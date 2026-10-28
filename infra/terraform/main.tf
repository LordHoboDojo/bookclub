data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = var.project
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)

  # Public URL of the app: custom domain if configured, otherwise CloudFront's HTTPS domain.
  app_host = length(var.domain_aliases) > 0 ? var.domain_aliases[0] : aws_cloudfront_distribution.app.domain_name
  app_url  = "https://${local.app_host}"

  # DocumentDB: TLS with the RDS CA bundle (baked into the image), users live in the admin DB,
  # and retryable writes are not supported.
  mongodb_uri = format(
    "mongodb://%s:%s@%s:27017/bookclub?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false&authSource=admin",
    aws_docdb_cluster.main.master_username,
    random_password.docdb.result,
    aws_docdb_cluster.main.endpoint,
  )
}
