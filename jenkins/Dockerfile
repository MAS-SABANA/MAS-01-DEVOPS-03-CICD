# ─────────────────────────────────────────────────────────────────────────────
# Jenkins LTS + solo las CLIs que el pipeline necesita en el controller:
#   - docker (habla con el daemon del host vía socket montado)
#   - kubectl (deploy a Kubernetes)
# Todo lo demás (plugins, credenciales, jobs) se configura a mano desde la UI.
# ─────────────────────────────────────────────────────────────────────────────
ARG JENKINS_VERSION=lts-jdk21
FROM jenkins/jenkins:${JENKINS_VERSION}

# GID del grupo del host dueño de /var/run/docker.sock (ver .env / README).
ARG DOCKER_GID=0

USER root

# ─── Docker CLI (cliente solamente) ─────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
 && chmod a+r /etc/apt/keyrings/docker.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update && apt-get install -y --no-install-recommends \
        docker-ce-cli docker-buildx-plugin \
 && rm -rf /var/lib/apt/lists/*

# ─── kubectl ────────────────────────────────────────────────────────────────
RUN curl -fsSLo /usr/local/bin/kubectl \
      "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/$(dpkg --print-architecture)/kubectl" \
 && chmod +x /usr/local/bin/kubectl

# ─── Acceso al socket de Docker para el usuario jenkins ─────────────────────
# El mecanismo real es `group_add` en docker-compose.yml; esto es best-effort
# para que `docker` funcione también en un `docker exec` interactivo.
RUN groupadd -g "${DOCKER_GID}" docker 2>/dev/null || groupadd docker 2>/dev/null || true \
 && usermod -aG docker jenkins

USER jenkins
