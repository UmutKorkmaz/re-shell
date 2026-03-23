import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Event Streaming Patterns Generation
 *
 * Generate event streaming infrastructure with Kafka and Redis Streams,
 * including schema evolution and versioning support.
 */

export interface EventSchema {
  name: string;
  version: string;
  type: string;
  fields: EventField[];
  compatibility: 'backward' | 'forward' | 'full' | 'none';
}

export interface EventField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface EventStream {
  name: string;
  topic: string;
  partitions: number;
  replicationFactor: number;
  retentionMs: number;
  schemas: EventSchema[];
  producers: string[];
  consumers: string[];
}

export interface EventStreamingIntegration {
  platform: string;
  producerCode: string;
  consumerCode: string;
  schemaRegistryCode: string;
  dependencies: string[];
  buildInstructions: string[];
}

/**
 * Generate event stream configuration
 */
export async function generateEventStream(
  name: string,
  topic: string,
  schemas: EventSchema[],
  platform: 'kafka' | 'redis-streams',
  projectPath: string = process.cwd()
): Promise<EventStream> {
  const stream: EventStream = {
    name,
    topic,
    partitions: platform === 'kafka' ? 3 : 0,
    replicationFactor: platform === 'kafka' ? 2 : 0,
    retentionMs: platform === 'kafka' ? 604800000 : 0, // 7 days
    schemas,
    producers: [],
    consumers: [],
  };

  return stream;
}

/**
 * Generate default event schemas for CRUD operations
 */
export function generateEventSchemas(resource: string): EventSchema[] {
  const resourceName = toPascalCase(resource);

  return [
    {
      name: `${resourceName}Created`,
      version: '1.0.0',
      type: 'event',
      compatibility: 'backward',
      fields: [
        { name: 'eventId', type: 'string', required: true, description: 'Unique event ID' },
        { name: 'timestamp', type: 'string', required: true, description: 'Event timestamp' },
        { name: 'resourceId', type: 'string', required: true, description: 'Resource ID' },
        { name: 'data', type: 'object', required: true, description: 'Resource data' },
        { name: 'metadata', type: 'object', required: false, description: 'Event metadata' },
      ],
    },
    {
      name: `${resourceName}Updated`,
      version: '1.0.0',
      type: 'event',
      compatibility: 'backward',
      fields: [
        { name: 'eventId', type: 'string', required: true, description: 'Unique event ID' },
        { name: 'timestamp', type: 'string', required: true, description: 'Event timestamp' },
        { name: 'resourceId', type: 'string', required: true, description: 'Resource ID' },
        { name: 'data', type: 'object', required: true, description: 'Updated data' },
        { name: 'changes', type: 'array', required: false, description: 'Field changes' },
        { name: 'metadata', type: 'object', required: false, description: 'Event metadata' },
      ],
    },
    {
      name: `${resourceName}Deleted`,
      version: '1.0.0',
      type: 'event',
      compatibility: 'backward',
      fields: [
        { name: 'eventId', type: 'string', required: true, description: 'Unique event ID' },
        { name: 'timestamp', type: 'string', required: true, description: 'Event timestamp' },
        { name: 'resourceId', type: 'string', required: true, description: 'Resource ID' },
        { name: 'reason', type: 'string', required: false, description: 'Deletion reason' },
        { name: 'metadata', type: 'object', required: false, description: 'Event metadata' },
      ],
    },
  ];
}

/**
 * Generate event streaming integration for language
 */
export async function generateEventStreamingIntegration(
  stream: EventStream,
  platform: 'kafka' | 'redis-streams',
  language: string
): Promise<EventStreamingIntegration> {
  if (platform === 'kafka') {
    return generateKafkaIntegration(stream, language);
  } else {
    return generateRedisStreamsIntegration(stream, language);
  }
}

/**
 * Generate Kafka integration
 */
function generateKafkaIntegration(stream: EventStream, language: string): EventStreamingIntegration {
  switch (language) {
    case 'typescript':
      return generateTypeScriptKafka(stream);
    case 'python':
      return generatePythonKafka(stream);
    case 'go':
      return generateGoKafka(stream);
    default:
      return generateGenericKafka(stream, language);
  }
}

