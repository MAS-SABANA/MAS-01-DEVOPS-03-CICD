# Kubernetes y Monitoreo — agents-arq

Objetos K8s desplegados, ciclo de vida de un pod y stack de observabilidad.

---

## Objetos Kubernetes (namespace: default)

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

## Métricas expuestas por la aplicación

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
