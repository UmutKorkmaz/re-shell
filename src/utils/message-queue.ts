import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Message Queue Integration Generation
 *
 * Generate message queue integration code for async communication
 * with guaranteed delivery across multiple queue providers.
 */

export interface MessageQueueConfig {
  name: string;
  provider: 'rabbitmq' | 'redis' | 'aws-sqs' | 'kafka' | 'azure';
  queues: QueueDefinition[];
  exchanges?: ExchangeDefinition[];
  bindings?: BindingDefinition[];
}

export interface QueueDefinition {
  name: string;
  durable: boolean;
  exclusive: boolean;
  autoDelete: boolean;
  arguments?: Record<string, any>;
}

export interface ExchangeDefinition {
  name: string;
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  durable: boolean;
}

export interface BindingDefinition {
  queue: string;
  exchange: string;
  routingKey: string;
}

export interface MessageHandler {
  queue: string;
  handlerName: string;
  processFunction: string;
}

export interface MessageQueueIntegration {
  provider: string;
  publisherCode: string;
  consumerCode: string;
  configurationCode: string;
  dependencies: string[];
  buildInstructions: string[];
}

/**
 * Generate message queue configuration
 */
export async function generateMessageQueueConfig(
  name: string,
  provider: MessageQueueConfig['provider'],
  queues: QueueDefinition[],
  projectPath: string = process.cwd()
): Promise<MessageQueueConfig> {
  const config: MessageQueueConfig = {
    name,
    provider,
    queues,
    exchanges: [],
    bindings: [],
  };

  // Create default exchange for direct messaging
  if (provider === 'rabbitmq') {
    config.exchanges = [
      {
        name: `${name}.exchange`,
        type: 'direct',
        durable: true,
      },
    ];

    // Create bindings
    config.bindings = queues.map((queue) => ({
      queue: queue.name,
      exchange: config.exchanges![0].name,
      routingKey: queue.name,
    }));
  }

  return config;
}

/**
 * Generate default queue definitions for CRUD operations
 */
export function generateQueueDefinitions(resource: string): QueueDefinition[] {
  const resourceName = resource.toLowerCase();

  return [
    {
      name: `${resourceName}.created`,
      durable: true,
      exclusive: false,
      autoDelete: false,
    },
    {
      name: `${resourceName}.updated`,
      durable: true,
      exclusive: false,
      autoDelete: false,
    },
    {
      name: `${resourceName}.deleted`,
      durable: true,
      exclusive: false,
      autoDelete: false,
    },
    {
      name: `${resourceName}.commands`,
      durable: true,
      exclusive: false,
      autoDelete: false,
    },
  ];
}

/**
 * Generate message queue integration for language
 */
export async function generateMessageQueueIntegration(
  config: MessageQueueConfig,
  language: string
): Promise<MessageQueueIntegration> {
  let integration: MessageQueueIntegration;

  switch (config.provider) {
    case 'rabbitmq':
      integration = generateRabbitMQIntegration(config, language);
      break;
    case 'redis':
      integration = generateRedisIntegration(config, language);
      break;
    case 'aws-sqs':
      integration = generateSQSIntegration(config, language);
      break;
    case 'kafka':
      integration = generateKafkaIntegration(config, language);
      break;
    case 'azure':
      integration = generateAzureIntegration(config, language);
      break;
    default:
      integration = generateGenericIntegration(config, language);
  }

  return integration;
}

/**
 * Generate RabbitMQ integration
 */
function generateRabbitMQIntegration(
  config: MessageQueueConfig,
  language: string
): MessageQueueIntegration {
  switch (language) {
    case 'typescript':
      return generateTypeScriptRabbitMQ(config);
    case 'python':
      return generatePythonRabbitMQ(config);
    case 'go':
      return generateGoRabbitMQ(config);
    default:
      return generateGenericIntegration(config, language);
  }
}

