#!/bin/bash
set -e

CLUSTER="diary-cluster"
REGION="australia-southeast2"
NAMESPACE="diary-app"
PROJECT=$(gcloud config get-value project)

echo "Pulling latest changes..."
git pull

echo "Connecting to cluster..."
gcloud container clusters get-credentials $CLUSTER --region $REGION --project $PROJECT

echo "Applying manifests..."
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/mongodb-deployment.yaml  -n $NAMESPACE
kubectl apply -f kubernetes/auth-deployment.yaml     -n $NAMESPACE
kubectl apply -f kubernetes/diary-deployment.yaml    -n $NAMESPACE
kubectl apply -f kubernetes/frontend-deployment.yaml -n $NAMESPACE
kubectl apply -f kubernetes/ingress.yaml             -n $NAMESPACE

echo "Waiting for rollout..."
kubectl rollout status deployment/auth-service  -n $NAMESPACE --timeout=120s
kubectl rollout status deployment/diary-service -n $NAMESPACE --timeout=120s
kubectl rollout status deployment/frontend      -n $NAMESPACE --timeout=120s

echo "Done. Pod status:"
kubectl get pods -n $NAMESPACE
