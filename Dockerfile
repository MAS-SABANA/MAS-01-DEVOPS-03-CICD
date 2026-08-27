# ─────────────────────────────────────────────────────────────────────────────
# STAGE 1: Build
# Compila TypeScript → JavaScript en un entorno completo de Node
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos de dependencias primero (aprovecha caché de Docker)
COPY package*.json tsconfig.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para compilar)
RUN npm ci

# Copiar código fuente
COPY src/ ./src/

# Compilar TypeScript
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2: Runtime
# Imagen final mínima — sin devDependencies, sin código fuente TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Metadatos OCI
LABEL org.opencontainers.image.title="agents-arq" \
      org.opencontainers.image.description="API REST de arquitectura de agentes — Unisabana DevOps" \
      org.opencontainers.image.source="https://github.com/MAS-SABANA/MAS-01-DEVOPS-03-CICD"

WORKDIR /app

# Copiar solo los artefactos necesarios desde la etapa de build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist/

# Instalar ÚNICAMENTE dependencias de producción
RUN npm ci --omit=dev && \
    npm cache clean --force

# Argumento de build para versión (inyectado por el pipeline)
ARG APP_VERSION=local
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
ENV PORT=3000

# Crear usuario no-root para seguridad
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

# Health check nativo de Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
