# Diary App — Cloud-Native Microservices

A diary web application built with a microservice architecture, containerised with Docker, and deployable to Google Kubernetes Engine (GKE).

## Architecture

```
Browser
  └── frontend (nginx:80)
        ├── /api/auth/*   → auth-service:3001  (JWT register/login)
        ├── /api/diary/*  → diary-service:3002 (entries + image upload)
        └── /uploads/*    → diary-service:3002 (served images)

Both backend services share a single MongoDB instance (separate collections).
Uploaded images are stored on a Kubernetes PersistentVolume (/uploads).
```

| Service | Port | Description |
|---|---|---|
| `auth-service` | 3001 | Register, login, issue JWT tokens |
| `diary-service` | 3002 | CRUD diary entries + image upload |
| `frontend` | 80 | React SPA + nginx reverse proxy |
| `mongodb` | 27017 | Single MongoDB instance |

---

## Local Development (Docker Compose)

**Prerequisites:** Docker + Docker Compose v2

```bash
cd diary-app
docker compose up --build
```

The app is available at **http://localhost**.

Auth and diary services are also exposed directly on ports `3001` and `3002` for development.

To run backend services without Docker (requires Node 20 and a local MongoDB):

```bash
# Terminal 1 — auth service
cd auth-service && npm install && npm run dev

# Terminal 2 — diary service
cd diary-service && npm install && npm run dev

# Terminal 3 — frontend dev server (proxies /api/* to localhost:3001/3002)
cd frontend && npm install && npm run dev
# Open http://localhost:5173
```

---

## Deploy to GKE

### 1. Prerequisites

- GCP project with billing enabled
- `gcloud` CLI authenticated (`gcloud auth login`)
- Docker configured for GCR (`gcloud auth configure-docker`)
- A GKE cluster created:

```bash
gcloud container clusters create diary-cluster \
  --region us-central1 \
  --num-nodes 2 \
  --machine-type e2-standard-2
```

### 2. Build and push images manually

```bash
export PROJECT_ID=$(gcloud config get-value project)

docker build -t gcr.io/$PROJECT_ID/auth-service:latest   ./auth-service
docker build -t gcr.io/$PROJECT_ID/diary-service:latest  ./diary-service
docker build -t gcr.io/$PROJECT_ID/diary-frontend:latest ./frontend

docker push gcr.io/$PROJECT_ID/auth-service:latest
docker push gcr.io/$PROJECT_ID/diary-service:latest
docker push gcr.io/$PROJECT_ID/diary-frontend:latest
```

### 3. Update image references in Kubernetes manifests

Replace `YOUR_PROJECT_ID` in the three deployment files:

```bash
sed -i "s/YOUR_PROJECT_ID/$PROJECT_ID/g" \
  kubernetes/auth-deployment.yaml \
  kubernetes/diary-deployment.yaml \
  kubernetes/frontend-deployment.yaml
```

### 4. Create the namespace and secret

```bash
kubectl apply -f kubernetes/namespace.yaml

kubectl create secret generic diary-secrets \
  --from-literal=jwt-secret='replace-with-a-strong-random-secret' \
  -n diary-app
```

### 5. Apply all manifests

```bash
kubectl apply -f kubernetes/
```

### 6. Get the external IP

```bash
kubectl get service frontend -n diary-app --watch
```

Once `EXTERNAL-IP` appears, open it in your browser.

---

## CI/CD with Cloud Build

Trigger a build (builds, pushes, and deploys all three images):

```bash
gcloud builds submit . \
  --config cloudbuild.yaml \
  --substitutions _CLUSTER=diary-cluster,_REGION=us-central1
```

To trigger automatically on every push, connect your repository in the Cloud Build console and point it at `cloudbuild.yaml`.

---

## API Reference

### Auth Service (`/api/auth/`)

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/register` | `{ username, email, password }` | Create account, returns JWT |
| `POST` | `/login` | `{ username, password }` | Login, returns JWT |
| `GET` | `/health` | | Health check |

### Diary Service (`/api/diary/`) — all routes require `Authorization: Bearer <token>`

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/entries` | | List all entries for the authenticated user |
| `POST` | `/entries` | `multipart/form-data: title, body, image?` | Create entry with optional image |
| `GET` | `/entries/:id` | | Get a single entry |
| `DELETE` | `/entries/:id` | | Delete entry and its image |
| `GET` | `/health` | | Health check |

---

## Notes

- **Image uploads:** The diary service stores images on a `ReadWriteOnce` PersistentVolume, so the diary-service Deployment runs with `replicas: 1`. To scale horizontally, migrate uploads to Google Cloud Storage and update the service to use the GCS client library.
- **JWT secret:** The same `JWT_SECRET` must be set in both auth-service and diary-service. In Kubernetes this is done via the shared `diary-secrets` Secret.
- **MongoDB:** A single Deployment is used for simplicity. For production, consider using MongoDB Atlas or a GKE StatefulSet with a replica set.

tigger1