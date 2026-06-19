/**
 * AWS deployment configuration template.
 * Generates the files needed to deploy a re-shell service to AWS.
 */
export const awsDeployTemplate = {
  id: 'aws-deploy',
  name: 'aws-deploy',
  displayName: 'AWS Deployment',
  description: 'AWS deployment configuration (ECS Fargate + RDS + ALB)',
  language: 'yaml',
  framework: 'aws',
  version: '1.0.0',
  tags: ['aws', 'ecs', 'fargate', 'rds', 'alb', 'deployment'],
  port: 3000,
  dependencies: {},
  features: ['deployment', 'aws', 'ecs', 'load-balancer', 'managed-database'],
  files: {
    'aws/task-definition.json': JSON.stringify({
      family: '{{projectName}}-task',
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: '512',
      memory: '1024',
      executionRoleArn: 'arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole',
      containerDefinitions: [{
        name: '{{projectName}}',
        image: '{{accountId}}.dkr.ecr.{{region}}.amazonaws.com/{{projectName}}:latest',
        portMappings: [{ containerPort: 3000, protocol: 'tcp' }],
        environment: [
          { name: 'NODE_ENV', value: 'production' },
          { name: 'DATABASE_URL', value: '{{databaseUrl}}' },
        ],
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': '/ecs/{{projectName}}',
            'awslogs-region': '{{region}}',
            'awslogs-stream-prefix': 'ecs',
          },
        },
      }],
    }, null, 2),
    'aws/load-balancer.tf': `# ALB + Target Group for {{projectName}}
resource "aws_lb" "main" {
  name               = "{{projectName}}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = module.vpc.public_subnets
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "app" {
  name        = "{{projectName}}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
`,
    'aws/database.tf': `# RDS PostgreSQL for {{projectName}}
resource "aws_db_instance" "main" {
  identifier           = "{{projectName}}-db"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.t3.micro"
  allocated_storage    = 20
  db_name              = "{{projectName}}"
  username             = "postgres"
  password             = var.db_password
  db_subnet_group_name = aws_db_subnet_group.main.name
  skip_final_snapshot  = true
}

resource "aws_db_subnet_group" "main" {
  name       = "{{projectName}}-db-subnet"
  subnet_ids = module.vpc.private_subnets
}
`,
    'aws/variables.tf': `variable "aws_region" {
  default = "us-east-1"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "accountId" {
  type = string
}
`,
    'aws/README.md': `# AWS Deployment

## Prerequisites
- AWS CLI configured with appropriate credentials
- Terraform >= 1.5
- ECR repository created

## Deploy

\`\`\`bash
# Build and push the Docker image
docker build -t {{projectName}} .
aws ecr get-login-password --region \${AWS_REGION} | docker login --username AWS --password-stdin \${ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com
docker tag {{projectName}}:latest \${ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com/{{projectName}}:latest
docker push \${ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com/{{projectName}}:latest

# Provision infrastructure
cd aws
terraform init
terraform plan -var="accountId=\${ACCOUNT_ID}" -var="db_password=\${DB_PASSWORD}"
terraform apply -var="accountId=\${ACCOUNT_ID}}" -var="db_password=\${DB_PASSWORD}"
\`\`\`
`,
  },
};
