❯ gcloud container clusters create-auto demo-observability  --location=us-central1 --release-channel=regular
API [container.googleapis.com] not enabled on project [devop-505501]. Would you like to enable and retry (this will take a few minutes)? (y/N)?  y

Enabling service [container.googleapis.com] on project [devop-505501]...
Operation "operations/acf.p2-261835461000-505cd612-8834-4701-aaa5-397a6caef62d" finished successfully.
Creating cluster demo-observability in us-central1... Cluster is being health-checked (Kubernetes Control Plane is healthy)...done.                                                                                                                          
Created [https://container.googleapis.com/v1/projects/devop-505501/zones/us-central1/clusters/demo-observability].

kubectl apply -f k8s/gke-autopilot/namespace.yaml
kubectl apply -f k8s/gke-autopilot/app.yaml
kubectl apply -f k8s/gke-autopilot/prometheus.yaml
kubectl apply -f k8s/gke-autopilot/grafana.yaml