function generateTypeScriptKafka(stream: EventStream): EventStreamingIntegration {
  return {
    platform: 'kafka',
    producerCode: generateTypeScriptKafkaProducer(stream),
    consumerCode: generateTypeScriptKafkaConsumer(stream),
    schemaRegistryCode: generateTypeScriptSchemaRegistry(stream),
    dependencies: ['kafkajs', '@types/node'],
    buildInstructions: [
      'npm install kafkajs',
      'Start Kafka: docker-compose up -d kafka',
      'Create topic: kafka-topics --create --topic ${stream.topic} --partitions 3 --replication-factor 2',
      'Start producer: npm run start:producer',
      'Start consumer: npm run start:consumer',
    ],
  };
}

function generateTypeScriptKafkaProducer(stream: EventStream): string {
  const eventMethods = stream.schemas
    .map(
      (schema) => `  async produce${schema.name}(data: any): Promise<void> {
    const event = {
      key: data.resourceId,
      value: JSON.stringify({
        schema: '${schema.name}:${schema.version}',
        timestamp: new Date().toISOString(),
        data,
      }),
      headers: {
        'event-type': '${schema.name}',
        'schema-version': '${schema.version}',
      },
    };

    await this.producer.send({
      topic: '${stream.topic}',
      messages: [event],
    });

    console.log(\`Produced ${schema.name} event for resource \${data.resourceId}\`);
  }`
    )
    .join('\n\n');

  return `import { Kafka } from 'kafkajs';

interface EventMessage {
  schema: string;
  timestamp: string;
  data: any;
}

export class ${toPascalCase(stream.name)}Producer {
  private kafka: Kafka;
  private producer: any;

  constructor(brokers: string = 'localhost:9092') {
    this.kafka = new Kafka({
      clientId: '${toCamelCase(stream.name)}-producer',
      brokers: brokers.split(','),
    });
    this.producer = this.kafka.producer();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    console.log('Producer connected to Kafka');
  }

${eventMethods}

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    console.log('Producer disconnected from Kafka');
  }
}

// Usage example
async function main() {
  const producer = new ${toPascalCase(stream.name)}Producer();

  await producer.connect();

  await producer.produce${stream.schemas[0]?.name || 'Event'}({
    resourceId: '123',
    data: { name: 'Test Resource' },
  });

  await producer.disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}
`;
}

function generateTypeScriptKafkaConsumer(stream: EventStream): string {
  const handlers = stream.schemas
    .map(
      (schema) => `  private async handle${schema.name}(message: any): Promise<void> {
    try {
      const event: EventMessage = JSON.parse(message.value.toString());

      // Validate schema version
      const [schemaName, schemaVersion] = event.schema.split(':');

      if (schemaName !== '${schema.name}') {
        console.warn(\`Unexpected schema: \${schemaName}\`);
        return;
      }

      console.log(\`Processing ${schema.name} event:\`, event.data);

      // TODO: Implement ${schema.name} event handling logic
      // - Validate event data
      // - Update database
      // - Trigger side effects
      // - Emit new events

    } catch (error) {
      console.error(\`Error processing ${schema.name}:\`, error);
      throw error;
    }
  }`
    )
    .join('\n\n');

  return `import { Kafka, EachMessagePayload } from 'kafkajs';

interface EventMessage {
  schema: string;
  timestamp: string;
  data: any;
}

export class ${toPascalCase(stream.name)}Consumer {
  private kafka: Kafka;
  private consumer: any;

  constructor(brokers: string = 'localhost:9092', groupId: string = '${toSnakeCase(stream.name)}-group') {
    this.kafka = new Kafka({
      clientId: '${toCamelCase(stream.name)}-consumer',
      brokers: brokers.split(','),
    });
    this.consumer = this.kafka.consumer({ groupId });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: '${stream.topic}', fromBeginning: false });
    console.log('Consumer connected to Kafka');
  }

  async consume(): Promise<void> {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        const eventType = message.headers?.['event-type'] as string;

        console.log(\`Received event: \${eventType}\`);

        switch (eventType) {
${stream.schemas.map((s) => `          case '${s.name}':
            await this.handle${s.name}(message);
            break;`).join('\n')}
          default:
            console.warn(\`Unknown event type: \${eventType}\`);
        }
      },
    });
  }

${handlers}

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    console.log('Consumer disconnected from Kafka');
  }
}

// Usage example
async function main() {
  const consumer = new ${toPascalCase(stream.name)}Consumer();

  await consumer.connect();
  await consumer.consume();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await consumer.disconnect();
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch(console.error);
}
`;
}

