# SSM Parameters for environment variables
# These should be created manually or via a separate script with actual values

resource "aws_ssm_parameter" "supabase_url" {
  name        = "/${var.project_name}/${var.environment}/NEXT_PUBLIC_SUPABASE_URL"
  description = "Supabase URL for main database"
  type        = "String"
  value       = "CHANGE_ME"  # Replace with actual value

  tags = {
    Name = "${var.project_name}-${var.environment}-supabase-url"
  }
}

resource "aws_ssm_parameter" "supabase_anon_key" {
  name        = "/${var.project_name}/${var.environment}/NEXT_PUBLIC_SUPABASE_ANON_KEY"
  description = "Supabase anon key"
  type        = "SecureString"
  value       = "CHANGE_ME"  # Replace with actual value

  tags = {
    Name = "${var.project_name}-${var.environment}-supabase-anon-key"
  }
}

resource "aws_ssm_parameter" "supabase_service_role_key" {
  name        = "/${var.project_name}/${var.environment}/SUPABASE_SERVICE_ROLE_KEY"
  description = "Supabase service role key"
  type        = "SecureString"
  value       = "CHANGE_ME"  # Replace with actual value

  tags = {
    Name = "${var.project_name}-${var.environment}-supabase-service-role-key"
  }
}

resource "aws_ssm_parameter" "telemetry_supabase_url" {
  name        = "/${var.project_name}/${var.environment}/TELEMETRY_SUPABASE_URL"
  description = "Supabase URL for telemetry database"
  type        = "String"
  value       = "CHANGE_ME"  # Replace with actual value

  tags = {
    Name = "${var.project_name}-${var.environment}-telemetry-supabase-url"
  }
}

resource "aws_ssm_parameter" "telemetry_supabase_anon_key" {
  name        = "/${var.project_name}/${var.environment}/TELEMETRY_SUPABASE_ANON_KEY"
  description = "Telemetry Supabase anon key"
  type        = "SecureString"
  value       = "CHANGE_ME"  # Replace with actual value

  tags = {
    Name = "${var.project_name}-${var.environment}-telemetry-supabase-anon-key"
  }
}

resource "aws_ssm_parameter" "telemetry_supabase_service_role_key" {
  name        = "/${var.project_name}/${var.environment}/TELEMETRY_SUPABASE_SERVICE_ROLE_KEY"
  description = "Telemetry Supabase service role key"
  type        = "SecureString"
  value       = "CHANGE_ME"  # Replace with actual value

  tags = {
    Name = "${var.project_name}-${var.environment}-telemetry-supabase-service-role-key"
  }
}

resource "aws_ssm_parameter" "cron_secret" {
  name        = "/${var.project_name}/${var.environment}/CRON_SECRET"
  description = "Secret for cron job authentication"
  type        = "SecureString"
  value       = "CHANGE_ME"  # Replace with actual value (generate a secure random string)

  tags = {
    Name = "${var.project_name}-${var.environment}-cron-secret"
  }
}

resource "aws_ssm_parameter" "new_relic_enabled" {
  name        = "/${var.project_name}/${var.environment}/NEW_RELIC_ENABLED"
  description = "Enable New Relic APM"
  type        = "String"
  value       = "false"  # Set to "true" if using New Relic

  tags = {
    Name = "${var.project_name}-${var.environment}-new-relic-enabled"
  }
}

resource "aws_ssm_parameter" "new_relic_license_key" {
  name        = "/${var.project_name}/${var.environment}/NEW_RELIC_LICENSE_KEY"
  description = "New Relic license key"
  type        = "SecureString"
  value       = "CHANGE_ME"  # Replace with actual value if using New Relic

  tags = {
    Name = "${var.project_name}-${var.environment}-new-relic-license-key"
  }
}

# Optional: Add more SSM parameters for vendor-specific API keys
# Example for INTELLO, TRACKSO, SCADA API base URLs
resource "aws_ssm_parameter" "intello_api_base_url" {
  name        = "/${var.project_name}/${var.environment}/INTELLO_API_BASE_URL"
  description = "Intello API base URL"
  type        = "String"
  value       = ""  # Set if using Intello

  tags = {
    Name = "${var.project_name}-${var.environment}-intello-api-base-url"
  }
}

resource "aws_ssm_parameter" "trackso_api_base_url" {
  name        = "/${var.project_name}/${var.environment}/TRACKSO_API_BASE_URL"
  description = "Trackso API base URL"
  type        = "String"
  value       = ""  # Set if using Trackso

  tags = {
    Name = "${var.project_name}-${var.environment}-trackso-api-base-url"
  }
}

resource "aws_ssm_parameter" "scada_api_base_url" {
  name        = "/${var.project_name}/${var.environment}/SCADA_API_BASE_URL"
  description = "SCADA API base URL"
  type        = "String"
  value       = ""  # Set if using SCADA

  tags = {
    Name = "${var.project_name}-${var.environment}-scada-api-base-url"
  }
}

