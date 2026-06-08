import { BackendTemplate } from '../types';

/**
 * Service Discovery Template
 * Comprehensive service discovery with Consul, etcd, and Kubernetes DNS
 */
export const serviceDiscoveryTemplate: BackendTemplate = {
  id: 'service-discovery',
  name: 'Service Discovery',
  displayName: 'Service Discovery',
  description: 'Complete service discovery infrastructure with Consul, etcd, and Kubernetes DNS integration for microservices',
  version: '1.0.0',
  language: 'typescript',
  framework: 'consul',
  tags: ['consul', 'etcd', 'kubernetes', 'service-discovery', 'microservices', 'dns'],
  port: 8500,
  dependencies: {},
  features: ['microservices', 'docker', 'rest-api', 'websockets', 'monitoring', 'documentation'],

  files: {
    'docker-compose.yml': `version: '3.8'

services:
  # ============ CONSUL CLUSTER ============
  
  # Consul Server (Bootstrap)
  consul-server1:
    image: hashicorp/consul:1.16
    container_name: consul-server1
    hostname: consul-server1
    restart: unless-stopped
    ports:
      - "8500:8500"    # HTTP API
      - "8400:8400"    # RPC
      - "8600:8600/udp" # Serf LAN UDP
      - "8600:8600"    # Serf LAN TCP
    networks:
      - service-mesh
    environment:
      - CONSUL_BIND_INTERFACE=eth0
      - CONSUL_CLIENT_INTERFACE=eth0
      - CONSUL_BOOTSTRAP_EXPECT=3
      - CONSUL_RETRY_JOIN=consul-server2,consul-server3
      - CONSUL_UI=true
    volumes:
      - consul-data1:/consul/data
      - ./consul/config/server1.hcl:/consul/config/server1.hcl:ro
    command: agent -server -bootstrap-expect=3 -ui -client=0.0.0.0

  consul-server2:
    image: hashicorp/consul:1.16
    container_name: consul-server2
    hostname: consul-server2
    restart: unless-stopped
    networks:
      - service-mesh
    environment:
      - CONSUL_BIND_INTERFACE=eth0
      - CONSUL_CLIENT_INTERFACE=eth0
      - CONSUL_RETRY_JOIN=consul-server1,consul-server3
    volumes:
      - consul-data2:/consul/data
      - ./consul/config/server2.hcl:/consul/config/server2.hcl:ro
    command: agent -server -client=0.0.0.0

  consul-server3:
    image: hashicorp/consul:1.16
    container_name: consul-server3
    hostname: consul-server3
    restart: unless-stopped
    networks:
      - service-mesh
    environment:
      - CONSUL_BIND_INTERFACE=eth0
      - CONSUL_CLIENT_INTERFACE=eth0
      - CONSUL_RETRY_JOIN=consul-server1,consul-server2
    volumes:
      - consul-data3:/consul/data
      - ./consul/config/server3.hcl:/consul/config/server3.hcl:ro
    command: agent -server -client=0.0.0.0

  # Consul Client for Service Registration
  consul-client:
    image: hashicorp/consul:1.16
    container_name: consul-client
    restart: unless-stopped
    ports:
      - "8501:8500"
    networks:
      - service-mesh
    environment:
      - CONSUL_BIND_INTERFACE=eth0
      - CONSUL_CLIENT_INTERFACE=eth0
      - CONSUL_RETRY_JOIN=consul-server1
    volumes:
      - ./consul/config/client.hcl:/consul/config/client.hcl:ro
    command: agent -client

  # ============ ETCD CLUSTER ============
  
  etcd1:
    image: quay.io/coreos/etcd:v3.5.9
    container_name: etcd1
    hostname: etcd1
    restart: unless-stopped
    ports:
      - "2379:2379"    # Client requests
      - "2380:2380"    # Peer communication
    networks:
      - service-mesh
    environment:
      - ETCD_NAME=etcd1
      - ETCD_INITIAL_ADVERTISE_PEER_URLS=http://etcd1:2380
      - ETCD_LISTEN_PEER_URLS=http://0.0.0.0:2380
      - ETCD_LISTEN_CLIENT_URLS=http://0.0.0.0:2379
      - ETCD_ADVERTISE_CLIENT_URLS=http://etcd1:2379
      - ETCD_INITIAL_CLUSTER=etcd1=http://etcd1:2380,etcd2=http://etcd2:2380,etcd3=http://etcd3:2380
      - ETCD_INITIAL_CLUSTER_STATE=new
      - ETCD_INITIAL_CLUSTER_TOKEN=etcd-cluster
    volumes:
      - etcd-data1:/etcd-data
    command: etcd --data-dir=/etcd-data

  etcd2:
    image: quay.io/coreos/etcd:v3.5.9
    container_name: etcd2
    hostname: etcd2
    restart: unless-stopped
    ports:
      - "2381:2379"
      - "2382:2380"
    networks:
      - service-mesh
    environment:
      - ETCD_NAME=etcd2
      - ETCD_INITIAL_ADVERTISE_PEER_URLS=http://etcd2:2380
      - ETCD_LISTEN_PEER_URLS=http://0.0.0.0:2380
      - ETCD_LISTEN_CLIENT_URLS=http://0.0.0.0:2379
      - ETCD_ADVERTISE_CLIENT_URLS=http://etcd2:2379
      - ETCD_INITIAL_CLUSTER=etcd1=http://etcd1:2380,etcd2=http://etcd2:2380,etcd3=http://etcd3:2380
      - ETCD_INITIAL_CLUSTER_STATE=new
      - ETCD_INITIAL_CLUSTER_TOKEN=etcd-cluster
    volumes:
      - etcd-data2:/etcd-data
    command: etcd --data-dir=/etcd-data

  etcd3:
    image: quay.io/coreos/etcd:v3.5.9
    container_name: etcd3
    hostname: etcd3
    restart: unless-stopped
    ports:
      - "2383:2379"
      - "2384:2380"
    networks:
      - service-mesh
    environment:
      - ETCD_NAME=etcd3
      - ETCD_INITIAL_ADVERTISE_PEER_URLS=http://etcd3:2380
      - ETCD_LISTEN_PEER_URLS=http://0.0.0.0:2380
      - ETCD_LISTEN_CLIENT_URLS=http://0.0.0.0:2379
      - ETCD_ADVERTISE_CLIENT_URLS=http://etcd3:2379
      - ETCD_INITIAL_CLUSTER=etcd1=http://etcd1:2380,etcd2=http://etcd2:2380,etcd3=http://etcd3:2380
      - ETCD_INITIAL_CLUSTER_STATE=new
      - ETCD_INITIAL_CLUSTER_TOKEN=etcd-cluster
    volumes:
      - etcd-data3:/etcd-data
    command: etcd --data-dir=/etcd-data

  # ============ SERVICE MESH EXAMPLES ============
  
  # Example Service 1: API Gateway
  api-gateway:
    image: nginx:alpine
    container_name: api-gateway
    restart: unless-stopped
    ports:
      - "8080:80"
    networks:
      - service-mesh
    volumes:
      - ./services/api-gateway/nginx.conf:/etc/nginx/nginx.conf:ro
    environment:
      - CONSUL_HOST=consul-client
      - CONSUL_PORT=8500
      - SERVICE_NAME=api-gateway
      - SERVICE_PORT=80
    depends_on:
      - consul-client
    command: >
      sh -c "
        apk add --no-cache curl &&
        while ! curl -s http://consul-client:8500; do sleep 1; done &&
        nginx &&
        # Register service with Consul
        curl -X PUT http://consul-client:8500/v1/agent/service/register -d '{
          \\"ID\\": \\"api-gateway-1\\",
          \\"Name\\": \\"api-gateway\\",
          \\"Address\\": \\"api-gateway\\",
          \\"Port\\": 80,
          \\"Check\\": {
            \\"HTTP\\": \\"http://api-gateway/health\\",
            \\"Interval\\": \\"10s\\"
          }
        }'
      "

  # Example Service 2: Backend Service
  backend-service:
    image: hashicorp/http-echo:latest
    container_name: backend-service
    restart: unless-stopped
    ports:
      - "8081:5678"
    networks:
      - service-mesh
    environment:
      - TEXT=Hello from backend!
    depends_on:
      - consul-client
    command: >
      sh -c "
        while ! curl -s http://consul-client:8500; do sleep 1; done &&
        /http-echo -text=\\"Hello from backend!\\" -listen=:5678 &
        # Register service with Consul
        sleep 2 &&
        curl -X PUT http://consul-client:8500/v1/agent/service/register -d '{
          \\"ID\\": \\"backend-service-1\\",
          \\"Name\\": \\"backend-service\\",
          \\"Address\\": \\"backend-service\\",
          \\"Port\\": 5678,
          \\"Tags\\": [\\"v1\\", \\"primary\\"],
          \\"Check\\": {
            \\"HTTP\\": \\"http://backend-service:5678/health\\",
            \\"Interval\\": \\"10s\\"
          }
        }' &&
        wait
      "

  # Consul Connect Sidecar Proxy for API Gateway
  api-gateway-proxy:
    image: hashicorp/consul-envoy:latest
    container_name: api-gateway-proxy
    restart: unless-stopped
    network_mode: service:api-gateway
    environment:
      - CONSUL_HTTP_ADDR=consul-client:8500
      - CONSUL_GRPC_ADDR=consul-client:8502
      - SERVICE_NAME=api-gateway
      - SERVICE_PROXY_MODE=transparent
    depends_on:
      - consul-client

  # Consul Connect Sidecar Proxy for Backend
  backend-service-proxy:
    image: hashicorp/consul-envoy:latest
    container_name: backend-service-proxy
    restart: unless-stopped
    network_mode: service:backend-service
    environment:
      - CONSUL_HTTP_ADDR=consul-client:8500
      - CONSUL_GRPC_ADDR=consul-client:8502
      - SERVICE_NAME=backend-service
      - SERVICE_PROXY_MODE=transparent
    depends_on:
      - consul-client

  # ============ KUBERNETES DNS SIMULATION ============
  
  # CoreDNS for Kubernetes-like DNS
  coredns:
    image: coredns/coredns:1.11.1
    container_name: coredns
    restart: unless-stopped
    ports:
      - "53:53/udp"
      - "53:53/tcp"
      - "9153:9153"
    networks:
      - service-mesh
    volumes:
      - ./dns/Corefile:/Corefile:ro
      - ./dns/hosts:/etc/hosts:ro
    command: -conf /Corefile

  # ============ SERVICE DISCOVERY TOOLS ============
  
  # Consul Template for dynamic configuration
  consul-template:
    image: hashicorp/consul-template:0.34.0
    container_name: consul-template
    restart: unless-stopped
    networks:
      - service-mesh
    environment:
      - CONSUL_ADDR=consul-client:8500
    volumes:
      - ./consul-template/templates:/templates
      - ./consul-template/config:/config
    depends_on:
      - consul-client
    command: -config=/config

  # Registrator for automatic service registration
  registrator:
    image: gliderlabs/registrator:latest
    container_name: registrator
    restart: unless-stopped
    networks:
      - service-mesh
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock
    depends_on:
      - consul-client
    command: -internal consul://consul-client:8500

  # ============ MONITORING ============
  
  # Consul UI is available on consul-server1:8500
  # Add Prometheus for metrics
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    networks:
      - service-mesh
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - service-mesh
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources

networks:
  service-mesh:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16

volumes:
  consul-data1:
  consul-data2:
  consul-data3:
  etcd-data1:
  etcd-data2:
  etcd-data3:
  prometheus-data:
  grafana-data:
`,

    'consul/config/server1.hcl': `datacenter = "dc1"
data_dir = "/consul/data"

server = true
bootstrap_expect = 3

bind_addr = "0.0.0.0"

client_addr = "0.0.0.0"

ports {
  grpc = 8502
}

connect {
  enabled = true
  ca_provider = "consul"
}

autopilot {
  cleanup_dead_servers = true
  last_contact_threshold = "200ms"
  max_trailing_logs = 250
  server_stabilization_time = "10s"
  enable_remount = true
}

acl {
  enabled = true
  default_policy = "deny"
  down_policy = "extend-cache"
}

ui = true
`,

    'consul/config/server2.hcl': `datacenter = "dc1"
data_dir = "/consul/data"

server = true
bootstrap_expect = 3

bind_addr = "0.0.0.0"
client_addr = "0.0.0.0"

ports {
  grpc = 8502
}

connect {
  enabled = true
}

retry_join = ["consul-server1"]
`,

    'consul/config/server3.hcl': `datacenter = "dc1"
data_dir = "/consul/data"

server = true
bootstrap_expect = 3

bind_addr = "0.0.0.0"
client_addr = "0.0.0.0"

ports {
  grpc = 8502
}

connect {
  enabled = true
}

retry_join = ["consul-server1"]
`,

    'consul/config/client.hcl': `datacenter = "dc1"
data_dir = "/consul/data"

server = false

bind_addr = "0.0.0.0"
client_addr = "0.0.0.0"

ports {
  grpc = 8502
}

connect {
  enabled = true
}

retry_join = ["consul-server1"]

telemetry {
  prometheus_retention_time = "24h"
  disable_hostname = true
}
`,

    'dns/Corefile': `.:53 {
    errors
    health {
        lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
    }
    prometheus 9153
    forward . /etc/resolv.conf
    cache 30
    loop
    reload
}

# Service discovery for Consul
consul {
    errors
    cache 30
    reload 1s
    forward . 127.0.0.1:8600
}

# Service discovery for etcd
etcd {
    errors
    cache 30
    forward . 127.0.0.1:2379
}

# Local development domains
local:53 {
    errors
    cache 1
    hosts {
        10.0.0.1 api.local
        10.0.0.2 backend.local
        10.0.0.3 frontend.local
        fallthrough
    }
}
`,

    'monitoring/prometheus.yml': `global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Consul metrics
  - job_name: 'consul'
    static_configs:
      - targets: ['consul-server1:8500', 'consul-client:8500']
    metrics_path: '/v1/agent/metrics'
    params:
      format: ['prometheus']

  # etcd metrics
  - job_name: 'etcd'
    static_configs:
      - targets: ['etcd1:2379', 'etcd2:2381', 'etcd3:2383']
    metrics_path: '/metrics'

  # API Gateway
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:80']

  # Backend Service
  - job_name: 'backend-service'
    static_configs:
      - targets: ['backend-service:5678']
`,

    'consul-template/templates/nginx.conf.ctmpl': `{{range services "backend-service"}}
upstream {{.Name}} {
    {{range .Services}}
    server {{.Address}}:{{.Port}} max_fails=3 fail_timeout=30s;
    {{end}}
}
{{end}}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://backend-service;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
    }

    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}
`,

    'consul-template/config/config.hcl': `consul {
  address = "consul-client:8500"

  retry {
    enabled = true
    backoff = "250ms"
    max_backoff = "1m"
  }

  ssl {
    enabled = false
    verify = false
  }
}

template {
  source = "/templates/nginx.conf.ctmpl"
  destination = "/etc/nginx/conf.d/default.conf"
  command = "nginx -s reload"
}

vault {
  grace = "5s"
  retry {
    backoff = "1s"
    max_backoff = "5s"
  }
}

exec {
  command = "/bin/sh -c \\"echo 'Template rendered!'\\"
}
`,

    'kubernetes/01-consul-configmap.yaml': `apiVersion: v1
kind: ConfigMap
metadata:
  name: consul-config
  namespace: default
data:
  consul.hcl: |
    datacenter = "k8s-dc1"
    data_dir = "/consul/data"
    
    server = true
    bootstrap_expect = 3
    
    bind_addr = "0.0.0.0"
    client_addr = "0.0.0.0"
    
    ports {
      grpc = 8502
    }
    
    connect {
      enabled = true
    }
    
    retry_join = ["provider=k8s"]
    
    k8s {
      enabled = true
    }
`,

    'kubernetes/02-consul-statefulset.yaml': `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: consul
  namespace: default
spec:
  serviceName: consul
  replicas: 3
  selector:
    matchLabels:
      app: consul
  template:
    metadata:
      labels:
        app: consul
    spec:
      serviceAccountName: consul
      containers:
      - name: consul
        image: hashicorp/consul:1.16
        ports:
        - containerPort: 8500
          name: http
        - containerPort: 8502
          name: grpc
        - containerPort: 8600
          name: serflan
          protocol: UDP
        env:
        - name: CONSUL_BIND_INTERFACE
          value: eth0
        - name: CONSUL_CLIENT_INTERFACE
          value: eth0
        - name: CONSUL_BOOTSTRAP_EXPECT
          value: "3"
        - name: CONSUL_RETRY_JOIN
          value: 'provider=k8s'
        volumeMounts:
        - name: data
          mountPath: /consul/data
        livenessProbe:
          httpGet:
            path: /v1/status/leader
            port: 8500
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /v1/status/leader
            port: 8500
          initialDelaySeconds: 10
          periodSeconds: 10
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
`,

    'kubernetes/03-consul-service.yaml': `apiVersion: v1
kind: Service
metadata:
  name: consul
  namespace: default
spec:
  clusterIP: None
  ports:
  - name: http
    port: 8500
    targetPort: 8500
  - name: grpc
    port: 8502
    targetPort: 8502
  - name: serflan
    port: 8600
    targetPort: 8600
    protocol: UDP
  selector:
    app: consul
---
apiVersion: v1
kind: Service
metadata:
  name: consul-ui
  namespace: default
spec:
  type: LoadBalancer
  ports:
  - port: 8500
    targetPort: 8500
  selector:
    app: consul
`,

    'kubernetes/04-etcd-statefulset.yaml': `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: etcd
  namespace: default
spec:
  serviceName: etcd
  replicas: 3
  selector:
    matchLabels:
      app: etcd
  template:
    metadata:
      labels:
        app: etcd
    spec:
      containers:
      - name: etcd
        image: quay.io/coreos/etcd:v3.5.9
        ports:
        - containerPort: 2379
          name: client
        - containerPort: 2380
          name: peer
        env:
        - name: ETCD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: ETCD_INITIAL_ADVERTISE_PEER_URLS
          value: http://$(ETCD_NAME).etcd.default.svc.cluster.local:2380
        - name: ETCD_LISTEN_PEER_URLS
          value: http://0.0.0.0:2380
        - name: ETCD_LISTEN_CLIENT_URLS
          value: http://0.0.0.0:2379
        - name: ETCD_ADVERTISE_CLIENT_URLS
          value: http://$(ETCD_NAME).etcd.default.svc.cluster.local:2379
        - name: ETCD_INITIAL_CLUSTER
          value: etcd0=http://etcd-0.etcd.default.svc.cluster.local:2380,etcd1=http://etcd-1.etcd.default.svc.cluster.local:2380,etcd2=http://etcd-2.etcd.default.svc.cluster.local:2380
        - name: ETCD_INITIAL_CLUSTER_STATE
          value: new
        - name: ETCD_INITIAL_CLUSTER_TOKEN
          value: etcd-cluster-k8s
        volumeMounts:
        - name: data
          mountPath: /etcd-data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
`,

    'kubernetes/05-core-dns-configmap.yaml': `apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health
        kubernetes cluster.local in-addr.arpa ip6.arpa {
            pods insecure
            fallthrough in-addr.arpa ip6.arpa
        }
        prometheus 9153
        forward . /etc/resolv.conf
        cache 30
        loop
        reload
    }
    
    # Consul service discovery
    consul:53 {
        errors
        cache 30
        forward . consul-service.default.svc.cluster.local:8500
    }
    
    # etcd service discovery  
    etcd:53 {
        errors
        cache 30
        forward . etcd-client.default.svc.cluster.local:2379
    }
`,

    'kubernetes/06-headless-service.yaml': `apiVersion: v1
kind: Service
metadata:
  name: etcd-headless
  namespace: default
spec:
  clusterIP: None
  ports:
  - port: 2379
    targetPort: 2379
    name: client
  - port: 2380
    targetPort: 2380
    name: peer
  selector:
    app: etcd
---
apiVersion: v1
kind: Service
metadata:
  name: etcd-client
  namespace: default
spec:
  clusterIP: None
  ports:
  - port: 2379
    targetPort: 2379
  selector:
    app: etcd
`,

    'scripts/register-service.sh': `#!/bin/bash
# Register a service with Consul

SERVICE_NAME="\${1:-myservice}"
SERVICE_ID="\${SERVICE_NAME}-\${HOSTNAME:-local}"
SERVICE_ADDRESS="\${2:-127.0.0.1}"
SERVICE_PORT="\${3:-8080}"
CONSUL_ADDR="\${4:-localhost:8500}"
HEALTH_CHECK="\${5:-http://\${SERVICE_ADDRESS}:\${SERVICE_PORT}/health}"

echo "Registering service: \${SERVICE_NAME}"
echo "Service ID: \${SERVICE_ID}"
echo "Address: \${SERVICE_ADDRESS}:\${SERVICE_PORT}"
echo "Consul: \${CONSUL_ADDR}"

curl -X PUT "http://\${CONSUL_ADDR}/v1/agent/service/register" -d "{
  \\"ID\\": \\"\${SERVICE_ID}\\",
  \\"Name\\": \\"\${SERVICE_NAME}\\",
  \\"Address\\": \\"\${SERVICE_ADDRESS}\\",
  \\"Port\\": \${SERVICE_PORT},
  \\"Check\\": {
    \\"HTTP\\": \\"\${HEALTH_CHECK}\\",
    \\"Interval\\": \\"10s\\",
    \\"Timeout\\": \\"5s\\",
    \\"DeregisterCriticalServiceAfter\\": \\"30s\\"
  }
}"

if [ $? -eq 0 ]; then
    echo "Service registered successfully!"
    echo "View at: http://\${CONSUL_ADDR}/ui/\${SERVICE_NAME}"
else
    echo "Failed to register service"
    exit 1
fi
`,

    'scripts/discover-service.sh': `#!/bin/bash
# Discover services using Consul

SERVICE_NAME="\${1:-}"
CONSUL_ADDR="\${2:-localhost:8500}"

if [ -z "\${SERVICE_NAME}" ]; then
    # List all services
    echo "Listing all registered services:"
    curl -s "http://\${CONSUL_ADDR}/v1/catalog/services" | jq '.'
else
    # Get service details
    echo "Discovering service: \${SERVICE_NAME}"
    curl -s "http://\${CONSUL_ADDR}/v1/catalog/service/\${SERVICE_NAME}" | jq '.'
    
    echo ""
    echo "Health status:"
    curl -s "http://\${CONSUL_ADDR}/v1/health/service/\${SERVICE_NAME}" | jq '.'
fi
`,

    'scripts/etcd-put.sh': `#!/bin/bash
# Store key-value pair in etcd

ETCD_ENDPOINT="\${1:-localhost:2379}"
KEY="\${2}"
VALUE="\${3}"

if [ -z "\${KEY}" ] || [ -z "\${VALUE}" ]; then
    echo "Usage: ./etcd-put.sh [endpoint] key value"
    echo "Example: ./etcd-put.sh localhost:2379 mykey myvalue"
    exit 1
fi

curl -L http://"\${ETCD_ENDPOINT}"/v3/kv/"\${KEY}" -X PUT -d value="\${VALUE}"

echo ""
echo "Key '\${KEY}' stored in etcd at \${ETCD_ENDPOINT}"
echo "Retrieve with: curl -L http://\${ETCD_ENDPOINT}/v3/kv/\${KEY}"
`,

    'scripts/etcd-get.sh': `#!/bin/bash
# Retrieve value from etcd

ETCD_ENDPOINT="\${1:-localhost:2379}"
KEY="\${2}"

if [ -z "\${KEY}" ]; then
    echo "Usage: ./etcd-get.sh [endpoint] key"
    echo "Example: ./etcd-get.sh localhost:2379 mykey"
    exit 1
fi

echo "Retrieving key '\${KEY}' from \${ETCD_ENDPOINT}:"
curl -L http://"\${ETCD_ENDPOINT}"/v3/kv/"\${KEY}" | jq '.'
`,

    'README.md': `# Service Discovery Infrastructure

Complete service discovery setup with Consul, etcd, and Kubernetes DNS integration.

## Components

### Consul Cluster
- 3-node Consul server cluster for high availability
- Consul client for service registration
- Consul Connect for service mesh
- Consul Template for dynamic configuration

### etcd Cluster  
- 3-node etcd cluster for distributed key-value storage
- Used for service discovery and configuration management

### Kubernetes DNS
- CoreDNS configuration for Kubernetes-like DNS resolution
- Headless services for DNS-based discovery
- Service discovery patterns

## Quick Start

### Using Docker Compose

\`\`\`bash
# Start all services
docker-compose up -d

# View Consul UI
open http://localhost:8500

# Register a service
./scripts/register-service.sh myservice 127.0.0.1 8080

# Discover services
./scripts/discover-service.sh myservice

# List all services
./scripts/discover-service.sh
\`\`\`

### Using Kubernetes

\`\`\`bash
# Apply all manifests
kubectl apply -f kubernetes/

# Verify Consul cluster
kubectl get pods -l app=consul

# Verify etcd cluster
kubectl get pods -l app=etcd

# Port forward to Consul UI
kubectl port-forward svc/consul-ui 8500:8500

# Register service (from within pod)
kubectl exec -it <pod-name> -- /scripts/register-service.sh
\`\`\`

## Service Registration

### Automatic Registration with Registrator

Services using Docker are automatically registered with Consul:

\`\`\`bash
# Registrator monitors Docker daemon events
docker-compose up -d registrator
\`\`\`

### Manual Registration

\`\`\`bash
./scripts/register-service.sh api-gateway 192.168.1.100 8080
./scripts/register-service.sh backend 192.168.1.101 3000
./scripts/register-service.sh frontend 192.168.1.102 80
\`\`\`

### Programmatic Registration (Node.js)

\`\`\`javascript
const Consul = require('consul');

const consul = new Consul({
  host: 'localhost',
  port: 8500
});

consul.agent.service.register({
  id: 'my-service-1',
  name: 'my-service',
  address: '192.168.1.100',
  port: 8080,
  check: {
    http: 'http://192.168.1.100:8080/health',
    interval: '10s'
  }
}, (err) => {
  if (err) throw err;
  console.log('Service registered!');
});
\`\`\`

## Service Discovery

### DNS-based Discovery

Services are reachable via DNS:

\`\`\`bash
# Consul DNS (port 8600)
dig @127.0.0.1 -p 8600 myservice.service.consul

# CoreDNS (port 53)  
dig @127.0.0.1 myservice.consul

# Kubernetes DNS
dig myservice.default.svc.cluster.local

# etcd service discovery
curl http://localhost:2379/v3/catalog/services
\`\`\`

### HTTP API Discovery

\`\`\`bash
# Consul Catalog API
curl http://localhost:8500/v1/catalog/services

# Health status
curl http://localhost:8500/v1/health/service/myservice

# Query specific datacenter
curl http://localhost:8500/v1/catalog/services?dc=dc1
\`\`\`

## etcd Operations

### Store and Retrieve Values

\`\`\`bash
# Store configuration
./scripts/etcd-put.sh localhost:2379 /config/database '{"host":"localhost","port":5432}'

# Retrieve configuration
./scripts/etcd-get.sh localhost:2379 /config/database

# Watch for changes
etcdctl watch /config/
\`\`\`

## Health Checking

Consul automatically checks service health:

\`\`\`bash
# Service health endpoint
curl http://localhost:8500/v1/health/service/myservice?passing

# Local agent health
curl http://localhost:8500/v1/agent/self

# Cluster health
curl http://localhost:8500/v1/health/state/serf_health
\`\`\`

## Service Mesh with Consul Connect

Enable service mesh features:

\`\`\`bash
# Intentions for service communication
consul intention create -source api-gateway -destination backend

# Sidecar proxies
docker-compose up -d api-gateway-proxy backend-service-proxy

# Verify connections
consul intention list
\`\`\`

## Monitoring

- **Consul UI**: http://localhost:8500
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────┐
│                  Service Discovery Layer            │
│  ┌────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Consul    │  │   etcd   │  │ Kubernetes  │  │
│  │  Cluster   │  │  Cluster │  │    DNS      │  │
│  └─────┬──────┘  └────┬─────┘  └──────┬───────┘  │
│        │              │                │          │
└────────┼──────────────┼────────────────┼──────────┘
         │              │                │
         └──────────────┴────────────────┴────────┐
                    │  Service Registration │
                    └──────────────────────────┘
         ┌──────────────┴───────────────────────────┐
         │         Services Layer                   │
         │  ┌───────┐  ┌───────┐  ┌────────────┐  │
         │  │ API   │  │Backend│  │  Frontend  │  │
         │  │Gateway│  │Service│  │    App     │  │
         │  └───────┘  └───────┘  └────────────┘  │
         └─────────────────────────────────────────┘
\`\`\`

## License

MIT
`,

    'Makefile': `.PHONY: help up down restart clean install test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

logs: ## Show logs from all services
	docker-compose logs -f

logs-consul: ## Show Consul logs
	docker-compose logs -f consul-server1 consul-server2 consul-server3 consul-client

logs-etcd: ## Show etcd logs
	docker-compose logs -f etcd1 etcd2 etcd3

clean: ## Remove all containers and volumes
	docker-compose down -v
	docker system prune -af

install: ## Install dependencies
	npm install

test: ## Run tests
	npm test

register: ## Register a service (usage: make register SERVICE=myservice PORT=8080)
	./scripts/register-service.sh $(SERVICE) 127.0.0.1 $(PORT)

discover: ## Discover services
	./scripts/discover-service.sh $(SERVICE)

consul-ui: ## Open Consul UI
	open http://localhost:8500

grafana: ## Open Grafana
	open http://localhost:3000

prometheus: ## Open Prometheus
	open http://localhost:9090
`
  },

  postInstall: [
    `echo "Setting up service discovery infrastructure..."
echo ""
echo "1. Start services:"
echo "   make up"
echo ""
echo "2. Access Consul UI:"
echo "   make consul-ui"
echo ""
echo "3. Register a service:"
echo "   ./scripts/register-service.sh myservice 127.0.0.1 8080"
echo ""
echo "4. Discover services:"
echo "   ./scripts/discover-service.sh"
echo ""
echo "5. For Kubernetes deployment:"
echo "   kubectl apply -f kubernetes/"`
  ]
};
