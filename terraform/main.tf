terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ── GCS bucket for diary image uploads ───────────────────────────────────────
resource "google_storage_bucket" "diary_uploads" {
  name                        = var.bucket_name
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

# ── Service Account for diary-service ────────────────────────────────────────
resource "google_service_account" "diary_app_sa" {
  account_id   = "diary-app-sa-2"
  display_name = "Diary App GCS Access"
}

# SA can read, write, and delete objects in the bucket
resource "google_storage_bucket_iam_member" "sa_object_admin" {
  bucket = google_storage_bucket.diary_uploads.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.diary_app_sa.email}"
}

# SA JSON key — used by diary-service inside Kubernetes
resource "google_service_account_key" "diary_app_sa_key" {
  service_account_id = google_service_account.diary_app_sa.name
}

# ── GKE Cluster ──────────────────────────────────────────────────────────────
resource "google_container_cluster" "diary_cluster" {
  name           = "diary-cluster"
  location       = var.region
  node_locations = ["${var.region}-a"]
  project        = var.project_id
  network    = "my-vpc"
  subnetwork = "my-vpc" 

  remove_default_node_pool = false
  initial_node_count       = 1
  deletion_protection      = false

  node_config {
    machine_type = "e2-medium"
    disk_size_gb = 30
  }
}