function generateTypeScriptSchemaRegistry(stream: EventStream): string {
  const schemas = stream.schemas
    .map(
      (schema) => `export const ${toCamelCase(schema.name)}Schema = {
  name: '${schema.name}',
  version: '${schema.version}',
  type: '${schema.type}',
  compatibility: '${schema.compatibility}',
  fields: [
${schema.fields.map((f) => `    { name: '${f.name}', type: '${f.type}', required: ${f.required} },`).join('\n')}
  ],
} as const;`
    )
    .join('\n\n');

  return `// Event Schema Registry for ${stream.name}

${schemas}

export const ${toPascalCase(stream.name)}Schemas = {
${stream.schemas.map((s) => `  ${s.name}: ${toCamelCase(s.name)}Schema,`).join('\n')}
};

export function validateEvent(schemaName: string, event: any): boolean {
  const schema = Object.values(${toPascalCase(stream.name)}Schemas).find(s => s.name === schemaName);

  if (!schema) {
    console.error(\`Schema not found: \${schemaName}\`);
    return false;
  }

  // TODO: Implement full validation logic
  // - Check required fields
  // - Validate field types
  // - Check field constraints

  return true;
}

export function getSchemaVersion(schemaName: string): string {
  const schema = Object.values(${toPascalCase(stream.name)}Schemas).find(s => s.name === schemaName);
  return schema?.version || 'unknown';
}
`;
}

function generatePythonKafka(stream: EventStream): EventStreamingIntegration {
  return {
    platform: 'kafka',
    producerCode: generatePythonKafkaProducer(stream),
    consumerCode: generatePythonKafkaConsumer(stream),
    schemaRegistryCode: generatePythonSchemaRegistry(stream),
    dependencies: ['confluent-kafka', 'avro-python3'],
    buildInstructions: [
      'pip install confluent-kafka avro-python3',
      'Start Kafka: docker-compose up -d kafka',
      'Create topic: kafka-topics --create --topic ${stream.topic}',
      'Start producer: python producer.py',
      'Start consumer: python consumer.py',
    ],
  };
}

function generatePythonKafkaProducer(stream: EventStream): string {
  return `from confluent_kafka import Producer
import json
import sys

class ${toPascalCase(stream.name)}Producer:
    def __init__(self, bootstrap_servers='localhost:9092'):
        self.config = {
            'bootstrap.servers': bootstrap_servers,
            'client.id': '${toSnakeCase(stream.name)}-producer',
        }
        self.producer = Producer(self.config)

    def produce_${toSnakeCase(stream.name)}_created(self, data):
        self._produce_event('${stream.schemas[0]?.name || 'Event'}', data)

    def _produce_event(self, event_type, data):
        event = {
            'schema': f'{event_type}:1.0.0',
            'timestamp': '2024-01-01T00:00:00Z',
            'data': data
        }

        value = json.dumps(event).encode('utf-8')
        key = data.get('resourceId', '').encode('utf-8')

        self.producer.produce(
            topic='${stream.topic}',
            key=key,
            value=value,
            headers={'event-type': event_type, 'schema-version': '1.0.0'}
        )

        self.producer.flush(10)
        print(f"Produced {event_type} event")

    def close(self):
        self.producer.flush()

def main():
    producer = ${toPascalCase(stream.name)}Producer()

    producer.produce_${toSnakeCase(stream.name)}_created({
        'resourceId': '123',
        'data': {'name': 'Test'}
    })

    producer.close()

if __name__ == '__main__':
    main()
`;
}

