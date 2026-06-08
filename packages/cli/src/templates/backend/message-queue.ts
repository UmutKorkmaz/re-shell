import { BackendTemplate } from '../types';

export const messageQueueTemplate: BackendTemplate = {
  id: 'message-queue',
  name: 'message-queue',
  displayName: 'Message Queue Integration',
  description: 'Message queue integration template with RabbitMQ, Apache Kafka, and NATS support, including clustering, producer/consumer patterns, and dead letter queues',
  language: 'javascript',
  framework: 'message-queue',
  version: '1.0.0',
  tags: ['rabbitmq', 'kafka', 'nats', 'messaging', 'queue', 'pubsub', 'clustering'],
  port: 3000,
  dependencies: {},
  features: ['queue', 'connection-pooling', 'monitoring'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "consumer:rabbitmq": "node/consumers/rabbitmq.js",
    "consumer:kafka": "node/consumers/kafka.js",
    "consumer:nats": "node/consumers/nats.js"
  },
  "dependencies": {
    "amqplib": "^0.10.3",
    "kafkajs": "^2.2.4",
    "nats": "^2.24.0",
    "express": "^4.18.2"
  }
}
`,

    'queues/rabbitmq.js': `import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:password@localhost:5672';

let connection = null;
let channel = null;

export async function connectRabbitMQ() {
  if (connection) return { connection, channel };

  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  
  // Setup prefetch (QoS)
  await channel.prefetch(10);
  
  console.log('Connected to RabbitMQ');
  
  // Handle connection events
  connection.on('error', (err) => console.error('RabbitMQ connection error:', err));
  connection.on('close', () => console.log('RabbitMQ connection closed'));
  
  return { connection, channel };
}

export function getChannel() {
  if (!channel) throw new Error('RabbitMQ not connected. Call connectRabbitMQ() first.');
  return channel;
}

