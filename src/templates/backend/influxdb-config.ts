import { BackendTemplate } from '../types';

export const influxdbConfigTemplate: BackendTemplate = {
  id: 'influxdb-config',
  name: 'influxdb-config',
  displayName: 'InfluxDB Time-Series Database',
  description: 'InfluxDB time-series database setup with advanced features: data retention policies, continuous queries, downsampling, and real-time analytics',
  language: 'javascript',
  framework: 'influxdb',
  version: '1.0.0',
  tags: ['influxdb', 'timeseries', 'metrics', 'monitoring', 'analytics', 'iot'],
  port: 3000,
  dependencies: {},
  features: ['database', 'monitoring', 'connection-pooling'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "seed": "node scripts/seed.js"
  },
  "dependencies": {
    "@influxdata/influxdb-client": "^1.33.0",
    "@influxdata/influxdb-client-apis": "^1.33.0",
    "express": "^4.18.2"
  }
}
`,

    'db/index.js': `import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { OrgsAPI, BucketsAPI, TasksAPI } from '@influxdata/influxdb-client-apis';

const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN || 'my-token';
const org = process.env.INFLUXDB_ORG || '{{projectName}}';
const bucket = process.env.INFLUXDB_BUCKET || '{{projectName}}';

export const influxDB = new InfluxDB({ url, token });

export const writeApi = influxDB.getWriteApi(org, bucket, 'ms');
export const queryApi = influxDB.getQueryApi(org);

// Setup APIs
export const orgsAPI = new OrgsAPI(influxDB);
export const bucketsAPI = new BucketsAPI(influxDB);
export const tasksAPI = new TasksAPI(influxDB);

// Write point helper
export function writePoint(measurement, tags, fields, timestamp) {
  const point = new Point(measurement);
  
  for (const [key, value] of Object.entries(tags)) {
    point.tag(key, String(value));
  }
  
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'number') {
      point.floatField(key, value);
    } else if (typeof value === 'boolean') {
      point.booleanField(key, value);
    } else if (typeof value === 'string') {
      point.stringField(key, value);
    }
  }
  
  if (timestamp) {
    point.timestamp(timestamp);
  }
  
  writeApi.writePoint(point);
  return point;
}

// Bulk write helper
export function writePoints(points) {
  writeApi.writePoints(points);
}

// Flush writes
export async function flush() {
  await writeApi.flush();
}

// Query helper
export async function executeQuery(fluxQuery) {
  const results = [];
  await queryApi.queryRows(fluxQuery, {
    next(row, tableMeta) {
      const o = tableMeta.toObject(row);
      results.push(o);
    },
    error(error) {
      console.error(error);
    },
    complete() {}
  });
  return results;
}

// Create bucket
export async function createBucket(bucketName, retentionDays = 30) {
  return await bucketsAPI.postBuckets({
    orgID: org,
    name: bucketName,
    retentionRules: [
      {
        type: 'expire',
        everySeconds: retentionDays * 24 * 60 * 60
      }
    ]
  });
}

// Create task (continuous query)
export async function createTask(name, fluxScript, every = '1h') {
  return await tasksAPI.postTasks({
    orgID: org,
    name: name,
    flux: fluxScript,
    every: every,
    status: 'active'
  });
}
`,

    'db/metrics.js': `import { writePoint, executeQuery, flush } from './index.js';

// Write metric
export function writeMetric(measurement, tags, fields) {
  return writePoint(measurement, tags, fields, new Date());
}

// Write counter
export function writeCounter(name, value, tags = {}) {
  return writeMetric(name, tags, { value, type: 'counter' });
}

// Write gauge
export function writeGauge(name, value, tags = {}) {
  return writeMetric(name, tags, { value, type: 'gauge' });
}

// Write histogram
export function writeHistogram(name, value, buckets, tags = {}) {
  return writeMetric(name, tags, { 
    value, 
    type: 'histogram',
    buckets: JSON.stringify(buckets)
  });
}

// Write summary
export function writeSummary(name, value, count, sum, tags = {}) {
  return writeMetric(name, tags, { 
    value, 
    count, 
    sum,
    type: 'summary'
  });
}

// HTTP request metrics
export function recordHttpRequest(method, route, statusCode, duration) {
  return writeMetric('http_requests', {
    method,
    route,
    status: String(statusCode)
  }, {
    duration,
    count: 1
  });
}

// Database query metrics
export function recordDbQuery(operation, table, duration, rowsAffected) {
  return writeMetric('db_queries', {
    operation,
    table
  }, {
    duration,
    rowsAffected
  });
}

