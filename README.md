# agents-arq — Pipeline CI/CD con Seguridad y Monitoreo

> **Repositorio:** [https://github.com/MAS-SABANA/MAS-01-DEVOPS-03-CICD](https://github.com/MAS-SABANA/MAS-01-DEVOPS-03-CICD)

**Integrantes:**

| Nombre | Correo |
|--------|--------|
| Santiago López Amaya | [santiagoloam@unisabana.edu.co](mailto:santiagoloam@unisabana.edu.co) |
| Jeisson Alejandro Fuquene Buitrago | [jeissonfubu@unisabana.edu.co](mailto:jeissonfubu@unisabana.edu.co) |

**Curso:** Fundamentos de DevOps — Universidad de La Sabana · Unidad 3

---

## Stack tecnológico

| Capa | Herramienta |
|------|-------------|
| Aplicación | TypeScript + Express |
| CI | GitHub Actions |
| CD | Jenkins |
| Análisis de código | SonarQube |
| Seguridad de dependencias | Snyk |
| Métricas | Prometheus + prom-client |
| Dashboards | Grafana |
| Contenedores | Docker (multi-stage) |
| Orquestación | Kubernetes (Minikube) |

---

## Diagramas

Los diagramas están en la carpeta [`diagrams/`](diagrams/) e ilustran cada capa del sistema:

| Diagrama | Descripción |
|----------|-------------|
| [Arquitectura general](diagrams/arquitectura.md) | Vista de alto nivel: developer → GitHub → CI/CD → K8s + monitoreo |
| [Flujo CI/CD](diagrams/cicd-flow.md) | Jobs de GitHub Actions y stages de Jenkins detallados |
| [K8s y monitoreo](diagrams/k8s-monitoreo.md) | Objetos Kubernetes, probes y stack Prometheus + Grafana |
| [Secuencia de despliegue](diagrams/secuencia-deploy.md) | Interacción entre actores en el ciclo completo de deploy |

---

## Inicio rápido

```bash
# Instalar dependencias
npm ci

# Validar calidad
npm run typecheck && npm run lint && npm run test

# Build de producción
npm run build

# Levantar con Docker
docker build -t agents-arq:local .
docker run -p 3000:3000 agents-arq:local

# Verificar
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| GET | `/metrics` | Métricas Prometheus |
| GET | `/agents` | Lista todos los agentes |
| GET | `/agents/:id` | Agente por ID |
| POST | `/agents` | Crear nuevo agente |

---

## Estructura del repositorio

```
agents-arq/
├── .github/workflows/ci.yml     # Pipeline CI — GitHub Actions
├── src/
│   ├── index.ts                 # Entry point
│   ├── metrics.ts               # Métricas Prometheus
│   ├── routes/health.ts         # Liveness + readiness
│   ├── routes/agents.ts         # CRUD de agentes
│   └── __tests__/               # Tests con Supertest
├── k8s/
│   ├── deployment.yaml          # Deployment + probes + security context
│   ├── service.yaml             # Service NodePort
│   ├── configmap.yaml
│   └── monitoring/              # Prometheus + Grafana
├── diagrams/                    # Diagramas Mermaid del sistema
├── docs/informe-tecnico.md      # Documento técnico del laboratorio
├── Dockerfile                   # Multi-stage (build → runtime mínimo)
├── Jenkinsfile                  # Pipeline CD — Jenkins declarativo
├── sonar-project.properties     # Configuración SonarQube
└── package.json
```

---

## Documentación técnica

Ver [`docs/informe-tecnico.md`](docs/informe-tecnico.md) para la descripción completa del flujo CI/CD, herramientas utilizadas, evidencias de seguridad y monitoreo, y reflexión sobre eficiencia operativa.