function generatePythonKafkaConsumer(stream: EventStream): string {
  return `from confluent_kafka import Consumer, KafkaError
import json
import sys

class ${toPascalCase(stream.name)}Consumer:
    def __init__(self, bootstrap_servers='localhost:9092', group_id='${toSnakeCase(stream.name)}-group'):
        self.config = {
            'bootstrap.servers': bootstrap_servers,
            'group.id': group_id,
            'auto.offset.reset': 'earliest',
        }
        self.consumer = Consumer(self.config)

    def connect(self):
        self.consumer.subscribe(['${stream.topic}'])
        print('Consumer connected to Kafka')

    def consume(self):
        try:
            while True:
                msg = self.consumer.poll(1.0)

                if msg is None:
                    continue

                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    else:
                        print(f"Consumer error: {msg.error()}")
                        break

                event = json.loads(msg.value().decode('utf-8'))
                event_type = msg.headers()[0][1].decode('utf-8') if msg.headers() else None

                print(f"Received event: {event_type}")

                self.handle_event(event_type, event)

        except KeyboardInterrupt:
            pass
        finally:
            self.close()

    def handle_event(self, event_type, event):
        # TODO: Implement event handling logic
        print(f"Processing {event_type}: {event}")

    def close(self):
        self.consumer.close()
        print('Consumer disconnected')

def main():
    consumer = ${toPascalCase(stream.name)}Consumer()
    consumer.connect()
    consumer.consume()

if __name__ == '__main__':
    main()
`;
}

function generatePythonSchemaRegistry(stream: EventStream): string {
  return `# Event Schema Registry for ${stream.name}

${stream.schemas.map(s => `${toSnakeCase(s.name)}_schema = {
    'name': '${s.name}',
    'version': '${s.version}',
    'type': '${s.type}',
    'compatibility': '${s.compatibility}',
    'fields': [
${s.fields.map(f => `        {'name': '${f.name}', 'type': '${f.type}', 'required': ${f.required}},`).join('\n')}
    ]
}`).join('\n\n')}

${toPascalCase(stream.name)}_schemas = {
${stream.schemas.map(s => `    '${s.name}': ${toSnakeCase(s.name)}_schema,`).join('\n')}
}

def validate_event(schema_name, event):
    schema = ${toPascalCase(stream.name)}_schemas.get(schema_name)
    if not schema:
        print(f"Schema not found: {schema_name}")
        return False

    # TODO: Implement validation logic
    return True
`;
}

function generateGoKafka(stream: EventStream): EventStreamingIntegration {
  return {
    platform: 'kafka',
    producerCode: generateGoKafkaProducer(stream),
    consumerCode: generateGoKafkaConsumer(stream),
    schemaRegistryCode: `package schemas

// Event schemas for ${stream.name}
// TODO: Implement Go schema registry
`,
    dependencies: [
      'github.com/segmentio/kafka-go',
    ],
    buildInstructions: [
      'go get github.com/segmentio/kafka-go',
      'Start Kafka: docker-compose up -d kafka',
      'Create topic: kafka-topics --create --topic ${stream.topic}',
      'Start producer: go run producer.go',
      'Start consumer: go run consumer.go',
    ],
  };
}

function generateGoKafkaProducer(stream: EventStream): string {
  return `package main

import (
    "context"
    "encoding/json"
    "log"

    "github.com/segmentio/kafka-go"
)

type Event struct {
    Schema    string      \`json:"schema"\`
    Timestamp string      \`json:"timestamp"\`
    Data      interface{} \`json:"data"\`
}

type ${toPascalCase(stream.name)}Producer struct {
    writer *kafka.Writer
}

func New${toPascalCase(stream.name)}Producer(brokers []string) *${toPascalCase(stream.name)}Producer {
    return &${toPascalCase(stream.name)}Producer{
        writer: &kafka.Writer{
            Addr:     kafka.TCP(brokers...),
            Topic:    "${stream.topic}",
            Balancer: &kafka.LeastBytes{},
        },
    }
}

func (p *${toPascalCase(stream.name)}Producer) Produce${stream.schemas[0]?.name || 'Event'}(data map[string]interface{}) error {
    event := Event{
        Schema:    "${stream.schemas[0]?.name || 'Event'}:1.0.0",
        Timestamp: "2024-01-01T00:00:00Z",
        Data:      data,
    }

    value, _ := json.Marshal(event)
    key := []byte(data["resourceId"].(string))

    return p.writer.WriteMessages(context.Background(),
        kafka.Message{
            Key:   key,
            Value: value,
            Headers: []kafka.Header{
                {Key: "event-type", Value: []byte("${stream.schemas[0]?.name || 'Event'}")},
                {Key: "schema-version", Value: []byte("1.0.0")},
            },
        },
    )
}

func (p *${toPascalCase(stream.name)}Producer) Close() error {
    return p.writer.Close()
}

func main() {
    producer := New${toPascalCase(stream.name)}Producer([]string{"localhost:9092"})

    err := producer.Produc${stream.schemas[0]?.name || 'Event'}(map[string]interface{}{
        "resourceId": "123",
        "data":       map[string]string{"name": "Test"},
    })
    if err != nil {
        log.Fatal(err)
    }

    producer.Close()
}
`;
}

