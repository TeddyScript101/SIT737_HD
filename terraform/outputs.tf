output "bucket_name" {
  description = "GCS bucket name to set as GCS_BUCKET_NAME env var in diary-deployment.yaml"
  value       = google_storage_bucket.diary_uploads.name
}

output "sa_email" {
  description = "Service Account email"
  value       = google_service_account.diary_app_sa.email
}

output "sa_key_json" {
  description = "Service Account JSON key — pipe this into kubectl to create the K8s Secret"
  value       = base64decode(google_service_account_key.diary_app_sa_key.private_key)
  sensitive   = true
}
