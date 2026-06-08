import { BackendTemplate } from '../types';

/**
 * Volume Management Template
 * Complete volume management for databases, file storage, and persistent data
 */
export const volumeManagementTemplate: BackendTemplate = {
  id: 'volume-management',
  name: 'Volume Management',
  displayName: 'Volume Management',
  description: 'Complete volume management configuration for databases, file storage, and persistent data with Docker volumes, Kubernetes PV/PVC, StatefulSets, and backup scripts',
  version: '1.0.0',
  language: 'typescript',
  framework: 'docker',
  tags: ['kubernetes', 'docker', 'volumes', 'storage', 'databases', 'backup'],
  port: 8080,
  dependencies: {},
  features: ['docker', 'database', 'rest-api', 'security', 'documentation'],

  files: {
    'docker-compose-volumes.yml': `version: '3.8'

services:
  # PostgreSQL with persistent volume
  postgres:
    image: postgres:15-alpine
    container_name: postgres
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secretpassword
      POSTGRES_DB: appdb
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d:ro
    ports:
      - "5432:5432"
    networks:
      - app-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d appdb"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MySQL with persistent volume
  mysql:
    image: mysql:8.0
    container_name: mysql
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: appdb
      MYSQL_USER: admin
      MYSQL_PASSWORD: secretpassword
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql/init:/docker-entrypoint-initdb.d:ro
    ports:
      - "3306:3306"
    networks:
      - app-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MongoDB with persistent volume
  mongodb:
    image: mongo:7.0
    container_name: mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: secretpassword
      MONGO_INITDB_DATABASE: appdb
    volumes:
      - mongodb_data:/data/db
      - mongodb_config:/data/configdb
      - ./mongo/init:/docker-entrypoint-initdb.d:ro
    ports:
      - "27017:27017"
    networks:
      - app-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis with persistent volume
  redis:
    image: redis:7-alpine
    container_name: redis
    command: redis-server --appendonly yes --requirepass redispassword
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - app-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # File storage with persistent volume
  file-storage:
    image: nginx:alpine
    container_name: file-storage
    volumes:
      - file_storage_data:/uploads
      - ./nginx/file-storage.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "8081:80"
    networks:
      - app-net
    restart: unless-stopped

  # MinIO object storage
  minio:
    image: minio/minio:latest
    container_name: minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    networks:
      - app-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # Backup service
  backup:
    image: alpine:3.19
    container_name: backup
    volumes:
      - postgres_data:/data/postgres:ro
      - mysql_data:/data/mysql:ro
      - mongodb_data:/data/mongodb:ro
      - redis_data:/data/redis:ro
      - ./backups:/backups
      - ./scripts/backup.sh:/backup.sh:ro
    command: sh -c 'chmod +x /backup.sh && crond -f -l 2 && while true; do sleep 3600; /backup.sh; done'
    networks:
      - app-net
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/postgres

  mysql_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/mysql

  mongodb_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/mongodb

  mongodb_config:
    driver: local

  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/redis

  file_storage_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/files

  minio_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/minio

networks:
  app-net:
    driver: bridge
`,

    'kubernetes/storage-class.yaml': `# Storage Classes for Different Performance Tiers

# Fast SSD storage (default)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true

---
# Standard HDD storage
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard-hdd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: st1
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true

---
# High performance NVMe storage
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nvme-high-perf
provisioner: kubernetes.io/aws-ebs
parameters:
  type: io2
  iops: "10000"
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true

---
# Local storage for temporary data
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
`,

    'kubernetes/persistent-volumes.yaml': `# Persistent Volumes for Database Storage

apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-pv
  labels:
    type: local
    app: postgres
spec:
  storageClassName: local-storage
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  local:
    path: /mnt/data/postgres
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - node-1

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: databases
spec:
  storageClassName: fast-ssd
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi

---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mysql-pv
  labels:
    type: local
    app: mysql
spec:
  storageClassName: local-storage
  capacity:
    storage: 20Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  local:
    path: /mnt/data/mysql
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - node-1

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
  namespace: databases
spec:
  storageClassName: fast-ssd
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi

---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mongodb-pv
  labels:
    type: local
    app: mongodb
spec:
  storageClassName: local-storage
  capacity:
    storage: 50Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  local:
    path: /mnt/data/mongodb
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - node-2

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
  namespace: databases
spec:
  storageClassName: fast-ssd
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
`,

    'kubernetes/statefulset-postgres.yaml': `# PostgreSQL StatefulSet with Persistent Storage

apiVersion: v1
kind: Namespace
metadata:
  name: databases

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: databases
data:
  POSTGRES_DB: appdb
  POSTGRES_USER: admin
  POSTGRES_PASSWORD: secretpassword
  PGDATA: /var/lib/postgresql/data/pgdata

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: databases
  labels:
    app: postgres
spec:
  ports:
  - port: 5432
    name: postgres
  clusterIP: None
  selector:
    app: postgres

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: databases
spec:
  serviceName: postgres
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: POSTGRES_DB
        - name: POSTGRES_USER
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: POSTGRES_PASSWORD
        - name: PGDATA
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: PGDATA
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command:
            - sh
            - -c
            - pg_isready -U \\$(POSTGRES_USER) -d \\$(POSTGRES_DB)
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - sh
            - -c
            - pg_isready -U \\$(POSTGRES_USER) -d \\$(POSTGRES_DB)
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      storageClassName: fast-ssd
      accessModes:
      - ReadWriteOnce
      resources:
        requests:
          storage: 10Gi
`,

    'kubernetes/statefulset-mongodb.yaml': `# MongoDB StatefulSet with Persistent Storage

apiVersion: v1
kind: Namespace
metadata:
  name: databases

---
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-secret
  namespace: databases
type: Opaque
stringData:
  MONGO_INITDB_ROOT_USERNAME: admin
  MONGO_INITDB_ROOT_PASSWORD: secretpassword

---
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: databases
  labels:
    app: mongodb
spec:
  ports:
  - port: 27017
    name: mongodb
  clusterIP: None
  selector:
    app: mongodb

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: databases
spec:
  serviceName: mongodb
  replicas: 3
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
      - name: mongodb
        image: mongo:7.0
        ports:
        - containerPort: 27017
          name: mongodb
        env:
        - name: MONGO_INITDB_ROOT_USERNAME
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: MONGO_INITDB_ROOT_USERNAME
        - name: MONGO_INITDB_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: MONGO_INITDB_ROOT_PASSWORD
        command:
        - mongod
        - --bind_ip
        - 0.0.0.0
        - --replSet
        - rs0
        volumeMounts:
        - name: mongodb-data
          mountPath: /data/db
        - name: mongodb-config
          mountPath: /data/configdb
        livenessProbe:
          exec:
            command:
            - mongosh
            - --eval
            - "db.adminCommand('ping')"
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - mongosh
            - --eval
            - "db.adminCommand('ping')"
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
  volumeClaimTemplates:
  - metadata:
      name: mongodb-data
    spec:
      storageClassName: fast-ssd
      accessModes:
      - ReadWriteOnce
      resources:
        requests:
          storage: 50Gi
  - metadata:
      name: mongodb-config
    spec:
      storageClassName: fast-ssd
      accessModes:
      - ReadWriteOnce
      resources:
        requests:
          storage: 1Gi
`,

    'kubernetes/file-storage.yaml': `# File Storage with Persistent Volume

apiVersion: v1
kind: Namespace
metadata:
  name: storage

---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: file-storage-pv
spec:
  storageClassName: local-storage
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 10.0.0.10
    path: /exports/files

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: file-storage-pvc
  namespace: storage
spec:
  storageClassName: local-storage
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 100Gi

---
apiVersion: v1
kind: Deployment
metadata:
  name: file-storage
  namespace: storage
  labels:
    app: file-storage
spec:
  replicas: 1
  selector:
    matchLabels:
      app: file-storage
  template:
    metadata:
      labels:
        app: file-storage
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        volumeMounts:
        - name: files
          mountPath: /uploads
        - name: nginx-config
          mountPath: /etc/nginx/conf.d/default.conf
          subPath: default.conf
      volumes:
      - name: files
        persistentVolumeClaim:
          claimName: file-storage-pvc
      - name: nginx-config
        configMap:
          name: nginx-file-storage

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-file-storage
  namespace: storage
data:
  default.conf: |
    server {
        listen 80;
        server_name _;

        client_max_body_size 100M;

        location /uploads/ {
            alias /uploads/;
            autoindex off;
            add_header Content-Disposition attachment;
        }

        location /health {
            access_log off;
            return 200 "OK\\n";
        }
    }

---
apiVersion: v1
kind: Service
metadata:
  name: file-storage
  namespace: storage
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: file-storage
`,

    'scripts/backup.sh': `#!/bin/sh
# Backup script for database volumes

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
docker exec postgres pg_dumpall -U admin | gzip > "$BACKUP_DIR/postgres_$DATE.sql.gz"

# Backup MySQL
echo "Backing up MySQL..."
docker exec mysql mysqldump -u root -prootpassword --all-databases | gzip > "$BACKUP_DIR/mysql_$DATE.sql.gz"

# Backup MongoDB
echo "Backing up MongoDB..."
docker exec mongodb mongodump --uri="mongodb://admin:secretpassword@localhost:27017" --archive=- | gzip > "$BACKUP_DIR/mongodb_$DATE.archive.gz"

# Backup Redis
echo "Backing up Redis..."
docker exec redis redis-cli --rdb /data/dump.rdb
cp /data/redis/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Backup files
echo "Backing up file storage..."
tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" /data/files

# Remove old backups (keep last 7 days)
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
`,

    'scripts/restore.sh': `#!/bin/sh
# Restore script for database volumes

BACKUP_DIR="/backups"

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Detect backup type and restore
case "$BACKUP_FILE" in
    *postgres*)
        echo "Restoring PostgreSQL..."
        gunzip < "$BACKUP_FILE" | docker exec -i postgres psql -U admin
        ;;
    *mysql*)
        echo "Restoring MySQL..."
        gunzip < "$BACKUP_FILE" | docker exec -i mysql mysql -u root -prootpassword
        ;;
    *mongodb*)
        echo "Restoring MongoDB..."
        gunzip < "$BACKUP_FILE" | docker exec -i mongodb mongorestore --uri="mongodb://admin:secretpassword@localhost:27017" --archive
        ;;
    *redis*)
        echo "Restoring Redis..."
        docker cp "$BACKUP_FILE" redis:/data/dump.rdb
        docker exec redis redis-cli SHUTDOWN NOSAVE
        docker start redis
        ;;
    *files*)
        echo "Restoring files..."
        tar -xzf "$BACKUP_FILE" -C /
        ;;
    *)
        echo "Unknown backup type"
        exit 1
        ;;
esac

echo "Restore completed: $BACKUP_FILE"
`,

    'scripts/volume-cleanup.sh': `#!/bin/sh
# Volume cleanup script

echo "Cleaning up unused Docker volumes..."

# Remove dangling volumes
docker volume ls -qf dangling=true | xargs -r docker volume rm

# Remove volumes from stopped containers (older than 30 days)
docker ps -a -f status=exited --format "{{.ID}}" | while read -r container; do
    created=$(docker inspect -f '{{.Created}}' "$container" | date -d - +%s 2>/dev/null || echo "0")
    age=$(($(date +%s) - created))
    days=$((age / 86400))

    if [ "$days" -gt 30 ]; then
        echo "Removing volumes for container: $container"
        docker inspect -f '{{range .Mounts}}{{.Name}} {{end}}' "$container" | xargs -r docker volume rm
        docker rm "$container"
    fi
done

echo "Volume cleanup completed"
`,

    'README.md': `# Volume Management Configuration

Complete volume management configuration for databases, file storage, and persistent data.

## Features

### Docker Volumes
- **Database Volumes**: PostgreSQL, MySQL, MongoDB, Redis with persistent storage
- **File Storage**: Nginx file server with persistent uploads
- **Object Storage**: MinIO S3-compatible object storage
- **Backup Automation**: Scheduled backups with retention policy

### Kubernetes Storage
- **Storage Classes**: Fast SSD, Standard HDD, NVMe, Local storage
- **Persistent Volumes**: Pre-provisioned PVs for databases
- **StatefulSets**: PostgreSQL and MongoDB with stable network identities
- **PVC Templates**: Dynamic volume provisioning

### Backup & Restore
- **Automated Backups**: Scheduled database dumps
- **Retention Policy**: 7-day retention for backups
- **Restore Scripts**: One-click restore functionality

## Quick Start

### Docker Compose

\`\`\`bash
# Create data directories
mkdir -p /data/{postgres,mysql,mongodb,redis,files,minio,backups}

# Start all services
docker-compose -f docker-compose-volumes.yml up -d

# Verify volumes
docker volume ls

# Test backups
./scripts/backup.sh
\`\`\`

### Kubernetes

\`\`\`bash
# Create storage classes
kubectl apply -f kubernetes/storage-class.yaml

# Create PVs and PVCs
kubectl apply -f kubernetes/persistent-volumes.yaml

# Deploy PostgreSQL StatefulSet
kubectl apply -f kubernetes/statefulset-postgres.yaml

# Deploy file storage
kubectl apply -f kubernetes/file-storage.yaml

# Verify
kubectl get pv,pvc -n databases
kubectl get statefulsets -n databases
\`\`\`

## Storage Classes

\`\`\`bash
# List storage classes
kubectl get sc

# Set default storage class
kubectl patch storageclass fast-ssd -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
\`\`\`

## StatefulSets

StatefulSets provide:
- Stable network identities
- Ordered pod deployment
- Stable persistent storage
- Rolling updates with controlled scaling

\`\`\`bash
# Scale StatefulSet
kubectl scale statefulset postgres --replicas=5 -n databases

# View statefulset status
kubectl get statefulset postgres -n databases -w
\`\`\`

## Backup Scripts

\`\`\`bash
# Run backup manually
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh /backups/postgres_20240101_120000.sql.gz

# List backups
ls -lh /backups/
\`\`\`

## Volume Cleanup

\`\`\`bash
# Run cleanup
./scripts/volume-cleanup.sh

# Remove specific volume
docker volume rm postgres_data
\`\`\`

## License

MIT
`,

    'Makefile': `.PHONY: help start stop backup restore clean volumes

help: ## Show this help message
	@echo 'Usage: make [target]'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

start: ## Start all volume-backed services
	docker-compose -f docker-compose-volumes.yml up -d

stop: ## Stop all services
	docker-compose -f docker-compose-volumes.yml down

volumes: ## List all volumes
	docker volume ls

backup: ## Run backup script
	chmod +x scripts/backup.sh
	./scripts/backup.sh

restore: ## Restore from backup (use FILE=path/to/backup)
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=/backups/backup.sql.gz"; exit 1; fi
	chmod +x scripts/restore.sh
	./scripts/restore.sh "$(FILE)"

cleanup: ## Run volume cleanup
	chmod +x scripts/volume-cleanup.sh
	./scripts/volume-cleanup.sh

clean: ## Remove all containers and volumes
	docker-compose -f docker-compose-volumes.yml down -v
	docker volume prune -f

k8s-apply: ## Apply Kubernetes storage configuration
	kubectl apply -f kubernetes/storage-class.yaml
	kubectl apply -f kubernetes/persistent-volumes.yaml
	kubectl apply -f kubernetes/statefulset-postgres.yaml
	kubectl apply -f kubernetes/statefulset-mongodb.yaml
	kubectl apply -f kubernetes/file-storage.yaml

k8s-status: ## Check Kubernetes storage status
	kubectl get pv,pvc -A
	kubectl get statefulsets -n databases
	kubectl get storageclass

test-postgres: ## Test PostgreSQL connection
	docker exec postgres psql -U admin -d appdb -c "SELECT version();"

test-mysql: ## Test MySQL connection
	docker exec mysql mysql -u admin -psecretpassword -e "SELECT VERSION();"

test-mongodb: ## Test MongoDB connection
	docker exec mongodb mongosh --eval "db.version()"

test-redis: ## Test Redis connection
	docker exec redis redis-cli -a redispassword PING
`
  },

  postInstall: [
    `echo "Setting up volume management..."
echo ""
echo "Docker Compose:"
echo "1. Create data directories:"
echo "   mkdir -p /data/{postgres,mysql,mongodb,redis,files,minio,backups}"
echo ""
echo "2. Start services:"
echo "   docker-compose -f docker-compose-volumes.yml up -d"
echo ""
echo "3. Verify volumes:"
echo "   docker volume ls"
echo ""
echo "Kubernetes:"
echo "1. Apply storage configuration:"
echo "   kubectl apply -f kubernetes/storage-class.yaml"
echo ""
echo "2. Deploy StatefulSets:"
echo "   kubectl apply -f kubernetes/statefulset-postgres.yaml"
echo ""
echo "3. Check status:"
echo "   kubectl get pv,pvc -A"
`
  ]
};