function generateTypeScriptRabbitMQ(config: MessageQueueConfig): MessageQueueIntegration {
  return {
    provider: 'rabbitmq',
    publisherCode: generateTypeScriptRabbitMQPublisher(config),
    consumerCode: generateTypeScriptRabbitMQConsumer(config),
    configurationCode: generateTypeScriptRabbitMQConfig(config),
    dependencies: ['amqplib', '@types/amqplib'],
    buildInstructions: [
      'npm install amqplib @types/amqplib',
      'Copy publisher to publisher.ts',
      'Copy consumer to consumer.ts',
      'Start publisher: npm run start:publisher',
      'Start consumer: npm run start:consumer',
    ],
  };
}

function generateTypeScriptRabbitMQPublisher(config: MessageQueueConfig): string {
  return `import amqp from 'amqplib';

interface Message {
  type: string;
  data: any;
  timestamp: string;
}

export class ${toPascalCase(config.name)}Publisher {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private exchangeName = '${config.exchanges?.[0]?.name || config.name}.exchange';

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect('amqp://localhost');
      this.channel = await this.connection.createChannel();

      // Assert exchange
      await this.channel.assertExchange(this.exchangeName, 'direct', { durable: true });

      console.log('Publisher connected to RabbitMQ');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async publish(routingKey: string, message: Message): Promise<boolean> {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }

    const content = Buffer.from(JSON.stringify(message));

    const published = this.channel.publish(
      this.exchangeName,
      routingKey,
      content,
      { persistent: true }
    );

    if (published) {
      console.log(\`Message published to \${routingKey}\`);
    } else {
      console.error('Failed to publish message');
    }

    return published;
  }

  async publish${toPascalCase(config.name)}Created(data: any): Promise<boolean> {
    return this.publish('${config.queues[0]?.name || 'created'}', {
      type: '${config.name}.created',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async publish${toPascalCase(config.name)}Updated(data: any): Promise<boolean> {
    return this.publish('${config.queues[1]?.name || 'updated'}', {
      type: '${config.name}.updated',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async publish${toPascalCase(config.name)}Deleted(data: any): Promise<boolean> {
    return this.publish('${config.queues[2]?.name || 'deleted'}', {
      type: '${config.name}.deleted',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('Publisher connection closed');
    } catch (error) {
      console.error('Error closing connection:', error);
    }
  }
}

// Usage example
async function main() {
  const publisher = new ${toPascalCase(config.name)}Publisher();
  await publisher.connect();

  await publisher.publish${toPascalCase(config.name)}Created({ id: '1', name: 'Test' });

  await publisher.close();
}

if (require.main === module) {
  main().catch(console.error);
}
`;
}

