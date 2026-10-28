variable "project" {
  description = "Name prefix for every resource."
  type        = string
  default     = "bookclub"
}

variable "aws_region" {
  description = "Region for all resources. Pick one where Claude in Amazon Bedrock and SES are available."
  type        = string
  default     = "us-east-1"
}

variable "image_tag" {
  description = "Tag of the app image in ECR to run (scripts/deploy.sh sets this)."
  type        = string
  default     = "latest"
}

# ---- Auth ----------------------------------------------------------------------------------

variable "google_client_id" {
  description = "Google OAuth client ID."
  type        = string
}

variable "google_client_secret" {
  description = "Google OAuth client secret (stored in Secrets Manager)."
  type        = string
  sensitive   = true
}

# ---- AI ------------------------------------------------------------------------------------

variable "llm_provider" {
  description = "bedrock (IAM via the task role), aws (Claude Platform on AWS), anthropic (API key), or none."
  type        = string
  default     = "bedrock"

  validation {
    condition     = contains(["bedrock", "aws", "anthropic", "none"], var.llm_provider)
    error_message = "llm_provider must be bedrock, aws, anthropic or none."
  }
}

variable "llm_model" {
  description = "Override the model ID. Empty = app default (anthropic.claude-opus-5-5 on Bedrock)."
  type        = string
  default     = ""
}

variable "anthropic_api_key" {
  description = "Only for llm_provider = anthropic."
  type        = string
  default     = ""
  sensitive   = true
}

variable "anthropic_aws_workspace_id" {
  description = "Only for llm_provider = aws (Claude Platform on AWS workspace)."
  type        = string
  default     = ""
}

variable "embedding_provider" {
  description = "bedrock (Amazon Titan Text Embeddings v2) or local (MiniLM inside the container)."
  type        = string
  default     = "bedrock"

  validation {
    condition     = contains(["bedrock", "local"], var.embedding_provider)
    error_message = "embedding_provider must be bedrock or local."
  }
}

# ---- Email ---------------------------------------------------------------------------------

variable "ses_from_email" {
  description = "Sender address for invites. SES emails a verification link to it on first apply."
  type        = string
}

# ---- Sizing --------------------------------------------------------------------------------

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}

variable "task_cpu" {
  type    = number
  default = 1024
}

variable "task_memory" {
  type    = number
  default = 2048
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "cpu_architecture" {
  description = "ARM64 (Graviton, cheaper; matches Apple Silicon builds) or X86_64."
  type        = string
  default     = "ARM64"
}

variable "docdb_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "docdb_instance_count" {
  type    = number
  default = 1
}

variable "docdb_deletion_protection" {
  type    = bool
  default = false
}

# ---- Optional custom domain ------------------------------------------------------------------

variable "domain_aliases" {
  description = "Custom hostnames for CloudFront, e.g. [\"club.example.com\"]. Empty = use the cloudfront.net domain."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate in us-east-1 covering domain_aliases."
  type        = string
  default     = ""
}
