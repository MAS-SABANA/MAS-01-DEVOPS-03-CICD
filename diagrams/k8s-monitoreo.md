# Kubernetes y Monitoreo — agents-arq

El stack de Kubernetes corre en Minikube y está dividido en dos namespaces: **default** para la aplicación y **monitoring** para el stack de observabilidad (Prometheus + Grafana). Esta separación sigue el principio de responsabilidad única a nivel de infraestructura: los pods de la app no saben nada de monitoreo; simplemente exponen `/metrics` y Prometheus los descubre automáticamente a través de las anotaciones del Deployment.

---

## Objetos Kubernetes (namespace: default)

El Deployment mantiene **2 réplicas** del pod `agents-arq`. El Service de tipo NodePort expone el puerto 30080 hacia el exterior y distribuye el tráfico entre ambos pods mediante round-robin. Un ConfigMap inyecta las variables de entorno (`NODE_ENV`, `PORT`, `VERSION`) para que la imagen Docker sea agnóstica al entorno.

```mermaid
graph LR
  USR(["🌐 Usuario\nexterno"])

  subgraph SVC_LAYER["Service Layer"]
    SVC["🔀 Service\nNodePort :30080\nagents-arq"]
  end

  subgraph DEPLOY["Deployment · replicas: 2"]
    direction TB
    CM["📋 ConfigMap\nagents-arq-config\nNODE_ENV · PORT · VERSION"]
    P1["🚀 Pod 1\nagents-arq:SHA"]
    P2["🚀 Pod 2\nagents-arq:SHA"]
    CM -->|"envFrom"| P1
    CM -->|"envFrom"| P2
  end

  DH[("🐳 Docker Hub\nagents-arq:SHA")]

  USR  -->|"HTTP :30080"| SVC
  SVC  -->|"round-robin"| P1
  SVC  -->|"round-robin"| P2
  DH   -->|"imagePull"| P1
  DH   -->|"imagePull"| P2
```

---

## Ciclo de vida del pod y probes

Kubernetes usa dos tipos de probes para decidir si un pod debe recibir tráfico o reiniciarse:

- **Readiness probe** (`GET /health/ready`, cada 10 s): determina si el pod está listo para recibir solicitudes. Si falla, el pod se retira silenciosamente del Service sin reiniciarse — útil durante arranque o sobrecarga temporal.
- **Liveness probe** (`GET /health`, cada 20 s): determina si el proceso sigue vivo. Si falla 3 veces seguidas, kubelet reinicia el contenedor.

Esta distinción evita que tráfico llegue a un pod que aún no terminó de inicializarse, y también evita reiniciar pods que simplemente están ocupados pero funcionales.

```mermaid
stateDiagram-v2
  [*]        --> Pending    : kubectl apply
  Pending    --> Init       : nodo asignado\nimagenPull OK
  Init       --> Running    : contenedor iniciado
  Running    --> NotReady   : readinessProbe falla\n(GET /health/ready)
  NotReady   --> Ready      : readinessProbe OK\npod recibe tráfico
  Ready      --> NotReady   : readinessProbe falla\nse retira del Service
  Ready      --> Restarting : livenessProbe falla\n(GET /health)
  Restarting --> Running    : kubelet reinicia
  Running    --> [*]        : kubectl delete\no falla fatal
```

---

## Stack de monitoreo (namespace: monitoring)

Prometheus descubre los pods de la aplicación automáticamente gracias a las anotaciones `prometheus.io/scrape: "true"` en el Deployment. Cada 10 segundos hace scrape del endpoint `/metrics` de cada pod y almacena las series temporales. Grafana consume Prometheus como datasource y carga el dashboard `agents-arq-main` que fue provisionado automáticamente desde un ConfigMap — sin necesidad de configuración manual al arrancar.

Las reglas de alerta están definidas en `prometheus-config.yaml` y evalúan condiciones sobre las métricas en tiempo real:

| Alerta | Condición | Umbral |
|--------|-----------|--------|
| `HighErrorRate` | Tasa de errores 5xx | > 10% por 2 min |
| `HighResponseTime` | Latencia P95 | > 1 s por 5 min |
| `PodDown` | Pod sin responder | `up == 0` por 1 min |

```mermaid
graph LR
  subgraph APP_NS["namespace: default"]
    direction TB
    POD["🚀 agents-arq\nPod"]
    MET["/metrics\nprom-client"]
    POD -->|"expone"| MET
  end

  subgraph MON_NS["namespace: monitoring"]
    direction TB
    PROM["📈 Prometheus\n:9090 · NodePort :30090"]
    ALERTS["🚨 Alertas\nHighErrorRate\nHighLatency\nPodDown"]
    GRAF["📊 Grafana\n:3000 · NodePort :30030"]
    DASH["🗂️ Dashboard\nagents-arq-main\nauto-provisioned"]
    PROM -->|"evalúa reglas"| ALERTS
    PROM -->|"datasource"| GRAF
    GRAF -->|"carga"| DASH
  end

  MET    -->|"scrape cada 10s"| PROM
  DEVOPS(["👨‍💻 DevOps\nequipo"])
  DEVOPS -->|"visualiza"| GRAF
  DEVOPS -->|"recibe alerta"| ALERTS
```

---

## Métricas expuestas y su mapeo a paneles de Grafana

La aplicación instrumenta tres métricas propias con `prom-client` y además recolecta automáticamente las métricas de proceso de Node.js. Cada métrica alimenta directamente uno o más paneles del dashboard:

- `http_requests_total` es un **Counter** que se incrementa en cada request. Con `rate()[1m]` se obtiene el throughput actual y filtrando por `status_code=~"5.."` se calcula la tasa de errores.
- `http_request_duration_seconds` es un **Histogram** que registra la distribución de latencias. `histogram_quantile(0.95, ...)` da el P95 que aparece en el panel de latencia.
- `active_agents_total` es un **Gauge** que sube/baja según cuántos agentes hay en memoria. Se representa directamente como valor instantáneo.

```mermaid
graph TB
  subgraph APP["agents-arq · prom-client"]
    direction LR
    M1["🔢 http_requests_total\nCounter · method/route/status"]
    M2["⏱️ http_request_duration_seconds\nHistogram · P50·P95·P99"]
    M3["📊 active_agents_total\nGauge · agentes activos"]
    M4["🖥️ process_cpu_seconds_total\nDefault metric · Node.js"]
    M5["💾 process_resident_memory_bytes\nDefault metric · Node.js"]
  end

  subgraph GRAFANA["Grafana · panels"]
    direction LR
    G1["Requests/seg"]
    G2["Latencia P95"]
    G3["Tasa errores 5xx"]
    G4["Agentes activos"]
    G5["CPU usage"]
    G6["Memoria RSS (MB)"]
  end

  M1 -->|"rate()[1m]"| G1
  M1 -->|"filtro 5xx"| G3
  M2 -->|"quantile(0.95)"| G2
  M3 -->|"valor directo"| G4
  M4 -->|"rate()[1m]"| G5
  M5 -->|"/ 1024 / 1024"| G6
```
