#!/usr/bin/env bash
# Build the image, push it to ECR, and roll it out on ECS Fargate via Terraform.
#   ./scripts/deploy.sh            # tag = git sha or timestamp
#   ./scripts/deploy.sh v1.2.0     # explicit tag
set -euo pipefail

cd "$(dirname "$0")/.."
TF="terraform -chdir=infra/terraform"
TAG="${1:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"

$TF init -input=false >/dev/null

# First deploy: the ECS service needs an image to exist, so create the registry on its own first.
if ! REPO="$($TF output -raw ecr_repository_url 2>/dev/null)"; then
  echo "==> Creating the ECR repository"
  $TF apply -input=false -auto-approve -target=aws_ecr_repository.app
  REPO="$($TF output -raw ecr_repository_url)"
fi
REGION="$($TF output -raw aws_region 2>/dev/null || aws configure get region)"
PLATFORM="linux/$(grep -q 'X86_64' infra/terraform/terraform.tfvars 2>/dev/null && echo amd64 || echo arm64)"

echo "==> Logging in to ${REPO%%/*}"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${REPO%%/*}"

echo "==> Building $REPO:$TAG for $PLATFORM"
docker buildx build --platform "$PLATFORM" -t "$REPO:$TAG" --push .

echo "==> Applying infrastructure with image_tag=$TAG"
$TF apply -input=false -var "image_tag=$TAG"

echo
echo "App:                  $($TF output -raw app_url)"
echo "Google redirect URI:  $($TF output -raw google_oauth_redirect_uri)"
