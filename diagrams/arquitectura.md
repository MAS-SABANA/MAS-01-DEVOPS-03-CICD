# Arquitectura General — agents-arq

Vista de alto nivel de todos los componentes del sistema y cómo se interconectan.

---

## Sistema completo (developer → producción)

```mermaid
graph LR
  DEV(["👨‍💻 Developer"])
  GH(["📁 GitHub\nagents-arq"])

  subgraph CI["🔵 Integración Continua (GitHub Actions)"]
    direction TB
    QG["⚙️ Quality Gate\ntypecheck · lint · test · build"]
    SQ["🔍 SonarQube\nanálisis estático"]
    SNK["🛡️ Snyk\nvulnerabilidades"]
  end

  subgraph REGISTRY["🐳 Docker Hub"]
    IMG[("agents-arq\n:sha · :latest")]
  end

  subgraph CD["🟠 Entrega Continua (Jenkins)"]
    direction TB
    JB["⚙️ Build & Test"]
    JD["🚀 Deploy a K8s"]
    JSM["✅ Smoke Test"]
    JB -->|"ok"| JD
    JD -->|"kubectl rollout"| JSM
  end

  subgraph K8S["☸️ Kubernetes (Minikube)"]
    direction TB
    APP["🚀 agents-arq\nPod × 2"]
    SVC["🔀 Service\nNodePort :30080"]
    SVC -->|"enruta"| APP
  end

  subgraph MON["📊 Monitoreo (namespace: monitoring)"]
    direction TB
    PROM["📈 Prometheus\n:30090"]
    GRAF["📊 Grafana\n:30030"]
    PROM -->|"datasource"| GRAF
  end

  USR(["🌐 Usuario final"])

  DEV      -->|"git push"| GH
  GH       -->|"webhook CI"| CI
  QG       -->|"pasa"| SQ
  QG       -->|"pasa"| SNK
  SQ       -->|"quality gate OK"| REGISTRY
  SNK      -->|"sin CVEs altos"| REGISTRY
  GH       -->|"webhook CD\nmerge a main"| CD
  CD       -->|"pull imagen"| REGISTRY
  CD       -->|"deploy"| K8S
  APP      -->|"expone /metrics"| MON
  USR      -->|"HTTP"| SVC
```

---

## Modelo de seguridad en capas

```mermaid
graph TB
  subgraph SHIFT_LEFT["Shift-Left Security (antes del merge)"]
    direction LR
    L1["🔍 SonarQube\ncódigo fuente"]
    L2["🛡️ Snyk\ndependencias npm"]
    L3["📋 ESLint\nreglas estáticas"]
  end

  subgraph RUNTIME["Seguridad en runtime (K8s)"]
    direction LR
    R1["🔒 Usuario no-root\nUID 1000"]
    R2["🚫 readOnlyRootFilesystem"]
    R3["⬇️ capabilities: drop ALL"]
  end

  subgraph IMAGEN["Seguridad de imagen (Docker)"]
    direction LR
    D1["🐳 Multi-stage build\nsin devDependencies"]
    D2["📦 Alpine base\nsuperficie mínima"]
  end

  SHIFT_LEFT -->|"bloquea PR defectuoso"| IMAGEN
  IMAGEN     -->|"imagen firmada con SHA"| RUNTIME
```
