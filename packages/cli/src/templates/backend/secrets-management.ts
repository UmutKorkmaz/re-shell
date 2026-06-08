import { BackendTemplate } from '../types';

/**
 * Secrets Management Template
 * Environment variable injection and secrets management with Vault integration
 */
export const secretsManagementTemplate: BackendTemplate = {
  id: 'secrets-management',
  name: 'Secrets Management',
  displayName: 'Secrets & Environment Variables',
  description: 'Complete secrets management with HashiCorp Vault integration, environment variable injection, Kubernetes secrets, and rotation policies',
  version: '1.15.0',
  language: 'typescript',
  framework: 'vault',
  tags: ['kubernetes', 'vault', 'secrets', 'security', 'env', 'cicd'],
  port: 8200,
  dependencies: {},
  features: ['security', 'docker', 'rest-api', 'documentation'],

  files: {
    'vault/config-vault.hcl': `# Vault Configuration
# HashiCorp Vault for secrets management

listener "tcp" {
  address       = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_cert_file = "/opt/vault/tls/tls.crt"
  tls_key_file  = "/opt/vault/tls/tls.key"
  tls_client_ca_file = "/opt/vault/tls/ca.crt"
}

storage "file" {
  path = "/opt/vault/data"
}

api_addr = "https://0.0.0.0:8200"
cluster_addr = "https://0.0.0.0:8201"

ui = true

disable_mlock = false

# Cluster configuration
cluster_name = "vault"

# Enable telemetry
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
}

# Enable audit logging
audit {
  enabled = true
  type    = "file"
  options = {
    file_path = "/opt/vault/logs/audit.log"
    mode     = "0640"
  }
}
`,

    'vault/docker-compose.yml': `version: '3.8'

services:
  vault:
    image: hashicorp/vault:1.15.0
    container_name: vault
    ports:
      - "8200:8200"
    environment:
      VAULT_ADDR: 'https://0.0.0.0:8200'
      VAULT_API_ADDR: 'https://0.0.0.0:8200'
      VAULT_CLUSTER_ADDR: 'https://0.0.0.0:8201'
      VAULT_UI: 'true'
      VAULT_DEV_ROOT_TOKEN_ID: 'root-token'
    cap_add:
      - IPC_LOCK
    volumes:
      - ./vault/data:/opt/vault/data
      - ./vault/logs:/opt/vault/logs
      - ./vault/config:/opt/vault/config
      - ./vault/tls:/opt/vault/tls
    networks:
      - vault-net
    command: server

  consul:
    image: hashicorp/consul:1.15
    container_name: consul
    ports:
      - "8500:8500"
    environment:
      CONSUL_BIND_INTERFACE: eth0
      CONSUL_CLIENT_INTERFACE: eth0
    networks:
      - vault-net

networks:
  vault-net:
    driver: bridge
`,

    'vault/kubernetes/statefulset.yaml': `# Vault StatefulSet for Kubernetes

apiVersion: v1
kind: Namespace
metadata:
  name: vault
  labels:
    name: vault

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: vault
  namespace: vault

---
apiVersion: v1
kind: Service
metadata:
  name: vault
  namespace: vault
  labels:
    app: vault
spec:
  ports:
  - name: http
    port: 8200
    targetPort: 8200
  selector:
    app: vault

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: vault
  namespace: vault
spec:
  serviceName: vault
  replicas: 3
  selector:
    matchLabels:
      app: vault
  template:
    metadata:
      labels:
        app: vault
    spec:
      serviceAccountName: vault
      securityContext:
        fsGroup: 1000
      containers:
      - name: vault
        image: hashicorp/vault:1.15.0
        securityContext:
          capabilities:
            add:
            - IPC_LOCK
        env:
        - name: VAULT_ADDR
          value: "https://127.0.0.1:8200"
        - name: VAULT_API_ADDR
          value: "https://0.0.0.0:8200"
        - name: VAULT_CLUSTER_ADDR
          value: "https://$(HOSTNAME).vault:8201"
        - name: HOME
          value: /home/vault
        ports:
        - containerPort: 8200
          name: http
        - containerPort: 8201
          name: internal
        readinessProbe:
          httpGet:
            path: /v1/sys/health
            port: 8200
            scheme: HTTPS
          failureThreshold: 2
        livenessProbe:
          httpGet:
            path: /v1/sys/health
            port: 8200
            scheme: HTTPS
          failureThreshold: 2
        volumeMounts:
        - name: vault-data
          mountPath: /vault/data
        - name: vault-config
          mountPath: /vault/config
        - name: vault-tls
          mountPath: /vault/tls
      volumes:
      - name: vault-config
        emptyDir: {}
      - name: vault-tls
        secret:
          secretName: vault-tls
  volumeClaimTemplates:
  - metadata:
      name: vault-data
    spec:
      accessModes:
      - ReadWriteOnce
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
`,

    'vault/kubernetes/vault-agent-injector.yaml': `# Vault Agent Injector for Kubernetes
# Automatically inject secrets into pods

apiVersion: v1
kind: ServiceAccount
metadata:
  name: vault-injector
  namespace: vault

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vault-agent-injector
  namespace: vault
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vault-agent-injector
  template:
    metadata:
      labels:
        app: vault-agent-injector
    spec:
      serviceAccountName: vault-injector
      containers:
      - name: vault-agent-injector
        image: hashicorp/vault-k8s:1.2.0
        args:
        - agent-inject
        - log-level=info
        - exit-after-auth=false
        env:
        - name: VAULT_ADDR
          value: https://vault.vault:8200
        - name: VAULT_AUTH_TYPE
          value: kubernetes
        - name: VAULT_ROLE
          value: vault-injector
        - name: AGENT_INJECT_LISTEN
          value: :8080
        ports:
        - containerPort: 8080
          name: http
        livenessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          failureThreshold: 2
          initialDelaySeconds: 5
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          failureThreshold: 2
          initialDelaySeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: vault-agent-injector
  namespace: vault
spec:
  ports:
  - port: 8080
    name: http
  selector:
    app: vault-agent-injector

---
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: vault-agent-injector-cfg
webhooks:
- name: vault-agent-injector
  clientConfig:
    service:
      name: vault-agent-injector
      namespace: vault
      path: /mutate
  rules:
  - operations:
    - CREATE
    - UPDATE
    apiGroups:
    - ""
    apiVersions:
    - v1
    resources:
    - pods
  namespaceSelector:
    matchLabels:
      vault-injection: enabled
`,

    'vault/kubernetes/example-pod-with-secrets.yaml': `# Example Pod with Vault Secret Injection
# Automatically inject secrets as environment variables

apiVersion: v1
kind: Namespace
metadata:
  name: app
  labels:
    vault-injection: enabled

---
apiVersion: v1
kind: Pod
metadata:
  name: app-with-secrets
  namespace: app
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/role: "app"
    vault.hashicorp.com/agent-inject-secret-database: "database/creds/app"
spec:
  serviceAccountName: app
  containers:
  - name: app
    image: nginx:alpine
    env:
    - name: VAULT_ADDR
      value: "https://vault.vault:8200"

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app
  namespace: app
`,

    'README.md': `# Secrets Management with Vault Integration

Complete secrets management solution with HashiCorp Vault integration, environment variable injection, Kubernetes secrets, and rotation policies.

## Features

### Vault Integration
- Auto-unseal with AWS KMS
- Kubernetes authentication
- Agent injector for pods
- Secret rotation policies

### Secrets Engines
- KV v2 for key-value storage
- Database for dynamic credentials
- PKI for certificate management
- Transit for encryption

### Quick Start

Docker Compose:
\`\`\`bash
docker-compose -f vault/docker-compose.yml up -d
docker exec vault vault operator init -key-shares=1 -key-threshold=1
docker exec vault vault operator unseal
\`\`\`

Kubernetes:
\`\`\`bash
kubectl apply -f vault/kubernetes/statefulset.yaml
kubectl apply -f vault/kubernetes/vault-agent-injector.yaml
kubectl apply -f vault/kubernetes/example-pod-with-secrets.yaml
\`\`\`

## License

MIT
`,

    'Makefile': `.PHONY: help start stop logs clean

help:
	@echo "Available targets: start stop logs clean"

start:
	docker-compose -f vault/docker-compose.yml up -d

stop:
	docker-compose -f vault/docker-compose.yml down

logs:
	docker-compose -f vault/docker-compose.yml logs -f vault

clean:
	docker-compose -f vault/docker-compose.yml down -v
`
  },

  postInstall: [
    `echo "Setting up secrets management with Vault..."
echo ""
echo "Docker Compose:"
echo "1. Start Vault: docker-compose -f vault/docker-compose.yml up -d"
echo "2. Initialize: make init"
echo "3. Unseal: make unseal"
echo ""
echo "Kubernetes:"
echo "1. kubectl apply -f vault/kubernetes/"
`
  ]
};
