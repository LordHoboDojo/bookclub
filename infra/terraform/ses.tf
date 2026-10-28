# SES sends invite emails. New accounts start in the SES sandbox: until you request production
# access, invites only reach verified addresses.
resource "aws_sesv2_email_identity" "from" {
  email_identity = var.ses_from_email
}
