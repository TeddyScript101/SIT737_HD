variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for the bucket and resources"
  type        = string
  default     = "australia-southeast2"
}

variable "bucket_name" {
  description = "Name of the GCS bucket for diary image uploads (must be globally unique)"
  type        = string
}
