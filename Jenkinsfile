// ─────────────────────────────────────────────────────────────────────────────
// Jenkinsfile — Pipeline CD para agents-arq
// Solo despliegue: toma la imagen ya publicada por el CI y la lleva a K8s.
// Se dispara por webhook de GitHub al detectar un merge a main.
// ─────────────────────────────────────────────────────────────────────────────
pipeline {
    agent any

    parameters {
        string(
            name: 'IMAGE_TAG',
            defaultValue: 'latest',
            description: 'Tag de la imagen agents-arq ya publicada por GitHub Actions (p.ej. sha-a28d2cf)'
        )
    }

    environment {
        APP_NAME    = 'agents-arq'
        IMAGE_REPO  = "${env.DOCKERHUB_USERNAME}/${APP_NAME}"
        IMAGE_TAG   = "${GIT_COMMIT[0..7]}"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 15, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
    }

    stages {
        // ─── Stage 1: Checkout ───────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                echo "🚀 Desplegando ${APP_NAME}:${IMAGE_TAG}"
            }
        }

        // ─── Stage 2: Deploy a Kubernetes ─────────────────────────────────────
        stage('Deploy a K8s') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-minikube', variable: 'KUBECONFIG')]) {
                    sh """
                        kubectl set image deployment/${APP_NAME} \
                          ${APP_NAME}=${IMAGE_REPO}:${IMAGE_TAG} \
                          --namespace=default

                        kubectl rollout status deployment/${APP_NAME} \
                          --namespace=default \
                          --timeout=120s
                    """
                }
            }
        }

        // ─── Stage 3: Smoke Test ──────────────────────────────────────────────
        stage('Smoke Test') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-minikube', variable: 'KUBECONFIG')]) {
                    sh """
                        SERVICE_IP=\$(kubectl get svc ${APP_NAME} \
                          -o jsonpath='{.spec.clusterIP}')

                        sleep 5
                        curl --fail http://\${SERVICE_IP}:3000/health || exit 1
                        echo "✅ /health responde correctamente"
                    """
                }
            }
        }
    }

    post {
        success {
            echo "✅ ${APP_NAME}:${IMAGE_TAG} desplegado exitosamente"
        }
        failure {
            echo "❌ Fallo en el despliegue — K8s mantiene la versión anterior"
        }
        always {
            cleanWs()
        }
    }
}
