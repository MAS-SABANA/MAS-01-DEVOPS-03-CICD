# Jenkins CD — agents-arq

Jenkins **vanilla** en docker-compose para ejecutar el [`Jenkinsfile`](../Jenkinsfile).
Solo aporta la infraestructura; **plugins, credenciales y jobs se configuran a mano
desde la UI** (asistente de setup incluido).

La imagen custom agrega únicamente dos CLIs que el pipeline necesita y no se
pueden instalar desde la UI: **`docker`** (habla con el daemon del host) y
**`kubectl`**.

## Contenido

| Archivo | Rol |
|---|---|
| `Dockerfile` | Jenkins LTS (jdk21) + CLI de Docker + `kubectl` |
| `docker-compose.yml` | Servicio `jenkins`, volumen persistente, socket de Docker montado |
| `.env` | *(opcional)* overrides de puertos / `DOCKER_GID` |

## Acceso a Docker

El contenedor monta `/var/run/docker.sock` del host y trae el CLI de Docker,
para los stages `agent { docker { ... } }` del Jenkinsfile.

- **Docker Desktop (Windows/macOS):** `DOCKER_GID=0` (por defecto).
- **Host Linux:** en `.env`, `DOCKER_GID=$(getent group docker | cut -d: -f3)`.

## Arranque

```bash
cd jenkins
docker compose build        # ~2-3 min (instala docker-cli + kubectl)
docker compose up -d

# Contraseña inicial del asistente:
docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Abrir <http://localhost:8090> y completar el asistente:

1. **Install suggested plugins** y además: `Docker Pipeline`, `SonarQube Scanner`,
   `HTML Publisher`, `JUnit`, `Credentials Binding` (los que pide el Jenkinsfile).
2. Crear el usuario admin.

```bash
docker compose logs -f jenkins
docker compose down          # detener (conserva jenkins_home)
docker compose down -v       # detener y borrar todo el estado
```

## Configuración manual (UI)

**Manage Jenkins → Credentials → System → Global:**

| ID | Tipo | Para |
|---|---|---|
| `dockerhub-credentials` | Username/password | build & push de la imagen |
| `sonar-token` | Secret text | análisis SonarQube |
| `snyk-token` | Secret text | escaneo Snyk |
| `kubeconfig-minikube` | Secret file | deploy a Kubernetes |

**Manage Jenkins → System → SonarQube servers:** agregar uno llamado
`sonarqube-server` con su URL y el `sonar-token`.

**Nuevo job:** *New Item → Pipeline* → *Pipeline script from SCM* → Git → URL del
repo → *Script Path* = `Jenkinsfile`. Webhook de GitHub hacia
`http://<host>:8090/github-webhook/` para disparo automático.

> `Jenkinsfile` referencia `DOCKERHUB_USERNAME` como variable de entorno del
> controller: definirla en **Manage Jenkins → System → Global properties →
> Environment variables**.
