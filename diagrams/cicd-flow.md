# Flujo CI/CD — agents-arq

Detalle de los dos pipelines: Integración Continua (GitHub Actions) y Entrega Continua (Jenkins).

---

## Pipeline CI — GitHub Actions

Se activa en cada `push` a `feature/**` y en cada Pull Request hacia `main`.  
Los 4 jobs se ejecutan en secuencia; un fallo detiene los siguientes.

```mermaid
flowchart TD
  TRIGGER(["⚡ Trigger\npush feature/** · PR → main"])

  subgraph JOB1["Job 1 · Quality Gate"]
    direction TB
    J1A["📥 Checkout\nfetch-depth: 0"]
    J1B["📦 npm ci\ninstalar dependencias"]
    J1C["🔷 TypeCheck\ntsc --noEmit"]
    J1D["🔍 ESLint\nnpm run lint"]
    J1E["🧪 Tests + cobertura\njest --coverage"]
    J1F["🏗️ Build producción\nnpm run build"]
    J1A --> J1B --> J1C --> J1D --> J1E --> J1F
  end

  subgraph JOB2["Job 2 · SonarQube (necesita Job 1)"]
    direction TB
    J2A["📥 Checkout"]
    J2B["📂 Descargar\nreporte cobertura"]
    J2C["🔍 sonarqube-scan-action\nanálisis completo"]
    J2D{"🚦 Quality Gate\n¿pasa?"}
    J2A --> J2B --> J2C --> J2D
  end

  subgraph JOB3["Job 3 · Snyk (necesita Job 1)"]
    direction TB
    J3A["📥 Checkout + npm ci"]
    J3B["🛡️ snyk test\n--severity-threshold=high"]
    J3C["📤 Upload SARIF\na GitHub Security"]
    J3A --> J3B --> J3C
  end

  subgraph JOB4["Job 4 · Docker (solo merge a main)"]
    direction TB
    J4A["🐳 docker buildx setup"]
    J4B["🔑 Login Docker Hub"]
    J4C["🏷️ Generar tags\n:sha · :latest"]
    J4D["🚀 Build & Push\nimagen multi-stage"]
    J4A --> J4B --> J4C --> J4D
  end

  OK(["✅ Imagen publicada\nen Docker Hub"])
  FAIL(["❌ Pipeline detenido"])

  TRIGGER --> JOB1
  JOB1    -->|"artefactos OK"| JOB2
  JOB1    -->|"artefactos OK"| JOB3
  JOB2    -->|"quality gate ✅"| JOB4
  JOB3    -->|"sin CVEs altos ✅"| JOB4
  JOB4    -->|"push exitoso"| OK
  JOB1    -.->|"falla"| FAIL
  JOB2    -.->|"falla quality gate"| FAIL
  JOB3    -.->|"CVE alto detectado"| FAIL
```

---

## Pipeline CD — Jenkins

Se activa mediante webhook de GitHub al detectar un push a `main` (post-merge).  
Corre en un agente Docker `node:20-alpine` limpio por cada ejecución.

```mermaid
flowchart TD
  WEBHOOK(["⚡ Webhook GitHub\npush a main"])

  subgraph PREP["Preparación"]
    direction LR
    S1["📥 Checkout\nscm"]
    S2["📦 npm ci"]
    S1 -->|"repo listo"| S2
  end

  subgraph CALIDAD["Calidad (paralelo)"]
    direction LR
    S3A["🔷 TypeCheck"]
    S3B["🔍 ESLint"]
  end

  subgraph TESTS["Tests"]
    direction TB
    S4["🧪 jest --coverage\njunit.xml"]
    S4R["📊 Publicar HTML\ncobertura en Jenkins"]
    S4 -->|"reporte"| S4R
  end

  subgraph SEGURIDAD["Seguridad"]
    direction TB
    S5["🔍 SonarQube\nnpx sonar-scanner"]
    S6{"🚦 Quality Gate\nwaitForQualityGate"}
    S7["🛡️ Snyk\nsnyk test + monitor"]
    S5 --> S6
  end

  subgraph BUILD_DEPLOY["Build & Deploy"]
    direction TB
    S8["🏗️ npm run build\ndist/"]
    S9["🐳 Docker build\n& push :SHA + :latest"]
    S10["☸️ kubectl set image\nrollout status 120s"]
    S11["🩺 Smoke Test\ncurl /health"]
    S8 --> S9 --> S10 --> S11
  end

  OK(["✅ Deploy completado\nagents-arq:SHA"])
  FAIL(["❌ Rollback automático\nK8s revierte al anterior"])

  WEBHOOK   --> PREP
  PREP      --> CALIDAD
  CALIDAD   -->|"ambos OK"| TESTS
  TESTS     --> SEGURIDAD
  S6        -->|"pasa"| S7
  S7        -->|"sin CVEs"| BUILD_DEPLOY
  S11       -->|"200 OK"| OK
  S6        -.->|"falla gate"| FAIL
  S10       -.->|"rollout timeout"| FAIL
  S11       -.->|"no responde"| FAIL
```