function generateTypeScriptRabbitMQConsumer(config: MessageQueueConfig): string {
  const handlers = config.queues
    .map(
      (queue) => `  async handle${toPascalCase(queue.name)}(message: Message): Promise<void> {
    const content = message.content.toString();
    const data = JSON.parse(content);

    console.log(\`Received message from ${queue.name}:\`, data);

    // TODO: Implement ${queue.name} handling logic
    // Process the message, update database, etc.

    // Acknowledge message
    this.channel?.ack(message);
  }`
    )
    .join('\n\n');

  const setupQueues = config.queues
    .map(
      (queue, i) => `    // Assert queue: ${queue.name}
    await this.channel.assertQueue('${queue.name}', { durable: ${queue.durable} });
    await this.channel.bindQueue('${queue.name}', this.exchangeName, '${queue.name}');

    // Consume from queue
    await this.channel.consume('${queue.name}', async (msg) => {
      if (msg) {
        await this.handle${toPascalCase(queue.name)}(msg);
      }
    });
    console.log('Consuming from queue: ${queue.name}');`
    )
    .join('\n\n');

  return `import amqp from 'amqplib';

export class ${toPascalCase(config.name)}Consumer {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private exchangeName = '${config.exchanges?.[0]?.name || config.name}.exchange';

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect('amqp://localhost');
      this.channel = await this.connection.createChannel();

      // Assert exchange
      await this.channel.assertExchange(this.exchangeName, 'direct', { durable: true });

      // Setup queues
${setupQueues}

      console.log('Consumer connected to RabbitMQ');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

${handlers}

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('Consumer connection closed');
    } catch (error) {
      console.error('Error closing connection:', error);
    }
  }
}

// Usage example
async function main() {
  const consumer = new ${toPascalCase(config.name)}Consumer();
  await consumer.connect();

  // Keep consumer running
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

function generateTypeScriptRabbitMQConfig(config: MessageQueueConfig): string {
  return `export interface MessageQueueConfig {
  url: string;
  exchange: string;
  queues: QueueConfig[];
}

export interface QueueConfig {
  name: string;
  durable: boolean;
  exclusive: boolean;
  autoDelete: boolean;
}

export const ${toCamelCase(config.name)}Config: MessageQueueConfig = {
  url: process.env.RABBITMQ_URL || 'amqp://localhost',
  exchange: '${config.exchanges?.[0]?.name || config.name}.exchange',
  queues: [
${config.queues
  .map(
    (q) => `    {
      name: '${q.name}',
      durable: ${q.durable},
      exclusive: ${q.exclusive},
      autoDelete: ${q.autoDelete},
    }`
  )
  .join(',\n')}
  ],
};
`;
}

function generatePythonRabbitMQ(config: MessageQueueConfig): MessageQueueIntegration {
  return {
    provider: 'rabbitmq',
    publisherCode: generatePythonRabbitMQPublisher(config),
    consumerCode: generatePythonRabbitMQConsumer(config),
    configurationCode: generatePythonRabbitMQConfig(config),
    dependencies: ['pika'],
    buildInstructions: [
      'pip install pika',
      'Copy publisher to publisher.py',
      'Copy consumer to consumer.py',
      'Start publisher: python publisher.py',
      'Start consumer: python consumer.py',
    ],
  };
}

function generatePythonRabbitMQPublisher(config: MessageQueueConfig): string {
  return `import pika
import json
import sys

class ${toPascalCase(config.name)}Publisher:
    def __init__(self, host='localhost'):
        self.connection = None
        self.channel = None
        self.exchange_name = '${config.exchanges?.[0]?.name || config.name}.exchange'
        self.host = host

    def connect(self):
        try:
            self.connection = pika.BlockingConnection(
                pika.ConnectionParameters(host=self.host)
            )
            self.channel = self.connection.channel()

            # Declare exchange
            self.channel.exchange_declare(
                exchange=self.exchange_name,
                exchange_type='direct',
                durable=True
            )

            print(f"Publisher connected to RabbitMQ at {self.host}")
        except Exception as error:
            print(f"Failed to connect to RabbitMQ: {error}")
            raise

    def publish(self, routing_key, message):
        if not self.channel:
            raise Exception("Channel not initialized. Call connect() first.")

        body = json.dumps(message).encode()
        self.channel.basic_publish(
            exchange=self.exchange_name,
            routing_key=routing_key,
            body=body,
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        print(f"Message published to {routing_key}")

    def publish_${toSnakeCase(config.name)}_created(self, data):
        self.publish('${config.queues[0]?.name || 'created'}', {
            'type': '${config.name}.created',
            'data': data,
            'timestamp': '2024-01-01T00:00:00Z'
        })

    def close(self):
        try:
            if self.connection and not self.connection.is_closed:
                self.connection.close()
                print("Publisher connection closed")
        except Exception as error:
            print(f"Error closing connection: {error}")

def main():
    publisher = ${toPascalCase(config.name)}Publisher()
    publisher.connect()

    publisher.publish_${toSnakeCase(config.name)}_created({'id': '1', 'name': 'Test'})

    publisher.close()

if __name__ == '__main__':
    main()
`;
}

function generatePythonRabbitMQConsumer(config: MessageQueueConfig): string {
  const handlers = config.queues
    .map(
      (queue) => `    def handle_${toSnakeCase(queue.name)}(self, ch, method, properties, body):
        try:
            data = json.loads(body.decode())
            print(f"Received message from ${queue.name}: {data}")

            # TODO: Implement ${queue.name} handling logic
            # Process the message, update database, etc.

            # Acknowledge message
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as error:
            print(f"Error processing message: {error}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)`
    )
    .join('\n\n');

  const setupQueues = config.queues
    .map(
      (queue) => `        # Declare queue: ${queue.name}
        self.channel.queue_declare(queue='${queue.name}', durable=${queue.durable})
        self.channel.queue_bind(
            queue='${queue.name}',
            exchange=self.exchange_name,
            routing_key='${queue.name}'
        )

        # Set up consumer
        self.channel.basic_consume(
            queue='${queue.name}',
            on_message_callback=lambda ch, method, properties, body: self.handle_${toSnakeCase(queue.name)}(ch, method, properties, body)
        )
        print(f"Consuming from queue: ${queue.name}")`
    )
    .join('\n\n');

  return `import pika
import json
import signal
import sys

class ${toPascalCase(config.name)}Consumer:
    def __init__(self, host='localhost'):
        self.connection = None
        self.channel = None
        self.exchange_name = '${config.exchanges?.[0]?.name || config.name}.exchange'
        self.host = host

    def connect(self):
        try:
            self.connection = pika.BlockingConnection(
                pika.ConnectionParameters(host=self.host)
            )
            self.channel = self.connection.channel()

            # Declare exchange
            self.channel.exchange_declare(
                exchange=self.exchange_name,
                exchange_type='direct',
                durable=True
            )

            # Setup queues
${setupQueues}

            print(f"Consumer connected to RabbitMQ at {self.host}")
        except Exception as error:
            print(f"Failed to connect to RabbitMQ: {error}")
            raise

${handlers}

    def start_consuming(self):
        try:
            print('Starting to consume messages...')
            self.channel.start_consuming()
        except KeyboardInterrupt:
            self.close()

    def close(self):
        try:
            if self.connection and not self.connection.is_closed:
                self.connection.close()
                print("Consumer connection closed")
        except Exception as error:
            print(f"Error closing connection: {error}")

def main():
    consumer = ${toPascalCase(config.name)}Consumer()
    consumer.connect()

    # Handle graceful shutdown
    def signal_handler(sig, frame):
        consumer.close()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    consumer.start_consuming()

if __name__ == '__main__':
    main()
`;
}

function generatePythonRabbitMQConfig(config: MessageQueueConfig): string {
  return `import os

${toPascalCase(config.name)}Config = {
    'url': os.environ.get('RABBITMQ_URL', 'amqp://localhost'),
    'exchange': '${config.exchanges?.[0]?.name || config.name}.exchange',
    'queues': [
${config.queues
  .map(
    (q) => `        {
            'name': '${q.name}',
            'durable': ${q.durable},
            'exclusive': ${q.exclusive},
            'auto_delete': ${q.autoDelete},
        }`
  )
  .join(',\n')}
    ],
}
`;
}

function generateGoRabbitMQ(config: MessageQueueConfig): MessageQueueIntegration {
  return {
    provider: 'rabbitmq',
    publisherCode: generateGoRabbitMQPublisher(config),
    consumerCode: generateGoRabbitMQConsumer(config),
    configurationCode: `package config

// Message queue configuration for ${config.name}
const (
    RabbitMQURL = "amqp://localhost"
    ExchangeName = "${config.exchanges?.[0]?.name || config.name}.exchange"
)
`,
    dependencies: [
      'github.com/rabbitmq/amqp091-go',
    ],
    buildInstructions: [
      'go get github.com/rabbitmq/amqp091-go',
      'Copy publisher to publisher/main.go',
      'Copy consumer to consumer/main.go',
      'Start publisher: go run publisher/main.go',
      'Start consumer: go run consumer/main.go',
    ],
  };
}

function generateGoRabbitMQPublisher(config: MessageQueueConfig): string {
  return `package main

import (
    "bytes"
    "encoding/json"
    "log"
    "time"

    amqp "github.com/rabbitmq/amqp091-go"
)

type Message struct {
    Type      string      \`json:"type"\`
    Data      interface{} \`json:"data"\`
    Timestamp string      \`json:"timestamp"\`
}

type ${toPascalCase(config.name)}Publisher struct {
    connection *amqp.Connection
    channel    *amqp.Channel
    exchange   string
}

func New${toPascalCase(config.name)}Publisher() *${toPascalCase(config.name)}Publisher {
    return &${toPascalCase(config.name)}Publisher{
        exchange: "${config.exchanges?.[0]?.name || config.name}.exchange",
    }
}

func (p *${toPascalCase(config.name)}Publisher) Connect(url string) error {
    var err error
    p.connection, err = amqp.Dial(url)
    if err != nil {
        return err
    }

    p.channel, err = p.connection.Channel()
    if err != nil {
        return err
    }

    err = p.channel.ExchangeDeclare(
        p.exchange,
        "direct",
        true,
        false,
        false,
        false,
        nil,
    )
    if err != nil {
        return err
    }

    log.Println("Publisher connected to RabbitMQ")
    return nil
}

func (p *${toPascalCase(config.name)}Publisher) Publish(routingKey string, message Message) error {
    body, err := json.Marshal(message)
    if err != nil {
        return err
    }

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    err = p.channel.PublishWithContext(ctx,
        p.exchange,
        routingKey,
        false,
        false,
        amqp.Publishing{
            ContentType:  "text/plain",
            DeliveryMode: amqp.Persistent,
            Body:         body,
        },
    )

    if err != nil {
        return err
    }

    log.Printf("Message published to %s", routingKey)
    return nil
}

func (p *${toPascalCase(config.name)}Publisher) Close() {
    if p.channel != nil {
        p.channel.Close()
    }
    if p.connection != nil {
        p.connection.Close()
    }
    log.Println("Publisher connection closed")
}

func main() {
    publisher := New${toPascalCase(config.name)}Publisher()
    err := publisher.Connect("amqp://localhost")
    if err != nil {
        log.Fatal(err)
    }
    defer publisher.Close()

    message := Message{
        Type:      "${config.name}.created",
        Data:      map[string]string{"id": "1", "name": "Test"},
        Timestamp: time.Now().Format(time.RFC3339),
    }

    err = publisher.Publish("${config.queues[0]?.name || 'created'}", message)
    if err != nil {
        log.Fatal(err)
    }
}
`;
}

function generateGoRabbitMQConsumer(config: MessageQueueConfig): string {
  return `package main

import (
    "encoding/json"
    "log"
    "os"
    "os/signal"
    "syscall"

    amqp "github.com/rabbitmq/amqp091-go"
)

type ${toPascalCase(config.name)}Consumer struct {
    connection *amqp.Connection
    channel    *amqp.Channel
    exchange   string
}

func New${toPascalCase(config.name)}Consumer() *${toPascalCase(config.name)}Consumer {
    return &${toPascalCase(config.name)}Consumer{
        exchange: "${config.exchanges?.[0]?.name || config.name}.exchange",
    }
}

func (c *${toPascalCase(config.name)}Consumer) Connect(url string) error {
    var err error
    c.connection, err = amqp.Dial(url)
    if err != nil {
        return err
    }

    c.channel, err = c.connection.Channel()
    if err != nil {
        return err
    }

    err = c.channel.ExchangeDeclare(
        c.exchange,
        "direct",
        true,
        false,
        false,
        false,
        nil,
    )
    if err != nil {
        return err
    }

${config.queues
  .map(
    (queue) => `    // Declare queue: ${queue.name}
    q, err := c.channel.QueueDeclare(
        "${queue.name}",
        ${queue.durable},
        false,
        false,
        false,
        nil,
    )
    if err != nil {
        return err
    }

    err = c.channel.QueueBind(
        q.Name,
        "${queue.name}",
        c.exchange,
        false,
        nil,
    )
    if err != nil {
        return err
    }

    msgs, err := c.channel.Consume(
        q.Name,
        "",
        false,
        false,
        false,
        false,
        nil,
    )
    if err != nil {
        return err
    }

    log.Printf("Consuming from queue: ${queue.name}")

    go func() {
        for d := range msgs {
            c.handle${toPascalCase(queue.name)}(d)
        }
    }()`
  )
  .join('\n\n')}

    log.Println("Consumer connected to RabbitMQ")
    return nil
}

${config.queues
  .map(
    (queue) => `func (c *${toPascalCase(config.name)}Consumer) handle${toPascalCase(queue.name)}(d amqp.Delivery) {
    var message Message
    err := json.Unmarshal(d.Body, &message)
    if err != nil {
        log.Printf("Error parsing message: %v", err)
        d.Nack(false, false)
        return
    }

    log.Printf("Received message from ${queue.name}: %+v", message)

    // TODO: Implement ${queue.name} handling logic
    // Process the message, update database, etc.

    d.Ack(false)
}`
  )
  .join('\n\n')}

func (c *${toPascalCase(config.name)}Consumer) Start() {
    sigs := make(chan os.Signal, 1)
    signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
    <-sigs

    log.Println("Shutting down consumer...")
    c.Close()
}

func (c *${toPascalCase(config.name)}Consumer) Close() {
    if c.channel != nil {
        c.channel.Close()
    }
    if c.connection != nil {
        c.connection.Close()
    }
    log.Println("Consumer connection closed")
}

func main() {
    consumer := New${toPascalCase(config.name)}Consumer()
    err := consumer.Connect("amqp://localhost")
    if err != nil {
        log.Fatal(err)
    }
    defer consumer.Close()

    consumer.Start()
}
`;
}

/**
 * Generate Redis integration
 */
function generateRedisIntegration(config: MessageQueueConfig, language: string): MessageQueueIntegration {
  if (language === 'typescript') {
    return {
      provider: 'redis',
      publisherCode: generateRedisPublisher(config),
      consumerCode: generateRedisConsumer(config),
      configurationCode: generateRedisConfig(config),
      dependencies: ['ioredis', '@types/ioredis'],
      buildInstructions: [
        'npm install ioredis @types/ioredis',
        'Copy publisher and consumer code',
        'Start Redis server: redis-server',
        'Start publisher: npm run start:publisher',
        'Start consumer: npm run start:consumer',
      ],
    };
  }
  return generateGenericIntegration(config, language);
}

function generateRedisPublisher(config: MessageQueueConfig): string {
  return `import Redis from 'ioredis';

interface Message {
  type: string;
  data: any;
  timestamp: string;
}

export class ${toPascalCase(config.name)}Publisher {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: 'localhost',
      port: 6379,
    });
  }

  async publish(channel: string, message: Message): Promise<number> {
    const content = JSON.stringify(message);
    const count = await this.client.publish(channel, content);
    console.log(\`Message published to \${channel}, subscribers: \${count}\`);
    return count;
  }

  async publish${toPascalCase(config.name)}Created(data: any): Promise<number> {
    return this.publish('${config.name}.created', {
      type: '${config.name}.created',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

// Usage example
async function main() {
  const publisher = new ${toPascalCase(config.name)}Publisher();
  await publisher.publish${toPascalCase(config.name)}Created({ id: '1', name: 'Test' });
  await publisher.close();
}

if (require.main === module) {
  main().catch(console.error);
}
`;
}

function generateRedisConsumer(config: MessageQueueConfig): string {
  const handlers = config.queues
    .map(
      (queue) => `  async handle${toPascalCase(queue.name)}(message: Message): Promise<void> {
    console.log(\`Received message from ${queue.name}:\`, message);

    // TODO: Implement ${queue.name} handling logic
    // Process the message, update database, etc.
  }`
    )
    .join('\n\n');

  return `import Redis from 'ioredis';

interface Message {
  type: string;
  data: any;
  timestamp: string;
}

export class ${toPascalCase(config.name)}Consumer {
  private pubClient: Redis;
  private subClient: Redis;

  constructor() {
    this.pubClient = new Redis({ host: 'localhost', port: 6379 });
    this.subClient = new Redis({ host: 'localhost', port: 6379 });
  }

  async subscribe(channels: string[]): Promise<void> {
    await this.subClient.subscribe(...channels);

    this.subClient.on('message', (channel, message) => {
      const data: Message = JSON.parse(message);
      this.handleMessage(channel, data);
    });

    console.log('Subscribed to channels:', channels);
  }

  async handleMessage(channel: string, message: Message): Promise<void> {
    console.log(\`Received on channel \${channel}:\`, message.type);

${handlers}
  }

  async close(): Promise<void> {
    await this.pubClient.quit();
    await this.subClient.quit();
  }
}

// Usage example
async function main() {
  const consumer = new ${toPascalCase(config.name)}Consumer();
  await consumer.subscribe([
${config.queues.map((q) => `    '${q.name}',`).join('\n')}
  ]);

  // Keep consumer running
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

function generateRedisConfig(config: MessageQueueConfig): string {
  return `export interface RedisConfig {
  host: string;
  port: number;
  db: number;
}

export const ${toCamelCase(config.name)}RedisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  db: parseInt(process.env.REDIS_DB || '0'),
};
`;
}

/**
 * Generate AWS SQS integration
 */
function generateSQSIntegration(config: MessageQueueConfig, language: string): MessageQueueIntegration {
  return {
    provider: 'aws-sqs',
    publisherCode: `// TODO: Implement AWS SQS publisher for ${language}`,
    consumerCode: `// TODO: Implement AWS SQS consumer for ${language}`,
    configurationCode: `// TODO: AWS SQS configuration for ${language}`,
    dependencies: language === 'typescript' ? ['@aws-sdk/client-sqs'] : [],
    buildInstructions: [
      'Install AWS SDK',
      'Configure AWS credentials',
      'Implement SQS publisher and consumer',
    ],
  };
}