function generateGoKafkaConsumer(stream: EventStream): string {
  return `package main

import (
    "context"
    "encoding/json"
    "log"
    "os"
    "os/signal"
    "syscall"

    "github.com/segmentio/kafka-go"
)

type Event struct {
    Schema    string      \`json:"schema"\`
    Timestamp string      \`json:"timestamp"\`
    Data      interface{} \`json:"data"\`
}

type ${toPascalCase(stream.name)}Consumer struct {
    reader *kafka.Reader
}

func New${toPascalCase(stream.name)}Consumer(brokers []string, groupID string) *${toPascalCase(stream.name)}Consumer {
    return &${toPascalCase(stream.name)}Consumer{
        reader: kafka.NewReader(kafka.ReaderConfig{
            Brokers:  brokers,
            GroupID:  groupID,
            Topic:    "${stream.topic}",
            MinBytes: 10e3,
            MaxBytes: 10e6,
        }),
    }
}

func (c *${toPascalCase(stream.name)}Consumer) Consume() {
    ctx := context.Background()

    for {
        msg, err := c.reader.ReadMessage(ctx)
        if err != nil {
            log.Printf("Consumer error: %v", err)
            break
        }

        var event Event
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            log.Printf("Error unmarshaling: %v", err)
            continue
        }

        eventType := string(msg.Headers[0].Value)
        log.Printf("Received event: %s", eventType)

        c.handleEvent(eventType, event)
    }
}

func (c *${toPascalCase(stream.name)}Consumer) handleEvent(eventType string, event Event) {
    // TODO: Implement event handling logic
    log.Printf("Processing %s: %+v", eventType, event.Data)
}

func (c *${toPascalCase(stream.name)}Consumer) Close() {
    c.reader.Close()
}

func main() {
    consumer := New${toPascalCase(stream.name)}Consumer([]string{"localhost:9092"}, "${toSnakeCase(stream.name)}-group")

    // Handle graceful shutdown
    sigchan := make(chan os.Signal, 1)
    signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

    go consumer.Consume()

    <-sigchan
    log.Println("Shutting down consumer...")
    consumer.Close()
}
`;
}

function generateGenericKafka(stream: EventStream, language: string): EventStreamingIntegration {
  return {
    platform: 'kafka',
    producerCode: `// TODO: Implement Kafka producer for ${language}`,
    consumerCode: `// TODO: Implement Kafka consumer for ${language}`,
    schemaRegistryCode: `// TODO: Implement schema registry for ${language}`,
    dependencies: [],
    buildInstructions: [
      `Install Kafka client library for ${language}`,
      `Implement Kafka producer`,
      `Implement Kafka consumer`,
      `Implement schema registry`,
    ],
  };
}

/**
 * Generate Redis Streams integration
 */
function generateRedisStreamsIntegration(stream: EventStream, language: string): EventStreamingIntegration {
  if (language === 'typescript') {
    return {
      platform: 'redis-streams',
      producerCode: generateRedisStreamsProducer(stream),
      consumerCode: generateRedisStreamsConsumer(stream),
      schemaRegistryCode: generateTypeScriptSchemaRegistry(stream),
      dependencies: ['ioredis', '@types/node'],
      buildInstructions: [
        'npm install ioredis',
        'Start Redis: docker-compose up -d redis',
        'Start producer: npm run start:producer',
        'Start consumer: npm run start:consumer',
      ],
    };
  }
  return generateGenericKafka(stream, language);
}

