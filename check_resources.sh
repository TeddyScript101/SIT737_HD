#!/bin/bash
PROJECT="sit737-26t1-teddy-yee-0f58209"
REGION="australia-southeast2"

echo "=== GKE Clusters ==="
gcloud container clusters list --project=$PROJECT 2>/dev/null || echo "none"

echo ""
echo "=== GCS Buckets ==="
gsutil ls -p $PROJECT 2>/dev/null || echo "none"

echo ""
echo "=== Kubernetes Pods (if cluster exists) ==="
gcloud container clusters list --project=$PROJECT --format="value(name,location)" 2>/dev/null | while read name location; do
  gcloud container clusters get-credentials $name --region=$location --project=$PROJECT 2>/dev/null
  kubectl get pods --all-namespaces 2>/dev/null
done

echo ""
echo "=== Cloud Build Triggers ==="
gcloud builds triggers list --region=$REGION --project=$PROJECT 2>/dev/null || echo "none"

echo ""
echo "=== Service Accounts (non-default) ==="
gcloud iam service-accounts list --project=$PROJECT \
  --filter="NOT email~compute AND NOT email~appspot" 2>/dev/null || echo "none"

echo ""
echo "=== Done ==="
