import { BackendTemplate } from '../types';

/**
 * Service Communication Patterns Template
 * Complete service-to-service communication patterns (sync/async, pub/sub, event-driven)
 */
export const serviceCommunicationTemplate: BackendTemplate = {
  id: 'service-communication',
  name: 'Service Communication Patterns',
  displayName: 'Service-to-Service Communication',
  description: 'Complete service-to-service communication patterns including synchronous REST, async messaging, pub/sub with Redis/Kafka/RabbitMQ, and event-driven architectures',
  version: '1.0.0',
  language: 'typescript',
  framework: 'microservices',
  tags: ['kubernetes', 'microservices', 'communication', 'messaging', 'events', 'pubsub'],
  port: 8080,
  dependencies: {},
  features: ['microservices', 'docker', 'rest-api', 'queue', 'websockets', 'documentation'],

  files: {
    'communication/sync/rest-client.ts': `// Synchronous HTTP/REST Client
// Service A calling Service B

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface ServiceClientConfig {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  circuitBreakerThreshold?: number;
}

export class RestServiceClient {
  private client: AxiosInstance;
  private failureCount = 0;
  private lastFailureTime = 0;
  private circuitOpen = false;

  constructor(config: ServiceClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use((request) => {
      request.headers['X-Request-ID'] = this.generateRequestId();
      request.headers['X-Service-Name'] = 'service-a';
      return request;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.resetCircuitBreaker();
        return response;
      },
      (error) => {
        this.recordFailure();
        return Promise.reject(this.handleError(error));
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.client.get<T>(url, config).then((r) => r.data);
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.client.post<T>(url, data, config).then((r) => r.data);
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.client.put<T>(url, data, config).then((r) => r.data);
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.client.delete<T>(url, config).then((r) => r.data);
  }

  private generateRequestId(): string {
    return \`req-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= 5) {
      this.circuitOpen = true;
      console.warn('Circuit breaker opened');
    }
  }

  private resetCircuitBreaker(): void {
    this.failureCount = 0;
    this.circuitOpen = false;
  }

  private handleError(error: any): Error {
    if (this.circuitOpen) {
      return new Error('Circuit breaker is open');
    }
    return error;
  }
}

// Usage example
const serviceBClient = new RestServiceClient({
  baseURL: process.env.SERVICE_B_URL || 'http://localhost:3001',
  timeout: 5000,
  retryAttempts: 3,
});

export async function callServiceB() {
  try {
    const result = await serviceBClient.get<{ message: string }>('/api/data');
    return result;
  } catch (error) {
    console.error('Failed to call Service B:', error);
    throw error;
  }
}
`,

    'communication/sync/grpc-client.ts': `// Synchronous gRPC Client
// Service A calling Service B via gRPC

import * as grpc from '@grpc/grpc-js';
import { promisify } from 'util';

// Proto-generated interfaces (simplified)
interface ServiceBClient {
  getData(request: any): any;
  streamData(request: any): any;
}

export class GrpcServiceClient {
  private client: any;

  constructor(address: string) {
    // In production, load proto definitions
    this.client = new ServiceBClient(
      address,
      grpc.credentials.createInsecure()
    );
  }

  async getData(request: any): Promise<any> {
    const getData = promisify(this.client.getData).bind(this.client);
    try {
      const response = await getData(request);
      return response;
    } catch (error) {
      console.error('gRPC error:', error);
      throw error;
    }
  }

  streamData(request: any): any {
    return this.client.streamData(request);
  }
}

// Usage
const grpcClient = new GrpcServiceClient('localhost:50051');

export async function callGrpcService() {
  return grpcClient.getData({ id: '123' });
}
`,

    'communication/async/event-emitter.ts': `// Async Event Emitter Pattern
// In-memory event bus for service communication

import { EventEmitter } from 'events';

export enum EventType {
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  ORDER_PLACED = 'order.placed',
  ORDER_CANCELLED = 'order.cancelled',
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
}

export interface Event {
  type: EventType;
  payload: any;
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
}

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private eventLog: Event[] = [];

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  publish(event: Event): void {
    event.timestamp = new Date();
    this.eventLog.push(event);
    this.emit(event.type, event);
    this.emit('*', event); // Catch-all listener
  }

  subscribe(eventType: EventType, handler: (event: Event) => void): void {
    this.on(eventType, handler);
  }

  unsubscribe(eventType: EventType, handler: (event: Event) => void): void {
    this.off(eventType, handler);
  }

  getEventLog(): Event[] {
    return this.eventLog;
  }
}

// Usage
const eventBus = EventBus.getInstance();

// Service A: Publish events
export function publishUserCreated(user: any) {
  eventBus.publish({
    type: EventType.USER_CREATED,
    payload: user,
    correlationId: generateId(),
  });
}

// Service B: Subscribe to events
eventBus.subscribe(EventType.USER_CREATED, (event) => {
  console.log('User created:', event.payload);
  // Handle event
});
`,

    'communication/async/redis-pubsub.ts': `// Redis Pub/Sub Pattern
// Distributed event-driven communication

import { createClient } from 'redis';

export class RedisPubSub {
  private publisher: any;
  private subscriber: any;
  private handlers: Map<string, Set<(message: any) => void>> = new Map();

  constructor(redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.publisher = createClient({ url: redisUrl });
    this.subscriber = createClient({ url: redisUrl });

    this.initialize();
  }

  private async initialize() {
    await this.publisher.connect();
    await this.subscriber.connect();

    this.subscriber.subscribe('message', (err: any, message: any) => {
      if (err) {
        console.error('Subscription error:', err);
        return;
      }

      const channel = message.channel.toString();
      const data = JSON.parse(message.message.toString());

      const handlers = this.handlers.get(channel);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(data);
          } catch (error) {
            console.error(\`Handler error for channel \${channel}:\`, error);
          }
        });
      }
    });
  }

  async publish(channel: string, message: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.handlers.get(channel)!.add(handler);
  }

  async unsubscribe(channel: string, handler: (message: any) => void): Promise<void> {
    const handlers = this.handlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    }
  }

  async close(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}

// Usage
const pubsub = new RedisPubSub();

// Publisher
export async function publishUserEvent(user: any) {
  await pubsub.publish('user.created', {
    userId: user.id,
    email: user.email,
    timestamp: new Date().toISOString(),
  });
}

// Subscriber
export async function subscribeToUserEvents() {
  await pubsub.subscribe('user.created', (data) => {
    console.log('User created event received:', data);
  });
}
`,

    'communication/async/kafka-producer.ts': `// Kafka Producer
// High-throughput event streaming

import { Kafka } from 'kafkajs';

export class KafkaProducer {
  private producer: any;
  private kafka: Kafka;

  constructor(brokers: string[] = ['localhost:9092']) {
    this.kafka = new Kafka({
      clientId: 'service-a',
      brokers,
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      retries: 5,
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish(topic: string, key: string, value: any): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(value),
          timestamp: Date.now(),
        },
      ],
    });
  }

  async publishBatch(topic: string, messages: Array<{ key: string; value: any }>): Promise<void> {
    await this.producer.send({
      topic,
      messages: messages.map((m) => ({
        key: m.key,
        value: JSON.stringify(m.value),
        timestamp: Date.now(),
      })),
    });
  }
}

// Usage
const producer = new KafkaProducer();

export async function publishOrderEvent(order: any) {
  await producer.publish('orders', order.id, {
    eventType: 'order.created',
    orderId: order.id,
    userId: order.userId,
    total: order.total,
    items: order.items,
    timestamp: new Date().toISOString(),
  });
}
`,

    'communication/async/kafka-consumer.ts': `// Kafka Consumer
// Event-driven service consumption

import { Kafka, EachMessagePayload } from 'kafkajs';

export interface KafkaConsumerConfig {
  brokers: string[];
  groupId: string;
  topics: string[];
  handler: (payload: EachMessagePayload) => Promise<void>;
}

export class KafkaConsumer {
  private consumer: any;
  private kafka: Kafka;
  private config: KafkaConsumerConfig;

  constructor(config: KafkaConsumerConfig) {
    this.config = config;
    this.kafka = new Kafka({
      clientId: \`consumer-\${config.groupId}\`,
      brokers: config.brokers,
    });

    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 5000,
    });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topics: this.config.topics });

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        try {
          await this.config.handler(payload);
        } catch (error) {
          console.error('Error processing message:', error);
          throw error; // Will trigger retry
        }
      },
    });
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
  }
}

// Usage
const consumer = new KafkaConsumer({
  brokers: ['localhost:9092'],
  groupId: 'order-processor',
  topics: ['orders', 'payments'],
  handler: async ({ topic, partition, message }) => {
    const value = JSON.parse(message.value?.toString() || '{}');
    console.log(\`Received message from \${topic}:\`, value);

    // Process message
    await processOrderEvent(value);
  },
});

export async function startOrderConsumer() {
  await consumer.start();
}

async function processOrderEvent(event: any) {
  // Handle order event
}
`,

    'communication/async/rabbitmq-publisher.ts': `// RabbitMQ Publisher
// Reliable message delivery with confirmations

import amqp, { Channel, Connection } from 'amqplib';

export class RabbitMQPublisher {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private connected = false;

  constructor(private url: string = process.env.RABBITMQ_URL || 'amqp://localhost:5672') {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();

    // Enable publisher confirms
    await this.channel.confirmMode();

    this.connected = true;
  }

  async publishToExchange(
    exchange: string,
    routingKey: string,
    message: any
  ): Promise<boolean> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const content = Buffer.from(JSON.stringify(message));

    return this.channel.publish(exchange, routingKey, content, {
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      messageId: this.generateId(),
      timestamp: new Date(),
      deliveryMode: 2, // Persistent
    });
  }

  async publishToQueue(queue: string, message: any): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const content = Buffer.from(JSON.stringify(message));

    await this.channel.sendToQueue(queue, content, {
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      messageId: this.generateId(),
      timestamp: new Date(),
      deliveryMode: 2,
    });
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.connected = false;
  }

  private generateId(): string {
    return \`msg-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }
}

// Usage
const publisher = new RabbitMQPublisher();

export async function publishOrderCreated(order: any) {
  await publisher.publishToExchange(
    'orders',
    'order.created',
    {
      eventType: 'order.created',
      orderId: order.id,
      userId: order.userId,
      timestamp: new Date().toISOString(),
    }
  );
}
`,

    'communication/async/rabbitmq-consumer.ts': `// RabbitMQ Consumer
// Event-driven message consumption

import amqp, { Channel, Connection, Message } from 'amqplib';

export interface MessageHandler {
  (message: any, originalMessage: Message, channel: Channel): Promise<void>;
}

export class RabbitMQConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  constructor(private url: string = process.env.RABBITMQ_URL || 'amqp://localhost:5672') {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();

    // Prefetch for fair dispatch
    await this.channel.prefetch(1);
  }

  async consumeQueue(
    queue: string,
    handler: MessageHandler
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content, msg, this.channel!);
        this.channel!.ack(msg);
      } catch (error) {
        console.error('Error processing message:', error);
        // Negative acknowledge with requeue
        this.channel!.nack(msg, false, true);
      }
    });
  }

  async bindQueueToExchange(
    queue: string,
    exchange: string,
    routingKey: string
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}

// Usage
const consumer = new RabbitMQConsumer();

export async function startOrderConsumer() {
  await consumer.connect();

  await consumer.bindQueueToExchange('order-queue', 'orders', 'order.*');

  await consumer.consumeQueue('order-queue', async (message, msg, channel) => {
    console.log('Received order message:', message);

    // Process order
    await processOrder(message);
  });
}

async function processOrder(message: any) {
  // Handle order processing
}
`,

    'communication/event-sourcing/event-store.ts': `// Event Store Pattern
// Append-only log for event sourcing

import { EventEmitter } from 'events';

export interface Event {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  timestamp: Date;
  version: number;
}

export class EventStore extends EventEmitter {
  private events: Map<string, Event[]> = new Map();
  private snapshots: Map<string, any> = new Map();

  async appendEvents(aggregateId: string, events: Omit<Event, 'id' | 'timestamp'>[]): Promise<void> {
    const existingEvents = this.events.get(aggregateId) || [];
    const currentVersion = existingEvents.length;

    const newEvents: Event[] = events.map((e, i) => ({
      ...e,
      id: this.generateEventId(),
      timestamp: new Date(),
      version: currentVersion + i + 1,
    }));

    existingEvents.push(...newEvents);
    this.events.set(aggregateId, existingEvents);

    // Emit events for subscribers
    newEvents.forEach((event) => {
      this.emit(event.type, event);
      this.emit('event', event);
    });
  }

  async getEvents(aggregateId: string): Promise<Event[]> {
    return this.events.get(aggregateId) || [];
  }

  async getEventsByType(eventType: string): Promise<Event[]> {
    const allEvents: Event[] = [];
    for (const events of this.events.values()) {
      allEvents.push(...events.filter((e) => e.type === eventType));
    }
    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async saveSnapshot(aggregateId: string, state: any, version: number): Promise<void> {
    this.snapshots.set(aggregateId, { state, version });
  }

  async getSnapshot(aggregateId: string): Promise<{ state: any; version: number } | null> {
    return this.snapshots.get(aggregateId) || null;
  }

  private generateEventId(): string {
    return \`evt-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }
}

// Usage
const eventStore = new EventStore();

export async function createOrder(orderData: any) {
  const orderId = generateId();

  await eventStore.appendEvents(orderId, [
    {
      type: 'OrderCreated',
      aggregateId: orderId,
      aggregateType: 'Order',
      payload: orderData,
    },
  ]);

  return orderId;
}
`,

    'docker-compose.yml': `version: '3.8'

services:
  # Service A (REST API)
  service-a:
    build: ./service-a
    ports:
      - "3000:3000"
    environment:
      - SERVICE_B_URL=http://service-b:3001
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
      - RABBITMQ_URL=amqp://rabbitmq:5672
    networks:
      - app-net
    depends_on:
      - service-b
      - redis
      - kafka
      - rabbitmq

  # Service B (Backend)
  service-b:
    build: ./service-b
    ports:
      - "3001:3001"
    networks:
      - app-net

  # Redis for pub/sub
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - app-net

  # Kafka for event streaming
  kafka:
    image: bitnami/kafka:3.6
    ports:
      - "9092:9092"
    environment:
      - KAFKA_CFG_ZOOKEEPER_CONNECT=zookeeper:2181
      - KAFKA_CFG_LISTENERS=PLAINTEXT://:9092
      - KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092
      - ALLOW_PLAINTEXT_LISTENER=yes
    networks:
      - app-net
    depends_on:
      - zookeeper

  zookeeper:
    image: bitnami/zookeeper:3.8
    networks:
      - app-net

  # RabbitMQ for messaging
  rabbitmq:
    image: rabbitmq:3.12-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=admin
      - RABBITMQ_DEFAULT_PASS=admin
    networks:
      - app-net

networks:
  app-net:
    driver: bridge
`,

    'README.md': `# Service-to-Service Communication Patterns

Complete patterns for service-to-service communication including synchronous REST, async messaging, pub/sub, and event-driven architectures.

## Communication Patterns

### 1. Synchronous (Request/Response)

#### REST/HTTP
- Direct HTTP calls between services
- Circuit breaker pattern
- Retries with exponential backoff
- Timeout handling

#### gRPC
- High-performance RPC
- Protocol buffers for serialization
- Bi-directional streaming
- Load balancing

### 2. Asynchronous (Message-Based)

#### Event Emitter
- In-memory event bus
- Publisher/subscriber pattern
- Event sourcing support

#### Redis Pub/Sub
- Distributed pub/sub
- Real-time messaging
- Pattern-based subscriptions

#### Kafka
- Event streaming
- High throughput
- Partitioning for parallelism
- Offset management

#### RabbitMQ
- Reliable message delivery
- Exchange-based routing
- Dead letter queues
- Message acknowledgments

## Quick Start

\`\`\`bash
# Start all services
docker-compose up -d

# Test synchronous REST
curl http://localhost:3000/api/call-service-b

# Test Redis pub/sub (from Service A)
curl http://localhost:3000/api/publish-event

# Test Kafka producer
curl http://localhost:3000/api/publish-kafka

# Test RabbitMQ
curl http://localhost:3000/api/publish-rabbitmq
\`\`\`

## Examples

### Synchronous REST Client

\`\`\`typescript
const client = new RestServiceClient({
  baseURL: 'http://service-b:3001',
  timeout: 5000,
});

const result = await client.get('/api/data');
\`\`\`

### Redis Pub/Sub

\`\`\`typescript
const pubsub = new RedisPubSub();

// Publish
await pubsub.publish('user.created', userData);

// Subscribe
await pubsub.subscribe('user.created', (data) => {
  console.log('User created:', data);
});
\`\`\`

### Kafka Producer

\`\`\`typescript
const producer = new KafkaProducer(['kafka:9092']);

await producer.publish('orders', orderId, {
  eventType: 'order.created',
  orderId,
  timestamp: new Date().toISOString(),
});
\`\`\`

### RabbitMQ Consumer

\`\`\`typescript
const consumer = new RabbitMQConsumer();

await consumer.bindQueueToExchange('orders', 'orders', 'order.*');
await consumer.consumeQueue('orders', async (message) => {
  await processOrder(message);
});
\`\`\`

## Monitoring

- **Kafka UI**: http://localhost:9080 (kafka-ui)
- **RabbitMQ Management**: http://localhost:15672
- **Redis CLI**: \`docker exec -it redis redis-cli\`

## License

MIT
`,

    'Makefile': `.PHONY: help start stop test clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

start: ## Start all services
	docker-compose up -d

stop: ## Stop all services
	docker-compose down

logs: ## View logs from all services
	docker-compose logs -f

logs-service-a: ## View Service A logs
	docker-compose logs -f service-a

test-sync: ## Test synchronous communication
	curl http://localhost:3000/api/call-service-b

test-redis: ## Test Redis pub/sub
	curl -X POST http://localhost:3000/api/publish-redis

test-kafka: ## Test Kafka producer
	curl -X POST http://localhost:3000/api/publish-kafka

test-rabbitmq: ## Test RabbitMQ publisher
	curl -X POST http://localhost:3000/api/publish-rabbitmq

clean: ## Remove all containers and volumes
	docker-compose down -v
`
  },

  postInstall: [
    `echo "Setting up service-to-service communication patterns..."
echo ""
echo "1. Start services:"
echo "   docker-compose up -d"
echo ""
echo "2. Test synchronous REST:"
echo "   curl http://localhost:3000/api/call-service-b"
echo ""
echo "3. Test Redis pub/sub:"
echo "   curl -X POST http://localhost:3000/api/publish-redis"
echo ""
echo "4. Access RabbitMQ Management UI:"
echo "   open http://localhost:15672 (admin/admin)"
`
  ]
};
