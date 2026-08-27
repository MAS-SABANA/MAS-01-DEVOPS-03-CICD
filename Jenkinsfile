// ─────────────────────────────────────────────────────────────────────────────
// Jenkinsfile — Pipeline de CD para agents-arq
//
// El CI (tests, calidad, análisis y build/push de la imagen) lo hace GitHub
// Actions. Este pipeline SOLO despliega en GKE Autopilot: fija el tag en el
// manifiesto y aplica k8s/gke-autopilot/ contra el clúster.
//
// Se dispara desde GitHub Actions (tras publicar la imagen) pasando IMAGE_TAG.
// ─────────────────────────────────────────────────────────────────────────────
pipeline {
    agent {
        docker {
            // Mirror en Docker Hub de gcr.io/google.com/cloudsdktool/google-cloud-cli
            // Incluye git + gcloud + kubectl + gke-gcloud-auth-plugin
            image 'google/cloud-sdk:latest'
            args '-u root'
        }
    }

    parameters {
        string(
            name: 'IMAGE_TAG',
            defaultValue: 'latest',
            description: 'Tag de la imagen agents-arq ya publicada por GitHub Actions (p.ej. sha-a28d2cf)'
        )
    }

    environment {
        APP_NAME     = 'agents-arq'
        // Ajusta al repositorio real de Docker Hub
        IMAGE_REPO   = 'santilp951/agents-arq'
        IMAGE_REF    = "santilp951/agents-arq:${params.IMAGE_TAG}"

        K8S_DIR      = 'k8s/gke-autopilot'
        GKE_CLUSTER  = 'demo-observability'
        GKE_LOCATION = 'us-central1'

        USE_GKE_GCLOUD_AUTH_PLUGIN    = 'True'
        CLOUDSDK_CORE_DISABLE_PROMPTS = '1'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 15, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
    }

    stages {
        // ─── Stage 1: Checkout ───────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                echo "CD de ${IMAGE_REF} → clúster ${GKE_CLUSTER} (${GKE_LOCATION})"
            }
        }

        // ─── Stage 2: Autenticar en GKE ──────────────────────────────────────
        stage('Autenticar en GKE') {
            steps {
                withCredentials([
                    file(credentialsId: 'gcp-sa-key', variable: 'GCP_SA_KEY'),
                    string(credentialsId: 'gcp-project-id', variable: 'GCP_PROJECT')
                ]) {
                    sh '''
                        set -eu
                        gcloud auth activate-service-account --key-file="$GCP_SA_KEY"
                        gcloud container clusters get-credentials "$GKE_CLUSTER" \
                          --location "$GKE_LOCATION" \
                          --project "$GCP_PROJECT"
                    '''
                }
            }
        }

        // ─── Stage 3: Deploy a GKE Autopilot ─────────────────────────────────
        stage('Deploy a GKE Autopilot') {
            steps {
                sh '''
                    set -eu

                    # Infra de monitoreo — idempotente, no depende del tag
                    kubectl apply -f "$K8S_DIR/namespace.yaml"
                    kubectl apply -f "$K8S_DIR/prometheus.yaml"
                    kubectl apply -f "$K8S_DIR/grafana.yaml"

                    # App — se sustituye el placeholder __IMAGE__ por el tag recibido
                    sed "s#__IMAGE__#${IMAGE_REF}#g" "$K8S_DIR/app.yaml" | kubectl apply -f -

                    kubectl -n default    rollout status deployment/"$APP_NAME" --timeout=180s
                    kubectl -n monitoring rollout status deployment/prometheus  --timeout=180s
                    kubectl -n monitoring rollout status deployment/grafana     --timeout=180s
                '''
            }
        }

        // ─── Stage 4: Smoke Test post-deploy ─────────────────────────────────
        stage('Smoke Test') {
            steps {
                sh '''
                    set -eu
                    kubectl -n default exec deploy/"$APP_NAME" -- wget -qO- http://localhost:3000/health
                    echo "OK: $IMAGE_REF desplegado y /health responde"
                '''
            }
        }
    }

    post {
        success {
            echo "✅ CD completado — ${IMAGE_REF} desplegado en ${GKE_CLUSTER}"
        }
        failure {
            echo "❌ CD fallido (${currentBuild.currentResult})"
        }
        always {
            cleanWs()
        }
    }
}
