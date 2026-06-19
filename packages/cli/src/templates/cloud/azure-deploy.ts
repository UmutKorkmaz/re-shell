/**
 * Azure deployment configuration template.
 */
export const azureDeployTemplate = {
  id: 'azure-deploy',
  name: 'azure-deploy',
  displayName: 'Azure Deployment',
  description: 'Azure deployment configuration (Container Apps + PostgreSQL)',
  language: 'yaml',
  framework: 'azure',
  version: '1.0.0',
  tags: ['azure', 'container-apps', 'postgres', 'deployment'],
  port: 3000,
  dependencies: {},
  features: ['deployment', 'azure', 'container-apps', 'managed-database'],
  files: {
    'azure/container-app.bicep': `// {{projectName}} Azure Container App
param location string = resourceGroup().location
param imageName string
param dbPassword string

resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '{{projectName}}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '{{projectName}}'
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: [
        {
          name: 'database-url'
          value: 'postgresql://app:\${dbPassword}@\${dbServer.properties.fullyQualifiedDomainName}:5432/{{projectName}}'
        }
      ]
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
      }
    }
    template: {
      containers: [
        {
          name: '{{projectName}}'
          image: imageName
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
          ]
          resources: {
            cpu: json('1')
            memory: '512Mi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
      }
    }
  }
}

resource dbServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '{{projectName}}-db'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: 'app'
    administratorLoginPassword: dbPassword
    version: '15'
    storage: {
      storageSizeGB: 20
    }
  }
}
`,
    'azure/parameters.json': JSON.stringify({
      '$schema': 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
      contentVersion: '1.0.0.0',
      parameters: {
        imageName: { value: '{{registryUrl}}/{{projectName}}:latest' },
        dbPassword: { reference: { keyVault: { id: '/subscriptions/SUBSCRIPTION/resourceGroups/RG/providers/Microsoft.KeyVault/vaults/KV' }, secretName: 'dbPassword' } },
      },
    }, null, 2),
    'azure/README.md': `# Azure Deployment

## Deploy

\`\`\`bash
# Build and push to ACR
az acr build --registry {{registryName}} --image {{projectName}}:latest .

# Deploy via Bicep
az deployment group create \\
  --resource-group \${RG} \\
  --template-file azure/container-app.bicep \\
  --parameters azure/parameters.json
\`\`\`
`,
  },
};
