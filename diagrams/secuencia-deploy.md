# Secuencia de Despliegue — agents-arq

Interacción entre actores en el ciclo completo: desde el commit hasta el tráfico en producción.

---

## Flujo CI completo (PR → merge)

```mermaid
sequenceDiagram
  actor Dev as 👨‍💻 Developer
  participant GH as 📁 GitHub
  participant GA as ⚙️ GitHub Actions
  participant SQ as 🔍 SonarQube
  participant SNK as 🛡️ Snyk
  participant DH as 🐳 Docker Hub

  Dev->>GH: git push feature/nueva-función
  GH->>GA: trigger workflow CI
  GA->>GA: typecheck · lint · test · build
  GA->>SQ: sonar-scanner (con lcov)
  SQ-->>GA: quality gate ✅
  GA->>SNK: snyk test --severity-threshold=high
  SNK-->>GA: sin CVEs altos ✅
  GA->>GH: status checks verdes
  Dev->>GH: abre Pull Request → main
  GH-->>Dev: PR lista para revisión
  Dev->>GH: merge PR
  GH->>GA: trigger job Docker
  GA->>DH: docker push :sha-abc123 + :latest
  DH-->>GA: imagen publicada ✅
  GA-->>Dev: pipeline CI completo ✅
```

---

## Flujo CD completo (merge → producción)

```mermaid
sequenceDiagram
  actor Dev as 👨‍💻 Developer
  participant GH as 📁 GitHub
  participant JK as 🟠 Jenkins
  participant DH as 🐳 Docker Hub
  participant K8S as ☸️ Kubernetes
  participant PROM as 📈 Prometheus

  GH->>JK: webhook: push a main
  JK->>JK: npm ci · typecheck · lint
  JK->>JK: jest --coverage (junit.xml)
  JK->>JK: sonar-scanner + waitForQualityGate
  JK->>JK: snyk test + snyk monitor
  JK->>JK: npm run build
  JK->>DH: docker build + push :sha-abc123
  DH-->>JK: imagen lista ✅
  JK->>K8S: kubectl set image agents-arq:sha-abc123
  K8S->>K8S: RollingUpdate (maxSurge:1, maxUnavailable:0)
  K8S->>K8S: readinessProbe GET /health/ready
  K8S-->>JK: rollout status: complete ✅
  JK->>K8S: curl GET /health (smoke test)
  K8S-->>JK: 200 OK · status: ok
  JK-->>Dev: ✅ Deploy completado — agents-arq:sha-abc123
  K8S->>PROM: expone /metrics cada 10s
  PROM->>PROM: evalúa alertas (HighErrorRate, HighLatency)
```

---

## Flujo de rollback automático

```mermaid
sequenceDiagram
  participant JK as 🟠 Jenkins
  participant K8S as ☸️ Kubernetes
  actor Dev as 👨‍💻 Developer

  JK->>K8S: kubectl set image agents-arq:sha-broken
  K8S->>K8S: RollingUpdate inicia
  K8S->>K8S: livenessProbe falla 3 veces
  K8S->>K8S: rollout timeout (120s)
  K8S-->>JK: ERROR: rollout no completado
  JK->>JK: stage falla · pipeline FAILURE
  Note over K8S: K8s mantiene la versión\nanterior (sha-abc123) activa
  JK-->>Dev: ❌ Notificación de falla
  Dev->>K8S: kubectl rollout history (diagnóstico)
```
