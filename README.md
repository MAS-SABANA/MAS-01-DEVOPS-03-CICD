# agents-arq — Pipeline CI/CD con Seguridad y Monitoreo

> **Repositorio:** [https://github.com/MAS-SABANA/MAS-01-DEVOPS-03-CICD](https://github.com/MAS-SABANA/MAS-01-DEVOPS-03-CICD)

**Integrante:** Santiago López Amaya  
**Curso:** Fundamentos de DevOps — Universidad de La Sabana · Unidad 3

---

## Stack tecnológico

| Capa | Herramienta |
|------|------------|
| Aplicación | TypeScript + Express |
| CI | GitHub Actions |
| CD | Jenkins |
| Análisis de código | SonarQube |
| Seguridad de dependencias | Snyk |
| Métricas | Prometheus + prom-client |
| Dashboards | Grafana |
| Contenedores | Docker (multi-stage) |
| Orquestación | Kubernetes (Minikube) |

## Inicio rápido

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
docker build -t agents-arq:local .
docker run -p 3000:3000 agents-arq:local
curl http://localhost:3000/health
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| GET | `/metrics` | Métricas Prometheus |
| GET | `/agents` | Lista agentes |
| GET | `/agents/:id` | Agente por ID |
| POST | `/agents` | Crear agente |

## Documentación técnica

Ver [`docs/informe-tecnico.md`](docs/informe-tecnico.md) para la descripción completa del flujo CI/CD, herramientas y reflexión operativa.