/**
 * Generate Kafka integration
 */
function generateKafkaIntegration(config: MessageQueueConfig, language: string): MessageQueueIntegration {
  return {
    provider: 'kafka',
    publisherCode: `// TODO: Implement Kafka publisher for ${language}`,
    consumerCode: `// TODO: Implement Kafka consumer for ${language}`,
    configurationCode: `// TODO: Kafka configuration for ${language}`,
    dependencies: language === 'typescript' ? ['kafkajs'] : [],
    buildInstructions: [
      'Install Kafka client library',
      'Configure Kafka connection',
      'Implement Kafka producer and consumer',
    ],
  };
}

/**
 * Generate Azure integration
 */
function generateAzureIntegration(config: MessageQueueConfig, language: string): MessageQueueIntegration {
  return {
    provider: 'azure',
    publisherCode: `// TODO: Implement Azure Service Bus publisher for ${language}`,
    consumerCode: `// TODO: Implement Azure Service Bus consumer for ${language}`,
    configurationCode: `// TODO: Azure Service Bus configuration for ${language}`,
    dependencies: language === 'typescript' ? ['@azure/service-bus'] : [],
    buildInstructions: [
      'Install Azure SDK',
      'Configure Azure connection string',
      'Implement Service Bus publisher and consumer',
    ],
  };
}