function generateRedisStreamsProducer(stream: EventStream): string {
  return `import Redis from 'ioredis';

interface EventMessage {
  schema: string;
  timestamp: string;
  data: any;
}

export class ${toPascalCase(stream.name)}Producer {
  private client: Redis;
  private streamKey: string;

  constructor() {
    this.client = new Redis({ host: 'localhost', port: 6379 });
    this.streamKey = '${stream.topic}';
  }

  async produce${stream.schemas[0]?.name || 'Event'}(data: any): Promise<string> {
    const event: EventMessage = {
      schema: '${stream.schemas[0]?.name || 'Event'}:1.0.0',
      timestamp: new Date().toISOString(),
      data,
    };

    const id = await this.client.xadd(
      this.streamKey,
      '*',
      'event-type', '${stream.schemas[0]?.name || 'Event'}',
      'schema-version', '1.0.0',
      'data', JSON.stringify(event)
    );

    console.log(\`Produced ${stream.schemas[0]?.name || 'Event'} event: \${id}\`);
    return id;
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

// Usage example
async function main() {
  const producer = new ${toPascalCase(stream.name)}Producer();

  await producer.produce${stream.schemas[0]?.name || 'Event'}({
    resourceId: '123',
    data: { name: 'Test Resource' },
  });

  await producer.close();
}

if (require.main === module) {
  main().catch(console.error);
}
`;
}

function generateRedisStreamsConsumer(stream: EventStream): string {
  return `import Redis from 'ioredis';

interface EventMessage {
  schema: string;
  timestamp: string;
  data: any;
}

export class ${toPascalCase(stream.name)}Consumer {
  private client: Redis;
  private streamKey: string;
  private groupName: string;
  private consumerName: string;

  constructor() {
    this.client = new Redis({ host: 'localhost', port: 6379 });
    this.streamKey = '${stream.topic}';
    this.groupName = '${toSnakeCase(stream.name)}-group';
    this.consumerName = '${toSnakeCase(stream.name)}-consumer';
  }

  async connect(): Promise<void> {
    try {
      // Create consumer group if not exists
      await this.client.xgroup('CREATE', this.streamKey, this.groupName, '0', 'MKSTREAM');
      console.log('Consumer group created');
    } catch (error: any) {
      if (error.message.includes('BUSYGROUP')) {
        console.log('Consumer group already exists');
      } else {
        throw error;
      }
    }

    console.log('Consumer connected to Redis Streams');
  }

  async consume(): Promise<void> {
    while (true) {
      try {
        const results = await this.client.xreadgroup(
          'GROUP',
          this.groupName,
          this.consumerName,
          'COUNT',
          '1',
          'BLOCK',
          '5000',
          'STREAMS',
          this.streamKey,
          '>'
        );

        if (!results || results.length === 0) {
          continue;
        }

        for (const result of results) {
          const stream = result[1];
          const messages = result[2];

          for (const message of messages) {
            const messageId = message[0];
            const fields = message[1];

            const eventType = fields[1] as string;
            const eventData = JSON.parse(fields[5] as string);

            console.log(\`Received event: \${eventType} (ID: \${messageId})\`);

            await this.handleEvent(eventType, eventData);

            // Acknowledge message
            await this.client.xack(this.streamKey, this.groupName, messageId);
          }
        }
      } catch (error) {
        console.error('Error consuming:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async handleEvent(eventType: string, event: EventMessage): Promise<void> {
    console.log(\`Processing \${eventType}:\`, event.data);

    // TODO: Implement event handling logic
    // - Validate schema
    // - Process event
    // - Update database
    // - Trigger side effects
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

// Usage example
async function main() {
  const consumer = new ${toPascalCase(stream.name)}Consumer();

  await consumer.connect();
  await consumer.consume();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await consumer.close();
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch(console.error);
}
`;
}

/**
 * Write event streaming files
 */
