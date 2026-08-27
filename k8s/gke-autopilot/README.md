# Despliegue en GKE Autopilot — agents-arq + Prometheus + Grafana

Manifiestos pensados para un clúster **GKE Autopilot** (tú aprovisionas los 3 pods;
Autopilot gestiona los nodos). Exposición: **todo `ClusterIP` + `kubectl port-forward`**,
nada queda público.

## Contenido

| Archivo | Objetos |
|---|---|
| `namespace.yaml`  | Namespace `monitoring` |
| `app.yaml`        | ConfigMap + Deployment (1 réplica) + Service ClusterIP de `agents-arq` (ns `default`) |
| `prometheus.yaml` | ServiceAccount + ClusterRole + ClusterRoleBinding + ConfigMap (scrape + reglas) + Deployment + Service ClusterIP |
| `grafana.yaml`    | ConfigMaps (datasource, provider, dashboard) + Deployment + Service ClusterIP |

## Diferencias frente a `k8s/` (que es para minikube)

- `Service` pasa de `NodePort` a `ClusterIP` (en Autopilot los nodos no tienen IP externa).
- Prometheus lleva **RBAC propio** (SA + ClusterRole); sin esto el service discovery de pods falla por RBAC denegado.
- Config de Prometheus recortada: se elimina el job `kubernetes-nodes` (el kubelet no es scrapeable sin auth en Autopilot) y el SD de pods se limita a los namespaces `default` y `monitoring`.
- `resources.requests` = `resources.limits` en los 3 pods, con CPU en múltiplos de 250m y ratio memoria:CPU dentro de 1:1–6.5:1 (requisitos de Autopilot; si no se cumplen, Autopilot los redondea hacia arriba y pagas de más).
- `securityContext` ajustado al UID de cada imagen (app 1000, Prometheus 65534, Grafana 472) + `seccompProfile: RuntimeDefault`.
- Grafana sin override de credenciales: usa `admin` / `admin` y pide cambiar la contraseña en el primer login.

## Requisitos previos

```bash
gcloud config set project <TU_PROJECT_ID>

# Crear el clúster Autopilot (regional; ~5–7 min)
gcloud container clusters create-auto demo-observability \
  --location=us-central1 \
  --release-channel=regular

gcloud container clusters get-credentials demo-observability --location=us-central1
```

Antes de aplicar:

1. `app.yaml` trae el placeholder `__IMAGE__`. El pipeline de CD lo sustituye por
   `<repo>:<sha>`; para aplicar a mano hay que reemplazarlo (ver abajo).
2. Grafana no requiere cambios: primer login con `admin` / `admin` y define ahí la contraseña nueva.

## Aplicar (manual)

```bash
kubectl apply -f namespace.yaml
kubectl apply -f prometheus.yaml
kubectl apply -f grafana.yaml

# app.yaml lleva __IMAGE__ como placeholder del tag
sed 's#__IMAGE__#santilp951/agents-arq:latest#' app.yaml | kubectl apply -f -

# En Autopilot los pods tardan más en arrancar la 1ª vez (escala de nodos bajo demanda)
kubectl -n default    rollout status deploy/agents-arq
kubectl -n monitoring rollout status deploy/prometheus
kubectl -n monitoring rollout status deploy/grafana
```

## CD automatizado (Jenkins)

Reparto de responsabilidades:

- **CI → GitHub Actions** ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)): tests, calidad, análisis y build/push de la imagen a Docker Hub.
- **CD → Jenkins** ([Jenkinsfile](../../Jenkinsfile)): solo despliegue. Recibe el parámetro `IMAGE_TAG` (tag ya publicado por el CI), sustituye `__IMAGE__` en `app.yaml` con `sed` y aplica los 4 manifiestos contra el clúster.

GitHub Actions dispara el job de Jenkins pasando `IMAGE_TAG` (p.ej. `sha-a28d2cf`)
después de publicar la imagen — vía *Remote trigger* del job o `repository_dispatch`.

Credenciales que espera en Jenkins:

| ID | Tipo | Contenido |
|---|---|---|
| `gcp-sa-key` | Secret file | JSON de una Service Account de GCP con `roles/container.developer` |
| `gcp-project-id` | Secret text | ID del proyecto GCP |

Repo de imagen, clúster y región se fijan en el bloque `environment` del `Jenkinsfile`
(`IMAGE_REPO`, `GKE_CLUSTER`, `GKE_LOCATION`).

## Acceso (port-forward)

```bash
# App:        http://localhost:8080/agents  · /health · /metrics
kubectl -n default port-forward svc/agents-arq 8080:80

# Prometheus: http://localhost:9090   (Status > Targets para ver el scrape)
kubectl -n monitoring port-forward svc/prometheus 9090:9090

# Grafana:    http://localhost:3000   (login admin/admin; dashboard "agents-arq" ya provisionado)
kubectl -n monitoring port-forward svc/grafana 3000:3000
```

## Verificación

```bash
kubectl get pods -A -l 'app in (agents-arq,prometheus,grafana)'
kubectl -n default exec deploy/agents-arq -- wget -qO- localhost:3000/metrics | head
# En la UI de Prometheus: los targets 'agents-arq' y 'kubernetes-pods' deben salir UP
```

## Coste aproximado (us-central1, on-demand)

- Pods facturados: 750m vCPU + 2 GiB RAM → ~USD 30–35/mes.
- Cargo de gestión del clúster: ~USD 0.10/h (~USD 74/mes), **1 clúster gratis por cuenta de facturación**.
- Sin balanceadores → sin coste de red de entrada.

## Notas

- Almacenamiento en `emptyDir`: Prometheus y Grafana **pierden datos** al reiniciarse el pod.
  Para persistencia, cambia el volumen `storage` por un `PersistentVolumeClaim` con
  `storageClassName: standard-rwo` (y pon `strategy.type: Recreate`, ya incluido).
- Alertmanager no está desplegado; las reglas de `alerts.yml` solo generan la métrica
  `ALERTS` consultable en Prometheus.
