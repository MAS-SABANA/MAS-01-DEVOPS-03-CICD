// ─────────────────────────────────────────────────────────────────────────────
// Jenkinsfile — Pipeline CD declarativo para agents-arq
// Ejecuta después del merge a main (disparado por webhook de GitHub)
// ─────────────────────────────────────────────────────────────────────────────
pipeline {
    agent {
        docker {
            image 'node:20-alpine'
            args '-u root'
        }
    }

    environment {
        APP_NAME        = 'agents-arq'
        IMAGE_REGISTRY  = 'docker.io'
        IMAGE_REPO      = "${DOCKERHUB_USERNAME}/${APP_NAME}"
        IMAGE_TAG       = "${GIT_COMMIT[0..7]}"
        KUBECONFIG_FILE = credentials('kubeconfig-minikube')
        DOCKERHUB_CRED  = credentials('dockerhub-credentials')
        SONAR_TOKEN     = credentials('sonar-token')
        SNYK_TOKEN      = credentials('snyk-token')
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
    }

    stages {
        // ─── Stage 1: Checkout ────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                echo "📦 Commit: ${GIT_COMMIT} | Branch: ${GIT_BRANCH}"
            }
        }

        // ─── Stage 2: Dependencias ────────────────────────────────────────────
        stage('Instalar dependencias') {
            steps {
                sh 'npm ci'
            }
        }

        // ─── Stage 3: Calidad de código ───────────────────────────────────────
        stage('Calidad de código') {
            parallel {
                stage('TypeCheck') {
                    steps {
                        sh 'npm run typecheck'
                    }
                }
                stage('Lint') {
                    steps {
                        sh 'npm run lint'
                    }
                }
            }
        }

        // ─── Stage 4: Tests ───────────────────────────────────────────────────
        stage('Tests') {
            environment {
                NODE_ENV = 'test'
            }
            steps {
                sh 'npm run test:ci'
                junit 'junit.xml'
                publishHTML(target: [
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'coverage',
                    reportFiles: 'index.html',
                    reportName: 'Cobertura de código'
                ])
            }
            post {
                always {
                    archiveArtifacts artifacts: 'coverage/**', fingerprint: true
                }
            }
        }

        // ─── Stage 5: Análisis SonarQube ──────────────────────────────────────
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('sonarqube-server') {
                    sh """
                        npx sonar-scanner \
                          -Dsonar.projectKey=${APP_NAME} \
                          -Dsonar.sources=src \
                          -Dsonar.exclusions=**/node_modules/**,**/__tests__/** \
                          -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                          -Dsonar.token=${SONAR_TOKEN}
                    """
                }
            }
        }

        // ─── Stage 6: Quality Gate SonarQube ──────────────────────────────────
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ─── Stage 7: Snyk Security Scan ──────────────────────────────────────
        stage('Snyk Security') {
            steps {
                sh """
                    npm install -g snyk
                    snyk auth ${SNYK_TOKEN}
                    snyk test --severity-threshold=high --json > snyk-report.json || true
                    snyk monitor
                """
                archiveArtifacts artifacts: 'snyk-report.json', fingerprint: true
            }
        }

        // ─── Stage 8: Build ───────────────────────────────────────────────────
        stage('Build') {
            steps {
                sh 'npm run build'
                archiveArtifacts artifacts: 'dist/**', fingerprint: true
            }
        }

        // ─── Stage 9: Docker Build & Push ─────────────────────────────────────
        stage('Docker Build & Push') {
            steps {
                script {
                    docker.withRegistry("https://${IMAGE_REGISTRY}", 'dockerhub-credentials') {
                        def image = docker.build(
                            "${IMAGE_REPO}:${IMAGE_TAG}",
                            "--build-arg APP_VERSION=${GIT_COMMIT} ."
                        )
                        image.push()
                        image.push('latest')
                    }
                }
            }
        }

        // ─── Stage 10: Deploy a Kubernetes (Minikube) ─────────────────────────
        stage('Deploy a K8s') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-minikube', variable: 'KUBECONFIG')]) {
                    sh """
                        # Actualizar la imagen en el deployment
                        kubectl set image deployment/${APP_NAME} \
                          ${APP_NAME}=${IMAGE_REPO}:${IMAGE_TAG} \
                          --namespace=default

                        # Verificar rollout
                        kubectl rollout status deployment/${APP_NAME} \
                          --namespace=default \
                          --timeout=120s
                    """
                }
            }
        }

        // ─── Stage 11: Smoke Test post-deploy ─────────────────────────────────
        stage('Smoke Test') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-minikube', variable: 'KUBECONFIG')]) {
                    sh """
                        # Obtener la URL del servicio en minikube
                        SERVICE_URL=\$(kubectl get svc ${APP_NAME} \
                          -o jsonpath='{.spec.clusterIP}:{.spec.ports[0].port}')

                        # Esperar a que el pod esté listo
                        sleep 10

                        # Verificar health endpoint
                        curl --fail http://\${SERVICE_URL}/health || exit 1
                        echo "✅ Smoke test superado — /health responde correctamente"
                    """
                }
            }
        }
    }

    // ─── Post-pipeline ────────────────────────────────────────────────────────
    post {
        success {
            echo "✅ Pipeline completado exitosamente — ${APP_NAME}:${IMAGE_TAG} desplegado"
        }
        failure {
            echo "❌ Pipeline fallido en stage: ${currentBuild.currentResult}"
        }
        always {
            cleanWs()
        }
    }
}
