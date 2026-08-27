# Laboratorio Técnico — Pipeline CI/CD con Seguridad y Monitoreo

**Repositorio:** [https://github.com/MAS-SABANA/MAS-01-DEVOPS-03-CICD](https://github.com/MAS-SABANA/MAS-01-DEVOPS-03-CICD)

**Integrante:** Santiago López Amaya  
**Curso:** Fundamentos de DevOps — Universidad de La Sabana  
**Unidad:** 3 — Ecosistema DevOps: Herramientas para CI/CD y monitoreo

---

## 1. Descripción del flujo CI/CD

El pipeline está diseñado bajo el modelo de una sola rama larga (`main`) con ramas de corta duración (`feature/*`). La calidad del código se valida en el Pull Request mediante el pipeline de CI, y el despliegue ocurre automáticamente después del merge a `main` mediante el pipeline de CD.

### 1.1 Pipeline de Integración Continua (GitHub Actions — `ci.yml`)

El workflow de CI se activa en dos eventos: cualquier push sobre ramas `feature/*` y cualquier Pull Request dirigido a `main`. Está compuesto por cuatro jobs que se ejecutan secuencialmente, asegurando que ningún artefacto defectuoso avance a etapas posteriores.

**Job 1 — Quality Gate** ejecuta los pasos de checkout, instalación de dependencias con `npm ci`, verificación de tipos con TypeScript (`tsc --noEmit`), análisis estático con ESLint, ejecución de tests con cobertura y, finalmente, la compilación de producción. Si alguno de estos pasos falla, los jobs siguientes no se ejecutan. Los reportes de cobertura y el artefacto de build se publican como artifacts de GitHub Actions para trazabilidad.

**Job 2 — SonarQube** consume el reporte de cobertura generado por el job anterior y ejecuta el análisis estático completo de la base de código. Utiliza la acción oficial `SonarSource/sonarqube-scan-action` y, al final, bloquea el pipeline si el Quality Gate configurado en el servidor SonarQube no se supera (`waitForQualityGate`). Esto garantiza que ningún código con deuda técnica crítica llega a producción.

**Job 3 — Snyk** realiza el escaneo de vulnerabilidades en las dependencias de npm. Se configura con `--severity-threshold=high`, lo que significa que solo falla el pipeline cuando se detecta una vulnerabilidad de severidad alta o crítica. Los resultados se exportan en formato SARIF y se cargan en el panel de seguridad de GitHub via `codeql-action/upload-sarif`.

**Job 4 — Docker Build & Push** se ejecuta únicamente cuando los tres jobs anteriores han pasado y el evento es un push directo a `main` (es decir, después del merge). Construye la imagen Docker multi-stage, la etiqueta con el SHA del commit y la etiqueta `latest`, y la publica en Docker Hub.

### 1.2 Pipeline de Entrega Continua (Jenkins — `Jenkinsfile`)

El pipeline de CD es declarativo y se dispara mediante un webhook de GitHub cuando hay un push a `main`. Corre en un agente Docker basado en `node:20-alpine` para garantizar un entorno limpio y reproducible.

Los stages más relevantes son: primero la instalación de dependencias, luego la verificación de calidad en paralelo (TypeCheck y Lint), después los tests con publicación del reporte JUnit en la UI de Jenkins. A continuación se ejecuta el análisis SonarQube con verificación del Quality Gate, el escaneo Snyk con archivado del reporte JSON, la compilación TypeScript, el build y push de la imagen Docker, el despliegue al cluster K8s mediante `kubectl set image` y un smoke test final que valida que el endpoint `/health` responde correctamente después del despliegue.

La etapa de deploy utiliza `kubectl rollout status` con timeout de 120 segundos para detectar rollouts fallidos y activar automáticamente el rollback de Kubernetes.

---

## 2. Herramientas utilizadas y justificación

**GitHub Actions** fue elegido como motor de CI por su integración nativa con GitHub, su ecosistema de acciones reutilizables y la facilidad para configurar workflows en YAML. Su capacidad de ejecutar jobs en paralelo reduce significativamente el tiempo de feedback al desarrollador.

**Jenkins** complementa el stack como motor de CD porque permite un control más granular del proceso de despliegue, integración con Kubernetes vía credenciales seguras y una UI rica para revisar el historial de pipelines. En entornos empresariales es común esta combinación: GitHub Actions para CI rápida y Jenkins para CD orquestado.

**SonarQube** centraliza el análisis de calidad del código y la deuda técnica. Su Quality Gate actúa como guardián automático: si la cobertura de tests cae por debajo del umbral o aparecen bugs bloqueantes, el pipeline se detiene. Esto hace explícito un estándar de calidad que de otro modo quedaría implícito o ignorado.

**Snyk** se especializa en vulnerabilidades de la cadena de suministro (dependencias de npm). A diferencia de SonarQube que analiza el código propio, Snyk monitorea si una librería de tercero tiene un CVE conocido. La integración con el panel de seguridad de GitHub via SARIF permite a los desarrolladores ver y remediar vulnerabilidades sin salir de la plataforma.

**Prometheus** recolecta métricas en formato text exposition format desde el endpoint `/metrics` de la aplicación, el cual es expuesto por la librería `prom-client`. Las métricas incluyen: contador de requests HTTP por método/ruta/código de estado, histograma de duración de requests (P50, P95, P99), gauge de agentes activos y métricas del runtime Node.js (CPU, memoria, event loop lag).

**Grafana** consume las métricas de Prometheus y las visualiza en un dashboard preconfigurado. El dashboard incluye paneles para requests por segundo, latencia P95, tasa de errores 5xx, agentes activos, uso de CPU y memoria RSS. Las alertas definidas en Prometheus notifican cuando la tasa de errores supera el 10% o la latencia P95 supera 1 segundo.

---

## 3. Evidencia de seguridad

### 3.1 SonarQube

La configuración en `sonar-project.properties` define el proyecto con análisis de TypeScript, cobertura de tests vía LCOV y exclusiones para node_modules y archivos de test. El Quality Gate está configurado para fallar si la cobertura cae por debajo del 80% o se introducen bugs de severidad mayor.

Los resultados del análisis incluyen las métricas de cobertura (objetivo: ≥ 80%), número de code smells, deuda técnica acumulada e issues de seguridad categorizados por severidad (blocker, critical, major, minor).

### 3.2 Snyk

El escaneo de dependencias se ejecuta en cada build. El archivo `.snyk` registra las excepciones aprobadas con justificación, garantizando trazabilidad de las decisiones de seguridad. El flag `--severity-threshold=high` permite que vulnerabilidades de severidad media no bloqueen el pipeline mientras se trabaja en actualizarlas, pero las altas y críticas sí lo hacen.

---

## 4. Configuración de monitoreo

El stack de monitoreo (Prometheus + Grafana) se despliega en el namespace `monitoring` del cluster K8s. Prometheus descubre automáticamente los pods de la aplicación mediante las anotaciones `prometheus.io/scrape: "true"` definidas en el Deployment, sin necesidad de configuración manual por cada nuevo pod.

El dashboard de Grafana se provisiona automáticamente mediante ConfigMaps, eliminando la configuración manual post-despliegue. Las alertas definidas en `alerts.yml` cubren los tres escenarios críticos: alta tasa de errores, latencia elevada y pod caído.

Para acceder al dashboard en minikube: `minikube service grafana -n monitoring --url` proporciona la URL directa. Las credenciales por defecto son `admin / devops2024` (deben rotarse en producción).

---

## 5. Reflexión sobre eficiencia operativa

La implementación de este pipeline CI/CD representa un salto cualitativo en la eficiencia operativa del equipo de desarrollo. Antes de esta automatización, la validación de calidad dependía de la disciplina individual de cada desarrollador; ahora, el pipeline actúa como árbitro imparcial que aplica los mismos estándares en cada commit.

El tiempo de feedback se reduce drásticamente: un desarrollador recibe en menos de 5 minutos la confirmación de que su código pasa typecheck, lint y tests, lo que permite correcciones tempranas cuando el contexto del cambio aún está fresco. La integración de seguridad desplaza las vulnerabilidades hacia la izquierda del ciclo (shift-left security): en lugar de descubrirlas en producción o en auditorías periódicas, se detectan en el Pull Request.

El monitoreo continuo con Prometheus y Grafana cierra el ciclo DevOps: el mismo equipo que desarrolla y despliega tiene visibilidad inmediata del comportamiento de la aplicación en producción. Las alertas configuradas convierten el monitoreo reactivo en proactivo, notificando problemas antes de que el usuario final los reporte.

Una área de mejora identificada es la ausencia de tests de integración contra una base de datos real y de tests de carga automatizados en el pipeline. Incorporar herramientas como k6 o Artillery en una etapa de performance testing post-deploy completaría el ciclo de calidad.

---

## 6. Estructura del repositorio

```
agents-arq/
├── .github/
│   └── workflows/
│       └── ci.yml              # Pipeline CI — GitHub Actions
├── src/
│   ├── index.ts                # Entry point de la aplicación
│   ├── metrics.ts              # Configuración de métricas Prometheus
│   ├── routes/
│   │   ├── health.ts           # Endpoints /health y /health/ready
│   │   └── agents.ts           # CRUD de agentes
│   └── __tests__/
│       ├── health.test.ts      # Tests del módulo health
│       └── agents.test.ts      # Tests del módulo agents
├── k8s/
│   ├── deployment.yaml         # Deployment K8s con probes y security context
│   ├── service.yaml            # Service NodePort para minikube
│   ├── configmap.yaml          # Variables de entorno
│   └── monitoring/
│       ├── prometheus-config.yaml  # Prometheus + alertas
│       └── grafana-deployment.yaml # Grafana + datasource + dashboard
├── docs/
│   └── informe-tecnico.md      # Este documento
├── Dockerfile                  # Multi-stage build (build → runtime mínimo)
├── Jenkinsfile                 # Pipeline CD — Jenkins declarativo
├── sonar-project.properties    # Configuración SonarQube
├── .snyk                       # Política de seguridad Snyk
├── .dockerignore
├── .gitignore
├── jest.config.ts
├── tsconfig.json
├── .eslintrc.json
└── package.json
```

---

## 7. Verificación rápida

```bash
# 1. Clonar e instalar
git clone https://github.com/MAS-SABANA/MAS-01-DEVOPS-03-CICD && cd MAS-01-DEVOPS-03-CICD
npm ci

# 2. Validar calidad
npm run typecheck && npm run lint && npm run test

# 3. Build de producción
npm run build

# 4. Levantar con Docker
docker build -t agents-arq:local .
docker run -p 3000:3000 agents-arq:local

# 5. Verificar health
curl http://localhost:3000/health

# 6. Ver métricas Prometheus
curl http://localhost:3000/metrics

# 7. Desplegar en minikube
kubectl apply -f k8s/
kubectl apply -f k8s/monitoring/
minikube service agents-arq --url
```
