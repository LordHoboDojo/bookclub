# CloudFront gives the app HTTPS on *.cloudfront.net without owning a domain, which Google OAuth
# requires for redirect URIs. Nothing is cached: every request goes to the ALB.

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# Forwards cookies, query strings, and CloudFront-Forwarded-Proto (the app trusts it for HTTPS).
data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewerAndCloudFrontHeaders-2022-06"
}

resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  comment         = "${local.name} app"
  price_class     = "PriceClass_100"
  aliases         = var.domain_aliases
  is_ipv6_enabled = true

  origin {
    origin_id   = "alb"
    domain_name = aws_lb.app.dns_name

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
    }
  }

  default_cache_behavior {
    target_origin_id         = "alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
    compress                 = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = length(var.domain_aliases) == 0
    acm_certificate_arn            = length(var.domain_aliases) > 0 ? var.acm_certificate_arn : null
    ssl_support_method             = length(var.domain_aliases) > 0 ? "sni-only" : null
    minimum_protocol_version       = length(var.domain_aliases) > 0 ? "TLSv1.2_2021" : null
  }
}
