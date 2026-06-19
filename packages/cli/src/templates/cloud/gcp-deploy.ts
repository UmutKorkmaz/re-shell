/**
 * GCP deployment configuration template.
 */
export const gcpDeployTemplate = {
  id: 'gcp-deploy',
  name: 'gcp-deploy',
  displayName: 'GCP Deployment',
  description: 'GCP deployment configuration (Cloud Run + Cloud SQL)',
  language: 'yaml',
  framework: 'gcp',
  version: '1.0.0',
  tags: ['gcp', 'cloud-run', 'cloud-sql', 'deployment'],
  port: 3000,
  dependencies: {},
  features: ['deployment', 'gcp', 'cloud-run', 'managed-database'],
  files: {
    'gcp/cloud-run.yaml': `apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: {{projectName}}
  namespace: default
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cloudsql-instances: PROJECT_ID:REGION:{{projectName}}-db
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
        - image: gcr.io/PROJECT_ID/{{projectName}}:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: {{projectName}}-secrets
                  key: database-url
          resources:
            limits:
              cpu: "1"
              memory: "512Mi"
`,
    'gcp/cloud-sql.tf': `# Cloud SQL PostgreSQL for {{projectName}}
resource "google_sql_database_instance" "main" {
  name             = "{{projectName}}-db"
  database_version = "POSTGRES_15"
  region           = var.gcp_region

  settings {
    tier = "db-f1-micro"
    disk_size = 20
    backup_configuration {
      enabled = true
    }
  }
}

resource "google_sql_database" "database" {
  name     = "{{projectName}}"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "users" {
  name     = "app"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}
`,
    'gcp/variables.tf': `variable "gcp_region" {
  default = "us-central1"
}

variable "project_id" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}
`,
    'gcp/README.md': `# GCP Deployment

## Deploy

\`\`\`bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT_ID/{{projectName}}:latest

# Deploy to Cloud Run
gcloud run deploy {{projectName}} \\
  --image gcr.io/PROJECT_ID/{{projectName}}:latest \\
  --region \${GCP_REGION} \\
  --platform managed \\
  --allow-unauthenticated \\
  --port 3000
\`\`\`
`,
  },
};