/**
 * Generate generic integration
 */
function generateGenericIntegration(config: MessageQueueConfig, language: string): MessageQueueIntegration {
  return {
    provider: config.provider,
    publisherCode: `// TODO: Implement ${config.provider} publisher for ${language}`,
    consumerCode: `// TODO: Implement ${config.provider} consumer for ${language}`,
    configurationCode: `// TODO: ${config.provider} configuration for ${language}`,
    dependencies: [],
    buildInstructions: [
      `Install ${config.provider} client library for ${language}`,
      `Implement publisher code`,
      `Implement consumer code`,
      `Configure connection settings`,
    ],
  };
}

/**
 * Write message queue integration files
 */
export async function writeMessageQueueFiles(
  serviceName: string,
  integration: MessageQueueIntegration,
  outputPath: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputPath);

  // Write publisher code
  if (integration.publisherCode) {
    const publisherFile = path.join(outputPath, `${serviceName}-publisher.${getFileExtension(language)}`);
    await fs.writeFile(publisherFile, integration.publisherCode);
  }

  // Write consumer code
  if (integration.consumerCode) {
    const consumerFile = path.join(outputPath, `${serviceName}-consumer.${getFileExtension(language)}`);
    await fs.writeFile(consumerFile, integration.consumerCode);
  }

  // Write configuration code
  if (integration.configurationCode) {
    const configDir = path.join(outputPath, 'config');
    await fs.ensureDir(configDir);
    const configFile = path.join(configDir, `config.${getFileExtension(language)}`);
    await fs.writeFile(configFile, integration.configurationCode);
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

function generateBuildREADME(serviceName: string, integration: MessageQueueIntegration): string {
  return `# Message Queue Integration Build Instructions for ${serviceName}

## Provider: ${integration.provider.toUpperCase()}

## Architecture

This setup includes:
- **Publisher**: Sends messages to the queue/exchange
- **Consumer**: Receives and processes messages
- **Guaranteed Delivery**: Persistent messages with acknowledgments

## Dependencies

\`\`\`bash
${integration.dependencies.map((dep) => dep).join('\n')}
\`\`\`

## Build Steps

${integration.buildInstructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Usage

### Publisher
\`\`\`bash
node ${serviceName}-publisher.ts
\`\`\`

### Consumer
\`\`\`bash
node ${serviceName}-consumer.ts
\`\`\`

## Configuration

Configure your message queue connection:
- **RabbitMQ**: Default \`amqp://localhost\`
- **Redis**: Default \`localhost:6379\`
- **AWS SQS**: Configure AWS credentials and region
- **Kafka**: Configure broker addresses
- **Azure**: Configure connection string

## Message Flow

1. Publisher connects to queue
2. Publisher sends message to queue/exchange
3. Consumer receives message from queue
4. Consumer processes message
5. Consumer acknowledges successful processing
6. Queue removes processed message

## Error Handling

- **Failed Publishing**: Returns error to publisher
- **Failed Processing**: Message can be re-queued (nack)
- **Connection Lost**: Automatic reconnection
- **Duplicate Messages**: Implement idempotency in consumers

## Monitoring

Monitor queue metrics:
- Queue depth (number of messages)
- Message throughput (messages/second)
- Consumer lag (unprocessed messages)
- Error rates

## Example Message

\`\`\`json
{
  "type": "user.created",
  "data": {
    "id": "123",
    "name": "John Doe"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
\`\`\`
`;
}

/**
 * Display message queue config info
 */
export async function displayMessageQueueConfig(config: MessageQueueConfig): Promise<void> {
  console.log(chalk.bold(`\n📨 Message Queue: ${config.name}\n`));
  console.log(chalk.cyan(`Provider: ${config.provider}`));
  console.log(chalk.cyan(`Queues: ${config.queues.length}\n`));

  console.log(chalk.bold('Queues:\n'));

  for (const queue of config.queues) {
    console.log(`  ${chalk.green('✓')} ${queue.name}`);
    console.log(chalk.gray(`      Durable: ${queue.durable}`));
    console.log(chalk.gray(`      Exclusive: ${queue.exclusive}`));
    console.log(chalk.gray(`      Auto-delete: ${queue.autoDelete}`));
    console.log('');
  }

  if (config.exchanges && config.exchanges.length > 0) {
    console.log(chalk.bold('Exchanges:\n'));

    for (const exchange of config.exchanges) {
      console.log(`  ${chalk.cyan(exchange.type.toUpperCase())} ${exchange.name}`);
      console.log(chalk.gray(`      Durable: ${exchange.durable}`));
      console.log('');
    }
  }

  if (config.bindings && config.bindings.length > 0) {
    console.log(chalk.bold('Bindings:\n'));

    for (const binding of config.bindings) {
      console.log(`  ${chalk.yellow(binding.queue)} ← ${binding.exchange}`);
      console.log(chalk.gray(`      Routing key: ${binding.routingKey}`));
      console.log('');
    }
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