// Business metrics
export function recordSale(productId, quantity, revenue, category) {
  return writeMetric('sales', {
    productId,
    category
  }, {
    quantity,
    revenue
  });
}

// System metrics
export function recordSystemMetrics(cpu, memory, disk) {
  return writeMetric('system', {
    host: process.env.HOSTNAME || 'localhost'
  }, {
    cpu,
    memory,
    disk
  });
}

// Query metrics over time range
export async function getMetrics(measurement, timeRange = '-1h', tags = {}) {
  const tagFilters = Object.entries(tags)
    .map(([k, v]) => \`r.\${k} == "\${v}"\`)
    .join(' and ');
    
  const filter = tagFilters ? \`|> filter(fn: (r) => \${tagFilters})\` : '';
  
  const query = \`
    from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "\${measurement}")
      \${filter}
  \`;
  
  return await executeQuery(query);
}

// Aggregate metrics
export async function getAggregatedMetrics(measurement, field, timeRange = '-1h', window = '5m') {
  const query = \`
    from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "\${measurement}")
      |> filter(fn: (r) => r._field == "\${field}")
      |> aggregateWindow(every: \${window}, fn: mean, createEmpty: false)
      |> yield(name: "mean")
  \`;
  
  return await executeQuery(query);
}

// Time series data with multiple fields
export async function getTimeSeries(measurement, fields, timeRange = '-1h') {
  const query = \`
    from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "\${measurement}")
      |> filter(fn: (r) => \${fields.map(f => \`r._field == "\${f}"\`).join(' or ')})
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  \`;
  
  return await executeQuery(query);
}

// Downsampling query
export function createDownsamplingTask(sourceBucket, targetBucket, window = '1h') {
  return \`
option task = {
  name: "\${sourceBucket}-downsample",
  every: \${window}
}

from(bucket: "\${sourceBucket}")
  |> range(start: -task.every)
  |> aggregateWindow(every: \${window}, fn: mean, createEmpty: false)
  |> set(key: "_measurement", value: "\${sourceBucket}_downsampled")
  |> to(bucket: "\${targetBucket}", org: "{{projectName}}")
  \`;
}
`,

    'db/queries/analytics.js': `import { executeQuery } from './index.js';

// Query: Average response time by route
export async function getAverageResponseTime(timeRange = '-1h') {
  const query = \`
    from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "http_requests")
      |> filter(fn: (r) => r._field == "duration")
      |> group(columns: ["route"])
      |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
      |> yield(name: "avg_duration")
  \`;
  
  return await executeQuery(query);
}

// Query: Request rate per minute
export async function getRequestRate(timeRange = '-1h') {
  const query = \`
    from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "http_requests")
      |> filter(fn: (r) => r._field == "count")
      |> aggregateWindow(every: 1m, fn: sum, createEmpty: false)
      |> yield(name: "request_rate")
  \`;
  
  return await executeQuery(query);
}

// Query: Error rate percentage
export async function getErrorRate(timeRange = '-1h') {
  const query = \`
    from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "http_requests")
      |> filter(fn: (r) => r._field == "count")
      |> group(columns: ["status"])
      |> aggregateWindow(every: 5m, fn: sum, createEmpty: false)
      |> pivot(rowKey:["_time"], columnKey: ["status"], valueColumn: "_value")
      |> map(fn: (r) => ({
        r with
        _value: (r._error_total / r._total) * 100.0
      }))
      |> yield(name: "error_rate")
  \`;
  
  return await executeQuery(query);
}

// Query: Sales over time
export async function getSalesOverTime(timeRange = '-24h', window = '1h') {
  const query = \`
    from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "sales")
      |> filter(fn: (r) => r._field == "revenue" or r._field == "quantity")
      |> aggregateWindow(every: \${window}, fn: sum, createEmpty: false)
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> yield(name: "sales")
  \`;
  
  return await executeQuery(query);
}

// Query: Top products by revenue
export async function getTopProducts(timeRange = '-7d', limit = 10) {
  const query = \`
    from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "sales")
      |> filter(fn: (r) => r._field == "revenue")
      |> group(columns: ["productId"])
      |> sum()
      |> sort(columns: ["_value"], desc: true)
      |> limit(n: \${limit})
      |> yield(name: "top_products")
  \`;
  
  return await executeQuery(query);
}

// Query: System resource trends
export async function getSystemTrends(timeRange = '-1h') {
  const query = \`
    from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "system")
      |> filter(fn: (r) => r._field == "cpu" or r._field == "memory" or r._field == "disk")
      |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> yield(name: "system_trends")
  \`;
  
  return await executeQuery(query);
}

// Query: Moving average
export async function getMovingAverage(measurement, field, timeRange = '-1h', window = '5m') {
  const query = \`
    from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "\${measurement}")
      |> filter(fn: (r) => r._field == "\${field}")
      |> movingAverage(n: \${parseInt(window) / 60000}) // Convert to data points
      |> yield(name: "moving_average")
  \`;
  
  return await executeQuery(query);
}

// Query: Anomaly detection (using z-score)
export async function detectAnomalies(measurement, field, timeRange = '-1h', threshold = 2) {
  const query = \`
    data = from(bucket: "{{projectName}}")
      |> range(start: \${timeRange})
      |> filter(fn: (r) => r._measurement == "\${measurement}")
      |> filter(fn: (r) => r._field == "\${field}")
    
    mean_val = data
      |> mean()
      |> findRecord(fn: (key) => true, idx: 0)
    
    sd_val = data
      |> stddev()
      |> findRecord(fn: (key) => true, idx: 0)
    
    anomalies = data
      |> map(fn: (r) => ({
        r with
        z_score: (r._value - mean_val._value) / sd_val._value
      }))
      |> filter(fn: (r) => Math.abs(r.z_score) > \${threshold})
    
    anomalies
      |> yield(name: "anomalies")
  \`;
  
  return await executeQuery(query);
}
`,

    'index.js': `import express from 'express';
import { writePoint, flush, executeQuery } from './db/index.js';
import { 
  recordHttpRequest, 
  recordDbQuery, 
  recordSale,
  recordSystemMetrics,
  getMetrics 
} from './db/metrics.js';
import { getAverageResponseTime, getRequestRate, getSalesOverTime } from './db/queries/analytics.js';

const app = express();
app.use(express.json());

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    recordHttpRequest(req.method, req.route?.path || req.path, res.statusCode, duration);
  });
  
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await executeQuery('buckets() |> limit(n: 1)');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

// Write metrics endpoint
app.post('/api/metrics/:measurement', async (req, res) => {
  const { measurement } = req.params;
  const { tags = {}, fields = {} } = req.body;
  
  writePoint(measurement, tags, fields, new Date());
  await flush();
  
  res.json({ success: true, measurement, tags, fields });
});

// Record sale
app.post('/api/sales', async (req, res) => {
  const { productId, quantity, revenue, category } = req.body;
  recordSale(productId, quantity, revenue, category);
  await flush();
  res.json({ success: true });
});

// System metrics endpoint (for monitoring agents)
app.post('/api/metrics/system', async (req, res) => {
  const { cpu, memory, disk } = req.body;
  recordSystemMetrics(cpu, memory, disk);
  await flush();
  res.json({ success: true });
});

// Query metrics
app.get('/api/metrics/:measurement', async (req, res) => {
  const { measurement } = req.params;
  const { range = '-1h' } = req.query;
  
  const metrics = await getMetrics(measurement, range);
  res.json(metrics);
});

// Analytics endpoints
app.get('/api/analytics/response-time', async (req, res) => {
  const { range = '-1h' } = req.query;
  const data = await getAverageResponseTime(range);
  res.json(data);
});

app.get('/api/analytics/request-rate', async (req, res) => {
  const { range = '-1h' } = req.query;
  const data = await getRequestRate(range);
  res.json(data);
});

app.get('/api/analytics/sales', async (req, res) => {
  const { range = '-24h', window = '1h' } = req.query;
  const data = await getSalesOverTime(range, window);
  res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server on port \${PORT}\`));
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - INFLUXDB_URL=http://influxdb:8086
      - INFLUXDB_TOKEN=my-token
      - INFLUXDB_ORG={{projectName}}
      - INFLUXDB_BUCKET={{projectName}}
    depends_on:
      - influxdb
    restart: unless-stopped

  # InfluxDB 2.x
  influxdb:
    image: influxdb:2.7
    ports:
      - "8086:8086"
    environment:
      - DOCKER_INFLUXDB_INIT_MODE=setup
      - DOCKER_INFLUXDB_INIT_USERNAME=admin
      - DOCKER_INFLUXDB_INIT_PASSWORD=password
      - DOCKER_INFLUXDB_INIT_ORG={{projectName}}
      - DOCKER_INFLUXDB_INIT_BUCKET={{projectName}}
      - DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=my-token
      - DOCKER_INFLUXDB_INIT_RETENTION=30d
    volumes:
      - influxdb_data:/var/lib/influxdb2
      - influxdb_config:/etc/influxdb
    restart: unless-stopped

  # Telegraf for metrics collection
  telegraf:
    image: telegraf:1.29
    volumes:
      - ./config/telegraf.conf:/etc/telegraf/telegraf.conf:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - influxdb
    restart: unless-stopped

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=
    volumes:
      - grafana_data:/var/lib/grafana
      - ./config/grafana/provisioning:/etc/grafana/provisioning:ro
    depends_on:
      - influxdb
    restart: unless-stopped

volumes:
  influxdb_data:
  influxdb_config:
  grafana_data:
`,

    'config/telegraf.conf': `[agent]
  interval = "10s"
  round_interval = true
  metric_batch_size = 1000
  metric_buffer_limit = 10000

[[outputs.influxdb_v2]]
  urls = ["http://influxdb:8086"]
  token = "my-token"
  organization = "{{projectName}}"
  bucket = "{{projectName}}"

# Input plugins
[[inputs.cpu]]
  percpu = true
  totalcpu = true
  collect_cpu_time = false

[[inputs.mem]]
[[inputs.system]]
[[inputs.disk]]

[[inputs.docker]]
  endpoint = "unix:///var/run/docker.sock"
  source_tag = false
  container_name = true

[[inputs.http_listener]]
  service_address = ":8186"
  paths = ["/telegraf"]
  method = "POST"
`,

    'config/grafana/provisioning/datasources/influxdb.yml': `apiVersion: 1

datasources:
  - name: InfluxDB
    type: influxdb
    access: proxy
    url: http://influxdb:8086
    jsonData:
      version: Flux
      organization: {{projectName}}
      defaultBucket: {{projectName}}
      httpMode: POST
    secureJsonData:
      token: my-token
    isDefault: true
    editable: true
`,

    'scripts/setup-tasks.sh': `#!/bin/bash
# Setup InfluxDB tasks and continuous queries

INFLUXDB_URL="http://localhost:8086"
INFLUXDB_TOKEN="my-token"
ORG="{{projectName}}"
BUCKET="{{projectName}}"

# Create downsampling task
curl -X POST "$INFLUXDB_URL/api/v2/tasks?org=$ORG" \\
  -H "Authorization: Token $INFLUXDB_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "downsample-raw-data",
    "flux": "from(bucket: "'"$BUCKET"'")
      |> range(start: -1h)
      |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
      |> set(key: "_measurement", value: "'"$BUCKET"'_downsampled")
      |> to(bucket: "'"$BUCKET"'_downsampled", org: "'"$ORG"'")",
    "every": "1h",
    "status": "active"
  }'

echo "Tasks setup complete!"
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
`,

    '.env.example': `# InfluxDB Configuration
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=my-token
INFLUXDB_ORG={{projectName}}
INFLUXDB_BUCKET={{projectName}}
INFLUXDB_RETENTION=30d

# Server
PORT=3000
NODE_ENV=development
`,

    'README.md': `# {{projectName}}

InfluxDB time-series database template with advanced analytics, downsampling, and real-time metrics.

## Features

- **Time-Series Database**: Optimized for metrics and events
- **Data Retention**: Configurable retention policies
- **Continuous Queries**: Automated downsampling and aggregation
- **Real-Time Analytics**: Moving averages, anomaly detection
- **Integration**: Telegraf collection, Grafana visualization
- **Flux Language**: Powerful query language for analytics

## Quick Start

### Local Development

\\\`\\\`\\\`bash
# Start InfluxDB
docker-compose up -d influxdb

# Start application
npm start
\\\`\\\`\\\`

### Full Stack with Grafana

\\\`\\\`\\\`bash
docker-compose up
\\\`\\\`\\\`

Access:
- Application: http://localhost:3000
- InfluxDB UI: http://localhost:8086
- Grafana: http://localhost:3001 (admin/admin)

## Writing Metrics

### HTTP Request Metrics
\\\`\\\`\\\`javascript
recordHttpRequest('GET', '/api/users', 200, 45);
\\\`\\\`\\\`

### Business Metrics
\\\`\\\`\\\`javascript
recordSale('product-123', 2, 29.99, 'electronics');
\\\`\\\`\\\`

### System Metrics
\\\`\\\`\\\`javascript
recordSystemMetrics(75.5, 60.2, 45.8); // cpu, memory, disk
\\\`\\\`\\\`

## Query Examples

### Average Response Time
\\\`\\\`\\\`flux
from(bucket: "{{projectName}}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "http_requests")
  |> filter(fn: (r) => r._field == "duration")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
\\\`\\\`\\\`

### Moving Average
\\\`\\\`\\\`flux
from(bucket: "{{projectName}}")
  |> range(start: -1h)
  |> movingAverage(n: 10)
\\\`\\\`\\\`

## Data Retention

- Raw data: 30 days
- Downsampled data: 365 days
- Configurable per bucket

## License

MIT
`
  }
};
