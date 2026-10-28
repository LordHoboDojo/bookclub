resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = 30
}

locals {
  secret_ref = aws_secretsmanager_secret.app.arn

  container_environment = concat(
    [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
      { name = "APP_URL", value = local.app_url },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "MONGODB_TLS_CA_FILE", value = "/etc/ssl/certs/rds-global-bundle.pem" },
      { name = "GOOGLE_CLIENT_ID", value = var.google_client_id },
      { name = "LLM_PROVIDER", value = var.llm_provider },
      { name = "EMBEDDING_PROVIDER", value = var.embedding_provider },
      { name = "MAIL_PROVIDER", value = "ses" },
      { name = "MAIL_FROM", value = "Bookclub <${var.ses_from_email}>" },
      { name = "SEED_CATALOG", value = "true" },
    ],
    var.llm_model != "" ? [{ name = "LLM_MODEL", value = var.llm_model }] : [],
    var.llm_provider == "aws" ? [{ name = "ANTHROPIC_AWS_WORKSPACE_ID", value = var.anthropic_aws_workspace_id }] : [],
  )

  container_secrets = concat(
    [
      { name = "SESSION_SECRET", valueFrom = "${local.secret_ref}:SESSION_SECRET::" },
      { name = "MONGODB_URI", valueFrom = "${local.secret_ref}:MONGODB_URI::" },
      { name = "GOOGLE_CLIENT_SECRET", valueFrom = "${local.secret_ref}:GOOGLE_CLIENT_SECRET::" },
    ],
    var.llm_provider == "anthropic" ? [{ name = "ANTHROPIC_API_KEY", valueFrom = "${local.secret_ref}:ANTHROPIC_API_KEY::" }] : [],
  )
}

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.cpu_architecture
  }

  container_definitions = jsonencode([{
    name         = "app"
    image        = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
    essential    = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment  = local.container_environment
    secrets      = local.container_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "app"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "curl -fsS http://localhost:3000/healthz || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }
  }])

  depends_on = [aws_secretsmanager_secret_version.app]
}

resource "aws_ecs_service" "app" {
  name                              = local.name
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.app.arn
  desired_count                     = var.desired_count
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.http, aws_docdb_cluster_instance.main]
}
