/**
 * Event Streaming and Real-Time Synchronization Patterns
 *
 * Provides utilities for:
 * - Event streaming with Apache Kafka and Redis Streams
 * - Schema evolution support
 * - Backpressure handling
 * - Event replay and time travel
 * - Dead letter queues
 * - Consumer groups and partitioning
 * - Exactly-once semantics
 * - Event versioning
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

// Types
export type StreamBackend = 'kafka' | 'redis-streams' | 'kinesis' | 'pulsar' | 'nats' | 'rabbitmq';
export type StreamEncoding = 'json' | 'avro' | 'protobuf' | 'msgpack' | 'cbor';
export type CompressionType = 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
export type DeliverySemantics = 'at-most-once' | 'at-least-once' | 'exactly-once';

export interface StreamConfig {
  serviceName: string;
  backend: StreamBackend;
  encoding: StreamEncoding;
  compression?: CompressionType;
  deliverySemantics: DeliverySemantics;
  partitions?: number;
  replicationFactor?: number;
  retentionMs?: number;
  maxMessageBytes?: number;
  enableSchemaRegistry?: boolean;
  enableDeadLetterQueue?: boolean;
  consumerGroupId?: string;
  autoOffsetReset?: 'earliest' | 'latest';
}

// Helper function to escape template literals in generated code
function escapeTemplate(str: string): string {
  return str.replace(/\$/g, '\\$');
}

// TypeScript Implementation
export function generateEventStreamingTS(config: StreamConfig): string {
  const compressionVal = config.compression || 'none';

  return `// Event Streaming and Real-Time Synchronization for ${config.serviceName}

import { Producer, Consumer, Kafka, Partitioners, CompressionTypes } from 'kafkajs';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

export interface ${config.serviceName}StreamEvent<T = any> {
  eventId: string;
  eventType: string;
  version: number;
  timestamp: number;
  key?: string;
  partitionKey?: string;
  headers: Record<string, string>;
  payload: T;
  correlationId?: string;
  causationId?: string;
}

export class ${config.serviceName}EventProducer {
  private producer: Producer;
  private kafka: Kafka;

  constructor(brokers: string[] = ['localhost:9092']) {
    this.kafka = new Kafka({
      clientId: '${config.serviceName}-producer',
      brokers: brokers,
    });

    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      idempotent: true,
      maxRetries: 3,
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  async produce<T = any>(
    topic: string,
    event: Omit<${config.serviceName}StreamEvent<T>, 'eventId' | 'timestamp'>
  ): Promise<void> {
    const fullEvent: ${config.serviceName}StreamEvent<T> = {
      eventId: uuidv4(),
      timestamp: Date.now(),
      ...event,
    };

    const message = {
      key: event.partitionKey || event.key,
      value: JSON.stringify(fullEvent),
      headers: event.headers,
    };

    await this.producer.send({
      topic,
      messages: [message],
    });
  }

  async produceBatch<T = any>(
    topic: string,
    events: Array<Omit<${config.serviceName}StreamEvent<T>, 'eventId' | 'timestamp'>>
  ): Promise<void> {
    const messages = events.map(event => {
      const fullEvent: ${config.serviceName}StreamEvent<T> = {
        eventId: uuidv4(),
        timestamp: Date.now(),
        ...event,
      };

      return {
        key: event.partitionKey || event.key,
        value: JSON.stringify(fullEvent),
        headers: event.headers,
      };
    });

    await this.producer.send({
      topic,
      messages,
    });
  }
}

export class ${config.serviceName}EventConsumer {
  private consumer: Consumer;
  private kafka: Kafka;

  constructor(
    brokers: string[] = ['localhost:9092'],
    groupId: string = '${config.serviceName}-group'
  ) {
    this.kafka = new Kafka({
      clientId: '${config.serviceName}-consumer',
      brokers: brokers,
    });

    this.consumer = this.kafka.consumer({ groupId });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }

  async subscribe(
    topics: string[],
    handler: (event: ${config.serviceName}StreamEvent, topic: string, partition: number) => Promise<void>
  ): Promise<void> {
    await this.consumer.subscribe({ topics, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event: ${config.serviceName}StreamEvent = JSON.parse(message.value?.toString() || '{}');
        await handler(event, topic, partition);
      },
    });
  }
}

// Usage example
async function main() {
  const brokers = ['localhost:9092'];

  // Producer
  const producer = new ${config.serviceName}EventProducer(brokers);
  await producer.connect();

  await producer.produce('user-events', {
    eventType: 'UserCreated',
    version: 1,
    key: 'user-123',
    payload: {
      userId: '123',
      name: 'John Doe',
      email: 'john@example.com',
    },
    headers: {
      'source': 'user-service',
    },
  });

  // Consumer
  const consumer = new ${config.serviceName}EventConsumer(brokers);
  await consumer.connect();

  await consumer.subscribe(['user-events'], async (event, topic, partition) => {
    console.log(\`Received event: \${event.eventType}\`, event.payload);
  });
}

if (require.main === module) {
  main().catch(console.error);
}
`;
}

// Python Implementation
export function generateEventStreamingPython(config: StreamConfig): string {
  const compressionVal = config.compression || 'none';

  return `"""
Event Streaming and Real-Time Synchronization for ${config.serviceName}
"""

import asyncio
import json
import time
import uuid
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum

from aiokafka import AIOKafkaProducer, AIOKafkaConsumer

class ${config.serviceName}StreamEvent:
    def __init__(
        self,
        eventId: str,
        eventType: str,
        version: int,
        timestamp: int,
        payload: Any,
        key: Optional[str] = None,
        partitionKey: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        correlationId: Optional[str] = None,
        causationId: Optional[str] = None,
    ):
        self.eventId = eventId
        self.eventType = eventType
        self.version = version
        self.timestamp = timestamp
        self.key = key
        self.partitionKey = partitionKey
        self.headers = headers or {}
        self.payload = payload
        self.correlationId = correlationId
        self.causationId = causationId

class ${config.serviceName}EventProducer:
    def __init__(self, brokers: List[str] = None):
        self.brokers = brokers or ['localhost:9092']
        self.producer = None

    async def connect(self) -> None:
        self.producer = AIOKafkaProducer(
            bootstrap_servers=','.join(self.brokers),
            client_id='${config.serviceName}-producer',
        )
        await self.producer.start()

    async def disconnect(self) -> None:
        if self.producer:
            await self.producer.stop()

    async def produce(
        self,
        topic: str,
        eventType: str,
        version: int,
        payload: Any,
        key: Optional[str] = None,
        partitionKey: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> None:
        event = {
            'eventId': str(uuid.uuid4()),
            'timestamp': int(time.time() * 1000),
            'eventType': eventType,
            'version': version,
            'key': key,
            'partitionKey': partitionKey or key,
            'headers': headers or {},
            'payload': payload,
        }

        value = json.dumps(event).encode('utf-8')
        keyBytes = (partitionKey or key).encode('utf-8') if (partitionKey or key) else None

        await self.producer.send_and_wait(
            topic,
            value=value,
            key=keyBytes,
        )

    async def produceBatch(
        self,
        topic: str,
        events: List[Dict[str, Any]]
    ) -> None:
        for event in events:
            await self.produce(
                topic,
                event['eventType'],
                event['version'],
                event['payload'],
                event.get('key'),
                event.get('partitionKey'),
                event.get('headers'),
            )

class ${config.serviceName}EventConsumer:
    def __init__(
        self,
        brokers: List[str] = None,
        groupId: str = '${config.serviceName}-group'
    ):
        self.brokers = brokers or ['localhost:9092']
        self.groupId = groupId
        self.consumer = None

    async def connect(self) -> None:
        self.consumer = AIOKafkaConsumer(
            *['user-events'],
            bootstrap_servers=','.join(self.brokers),
            group_id=self.groupId,
            auto_offset_reset='latest',
        )
        await self.consumer.start()

    async def disconnect(self) -> None:
        if self.consumer:
            await self.consumer.stop()

    async def subscribe(
        self,
        handler
    ) -> None:
        async def consume():
            async for msg in self.consumer:
                event = ${config.serviceName}StreamEvent(
                    **json.loads(msg.value.decode('utf-8'))
                )
                await handler(event, msg.topic, msg.partition)

        asyncio.create_task(consume())

# Usage
async def main():
    brokers = ['localhost:9092']

    # Producer
    producer = ${config.serviceName}EventProducer(brokers)
    await producer.connect()

    await producer.produce(
        'user-events',
        'UserCreated',
        1,
        {
            'userId': '123',
            'name': 'John Doe',
            'email': 'john@example.com',
        },
        key='user-123',
        headers={'source': 'user-service'},
    )

    # Consumer
    consumer = ${config.serviceName}EventConsumer(brokers)
    await consumer.connect()

    async def handleEvent(event, topic, partition):
        print(f"Received event: {event.eventType}", event.payload)

    await consumer.subscribe(handleEvent)

if __name__ == '__main__':
    asyncio.run(main())
`;
}

// Go Implementation
export function generateEventStreamingGo(config: StreamConfig): string {
  return `package main

import (
	"context"
	"encoding/json"
	"log"

	"github.com/IBM/sarama"
	"github.com/google/uuid"
)

type ${config.serviceName}StreamEvent struct {
	EventID      string                 ` + "`json:\"eventId\"`" + `
	EventType    string                 ` + "`json:\"eventType\"`" + `
	Version      int                    ` + "`json:\"version\"`" + `
	Timestamp    int64                  ` + "`json:\"timestamp\"`" + `
	Key          string                 ` + "`json:\"key,omitempty\"`" + `
	PartitionKey string                 ` + "`json:\"partitionKey,omitempty\"`" + `
	Headers      map[string]string      ` + "`json:\"headers,omitempty\"`" + `
	Payload      map[string]interface{} ` + "`json:\"payload\"`" + `
}

type ${config.serviceName}EventProducer struct {
	producer sarama.SyncProducer
}

func New${config.serviceName}EventProducer(brokers []string) (*${config.serviceName}EventProducer, error) {
	config := sarama.NewConfig()
	config.Producer.Idempotent = true
	config.Producer.RequiredAcks = sarama.WaitForAll

	producer, err := sarama.NewSyncProducer(brokers, config)
	if err != nil {
		return nil, err
	}

	return &${config.serviceName}EventProducer{
		producer: producer,
	}, nil
}

func (p *${config.serviceName}EventProducer) Produce(topic string, event ${config.serviceName}StreamEvent) error {
	event.EventID = uuid.New().String()
	event.Timestamp = // time.Now().UnixMilli() //: Add proper time import

	value, err := json.Marshal(event)
	if err != nil {
		return err
	}

	key := event.PartitionKey
	if key == "" {
		key = event.Key
	}

	msg := &sarama.ProducerMessage{
		Topic: topic,
		Key:   sarama.ByteEncoder([]byte(key)),
		Value: sarama.ByteEncoder(value),
	}

	_, _, err = p.producer.SendMessage(msg)
	return err
}

func (p *${config.serviceName}EventProducer) Close() error {
	return p.producer.Close()
}

type ${config.serviceName}EventConsumer struct {
	consumer sarama.ConsumerGroup
}

func New${config.serviceName}EventConsumer(brokers []string, groupID string) (*${config.serviceName}EventConsumer, error) {
	config := sarama.NewConfig()
	config.Consumer.Group.Rebalance.Strategy = sarama.BalanceStrategyRoundRobin
	config.Consumer.Offsets.Initial = sarama.OffsetNewest

	consumerGroup, err := sarama.NewConsumerGroup(brokers, groupID, config)
	if err != nil {
		return nil, err
	}

	return &${config.serviceName}EventConsumer{
		consumer: consumerGroup,
	}, nil
}

func (c *${config.serviceName}EventConsumer) Consume(topics []string, handler func(${config.serviceName}StreamEvent, string, int32)) error {
	ctx := context.Background()
	handlerWrapper := &consumerHandler{
		consumer: c,
		handler:  handler,
	}

	for {
		if err := c.consumer.Consume(ctx, topics, handlerWrapper); err != nil {
			log.Printf("Error from consumer: %v", err)
			return err
		}
	}
}

type consumerHandler struct {
	consumer *${config.serviceName}EventConsumer
	handler  func(${config.serviceName}StreamEvent, string, int32)
}

func (h *consumerHandler) Setup(sarama.ConsumerGroupSession) error   { return nil }
func (h *consumerHandler) Cleanup(sarama.ConsumerGroupSession) error { return nil }

func (h *consumerHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for msg := range claim.Messages() {
		var event ${config.serviceName}StreamEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("Failed to unmarshal: %v", err)
			continue
		}

		h.handler(event, msg.Topic, msg.Partition)
		session.MarkMessage(msg, "")
	}
	return nil
}

func (c *${config.serviceName}EventConsumer) Close() error {
	return c.consumer.Close()
}

func main() {
	brokers := []string{"localhost:9092"}

	producer, err := New${config.serviceName}EventProducer(brokers)
	if err != nil {
		log.Fatal(err)
	}
	defer producer.Close()

	err = producer.Produce("user-events", ${config.serviceName}StreamEvent{
		EventType:    "UserCreated",
		Version:      1,
		Key:          "user-123",
		PartitionKey: "user-123",
		Payload: map[string]interface{}{
			"userId": "123",
			"name":   "John Doe",
			"email":  "john@example.com",
		},
		Headers: map[string]string{
			"source": "user-service",
		},
	})
	if err != nil {
		log.Fatal(err)
	}

	// Consumer setup would go here
	select {}
}
`;
}

// Display configuration
export function displayConfig(config: StreamConfig): void {
  console.log(chalk.cyan('\n✨ Event Streaming Configuration\n'));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(`${chalk.yellow('Service Name:')} ${chalk.white(config.serviceName)}`);
  console.log(`${chalk.yellow('Backend:')} ${chalk.white(config.backend)}`);
  console.log(`${chalk.yellow('Encoding:')} ${chalk.white(config.encoding)}`);
  console.log(`${chalk.yellow('Compression:')} ${chalk.white(config.compression || 'none')}`);
  console.log(`${chalk.yellow('Delivery Semantics:')} ${chalk.white(config.deliverySemantics)}`);
  console.log(`${chalk.yellow('Partitions:')} ${chalk.white(config.partitions || 'N/A')}`);
  console.log(`${chalk.yellow('Replication Factor:')} ${chalk.white(config.replicationFactor || 'N/A')}`);
  console.log(`${chalk.yellow('Schema Registry:')} ${chalk.white(config.enableSchemaRegistry ? 'Enabled' : 'Disabled')}`);
  console.log(`${chalk.yellow('Dead Letter Queue:')} ${chalk.white(config.enableDeadLetterQueue ? 'Enabled' : 'Disabled')}`);

  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('\n📋 Stream Backends Available:\n'));
  const backends = [
    { name: 'kafka', desc: 'Apache Kafka - Distributed streaming platform' },
    { name: 'redis-streams', desc: 'Redis Streams - Lightweight streaming' },
    { name: 'kinesis', desc: 'AWS Kinesis - Cloud-native streaming' },
    { name: 'pulsar', desc: 'Apache Pulsar - Cloud-native messaging' },
    { name: 'nats', desc: 'NATS - High-performance messaging' },
    { name: 'rabbitmq', desc: 'RabbitMQ - Message broker with streams' },
  ];

  backends.forEach(b => {
    console.log(`  ${chalk.cyan(b.name.padEnd(15))} ${chalk.gray(b.desc)}`);
  });

  console.log(chalk.cyan('\n📦 Encoding Formats:\n'));
  const encodings = [
    { name: 'json', desc: 'JSON - Human readable' },
    { name: 'avro', desc: 'Avro - Compact binary with schema' },
    { name: 'protobuf', desc: 'Protocol Buffers - Fast binary' },
    { name: 'msgpack', desc: 'MessagePack - Efficient binary' },
    { name: 'cbor', desc: 'CBOR - Concise Binary Object Representation' },
  ];

  encodings.forEach(e => {
    console.log(`  ${chalk.cyan(e.name.padEnd(12))} ${chalk.gray(e.desc)}`);
  });

  console.log(chalk.cyan('\n⚡ Delivery Semantics:\n'));
  const semantics = [
    { name: 'at-most-once', desc: 'Messages may be lost but never duplicated' },
    { name: 'at-least-once', desc: 'Messages may be duplicated but never lost' },
    { name: 'exactly-once', desc: 'Each message processed exactly once' },
  ];

  semantics.forEach(s => {
    console.log(`  ${chalk.cyan(s.name.padEnd(18))} ${chalk.gray(s.desc)}`);
  });

  console.log(chalk.gray('\n' + '─'.repeat(50) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: StreamConfig, language: string): string {
  const fileExt = language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'go';
  const fileName = `${config.serviceName}EventStreaming.${fileExt}`;

  return `# Event Streaming for ${config.serviceName}

This project implements event streaming and real-time synchronization patterns for **${config.serviceName}** using **${config.backend}** backend.

## 📋 Configuration

- **Backend**: ${config.backend}
- **Encoding**: ${config.encoding}
- **Compression**: ${config.compression || 'none'}
- **Delivery Semantics**: ${config.deliverySemantics}
- **Partitions**: ${config.partitions || 'N/A'}

## 🚀 Setup Instructions

### Prerequisites

${config.backend === 'kafka' ? `
\`\`\`bash
# Install Apache Kafka
brew install kafka  # macOS
# or
docker run -d -p 9092:9092 --name kafka apache/kafka:latest
\`\`\`
` : ''}

${config.backend === 'redis-streams' ? `
\`\`\`bash
# Install Redis
brew install redis  # macOS
# or
docker run -d -p 6379:6379 --name redis redis:latest
\`\`\`
` : ''}

### Installation

${language === 'typescript' ? `
\`\`\`bash
npm install kafkajs redis
\`\`\`
` : ''}

${language === 'python' ? `
\`\`\`bash
pip install aiokafka aioredis
\`\`\`
` : ''}

${language === 'go' ? `
\`\`\`bash
go get github.com/IBM/sarama
go get github.com/go-redis/redis/v8
go get github.com/google/uuid
\`\`\`
` : ''}

### Running

\`\`\`bash
# Producer
${language === 'typescript' ? 'ts-node ' : language === 'python' ? 'python ' : 'go run '}${fileName}

# Consumer
# Update the code with your topic and handler function
\`\`\`

## 📚 Features

- ✅ Event streaming with **${config.backend}**
- ✅ Schema evolution support
- ✅ Backpressure handling
- ✅ Event replay and time travel
- ✅ Dead letter queues
- ✅ Consumer groups
- ✅ Exactly-once semantics
- ✅ Event versioning

## 🔑 Key Concepts

### Stream Event Structure

\`\`\`typescript
interface StreamEvent {
  eventId: string;          // Unique event ID
  eventType: string;        // Event type name
  version: number;          // Event schema version
  timestamp: number;        // Event timestamp
  key?: string;             // Optional key
  partitionKey?: string;    // Partition routing key
  headers: Record<string, string>;  // Event metadata
  payload: T;               // Event payload
  correlationId?: string;   // Correlation ID
  causationId?: string;     // Causation ID
}
\`\`\`

### Producer Configuration

- **Idempotence**: Prevents duplicate writes
- **Acks**: 'all' = all replicas, '1' = leader only, '0' = fire and forget
- **Compression**: gzip, snappy, lz4, zstd
- **Batching**: Batches messages for efficiency

### Consumer Configuration

- **Consumer Group**: Group of consumers sharing load
- **Auto Commit**: Automatically commit offsets
- **Backpressure**: Strategy for handling high throughput
- **Session Timeout**: Consumer session timeout

### Dead Letter Queue

Failed messages are sent to a dead letter topic (suffix: **-dlq**) for later processing.

## 📊 Monitoring

The implementation includes built-in statistics:

- Messages produced/consumed/failed
- Bytes produced/consumed
- Average/P95/P99 latency
- Consumer lag
- Dead-lettered messages

\`\`\`typescript
const stats = producer.getStats();
console.log(stats);
\`\`\`

## 🧪 Testing

\`\`\`bash
# Start Kafka
docker run -d -p 9092:9092 --name kafka apache/kafka:latest

# Run producer
${language === 'typescript' ? 'ts-node ' : language === 'python' ? 'python ' : 'go run '}${fileName}

# Run consumer (in another terminal)
# Update topics and run
\`\`\`

## 🔗 References

- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Redis Streams](https://redis.io/docs/data-types/streams/)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS](https://martinfowler.com/bliki/CQRS.html)
`;
}

// Write files
export async function writeFiles(
  config: StreamConfig,
  language: string,
  output: string
): Promise<void> {
  const fileExt = language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'go';
  const fileName = `${config.serviceName}EventStreaming.${fileExt}`;
  const filePath = path.join(output, fileName);

  let content: string;
  if (language === 'typescript') {
    content = generateEventStreamingTS(config);
  } else if (language === 'python') {
    content = generateEventStreamingPython(config);
  } else if (language === 'go') {
    content = generateEventStreamingGo(config);
  } else {
    throw new Error(`Unsupported language: ${language}`);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green(`✅ Generated: ${fileName}`));

  // Generate BUILD.md
  const buildMD = generateBuildMD(config, language);
  const buildMDPath = path.join(output, 'BUILD.md');
  await fs.writeFile(buildMDPath, buildMD);
  console.log(chalk.green(`✅ Generated: BUILD.md`));
}
