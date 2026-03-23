import { BackendTemplate } from '../types';

/**
 * Service Authentication Template
 * Inter-service authentication with mTLS and JWT validation
 */
export const serviceAuthTemplate: BackendTemplate = {
  id: 'service-auth',
  name: 'Service Authentication',
  displayName: 'mTLS & JWT Authentication',
  description: 'Complete inter-service authentication configuration with mTLS, JWT validation, SPIFFE/SPIRE identities, and certificate rotation',
  version: '1.0.0',
  language: 'typescript',
  framework: 'mtls',
  tags: ['kubernetes', 'security', 'mtls', 'jwt', 'auth', 'spiffe'],
  port: 8443,
  dependencies: {},
  features: ['security', 'docker', 'rest-api', 'documentation'],

  files: {
    'mtls/ca-setup.sh': `#!/bin/bash
# Setup Certificate Authority for mTLS

set -e

CA_DIR="./certs"
mkdir -p "$CA_DIR"

echo "Generating CA certificate..."
openssl genrsa -out "$CA_DIR/ca-key.pem" 4096
openssl req -new -x509 -days 3650 -key "$CA_DIR/ca-key.pem" -out "$CA_DIR/ca-cert.pem" \\
  -subj "/C=US/ST=CA/L=San Francisco/O=MyCompany/OU=CA/CN=MyCA"

echo "CA certificate generated at $CA_DIR/ca-cert.pem"

# Generate CA bundle for clients
cat "$CA_DIR/ca-cert.pem" > "$CA_DIR/ca-bundle.pem"
`,

    'mtls/generate-certs.sh': `#!/bin/bash
# Generate server and client certificates for services

set -e

CA_DIR="./certs"
SERVICE_NAME="service-a"
DAYS="365"

if [ ! -f "$CA_DIR/ca-cert.pem" ]; then
  echo "CA certificate not found. Run ca-setup.sh first."
  exit 1
fi

echo "Generating certificate for service..."

# Generate private key
openssl genrsa -out "$CA_DIR/service-key.pem" 2048

# Generate CSR
openssl req -new \\
  -key "$CA_DIR/service-key.pem" \\
  -out "$CA_DIR/service.csr" \\
  -subj "/C=US/ST=CA/L=San Francisco/O=MyCompany/OU=Services/CN=service"

# Sign with CA
openssl x509 -req -in "$CA_DIR/service.csr" \\
  -CA "$CA_DIR/ca-cert.pem" \\
  -CAkey "$CA_DIR/ca-key.pem" \\
  -CAcreateserial \\
  -out "$CA_DIR/service-cert.pem" \\
  -days "$DAYS"

# Combine cert and key for nginx
cat "$CA_DIR/service-cert.pem" "$CA_DIR/service-key.pem" > "$CA_DIR/service-combined.pem"

# Clean up CSR
rm "$CA_DIR/service.csr"

echo "Certificate generated: service-cert.pem"
echo "Private key: service-key.pem"
echo "Combined: service-combined.pem"
`,

    'mtls/nginx-mtls.conf': `# Nginx mTLS Configuration

server {
    listen 8443 ssl http2;
    server_name service.example.com;

    # Server certificate
    ssl_certificate /etc/nginx/certs/server-cert.pem;
    ssl_certificate_key /etc/nginx/certs/server-key.pem;

    # CA certificate for client verification
    ssl_client_certificate /etc/nginx/ca/ca-cert.pem;
    ssl_verify_client on;
    ssl_verify_depth 2;

    # SSL protocols
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # mTLS results
    add_header X-SSL-Client-Verify ssl_client_verify always;

    location /api/ {
        # Verify client certificate
        if (ssl_client_verify != SUCCESS) {
            return 403;
        }

        proxy_pass http://backend:8080;
        proxy_set_header X-SSL-Client-CN ssl_client_s_dn;
        proxy_set_header X-SSL-Client-Cert ssl_client_cert;
    }
}
`,

    'mtls/istio-mtls-policy.yaml': `# Istio mTLS Policy
# Enforce mutual TLS between services

apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default-mtls
  namespace: production
spec:
  mtls:
    mode: STRICT

---
# Permissive mTLS for legacy services
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: permissive-mtls
  namespace: development
spec:
  mtls:
    mode: PERMISSIVE

---
# Authorization Policy
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: service-a-policy
  namespace: production
spec:
  action: ALLOW
  rules:
  - from:
    - source:
        principals:
        - cluster.local/ns/production/sa/service-b
        - cluster.local/ns/production/sa/service-c
    to:
    - operation:
        methods: ["GET", "POST", "PUT", "DELETE"]
        paths: ["/api/*"]
  - from:
    - source:
        namespaces: ["istio-system"]
    to:
    - operation:
        methods: ["GET"]
        paths: ["/health"]
`,

    'mtls/spire/spire-server.yaml': `# SPIRE Server Configuration
# SPIFFE/SPIRE identity framework for mTLS

apiVersion: v1
kind: Namespace
metadata:
  name: spire

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: spire-server
  namespace: spire
data:
  server.conf: |
    server {
      bind_address = "0.0.0.0"
      bind_port = "8081"
      trust_domain = "example.com"
      data_dir = "/run/spire/data"
      log_level = "INFO"
      default_x509_svid_ttl = "1h"
      default_jwks_x509_svid_ttl = "1h"
    }

    plugins {
      DataStore "sql" {
        plugin_data {
          database_type = "sqlite3"
          connection_string = "/run/spire/data/datastore.sqlite"
        }
      }

      KeyValue "default" {
        plugin_data {
          path = "/run/spire/data/kv.sqlite"
        }
      }

      NodeAttestor "k8s" {
        plugin_data {
          kube_config_file = "/var/run/secrets/kubernetes.io/serviceaccount/token"
        }
      }

      WorkloadAttestor "k8s" {
        plugin_data {
          pod_label = "spiffe-id"
        }
      }

      X509-SVID "default" {
        plugin_data {
          ca_secret_name = "spire-ca"
          ca_secret_namespace = "spire"
          svid_secret_name_format = "svid-%s"
          svid_secret_namespace_format = "spire"
          svid_ttl = "1h"
        }
      }
    }

    health_checks {
      alive_enabled = true
      ready_enabled = true
    }
`,

    'mtls/spire/spire-statefulset.yaml': `# SPIRE Server Deployment

apiVersion: v1
kind: ServiceAccount
metadata:
  name: spire-server
  namespace: spire

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: spire-server
rules:
- apiGroups:
  - ""
  resources:
  - pods
  verbs:
  - get
  - list
  - watch

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: spire-server
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: spire-server
subjects:
- kind: ServiceAccount
  name: spire-server
  namespace: spire

---
apiVersion: v1
kind: Service
metadata:
  name: spire-server
  namespace: spire
spec:
  ports:
  - name: grpc
    port: 8081
    targetPort: 8081
  selector:
    app: spire-server

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: spire-server
  namespace: spire
spec:
  serviceName: spire-server
  replicas: 1
  selector:
    matchLabels:
      app: spire-server
  template:
    metadata:
      labels:
        app: spire-server
    spec:
      serviceAccountName: spire-server
      containers:
      - name: spire-server
        image: ghcr.io/spiffe/spire-server:1.8.0
        args:
        - -config
        - /run/spire/config/server.conf
        ports:
        - containerPort: 8081
          name: grpc
        volumeMounts:
        - name: data
          mountPath: /run/spire/data
        - name: config
          mountPath: /run/spire/config
        livenessProbe:
          exec:
            command:
            - /opt/spire/bin/spire-server
            - health-check
            - -serverAddress
            - "localhost:8081"
        readinessProbe:
          exec:
            command:
            - /opt/spire/bin/spire-server
            - health-check
            - -serverAddress
            - "localhost:8081"
      volumes:
      - name: data
        emptyDir: {}
      - name: config
        configMap:
          name: spire-server
`,

    'mtls/spire/spire-agent-daemonset.yaml': `# SPIRE Agent DaemonSet
# Runs on each node to provide workload identities

apiVersion: v1
kind: ServiceAccount
metadata:
  name: spire-agent
  namespace: spire

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: spire-agent
rules:
- apiGroups:
  - ""
  resources:
  - pods
  - nodes
  verbs:
  - get
  - list
  - watch

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: spire-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: spire-agent
subjects:
- kind: ServiceAccount
  name: spire-agent
  namespace: spire

---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: spire-agent
  namespace: spire
  labels:
    app: spire-agent
spec:
  selector:
    matchLabels:
      app: spire-agent
  template:
    metadata:
      labels:
        app: spire-agent
    spec:
      serviceAccountName: spire-agent
      hostNetwork: true
      containers:
      - name: spire-agent
        image: ghcr.io/spiffe/spire-agent:1.8.0
        args:
        - -config
        - /run/spire/config/agent.conf
        env:
        - name: SPIRE_SERVER_ADDR
          value: "spire-server.spire:8081"
        securityContext:
          readOnlyRootFilesystem: true
        volumeMounts:
        - name: spire-agent-socket
          mountPath: /run/spire/sockets
        - name: token
          mountPath: /var/run/secrets/kubernetes.io/serviceaccount
          readOnly: true
        ports:
        - containerPort: 8080
          name: grpc
        livenessProbe:
          exec:
            command:
            - /opt/spire/bin/spire-agent
            - health-check
            - -serverAddress
            - "127.0.0.1:8081"
        readinessProbe:
          exec:
            command:
            - /opt/spire/bin/spire-agent
            - health-check
            - -serverAddress
            - "127.0.0.1:8081"
      volumes:
      - name: spire-agent-socket
        hostPath:
          path: /run/spire/sockets
          type: DirectoryOrCreate
      - name: token
        projected:
          - source:
              serviceAccountToken:
                expiration: 3600s
            path: token
`,

    'jwt/jwt-auth-middleware.ts': `// JWT Authentication Middleware
// Validate JWT tokens for inter-service communication

import { verify } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface JwtPayload {
  sub: string;
  iss: string;
  aud: string[];
  exp: number;
  nbf: number;
  iat: number;
  scopes?: string[];
}

interface ServiceAuthConfig {
  publicKey: string;
  issuer: string;
  audience: string[];
}

export class JwtAuthMiddleware {
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000;

  constructor(private config: ServiceAuthConfig) {}

  middleware(req: Request, res: Response, next: NextFunction): void {
    const token = this.extractToken(req);

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    try {
      const payload = this.verifyToken(token);
      req.user = payload;
      next();
    } catch (error: any) {
      res.status(401).json({ error: 'Invalid token', message: error.message });
    }
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    return null;
  }

  private verifyToken(token: string): JwtPayload {
    const cached = this.cache.get(token);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.payload;
    }

    const payload = verify(token, this.config.publicKey, {
      issuer: this.config.issuer,
      audience: this.config.audience,
    }) as JwtPayload;

    this.cache.set(token, {
      payload,
      timestamp: Date.now(),
    });

    return payload;
  }

  public clearCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}

const jwtAuth = new JwtAuthMiddleware({
  publicKey: process.env.JWT_PUBLIC_KEY || '',
  issuer: 'https://auth.example.com',
  audience: ['service-a', 'service-b'],
});

export { jwtAuth };
`,

    'jwt/jwt-service.yaml': `# JWT Validation Service
# Standalone JWT token validation service

apiVersion: v1
kind: Service
metadata:
  name: jwt-validator
  namespace: auth
spec:
  ports:
  - port: 8080
    targetPort: 8080
  selector:
    app: jwt-validator

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: jwt-config
  namespace: auth
data:
  config.yaml: |
    issuer: https://auth.example.com
    audience:
      - service-a
      - service-b
      - service-c
    publicKey: |
      -----BEGIN PUBLIC KEY-----
      MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
      -----END PUBLIC KEY-----
    algorithms:
      - RS256
      - RS384
    tokenTTL: 3600
    cacheTTL: 300

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jwt-validator
  namespace: auth
  labels:
    app: jwt-validator
spec:
  replicas: 2
  selector:
    matchLabels:
      app: jwt-validator
  template:
    metadata:
      labels:
        app: jwt-validator
    spec:
      containers:
      - name: jwt-validator
        image: myorg/jwt-validator:1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: CONFIG_FILE
          value: /config/config.yaml
        volumeMounts:
        - name: config
          mountPath: /config
          readOnly: true
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
      volumes:
      - name: config
        configMap:
          name: jwt-config
`,

    'docker-compose.yml': `version: '3.8'

services:
  # Certificate Authority
  ca:
    image: smallstep/step-ca:latest
    container_name: step-ca
    ports:
      - "9000:9000"
    environment:
      - DOCKER_STEPCA_INIT=1
      - STEPCA_CA_NAME=MyCA
      - STEPCA_DNS_NAMES=localhost,ca.example.com
    volumes:
      - ./certs:/home/step/certs
    networks:
      - mtls-net
    restart: unless-stopped

  # Service A with mTLS
  service-a:
    image: nginx:alpine
    container_name: service-a
    ports:
      - "8443:8443"
    volumes:
      - ./mtls/nginx-mtls.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs/service-combined.pem:/etc/nginx/certs/server-cert.pem:ro
      - ./certs/service-key.pem:/etc/nginx/certs/server-key.pem:ro
      - ./certs/ca-cert.pem:/etc/nginx/ca/ca-cert.pem:ro
    networks:
      - mtls-net
    depends_on:
      - ca

  # Service B with mTLS
  service-b:
    image: nginx:alpine
    container_name: service-b
    ports:
      - "8444:8443"
    volumes:
      - ./certs/service-combined.pem:/etc/nginx/certs/server-cert.pem:ro
      - ./certs/service-key.pem:/etc/nginx/certs/server-key.pem:ro
      - ./certs/ca-cert.pem:/etc/nginx/ca/ca-cert.pem:ro
    networks:
      - mtls-net
    depends_on:
      - ca

  # JWT Auth Service
  auth-service:
    image: myorg/auth-service:1.0.0
    container_name: auth-service
    ports:
      - "8080:8080"
    environment:
      - JWT_SECRET=your-secret-key
      - CA_CERT_FILE=/certs/ca-cert.pem
    volumes:
      - ./certs:/certs:ro
    networks:
      - mtls-net
    depends_on:
      - ca

  # SPIRE Server
  spire-server:
    image: ghcr.io/spiffe/spire-server:1.8.0
    container_name: spire-server
    ports:
      - "8081:8081"
    command:
      - -config
      - /opt/spire/conf/server.conf
    volumes:
      - ./spire/data:/opt/spire/data
      - ./spire/conf:/opt/spire/conf
    networks:
      - mtls-net

  # SPIRE Agent
  spire-agent:
    image: ghcr.io/spiffe/spire-agent:1.8.0
    container_name: spire-agent
    pid: "host"
    command:
      - -config
      - /opt/spire/conf/agent.conf
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./spire/conf:/opt/spire/conf
      - spire-socket:/run/spire/sockets
    networks:
      - mtls-net
    depends_on:
      - spire-server

networks:
  mtls-net:
    driver: bridge
`,

    'README.md': `# Inter-Service Authentication with mTLS and JWT

Complete inter-service authentication configuration with mTLS, JWT validation, SPIFFE/SPIRE identities, and certificate rotation.

## Features

### mTLS (Mutual TLS)
- CA Management: Automated certificate authority setup
- Certificate Generation: Server and client certificates
- Nginx Configuration: mTLS termination
- Istio Policies: PeerAuthentication and Authorization

### SPIFFE/SPIRE
- Identity Framework: SPIFFE/SPIRE for workload identities
- X.509 SVIDs: Short-lived X.509 certificates
- JWT-SVIDs: JWT-based identities
- Kubernetes Integration: Automatic workload attestation

### JWT Authentication
- Middleware: Express/Node.js JWT validation
- Token Validation Service: Standalone validator
- Caching: Token payload caching
- Multiple Algorithms: RS256, RS384 support

## Quick Start

### Setup CA

bash code for generating CA certificate

### Generate Certificates

bash code for generating service certificates

### Docker Compose

bash code for starting all services

## License

MIT
`,

    'Makefile': `.PHONY: help ca cert start stop test clean

help:
	@echo "Available targets: ca cert start stop test clean"

ca:
	chmod +x mtls/ca-setup.sh
	./mtls/ca-setup.sh

cert:
	chmod +x mtls/generate-certs.sh
	./mtls/generate-certs.sh

start:
	docker-compose up -d

stop:
	docker-compose down

test:
	curl -k --cert ./certs/service-cert.pem --key ./certs/service-key.pem https://localhost:8443/api/test

clean:
	docker-compose down -v
	rm -rf certs
`
  },

  postInstall: [
    `echo "Setting up inter-service authentication..."
echo ""
echo "1. Setup Certificate Authority:"
echo "   make ca"
echo ""
echo "2. Generate service certificates:"
echo "   make cert"
echo ""
echo "3. Start services:"
echo "   make start"
echo ""
echo "4. Test mTLS communication:"
echo "   make test"
`
  ]
};