export async function writeEventStreamingFiles(
  serviceName: string,
  integration: EventStreamingIntegration,
  outputPath: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputPath);

  // Write producer code
  if (integration.producerCode) {
    const producerFile = path.join(outputPath, `${serviceName}-producer.${getFileExtension(language)}`);
    await fs.writeFile(producerFile, integration.producerCode);
  }

  // Write consumer code
  if (integration.consumerCode) {
    const consumerFile = path.join(outputPath, `${serviceName}-consumer.${getFileExtension(language)}`);
    await fs.writeFile(consumerFile, integration.consumerCode);
  }

  // Write schema registry code
  if (integration.schemaRegistryCode) {
    const schemaDir = path.join(outputPath, 'schemas');
    await fs.ensureDir(schemaDir);
    const schemaFile = path.join(schemaDir, `registry.${getFileExtension(language)}`);
    await fs.writeFile(schemaFile, integration.schemaRegistryCode);
  }

  // Write docker-compose for Kafka
  if (integration.platform === 'kafka') {
    const composeFile = path.join(outputPath, 'docker-compose.yml');
    await fs.writeFile(composeFile, generateDockerCompose(serviceName));
  }

  // Write build instructions
  const readmeFile = path.join(outputPath, 'BUILD.md');
  const readmeContent = generateBuildREADME(serviceName, integration);
  await fs.writeFile(readmeFile, readmeContent);
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    typescript: 'ts',
    python: 'py',
    go: 'go',
    csharp: 'cs',
  };
  return extensions[language] || 'txt';
}

function generateDockerCompose(serviceName: string): string {
  return `version: '3.8'

services:
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    depends_on:
      - kafka
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
      KAFKA_CLUSTERS_0_ZOOKEEPER: zookeeper:2181
`;
}

function generateBuildREADME(serviceName: string, integration: EventStreamingIntegration): string {
  return `# Event Streaming Build Instructions for ${serviceName}

## Platform: ${integration.platform.toUpperCase()}

## Architecture

This setup includes:
- **Producer**: Writes events to the stream/topic
- **Consumer**: Reads and processes events from the stream/topic
- **Schema Registry**: Manages event schema versions and compatibility

## Dependencies

\`\`\`bash
${integration.dependencies.map((dep) => dep).join('\n')}
\`\`\`

## Build Steps

${integration.buildInstructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Usage

### Producer
\`\`\`bash
node ${serviceName}-producer.${getFileExtension('typescript')}
\`\`\`

### Consumer
\`\`\`bash
node ${serviceName}-consumer.${getFileExtension('typescript')}
\`\`\`

## Schema Evolution

Event schemas follow semantic versioning:
- **Patch** (1.0.x): Backward-compatible bug fixes
- **Minor** (1.x.0): Backward-compatible features
- **Major** (x.0.0): Breaking changes

## Compatibility Modes

- **Backward**: New consumers can read old events
- **Forward**: Old consumers can read new events
- **Full**: Both backward and forward compatible
- **None**: No compatibility guarantees

## Monitoring

Monitor stream metrics:
- **Throughput**: Events per second
- **Latency**: Event processing delay
- **Consumer Lag**: Unprocessed events
- **Error Rate**: Failed event processing

## Example Event

\`\`\`json
{
  "schema": "UserCreated:1.0.0",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "resourceId": "123",
    "data": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
\`\`\`
`;
}

/**
 * Display event stream info
 */
export async function displayEventStream(stream: EventStream): Promise<void> {
  console.log(chalk.bold(`\n🌊 Event Stream: ${stream.name}\n`));
  console.log(chalk.cyan(`Topic: ${stream.topic}`));
  console.log(chalk.cyan(`Partitions: ${stream.partitions}`));
  console.log(chalk.cyan(`Schemas: ${stream.schemas.length}\n`));

  console.log(chalk.bold('Event Schemas:\n'));

  for (const schema of stream.schemas) {
    console.log(`  ${chalk.green('✓')} ${schema.name} (v${schema.version})`);
    console.log(chalk.gray(`      Type: ${schema.type}`));
    console.log(chalk.gray(`      Compatibility: ${schema.compatibility}`));
    console.log(chalk.gray(`      Fields: ${schema.fields.length}`));
    console.log('');
  }
}

/**
 * Helper functions
 */
function toPascalCase(str: string): string {
  return str.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase());
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toSnakeCase(str: string): string {
  return (
    str.charAt(0).toLowerCase() + str.slice(1).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  );
}
