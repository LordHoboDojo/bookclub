output "app_url" {
  description = "Public HTTPS URL of the app."
  value       = local.app_url
}

output "google_oauth_redirect_uri" {
  description = "Add this as an Authorized redirect URI on your Google OAuth client."
  value       = "${local.app_url}/auth/google/callback"
}

output "aws_region" {
  value = var.aws_region
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service" {
  value = aws_ecs_service.app.name
}

output "docdb_endpoint" {
  value = aws_docdb_cluster.main.endpoint
}

output "log_group" {
  value = aws_cloudwatch_log_group.app.name
}
