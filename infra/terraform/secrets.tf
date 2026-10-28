resource "random_password" "session" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name_prefix             = "${local.name}/app-"
  description             = "Runtime secrets for the ${local.name} app"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    SESSION_SECRET       = random_password.session.result
    MONGODB_URI          = local.mongodb_uri
    GOOGLE_CLIENT_SECRET = var.google_client_secret
    ANTHROPIC_API_KEY    = var.anthropic_api_key
  })
}
