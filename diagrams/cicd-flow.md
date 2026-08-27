# Flujo CI/CD — agents-arq

Los dos pipelines tienen responsabilidades completamente separadas:
el **CI** valida la calidad y publica la imagen; el **CD** solo la despliega.

---

## Pipeline CI — GitHub Actions

Se activa en cada `push` a `feature/**` y en PRs hacia `main`.
Los 4 jobs corren en secuencia; cualquier fallo detiene los siguientes.

```mermaid
flowchart TD
  TRIGGER(["⚡ Trigger\npush feature/** · PR → main"])

  subgraph JOB1["Job 1 · Quality Gate"]
    direction TB
    J1A["📥 Checkout"]
    J1B["📦 npm ci"]
    J1C["🔷 TypeCheck\ntsc --noEmit"]
    J1D["🔍 ESLint\nnpm run lint"]
    J1E["🧪 Tests + cobertura\njest --coverage"]
    J1F["🏗️ Build\nnpm run build"]
    J1A --> J1B --> J1C --> J1D --> J1E --> J1F
  end

  subgraph JOB2["Job 2 · SonarQube (necesita Job 1)"]
    direction TB
    J2A["📥 Checkout + bajar lcov"]
    J2B["🔍 sonarqube-scan-action"]
    J2C{"🚦 Quality Gate\n¿pasa?"}
    J2A --> J2B --> J2C
  end

  subgraph JOB3["Job 3 · Snyk (necesita Job 1)"]
    direction TB
    J3A["📥 Checkout + npm ci"]
    J3B["🛡️ snyk test\n--severity-threshold=high"]
    J3C["📤 Upload SARIF\nGitHub Security"]
    J3A --> J3B --> J3C
  end

  subgraph JOB4["Job 4 · Docker (solo merge a main)"]
    direction TB
    J4A["🐳 docker buildx"]
    J4B["🔑 login Docker Hub"]
    J4C["🏷️ tag :SHA + :latest"]
    J4D["🚀 docker push"]
    J4A --> J4B --> J4C --> J4D
  end

  OK(["✅ Imagen publicada\nDocker Hub"])
  FAIL(["❌ Pipeline detenido"])

  TRIGGER --> JOB1
  JOB1    -->|"artifacts OK"| JOB2
  JOB1    -->|"artifacts OK"| JOB3
  JOB2    -->|"gate ✅"| JOB4
  JOB3    -->|"sin CVEs altos ✅"| JOB4
  JOB4    -->|"push OK"| OK
  JOB1    -.->|"falla"| FAIL
  JOB2    -.->|"gate rojo"| FAIL
  JOB3    -.->|"CVE alto"| FAIL
```

---

## Pipeline CD — Jenkins

Se activa por webhook al detectar merge a `main`.
**No repite pasos de CI** — simplemente toma la imagen ya publicada y la lleva al cluster.

```mermaid
flowchart TD
  WEBHOOK(["⚡ Webhook\nmerge a main"])

  subgraph S1["Stage 1 · Checkout"]
    C1["📥 git clone\n(solo para obtener GIT_COMMIT)"]
  end

  subgraph S2["Stage 2 · Deploy a K8s"]
    direction TB
    D1["☸️ kubectl set image\nagents-arq:SHA"]
    D2["⏳ kubectl rollout status\ntimeout 120s"]
    D1 --> D2
  end

  subgraph S3["Stage 3 · Smoke Test"]
    direction TB
    SM1["🩺 curl GET /health"]
    SM2{"200 OK?"}
    SM1 --> SM2
  end

  OK(["✅ Deploy exitoso\nagents-arq:SHA activo"])
  FAIL(["❌ K8s mantiene\nversión anterior"])

  WEBHOOK --> S1 --> S2 --> S3
  SM2     -->|"sí"| OK
  SM2     -.->|"no"| FAIL
  D2      -.->|"timeout"| FAIL
```