// Declare exchange
export async function declareExchange(exchangeName, type = 'direct', options = {}) {
  const ch = getChannel();
  await ch.assertExchange(exchangeName, type, {
    durable: true,
    ...options
  });
  console.log(\`Exchange \${exchangeName} declared\`);
}

// Declare queue
export async function declareQueue(queueName, options = {}) {
  const ch = getChannel();
  const queue = await ch.assertQueue(queueName, {
    durable: true,
    ...options
  });
  console.log(\`Queue \${queueName} declared\`);
  return queue;
}

// Bind queue to exchange
export async function bindQueue(queueName, exchangeName, routingKey = '') {
  const ch = getChannel();
  await ch.bindQueue(queueName, exchangeName, routingKey);
  console.log(\`Queue \${queueName} bound to \${exchangeName} with routing key '\${routingKey}'\`);
}

// Publish message
export async function publishMessage(exchangeName, routingKey, message, options = {}) {
  const ch = getChannel();
  const sent = ch.publish(
    exchangeName,
    routingKey,
    Buffer.from(JSON.stringify(message)),
    {
      persistent: true,
      ...options
    }
  );
  
  if (sent) {
    console.log(\`Message published to \${exchangeName}:\${routingKey}\`);
  } else {
    console.warn('Message buffer full, waiting...');
    await new Promise(resolve => ch.once('drain', resolve));
  }
  
  return sent;
}

// Send to queue (direct)
export async function sendToQueue(queueName, message, options = {}) {
  const ch = getChannel();
  const sent = ch.sendToQueue(
    queueName,
    Buffer.from(JSON.stringify(message)),
    {
      persistent: true,
      ...options
    }
  );
  return sent;
}

// Consume messages
export async function consumeMessages(queueName, handler, options = {}) {
  const ch = getChannel();
  
  await ch.consume(queueName, async (msg) => {
    if (msg) {
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content, msg);
        ch.ack(msg);
      } catch (error) {
        console.error('Error processing message:', error);
        ch.nack(msg, false, false); // Reject without requeue
      }
    }
  }, {
    noAck: false,
    ...options
  });
  
  console.log(\`Consuming from queue: \${queueName}\`);
}

// Create dead letter queue
export async function setupDeadLetterQueue(queueName, dlqName) {
  const ch = getChannel();
  
  // Declare dead letter exchange
  await ch.assertExchange(\`\${queueName}-dlx\`, 'direct', { durable: true });
  
  // Declare dead letter queue
  await ch.assertQueue(dlqName, { durable: true });
  
  // Bind DLQ to DLX
  await ch.bindQueue(dlqName, \`\${queueName}-dlx\`, dlqName);
  
  // Declare main queue with DLX argument
  await ch.assertQueue(queueName, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': \`\${queueName}-dlx\`,
      'x-dead-letter-routing-key': dlqName
    }
  });
  
  console.log(\`Dead letter queue \${dlqName} setup for \${queueName}\`);
}

export async function closeRabbitMQ() {
  if (channel) await channel.close();
  if (connection) await connection.close();
  connection = null;
  channel = null;
}
`,

    'queues/kafka.js': `import { Kafka, logLevel } from 'kafkajs';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const CLIENT_ID = process.env.KAFKA_CLIENT_ID || '{{projectName}}';

export const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: KAFKA_BROKERS,
  logLevel: logLevel.INFO,
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

export const producer = kafka.producer({
  maxInFlightRequests: 1,
  idempotent: true,
  transactionTimeout: 30000
});

export const consumer = kafka.consumer({
  groupId: '{{projectName}}-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

// Connect producer
export async function connectProducer() {
  await producer.connect();
  console.log('Kafka producer connected');
}

// Connect consumer
export async function connectConsumer() {
  await consumer.connect();
  console.log('Kafka consumer connected');
}

// Create topic
export async function createTopic(topicName, numPartitions = 3, replicationFactor = 1) {
  const admin = kafka.admin();
  await admin.connect();
  
  try {
    await admin.createTopics({
      topics: [{
        topic: topicName,
        numPartitions,
        replicationFactor
      }]
    });
    console.log(\`Topic \${topicName} created\`);
  } catch (error) {
    if (error.type === 'TOPIC_ALREADY_EXISTS') {
      console.log(\`Topic \${topicName} already exists\`);
    } else {
      throw error;
    }
  } finally {
    await admin.disconnect();
  }
}

// Send message
export async function sendMessage(topicName, key, value, headers = {}) {
  await producer.send({
    topic: topicName,
    messages: [{
      key,
      value: JSON.stringify(value),
      headers
    }]
  });
  
  console.log(\`Message sent to topic \${topicName}, key: \${key}\`);
}

// Send batch messages
export async function sendBatch(topicName, messages) {
  await producer.send({
    topic: topicName,
    messages: messages.map(({ key, value, headers }) => ({
      key,
      value: JSON.stringify(value),
      headers
    }))
  });
  
  console.log(\`\${messages.length} messages sent to topic \${topicName}\`);
}

// Subscribe to topic
export async function subscribe(topics, handler) {
  await consumer.subscribe({ topics, fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const value = JSON.parse(message.value?.toString() || '{}');
        const key = message.key?.toString();
        
        console.log(\`Processing message from \${topic}[\${partition}]: \${key}\`);
        
        await handler({
          topic,
          partition,
          key,
          value,
          headers: message.headers,
          timestamp: message.timestamp
        });
      } catch (error) {
        console.error('Error processing message:', error);
        throw error; // Will trigger retry based on Kafka config
      }
    }
  });
}

// Transactional send
export async function sendTransactional(topicName, messages) {
  const txn = await producer.transaction();
  
  try {
    await txn.send({
      topic: topicName,
      messages: messages.map(({ key, value }) => ({
        key,
        value: JSON.stringify(value)
      }))
    });
    
    await txn.commit();
    console.log(\`Transactional send to \${topicName} committed\`);
  } catch (error) {
    await txn.abort();
    console.error('Transaction aborted:', error);
    throw error;
  }
}

export async function disconnectProducer() {
  await producer.disconnect();
}

export async function disconnectConsumer() {
  await consumer.disconnect();
}
`,

    'queues/nats.js': `import { connect, NatsConnection, JetStreamClient } from 'nats';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const NATS_USER = process.env.NATS_USER || 'user';
const NATS_PASSWORD = process.env.NATS_PASSWORD || 'password';

let nc = null;
let js = null;

// Connect to NATS
export async function connectNATS() {
  if (nc) return { nc, js };

  nc = await connect({
    servers: NATS_URL,
    user: NATS_USER,
    pass: NATS_PASSWORD,
    timeout: 10000,
    reconnect: true,
    maxReconnectAttempts: -1
  });

  // Get JetStream client
  js = nc.jetstream();

  console.log('Connected to NATS');

  nc.closed().then((err) => {
    if (err) {
      console.error('NATS connection closed with error:', err);
    } else {
      console.log('NATS connection closed');
    }
  });

  return { nc, js };
}

export function getConnection() {
  if (!nc) throw new Error('NATS not connected. Call connectNATS() first.');
  return nc;
}

export function getJetStream() {
  if (!js) throw new Error('JetStream not initialized. Call connectNATS() first.');
  return js;
}

// Publish message
export async function publishMessage(subject, message) {
  const conn = getConnection();
  const encoded = JSON.stringify(message);
  
  await conn.publish(subject, encoded);
  console.log(\`Published to \${subject}\`);
}

// Request/Reply pattern
export async function requestReply(subject, message, timeout = 5000) {
  const conn = getConnection();
  const encoded = JSON.stringify(message);
  
  const response = await conn.request(subject, encoded, { timeout });
  return JSON.parse(response.string());
}

// Subscribe to subject
export async function subscribe(subject, handler, options = {}) {
  const conn = getConnection();
  
  const sub = conn.subscribe(subject, {
    ...options,
    callback: async (err, msg) => {
      if (err) {
        console.error('Subscription error:', err);
        return;
      }
      
      try {
        const data = JSON.parse(msg.string());
        await handler(data, msg);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    }
  });
  
  console.log(\`Subscribed to \${subject}\`);
  return sub;
}

// JetStream: Create stream
export async function createStream(streamName, subjects) {
  const js = getJetStream();
  
  try {
    await js.streams.info(streamName);
    console.log(\`Stream \${streamName} already exists\`);
  } catch (error) {
    await js.streams.add({
      name: streamName,
      subjects: subjects
    });
    console.log(\`Stream \${streamName} created\`);
  }
}

// JetStream: Publish to stream
export async function jsPublish(subject, message) {
  const js = getJetStream();
  const encoded = JSON.stringify(message);
  
  const ack = await js.publish(subject, encoded);
  console.log(\`JetStream published to \${subject}, seq: \${ack.seq}\`);
  
  return ack;
}

// JetStream: Create consumer
export async function createConsumer(streamName, consumerName, durableName, filterSubject = '>', ackPolicy = 'explicit') {
  const js = getJetStream();
  
  const consumerConfig = {
    name: consumerName,
    durable_name: durableName,
    ack_policy: ackPolicy,
    filter_subject: filterSubject,
    deliver_policy: 'all'
  };
  
  await js.consumers.add(streamName, consumerConfig);
  console.log(\`Consumer \${consumerName} created for stream \${streamName}\`);
}

// JetStream: Subscribe with consumer
export async function jsSubscribe(streamName, consumerName, handler) {
  const js = getJetStream();
  
  const consumer = await js.consumers.get(streamName, consumerName);
  const info = await consumer.info();
  
  const subscription = js.subscribe(streamName, consumerName);
  
  for await (const msg of subscription) {
    try {
      const data = JSON.parse(msg.string());
      await handler(data, msg);
      msg.ack();
    } catch (error) {
      console.error('Error processing JetStream message:', error);
      msg.nack();
    }
  }
}

// Queue group (load balancing)
export async function queueGroupSubscribe(subject, groupName, handler) {
  const conn = getConnection();
  
  const sub = conn.subscribe(subject, {
    queue: groupName,
    callback: async (err, msg) => {
      if (err) {
        console.error('Queue group subscription error:', err);
        return;
      }
      
      try {
        const data = JSON.parse(msg.string());
        await handler(data, msg);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    }
  });
  
  console.log(\`Subscribed to \${subject} in queue group \${groupName}\`);
  return sub;
}

export async function closeNATS() {
  if (nc) {
    await nc.close();
    nc = null;
    js = null;
  }
}
`,

    'index.js': `import express from 'express';
import { 
  connectRabbitMQ, 
  publishMessage, 
  sendToQueue, 
  declareExchange, 
  declareQueue,
  bindQueue 
} from './queues/rabbitmq.js';
import { 
  connectProducer, 
  sendMessage, 
  subscribe 
} from './queues/kafka.js';
import { 
  connectNATS, 
  publishMessage as natsPublish,
  subscribe as natsSubscribe,
  createStream
} from './queues/nats.js';

const app = express();
app.use(express.json());

// Initialize all connections
await connectRabbitMQ();
await connectProducer();
await connectNATS();

// Setup RabbitMQ infrastructure
await declareExchange('orders', 'topic');
await declareQueue('orders.created');
await bindQueue('orders.created', 'orders', 'orders.created');
await declareQueue('orders.email');
await bindQueue('orders.email', 'orders', 'orders.email');

// Setup Kafka topics
await createStream('ORDERS', ['orders.>', 'orders.created', 'orders.email']);

app.get('/health', async (req, res) => {
  res.json({ 
    status: 'healthy', 
    rabbitmq: !!rabbitmqChannel, 
    kafka: 'connected',
    nats: 'connected'
  });
});

// RabbitMQ publish endpoint
app.post('/api/rabbitmq/publish', async (req, res) => {
  const { exchange, routingKey, message } = req.body;
  await publishMessage(exchange || 'orders', routingKey || 'orders.created', message);
  res.json({ success: true, exchange, routingKey });
});

// Kafka publish endpoint
app.post('/api/kafka/publish', async (req, res) => {
  const { topic, key, message } = req.body;
  await sendMessage(topic || 'orders', key || 'order-id', message);
  res.json({ success: true, topic, key });
});

// NATS publish endpoint
app.post('/api/nats/publish', async (req, res) => {
  const { subject, message } = req.body;
  await natsPublish(subject || 'orders.created', message);
  res.json({ success: true, subject });
});

// Combined publish to all message brokers
app.post('/api/messages', async (req, res) => {
  const { routingKey = 'orders.created', message } = req.body;
  
  // Publish to all three
  await publishMessage('orders', routingKey, message);
  await sendMessage('orders', routingKey, message);
  await natsPublish(\`orders.\${routingKey}\`, message);
  
  res.json({ success: true, publishedTo: ['rabbitmq', 'kafka', 'nats'] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Message Queue Demo Server on port \${PORT}\`));
`,

    'consumers/rabbitmq.js': `import { connectRabbitMQ, consumeMessages } from '../queues/rabbitmq.js';

await connectRabbitMQ();

console.log('Starting RabbitMQ consumer...');

// Consume from orders queue
await consumeMessages('orders.created', async (message) => {
  console.log('Received order:', message);
  
  // Process order
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('Order processed:', message.id);
});

// Consume from email queue
await consumeMessages('orders.email', async (message) => {
  console.log('Sending email for order:', message);
  
  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, 50));
  
  console.log('Email sent for order:', message.id);
});

console.log('RabbitMQ consumers running...');
`,

    'consumers/kafka.js': `import { connectConsumer, subscribe } from '../queues/kafka.js';

await connectConsumer();

console.log('Starting Kafka consumer...');

await subscribe(['orders'], async ({ topic, key, value }) => {
  console.log(\`Kafka: Received from \${topic}, key \${key}:\`, value);
  
  // Process message
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log(\`Kafka: Processed \${key}\`);
});

console.log('Kafka consumer running...');
`,

    'consumers/nats.js': `import { connectNATS, subscribe, jsSubscribe } from '../queues/nats.js';

const { nc, js } = await connectNATS();

console.log('Starting NATS consumer...');

// Regular subscription
await subscribe('orders.*', async (data, msg) => {
  console.log(\`NATS: Received \${msg.subject}:\`, data);
  
  // Process message
  await new Promise(resolve => setTimeout(resolve, 50));
  
  console.log(\`NATS: Processed \${msg.subject}\`);
});

// JetStream subscription
try {
  await jsSubscribe('ORDERS', 'orders-consumer', async (data, msg) => {
    console.log(\`NATS JetStream: Received:\`, data);
    msg.ack();
  });
} catch (error) {
  console.log('JetStream not available, using regular NATS');
}

console.log('NATS consumers running...');
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - RABBITMQ_URL=amqp://user:password@rabbitmq:5672
      - KAFKA_BROKERS=kafka:9092
      - NATS_URL=nats://nats:4222
      - NATS_USER=user
      - NATS_PASSWORD=password
    depends_on:
      - rabbitmq
      - kafka
      - nats
    restart: unless-stopped

  # RabbitMQ with clustering
  rabbitmq-primary:
    image: rabbitmq:3.12-management
    hostname: rabbitmq-primary
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=user
      - RABBITMQ_DEFAULT_PASS=password
      - RABBITMQ_ERLANG_COOKIE=secret_cookie
    volumes:
      - rabbitmq_primary_data:/var/lib/rabbitmq
    restart: unless-stopped

  rabbitmq-secondary:
    image: rabbitmq:3.12-management
    hostname: rabbitmq-secondary
    ports:
      - "5673:5672"
    environment:
      - RABBITMQ_ERLANG_COOKIE=secret_cookie
    volumes:
      - rabbitmq_secondary_data:/var/lib/rabbitmq
    depends_on:
      - rabbitmq-primary
    restart: unless-stopped

  # Apache Kafka with Zookeeper
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      - ZOOKEEPER_CLIENT_PORT=2181
      - ZOOKEEPER_TICK_TIME=2000
    volumes:
      - zookeeper_data:/var/lib/zookeeper/data
      - zookeeper_log:/var/lib/zookeeper/log
    restart: unless-stopped

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    ports:
      - "9092:9092"
    environment:
      - KAFKA_BROKER_ID=1
      - KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181
      - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      - KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      - KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT
      - KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1
      - KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1
      - KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1
    volumes:
      - kafka_data:/var/lib/kafka/data
    depends_on:
      - zookeeper
    restart: unless-stopped

  # Kafka UI
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    ports:
      - "8080:8080"
    environment:
      - KAFKA_CLUSTERS_0_NAME=local
      - KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:29092
      - KAFKA_CLUSTERS_0_ZOOKEEPER=zookeeper:2181
    depends_on:
      - kafka
    restart: unless-stopped

  # NATS with JetStream
  nats:
    image: nats:latest
    ports:
      - "4222:4222"
      - "8222:8222"
    command: "-js -m 8222"
    environment:
      - NATS_USER=user
      - NATS_PASSWORD=password
    volumes:
      - nats_data:/data
    restart: unless-stopped

  # NATS monitoring
  nats-exporter:
    image: natsio/prometheus-nats-exporter:latest
    ports:
      - "7777:7777"
    environment:
      - NATS_URL=http://nats:8222
      - NATS_USER=user
      - NATS_PASSWORD=password
    depends_on:
      - nats
    restart: unless-stopped

volumes:
  rabbitmq_primary_data:
  rabbitmq_secondary_data:
  zookeeper_data:
  zookeeper_log:
  kafka_data:
  nats_data:
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
`,

    '.env.example': `# RabbitMQ Configuration
RABBITMQ_URL=amqp://user:password@localhost:5672

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID={{projectName}}

# NATS Configuration
NATS_URL=nats://localhost:4222
NATS_USER=user
NATS_PASSWORD=password

# Server
PORT=3000
NODE_ENV=development
`,

    'README.md': `# {{projectName}}

Message queue integration template with RabbitMQ, Apache Kafka, and NATS support.

## Features

- **RabbitMQ**: AMQP messaging with exchanges, queues, and routing keys
- **Apache Kafka**: Distributed event streaming with partitions and consumer groups
- **NATS**: High-performance messaging with JetStream persistence
- **Clustering**: High availability setup for all brokers
- **Dead Letter Queues**: Message failure handling
- **Producer/Consumer Patterns**: Multiple messaging patterns

## Quick Start

### Full Stack

\\\`\\\`\\\`bash
docker-compose up
\\\`\\\`\\\`

Access:
- Application: http://localhost:3000
- RabbitMQ Management: http://localhost:15672 (user/password)
- Kafka UI: http://localhost:8080
- NATS Monitoring: http://localhost:8222

## RabbitMQ Usage

### Publish message
\\\`\\\`\\\`javascript
import { publishMessage } from './queues/rabbitmq.js';
await publishMessage('orders', 'orders.created', { orderId: 123 });
\\\`\\\`\\\`

### Consume messages
\\\`\\\`\\\`javascript
import { consumeMessages } from './queues/rabbitmq.js';
await consumeMessages('orders.created', async (msg) => {
  console.log('Received:', msg);
});
\\\`\\\`\\\`

## Kafka Usage

### Send message
\\\`\\\`\\\`javascript
import { sendMessage } from './queues/kafka.js';
await sendMessage('orders', 'order-123', { orderId: 123 });
\\\`\\\`\\\`

### Subscribe
\\\`\\\`\\\`javascript
import { subscribe } from './queues/kafka.js';
await subscribe(['orders'], async ({ topic, key, value }) => {
  console.log('Received:', value);
});
\\\`\\\`\\\`

## NATS Usage

### Publish
\\\`\\\`\\\`javascript
import { publishMessage } from './queues/nats.js';
await publishMessage('orders.created', { orderId: 123 });
\\\`\\\`\\\`

### Subscribe
\\\`\\\`\\\`javascript
import { subscribe } from './queues/nats.js';
await subscribe('orders.*', async (data, msg) => {
  console.log('Received:', msg.subject, data);
});
\\\`\\\`\\\`

## License

MIT
`
  }
};
