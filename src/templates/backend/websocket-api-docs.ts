import { BackendTemplate } from '../types.js';

/**
 * WebSocket API Documentation and Client Generation Template
 *
 * Provides AsyncAPI specification, client code generation,
 * and comprehensive documentation for WebSocket APIs.
 */
export const websocketApiDocsTemplate: BackendTemplate = {
  id: 'websocket-api-docs',
  name: 'websocket-api-docs',
  displayName: 'WebSocket API Docs & Client Generator',
  description: 'WebSocket API with AsyncAPI specification, client code generation, and comprehensive documentation',
  language: 'typescript',
  framework: 'ws',
  version: '1.0.0',
  tags: ['websocket', 'asyncapi', 'documentation', 'client-generation', 'realtime'],
  port: 3000,
  dependencies: {
    'ws': '^8.18.0',
    'express': '^4.19.2',
    '@asyncapi/parser': '^3.0.0',
    'uuid': '^9.0.1',
    'dotenv': '^16.4.5',
  },
  devDependencies: {
    '@types/ws': '^8.5.10',
    '@types/express': '^4.17.21',
    '@types/uuid': '^9.0.8',
    'typescript': '^5.5.4',
    'tsx': '^4.16.2',
    'nodemon': '^3.1.4',
  },
  features: ['websockets', 'rest-api', 'documentation', 'cli'],
  files: {
    'src/server.ts': `import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

// Express app for HTTP endpoints
const app = express();
app.use(express.json());

// Store connected clients
const clients = new Map<string, { ws: WebSocket; rooms: string[] }>();
const rooms = new Map<string, Set<string>>();

// HTTP Server
const server = createServer(app);
server.listen(PORT, () => {
  console.log(\`HTTP Server running on port \${PORT}\`);
});

// WebSocket Server
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws: WebSocket, req) => {
  const clientId = uuidv4();
  console.log(\`Client connected: \${clientId}\`);

  // Store client
  clients.set(clientId, { ws, rooms: [] });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    timestamp: new Date().toISOString(),
  }));

  // Handle incoming messages
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(clientId, message);
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid JSON format',
      }));
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log(\`Client disconnected: \${clientId}\`);
    const client = clients.get(clientId);
    if (client) {
      // Remove from all rooms
      for (const room of client.rooms) {
        const roomClients = rooms.get(room);
        if (roomClients) {
          roomClients.delete(clientId);
          if (roomClients.size === 0) {
            rooms.delete(room);
          }
        }
      }
    }
    clients.delete(clientId);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(\`WebSocket error for client \${clientId}:\`, error);
  });
});

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(clientId: string, message: any) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'join':
      handleJoinRoom(clientId, message.room);
      break;

    case 'leave':
      handleLeaveRoom(clientId, message.room);
      break;

    case 'message':
      handleChatMessage(clientId, message);
      break;

    case 'broadcast':
      handleBroadcast(clientId, message);
      break;

    case 'ping':
      client.ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString(),
      }));
      break;

    case 'list_rooms':
      client.ws.send(JSON.stringify({
        type: 'rooms_list',
        rooms: Array.from(rooms.keys()),
      }));
      break;

    case 'list_clients':
      const clientsInfo = Array.from(clients.entries()).map(([id, data]) => ({
        id,
        rooms: data.rooms,
      }));
      client.ws.send(JSON.stringify({
        type: 'clients_list',
        clients: clientsInfo,
      }));
      break;

    default:
      client.ws.send(JSON.stringify({
        type: 'error',
        message: \`Unknown message type: \${message.type}\`,
      }));
  }
}

/**
 * Handle room join requests
 */
function handleJoinRoom(clientId: string, roomName: string) {
  const client = clients.get(clientId);
  if (!client) return;

  // Initialize room if doesn't exist
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }

  // Add client to room
  rooms.get(roomName)!.add(clientId);
  client.rooms.push(roomName);

  // Notify client
  client.ws.send(JSON.stringify({
    type: 'joined',
    room: roomName,
    timestamp: new Date().toISOString(),
  }));

  // Notify others in room
  broadcastToRoom(roomName, {
    type: 'user_joined',
    clientId,
    room: roomName,
    timestamp: new Date().toISOString(),
  }, clientId);

  console.log(\`Client \${clientId} joined room: \${roomName}\`);
}

/**
 * Handle room leave requests
 */
function handleLeaveRoom(clientId: string, roomName: string) {
  const client = clients.get(clientId);
  if (!client) return;

  const roomClients = rooms.get(roomName);
  if (roomClients) {
    roomClients.delete(clientId);
    if (roomClients.size === 0) {
      rooms.delete(roomName);
    }
  }

  client.rooms = client.rooms.filter(r => r !== roomName);

  client.ws.send(JSON.stringify({
    type: 'left',
    room: roomName,
    timestamp: new Date().toISOString(),
  }));

  broadcastToRoom(roomName, {
    type: 'user_left',
    clientId,
    room: roomName,
    timestamp: new Date().toISOString(),
  });

  console.log(\`Client \${clientId} left room: \${roomName}\`);
}

/**
 * Handle chat messages within a room
 */
function handleChatMessage(clientId: string, message: any) {
  const client = clients.get(clientId);
  if (!client || !message.room) {
    return;
  }

  const chatMessage = {
    type: 'chat_message',
    id: uuidv4(),
    clientId,
    room: message.room,
    content: message.content || '',
    timestamp: new Date().toISOString(),
  };

  broadcastToRoom(message.room, chatMessage);
  console.log(\`Chat in \${message.room} from \${clientId}: \${message.content}\`);
}

/**
 * Handle broadcast messages to all connected clients
 */
function handleBroadcast(clientId: string, message: any) {
  const broadcast = {
    type: 'broadcast',
    from: clientId,
    content: message.content || '',
    timestamp: new Date().toISOString(),
  };

  for (const [id, client] of clients.entries()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(broadcast));
    }
  }

  console.log(\`Broadcast from \${clientId}: \${message.content}\`);
}

/**
 * Broadcast a message to all clients in a room
 */
function broadcastToRoom(roomName: string, message: any, excludeClientId?: string) {
  const roomClients = rooms.get(roomName);
  if (!roomClients) return;

  for (const clientId of roomClients) {
    if (clientId === excludeClientId) continue;

    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
}

// HTTP Endpoints for API documentation
app.get('/', (req, res) => {
  res.json({
    name: '{{name}} WebSocket API',
    version: '1.0.0',
    endpoints: {
      http: {
        base: \`http://localhost:\${PORT}\`,
        routes: {
          'GET /': 'API information',
          'GET /health': 'Health check',
          'GET /stats': 'Connection statistics',
          'GET /docs': 'API documentation',
          'GET /asyncapi.yaml': 'AsyncAPI specification',
          'POST /broadcast': 'Broadcast message to all WebSocket clients',
        },
      },
      websocket: {
        url: \`ws://localhost:\${WS_PORT}\`,
        messageTypes: {
          client: ['join', 'leave', 'message', 'broadcast', 'ping', 'list_rooms', 'list_clients'],
          server: ['connected', 'joined', 'left', 'chat_message', 'broadcast', 'pong', 'rooms_list', 'clients_list', 'error'],
        },
      },
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/stats', (req, res) => {
  res.json({
    connectedClients: clients.size,
    activeRooms: rooms.size,
    rooms: Object.fromEntries(
      Array.from(rooms.entries()).map(([name, clients]) => [name, clients.size])
    ),
  });
});

app.get('/docs', (req, res) => {
  res.json({
    title: '{{name}} WebSocket API Documentation',
    version: '1.0.0',
    baseUrl: \`http://localhost:\${PORT}\`,
    wsUrl: \`ws://localhost:\${WS_PORT}\`,
    channels: {
      connection: {
        description: 'Main WebSocket connection endpoint',
        events: {
          connected: {
            summary: 'Sent when client successfully connects',
            payload: {
              type: 'object',
              properties: {
                type: { type: 'string', const: 'connected' },
                clientId: { type: 'string', format: 'uuid' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      rooms: {
        description: 'Room-based messaging channels',
        events: {
          join: {
            summary: 'Join a room',
            payload: {
              type: 'object',
              properties: {
                type: { type: 'string', const: 'join' },
                room: { type: 'string' },
              },
              required: ['type', 'room'],
            },
          },
          leave: {
            summary: 'Leave a room',
            payload: {
              type: 'object',
              properties: {
                type: { type: 'string', const: 'leave' },
                room: { type: 'string' },
              },
              required: ['type', 'room'],
            },
          },
          message: {
            summary: 'Send message to a room',
            payload: {
              type: 'object',
              properties: {
                type: { type: 'string', const: 'message' },
                room: { type: 'string' },
                content: { type: 'string' },
              },
              required: ['type', 'room', 'content'],
            },
          },
        },
      },
    },
  });
});

app.get('/asyncapi.yaml', (req, res) => {
  const yaml = \`asyncapi: '3.0.0'
info:
  title: {{name}} WebSocket API
  version: 1.0.0
  description: |
    Real-time WebSocket API for {{name}} with room-based messaging,
    broadcasts, and client management.

servers:
  production:
    url: ws://localhost:\${WS_PORT}
    protocol: ws
    description: Production WebSocket server

channels:
  connection:
    address: /
    description: Main WebSocket connection endpoint
    messages:
      connected:
        $ref: '#/components/messages/connected'
      user_joined:
        $ref: '#/components/messages/user_joined'
      user_left:
        $ref: '#/components/messages/user_left'

  rooms/{roomName}:
    address: /rooms/{roomName}
    description: Room-based messaging
    parameters:
      roomName:
        $ref: '#/components/parameters/roomName'
    messages:
      chat_message:
        $ref: '#/components/messages/chat_message'
      join:
        $ref: '#/components/messages/join'
      leave:
        $ref: '#/components/messages/leave'

  broadcast:
    address: /broadcast
    description: Broadcast to all connected clients
    messages:
      broadcast:
        $ref: '#/components/messages/broadcast'

components:
  messages:
    connected:
      name: connected
      title: Connected
      summary: Sent when client successfully connects
      payload:
        $ref: '#/components/schemas/Connected'

    user_joined:
      name: user_joined
      title: User Joined
      summary: Sent when a user joins a room
      payload:
        $ref: '#/components/schemas/UserJoined'

    user_left:
      name: user_left
      title: User Left
      summary: Sent when a user leaves a room
      payload:
        $ref: '#/components/schemas/UserLeft'

    chat_message:
      name: chat_message
      title: Chat Message
      summary: Chat message within a room
      payload:
        $ref: '#/components/schemas/ChatMessage'

    join:
      name: join
      title: Join Room
      summary: Request to join a room
      payload:
        $ref: '#/components/schemas/JoinRoom'

    leave:
      name: leave
      title: Leave Room
      summary: Request to leave a room
      payload:
        $ref: '#/components/schemas/LeaveRoom'

    broadcast:
      name: broadcast
      title: Broadcast
      summary: Broadcast message to all clients
      payload:
        $ref: '#/components/schemas/Broadcast'

  schemas:
    Connected:
      type: object
      properties:
        type:
          type: string
          const: connected
        clientId:
          type: string
          format: uuid
        timestamp:
          type: string
          format: date-time

    UserJoined:
      type: object
      properties:
        type:
          type: string
          const: user_joined
        clientId:
          type: string
          format: uuid
        room:
          type: string
        timestamp:
          type: string
          format: date-time

    UserLeft:
      type: object
      properties:
        type:
          type: string
          const: user_left
        clientId:
          type: string
          format: uuid
        room:
          type: string
        timestamp:
          type: string
          format: date-time

    ChatMessage:
      type: object
      properties:
        type:
          type: string
          const: chat_message
        id:
          type: string
          format: uuid
        clientId:
          type: string
          format: uuid
        room:
          type: string
        content:
          type: string
        timestamp:
          type: string
          format: date-time

    JoinRoom:
      type: object
      required:
        - type
        - room
      properties:
        type:
          type: string
          const: join
        room:
          type: string

    LeaveRoom:
      type: object
      required:
        - type
        - room
      properties:
        type:
          type: string
          const: leave
        room:
          type: string

    Broadcast:
      type: object
      required:
        - type
        - content
      properties:
        type:
          type: string
          const: broadcast
        content:
          type: string

  parameters:
    roomName:
      description: Name of the room
      schema:
        type: string
        example: general
\`;
  res.setHeader('Content-Type', 'text/yaml');
  res.send(yaml);
});

app.post('/broadcast', (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const broadcast = {
    type: 'broadcast',
    from: 'system',
    content: message,
    timestamp: new Date().toISOString(),
  };

  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(broadcast));
    }
  }

  res.json({ success: true, recipients: clients.size });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\nShutting down servers...');
  wss.close(() => {
    console.log('WebSocket server closed');
  });
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
`,
    'src/client/index.ts': `/**
 * Auto-generated WebSocket Client
 *
 * This client is generated from the AsyncAPI specification.
 * It provides a type-safe interface for interacting with the WebSocket API.
 */

export interface ClientOptions {
  url?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeat?: boolean;
  heartbeatInterval?: number;
}

export interface MessageHandlers {
  onConnected?: (data: ConnectedMessage) => void;
  onJoined?: (data: JoinedMessage) => void;
  onLeft?: (data: LeftMessage) => void;
  onChatMessage?: (data: ChatMessage) => void;
  onBroadcast?: (data: BroadcastMessage) => void;
  onPong?: (data: PongMessage) => void;
  onRoomsList?: (data: RoomsListMessage) => void;
  onClientsList?: (data: ClientsListMessage) => void;
  onError?: (data: ErrorMessage) => void;
}

export interface ConnectedMessage {
  type: 'connected';
  clientId: string;
  timestamp: string;
}

export interface JoinedMessage {
  type: 'joined';
  room: string;
  timestamp: string;
}

export interface LeftMessage {
  type: 'left';
  room: string;
  timestamp: string;
}

export interface ChatMessage {
  type: 'chat_message';
  id: string;
  clientId: string;
  room: string;
  content: string;
  timestamp: string;
}

export interface BroadcastMessage {
  type: 'broadcast';
  from: string;
  content: string;
  timestamp: string;
}

export interface PongMessage {
  type: 'pong';
  timestamp: string;
}

export interface RoomsListMessage {
  type: 'rooms_list';
  rooms: string[];
}

export interface ClientsListMessage {
  type: 'clients_list';
  clients: Array<{ id: string; rooms: string[] }>;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | ConnectedMessage
  | JoinedMessage
  | LeftMessage
  | ChatMessage
  | BroadcastMessage
  | PongMessage
  | RoomsListMessage
  | ClientsListMessage
  | ErrorMessage;

/**
 * WebSocket Client with type-safe messaging
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private options: Required<ClientOptions>;
  private handlers: MessageHandlers = {};
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private clientId: string | null = null;
  private currentRooms: string[] = [];

  constructor(options: ClientOptions = {}) {
    this.url = options.url || \`ws://\${typeof window !== 'undefined' ? window.location.host : 'localhost:3001'}\`;
    this.options = {
      reconnect: options.reconnect ?? true,
      reconnectInterval: options.reconnectInterval ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      heartbeat: options.heartbeat ?? true,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      url: this.url,
    };
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Use WebSocket constructor (works in both browser and Node.js with ws package)
        const WS = typeof window !== 'undefined' ? window.WebSocket : (require('ws') as any);
        this.ws = new WS(this.url);

        this.ws.onopen = () => {
          console.log('Connected to WebSocket server');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event: CloseEvent) => {
          console.log('Disconnected from WebSocket server', event.code, event.reason);
          this.stopHeartbeat();

          if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(\`Reconnecting... (attempt \${this.reconnectAttempts}/\${this.options.maxReconnectAttempts})\`);
            setTimeout(() => this.connect(), this.options.reconnectInterval);
          }
        };

        this.ws.onerror = (error: Event) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.options.reconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
  }

  /**
   * Register message handlers
   */
  on(handlers: MessageHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Join a room
   */
  joinRoom(roomName: string): void {
    this.send({ type: 'join', room: roomName });
  }

  /**
   * Leave a room
   */
  leaveRoom(roomName: string): void {
    this.send({ type: 'leave', room: roomName });
  }

  /**
   * Send a chat message to a room
   */
  sendChatMessage(roomName: string, content: string): void {
    this.send({ type: 'message', room: roomName, content });
  }

  /**
   * Broadcast a message to all clients
   */
  broadcast(content: string): void {
    this.send({ type: 'broadcast', content });
  }

  /**
   * Request list of active rooms
   */
  listRooms(): void {
    this.send({ type: 'list_rooms' });
  }

  /**
   * Request list of connected clients
   */
  listClients(): void {
    this.send({ type: 'list_clients' });
  }

  /**
   * Send a ping to the server
   */
  ping(): void {
    this.send({ type: 'ping' });
  }

  /**
   * Send raw message to server
   */
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
    }
  }

  /**
   * Get current client ID
   */
  getClientId(): string | null {
    return this.clientId;
  }

  /**
   * Get currently joined rooms
   */
  getCurrentRooms(): string[] {
    return [...this.currentRooms];
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message: ServerMessage = JSON.parse(data);

      switch (message.type) {
        case 'connected':
          this.clientId = message.clientId;
          this.handlers.onConnected?.(message);
          break;
        case 'joined':
          this.currentRooms.push(message.room);
          this.handlers.onJoined?.(message);
          break;
        case 'left':
          this.currentRooms = this.currentRooms.filter(r => r !== message.room);
          this.handlers.onLeft?.(message);
          break;
        case 'chat_message':
          this.handlers.onChatMessage?.(message);
          break;
        case 'broadcast':
          this.handlers.onBroadcast?.(message);
          break;
        case 'pong':
          this.handlers.onPong?.(message);
          break;
        case 'rooms_list':
          this.handlers.onRoomsList?.(message);
          break;
        case 'clients_list':
          this.handlers.onClientsList?.(message);
          break;
        case 'error':
          this.handlers.onError?.(message);
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (!this.options.heartbeat) return;

    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.ping();
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

/**
 * Create a new WebSocket client with the given options
 */
export function createClient(options: ClientOptions = {}): WebSocketClient {
  return new WebSocketClient(options);
}
`,
    'src/client/index.js': `/**
 * Auto-generated WebSocket Client (JavaScript)
 *
 * This client is generated from the AsyncAPI specification.
 * It provides a clean interface for interacting with the WebSocket API.
 */

export class WebSocketClient {
  constructor(options = {}) {
    this.url = options.url || (typeof window !== 'undefined'
      ? \`ws://\${window.location.host}\`
      : 'ws://localhost:3001');
    this.ws = null;
    this.reconnect = options.reconnect !== undefined ? options.reconnect : true;
    this.reconnectInterval = options.reconnectInterval || 1000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.heartbeat = options.heartbeat !== undefined ? options.heartbeat : true;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.reconnectAttempts = 0;
    this.handlers = {};
    this.heartbeatTimer = null;
    this.clientId = null;
    this.currentRooms = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        const WS = typeof window !== 'undefined' ? window.WebSocket : require('ws');
        this.ws = new WS(this.url);

        this.ws.onopen = () => {
          console.log('Connected to WebSocket server');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('Disconnected from WebSocket server', event.code, event.reason);
          this.stopHeartbeat();

          if (this.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(\`Reconnecting... (attempt \${this.reconnectAttempts}/\${this.maxReconnectAttempts})\`);
            setTimeout(() => this.connect(), this.reconnectInterval);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    this.reconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
  }

  on(handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  joinRoom(roomName) {
    this.send({ type: 'join', room: roomName });
  }

  leaveRoom(roomName) {
    this.send({ type: 'leave', room: roomName });
  }

  sendChatMessage(roomName, content) {
    this.send({ type: 'message', room: roomName, content });
  }

  broadcast(content) {
    this.send({ type: 'broadcast', content });
  }

  listRooms() {
    this.send({ type: 'list_rooms' });
  }

  listClients() {
    this.send({ type: 'list_clients' });
  }

  ping() {
    this.send({ type: 'ping' });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
    }
  }

  getClientId() {
    return this.clientId;
  }

  getCurrentRooms() {
    return [...this.currentRooms];
  }

  isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'connected':
          this.clientId = message.clientId;
          this.handlers.onConnected?.(message);
          break;
        case 'joined':
          this.currentRooms.push(message.room);
          this.handlers.onJoined?.(message);
          break;
        case 'left':
          this.currentRooms = this.currentRooms.filter(r => r !== message.room);
          this.handlers.onLeft?.(message);
          break;
        case 'chat_message':
          this.handlers.onChatMessage?.(message);
          break;
        case 'broadcast':
          this.handlers.onBroadcast?.(message);
          break;
        case 'pong':
          this.handlers.onPong?.(message);
          break;
        case 'rooms_list':
          this.handlers.onRoomsList?.(message);
          break;
        case 'clients_list':
          this.handlers.onClientsList?.(message);
          break;
        case 'error':
          this.handlers.onError?.(message);
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  startHeartbeat() {
    if (!this.heartbeat) return;

    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.ping();
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export function createClient(options) {
  return new WebSocketClient(options);
}
`,
    'scripts/generate-client.ts': `#!/usr/bin/env tsx
/**
 * Client Code Generator Script
 *
 * Generates client SDKs from AsyncAPI specifications.
 * Supports JavaScript and TypeScript targets.
 */

import fs from 'fs';
import path from 'path';

interface Channel {
  address: string;
  description?: string;
  messages?: Record<string, any>;
  parameters?: Record<string, any>;
}

interface AsyncAPIDocument {
  asyncapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Record<string, any>;
  channels?: Record<string, Channel>;
  components?: {
    messages?: Record<string, any>;
    schemas?: Record<string, any>;
    parameters?: Record<string, any>;
  };
}

interface GenerateClientOptions {
  input: string;
  output: string;
  language: 'typescript' | 'javascript';
  clientName?: string;
}

/**
 * Generate TypeScript interfaces from AsyncAPI schema
 */
function generateTypeScriptInterfaces(doc: AsyncAPIDocument): string {
  let output = '// Auto-generated TypeScript interfaces\\n';
  output += '// Generated from AsyncAPI specification\\n\\n';

  // Generate message type interfaces
  output += 'export type ServerMessageType = \\n';
  const messageTypes: string[] = [];

  if (doc.components?.messages) {
    for (const [name, messageDef] of Object.entries(doc.components.messages)) {
      messageTypes.push(\`  | '\${name}'\`);
    }
  }

  if (doc.channels) {
    for (const [channelName, channel] of Object.entries(doc.channels)) {
      if (channel.messages) {
        for (const messageName of Object.keys(channel.messages)) {
          if (!messageTypes.includes(\`  | '\${messageName}'\`)) {
            messageTypes.push(\`  | '\${messageName}'\`);
          }
        }
      }
    }
  }

  if (messageTypes.length > 0) {
    output += messageTypes.join('\\n') + ';\\n\\n';
  } else {
    output += '  string;\\n\\n';
  }

  // Generate schema interfaces
  if (doc.components?.schemas) {
    for (const [schemaName, schemaDef] of Object.entries(doc.components.schemas)) {
      output += generateTypeScriptInterface(schemaName, schemaDef as any);
    }
  }

  return output;
}

/**
 * Generate TypeScript interface from schema
 */
function generateTypeScriptInterface(name: string, schema: any): string {
  let output = \`export interface \${toPascalCase(name)} {\\n\`;

  if (schema.properties) {
    for (const [propName, propDef] of Object.entries(schema.properties)) {
      const isRequired = schema.required?.includes(propName);
      const optional = isRequired ? '' : '?';
      const type = mapTypeToTypeScript(propDef as any);
      const comment = (propDef as any).description ? \`  /** \${(propDef as any).description} */\\n\` : '';
      output += comment + \`  \${propName}\${optional}: \${type};\\n\`;
    }
  }

  output += '}\\n\\n';
  return output;
}

/**
 * Map JSON Schema type to TypeScript
 */
function mapTypeToTypeScript(prop: any): string {
  if (prop.const) {
    return \`'\${prop.const}'\`;
  }

  const type = prop.type || 'any';

  switch (type) {
    case 'string':
      if (prop.format === 'date-time') return 'string';
      if (prop.format === 'uuid') return 'string';
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return \`Array<\${mapTypeToTypeScript(prop.items || {})}>\`;
    case 'object':
      return 'Record<string, any>';
    default:
      return 'any';
  }
}

/**
 * Generate JavaScript client class
 */
function generateJavaScriptClient(doc: AsyncAPIDocument, clientName: string): string {
  let output = \`/**
 * Auto-generated WebSocket Client: \${clientName}
 *
 * This client is generated from the AsyncAPI specification.
 * Language: JavaScript
 */\\n\\n\`;

  output += \`export class \${clientName} {\\n\`;
  output += \`  constructor(options = {}) {\\n\`;
  output += \`    this.url = options.url || 'ws://localhost:3001';\\n\`;
  output += \`    this.ws = null;\\n\`;
  output += \`    this.handlers = {};\\n\`;
  output += \`  }\\n\\n\`;

  // Connection methods
  output += generateConnectionMethods();

  // Channel-based methods
  if (doc.channels) {
    for (const [channelName, channel] of Object.entries(doc.channels)) {
      output += generateChannelMethods(channelName, channel);
    }
  }

  output += \`}\\n\`;

  return output;
}

/**
 * Generate TypeScript client class
 */
function generateTypeScriptClient(doc: AsyncAPIDocument, clientName: string): string {
  let output = \`/**
 * Auto-generated WebSocket Client: \${clientName}
 *
 * This client is generated from the AsyncAPI specification.
 * Language: TypeScript
 */\\n\\n\`;

  // Add interfaces first
  output += generateTypeScriptInterfaces(doc);

  // Client class
  output += \`export class \${clientName}Client {\\n\`;
  output += \`  private ws: WebSocket | null = null;\\n\`;
  output += \`  private url: string;\\n\`;
  output += \`  private handlers: Record<string, (data: any) => void> = {};\\n\\n\`;

  output += \`  constructor(options: { url?: string } = {}) {\\n\`;
  output += \`    this.url = options.url || 'ws://localhost:3001';\\n\`;
  output += \`  }\\n\\n\`;

  // Connection methods
  output += generateConnectionMethodsTS();

  // Channel-based methods
  if (doc.channels) {
    for (const [channelName, channel] of Object.entries(doc.channels)) {
      output += generateChannelMethodsTS(channelName, channel);
    }
  }

  output += \`}\\n\`;

  return output;
}

/**
 * Generate connection methods (JavaScript)
 */
function generateConnectionMethods(): string {
  return \`  connect() {
    return new Promise((resolve, reject) => {
      const WS = typeof window !== 'undefined' ? window.WebSocket : require('ws');
      this.ws = new WS(this.url);

      this.ws.onopen = () => {
        console.log('Connected to WebSocket server');
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event, handler) {
    this.handlers[event] = handler;
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      const handler = this.handlers[message.type];
      if (handler) {
        handler(message);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

\\n\`;
}

/**
 * Generate connection methods (TypeScript)
 */
function generateConnectionMethodsTS(): string {
  return \`  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const WS = typeof window !== 'undefined' ? window.WebSocket : (require('ws') as any);
      this.ws = new WS(this.url);

      this.ws.onopen = () => {
        console.log('Connected to WebSocket server');
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
      };

      this.ws.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, handler: (data: any) => void): void {
    this.handlers[event] = handler;
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      const handler = this.handlers[message.type];
      if (handler) {
        handler(message);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

\\n\`;
}

/**
 * Generate methods for a channel (JavaScript)
 */
function generateChannelMethods(channelName: string, channel: Channel): string {
  let methods = '';

  if (channel.messages) {
    for (const [messageName, messageDef] of Object.entries(channel.messages)) {
      const methodName = toCamelCase(messageName);
      methods += \`  \${methodName}(payload) {
    this.send({ type: '\${messageName}', ...payload });
  }

\`;
    }
  }

  return methods;
}

/**
 * Generate methods for a channel (TypeScript)
 */
function generateChannelMethodsTS(channelName: string, channel: Channel): string {
  let methods = '';

  if (channel.messages) {
    for (const [messageName, messageDef] of Object.entries(channel.messages)) {
      const methodName = toCamelCase(messageName);
      methods += \`  \${methodName}(payload: any): void {
    this.send({ type: '\${messageName}', ...payload });
  }

\`;
    }
  }

  return methods;
}

/**
 * Parse YAML to JSON (basic implementation)
 */
function parseYAML(yaml: string): any {
  const lines = yaml.split('\\n');
  const result: any = {};
  let stack = [result];
  let indentStack = [0];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\\S/);
    const [key, ...valueParts] = trimmed.split(':');
    const value = valueParts.join(':').trim();

    // Pop stack to correct level
    while (indentStack.length > 0 && indentStack[indentStack.length - 1] >= indent) {
      stack.pop();
      indentStack.pop();
    }

    const current = stack[stack.length - 1];

    if (value) {
      current[key] = parseValue(value);
    } else {
      current[key] = {};
      stack.push(current[key]);
      indentStack.push(indent);
    }
  }

  return result;
}

/**
 * Parse a YAML value
 */
function parseValue(value: string): any {
  value = value.trim();

  // Handle quoted strings
  if ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }

  // Handle special values
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (value === '|') return '';

  // Handle arrays
  if (value.startsWith('[')) {
    return JSON.parse(value);
  }

  // Handle numbers
  if (/^-?\\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\\d+\\.\\d+$/.test(value)) return parseFloat(value);

  return value;
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\\b\\w/g, l => l.toUpperCase())
    .replace(/\\s/g, '');
}

/**
 * Convert string to camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Main generator function
 */
async function generateClient(options: GenerateClientOptions): Promise<void> {
  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);

  console.log(\`Reading AsyncAPI spec from: \${inputPath}\`);

  // Read and parse input
  let doc: AsyncAPIDocument;
  const inputContent = fs.readFileSync(inputPath, 'utf-8');

  if (inputPath.endsWith('.json')) {
    doc = JSON.parse(inputContent);
  } else {
    // Simple YAML parser for AsyncAPI
    doc = parseYAML(inputContent);
  }

  const clientName = options.clientName || toPascalCase(doc.info.title.replace(/\\s+/g, ''));

  // Generate client code
  let code: string;
  if (options.language === 'typescript') {
    code = generateTypeScriptClient(doc, clientName);
  } else {
    code = generateJavaScriptClient(doc, clientName);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write generated code
  fs.writeFileSync(outputPath, code, 'utf-8');
  console.log(\`Generated client written to: \${outputPath}\`);
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: GenerateClientOptions = {
    input: args[0] || 'asyncapi.yaml',
    output: args[1] || 'src/generated-client.js',
    language: (args.includes('--ts') || args.includes('--typescript')) ? 'typescript' : 'javascript',
  };

  await generateClient(options);
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main().catch(console.error);
}

export { generateClient, generateJavaScriptClient, generateTypeScriptClient };
`,
    'scripts/validate-asyncapi.ts': `#!/usr/bin/env tsx
/**
 * AsyncAPI Specification Validator
 *
 * Validates AsyncAPI YAML/JSON files against the AsyncAPI 3.0 specification.
 */

import fs from 'fs';
import path from 'path';

interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validate AsyncAPI document
 */
function validateAsyncAPI(doc: any, filePath: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check required fields
  if (!doc.asyncapi) {
    errors.push({ path: '/', message: 'Missing required field: asyncapi', severity: 'error' });
  } else if (typeof doc.asyncapi !== 'string') {
    errors.push({ path: '/asyncapi', message: 'asyncapi must be a string', severity: 'error' });
  } else if (!/^3\\.0\\./.test(doc.asyncapi)) {
    warnings.push({ path: '/asyncapi', message: \`Version \${doc.asyncapi} is not 3.0.x\`, severity: 'warning' });
  }

  if (!doc.info) {
    errors.push({ path: '/', message: 'Missing required field: info', severity: 'error' });
  } else {
    if (!doc.info.title) {
      errors.push({ path: '/info', message: 'Missing required field: info.title', severity: 'error' });
    }
    if (!doc.info.version) {
      errors.push({ path: '/info', message: 'Missing required field: info.version', severity: 'error' });
    }
  }

  if (!doc.servers && !doc.channels) {
    warnings.push({
      path: '/',
      message: 'Document should contain either servers or channels',
      severity: 'warning'
    });
  }

  // Validate servers
  if (doc.servers) {
    for (const [serverName, serverDef] of Object.entries(doc.servers)) {
      const server = serverDef as any;
      if (!server.url) {
        errors.push({
          path: \`/servers/\${serverName}\`,
          message: 'Server must have a url',
          severity: 'error'
        });
      }
      if (!server.protocol) {
        warnings.push({
          path: \`/servers/\${serverName}\`,
          message: 'Server should specify a protocol',
          severity: 'warning'
        });
      }
    }
  }

  // Validate channels
  if (doc.channels) {
    for (const [channelName, channelDef] of Object.entries(doc.channels)) {
      const channel = channelDef as any;
      if (!channel.address && !channelName.includes('/')) {
        warnings.push({
          path: \`/channels/\${channelName}\`,
          message: 'Channel should have an address or include address in name',
          severity: 'warning'
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Load and parse AsyncAPI document
 */
function loadDocument(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');

  if (filePath.endsWith('.json')) {
    return JSON.parse(content);
  }

  // Simple YAML parser
  const lines = content.split('\\n');
  const result: any = {};
  const stack: Array<{ obj: any; indent: number }> = [{ obj: result, indent: -1 }];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\\S/);
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex);
    const value = trimmed.slice(colonIndex + 1).trim();

    // Find parent level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (!value) {
      parent[key] = {};
      stack.push({ obj: parent[key], indent });
    } else {
      parent[key] = parseValue(value);
    }
  }

  return result;
}

/**
 * Parse YAML value
 */
function parseValue(value: string): any {
  value = value.trim();

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (value.startsWith("'") || value.startsWith('"')) return value.slice(1, -1);
  if (value.startsWith('[')) return JSON.parse(value);

  const num = Number(value);
  return isNaN(num) ? value : num;
}

/**
 * Main validation function
 */
async function validate(filePath: string): Promise<void> {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(\`Error: File not found: \${resolvedPath}\`);
    process.exit(1);
  }

  console.log(\`Validating: \${resolvedPath}\\n\`);

  try {
    const doc = loadDocument(resolvedPath);
    const result = validateAsyncAPI(doc, resolvedPath);

    // Print errors
    if (result.errors.length > 0) {
      console.log('❌ Errors:');
      for (const error of result.errors) {
        console.log(\`  \${error.path}: \${error.message}\`);
      }
      console.log('');
    }

    // Print warnings
    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      for (const warning of result.warnings) {
        console.log(\`  \${warning.path}: \${warning.message}\`);
      }
      console.log('');
    }

    if (result.valid) {
      console.log('✅ Valid AsyncAPI document!');
      process.exit(0);
    } else {
      console.log('❌ Invalid AsyncAPI document');
      process.exit(1);
    }
  } catch (error) {
    console.error(\`Error parsing file: \${error}\`);
    process.exit(1);
  }
}

// CLI
const filePath = process.argv[2] || 'asyncapi.yaml';
validate(filePath).catch(console.error);
`,
    'scripts/test-websocket.ts': `#!/usr/bin/env tsx
/**
 * WebSocket Test Script
 *
 * Tests the WebSocket API endpoints and functionality.
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const WS_URL = process.env.WS_URL || 'ws://localhost:3001';
const HTTP_URL = process.env.HTTP_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

const results: TestResult[] = [];

/**
 * Run a test
 */
async function runTest(
  name: string,
  test: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await test();
    const duration = Date.now() - start;
    results.push({ name, passed: true, message: 'OK', duration });
    console.log(\`✅ \${name}\`);
  } catch (error) {
    const duration = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, message, duration });
    console.log(\`❌ \${name}: \${message}\`);
  }
}

/**
 * Test connection
 */
async function testConnection(): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      ws.close();
      resolve();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Test message receive
 */
async function testMessageReceive(): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let receivedConnected = false;

    const timeout = setTimeout(() => {
      ws.close();
      if (!receivedConnected) {
        reject(new Error('Did not receive connected message'));
      }
    }, 5000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'ping' }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'connected' || message.type === 'pong') {
        receivedConnected = true;
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    });

    ws.on('error', reject);
  });
}

/**
 * Test room join/leave
 */
async function testRoomJoinLeave(): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const testRoom = 'test-room-' + uuidv4();
    let state = 'connecting';
    let receivedJoined = false;
    let receivedLeft = false;

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Room join/leave test incomplete'));
    }, 5000);

    ws.on('open', () => {
      state = 'joining';
      ws.send(JSON.stringify({ type: 'join', room: testRoom }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === 'joined') {
        receivedJoined = true;
        state = 'leaving';
        ws.send(JSON.stringify({ type: 'leave', room: testRoom }));
      } else if (message.type === 'left') {
        receivedLeft = true;
        if (receivedJoined && receivedLeft) {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      }
    });

    ws.on('error', reject);
  });
}

/**
 * Test chat message
 */
async function testChatMessage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws1 = new WebSocket(WS_URL);
    const ws2 = new WebSocket(WS_URL);
    const testRoom = 'chat-test-' + uuidv4();
    const testMessage = 'Hello from test!';

    let ws1Joined = false;
    let ws2Joined = false;
    let ws2Received = false;

    const timeout = setTimeout(() => {
      ws1.close();
      ws2.close();
      reject(new Error('Chat message test incomplete'));
    }, 8000);

    function checkComplete() {
      if (ws1Joined && ws2Joined && ws2Received) {
        clearTimeout(timeout);
        ws1.close();
        ws2.close();
        resolve();
      }
    }

    ws1.on('open', () => {
      ws1.send(JSON.stringify({ type: 'join', room: testRoom }));
    });

    ws1.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'joined') {
        ws1Joined = true;
        checkComplete();
      }
    });

    ws2.on('open', () => {
      ws2.send(JSON.stringify({ type: 'join', room: testRoom }));
    });

    ws2.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'joined') {
        ws2Joined = true;
        // Send chat message from ws1
        ws1.send(JSON.stringify({
          type: 'message',
          room: testRoom,
          content: testMessage,
        }));
      } else if (message.type === 'chat_message') {
        if (message.content === testMessage) {
          ws2Received = true;
          checkComplete();
        }
      }
    });

    ws1.on('error', reject);
    ws2.on('error', reject);
  });
}

/**
 * Test HTTP health endpoint
 */
async function testHealthEndpoint(): Promise<void> {
  const response = await fetch(\`\${HTTP_URL}/health\`);
  if (!response.ok) {
    throw new Error(\`Health endpoint returned \${response.status}\`);
  }
  const data = await response.json();
  if (data.status !== 'healthy') {
    throw new Error('Health status is not healthy');
  }
}

/**
 * Test HTTP stats endpoint
 */
async function testStatsEndpoint(): Promise<void> {
  const response = await fetch(\`\${HTTP_URL}/stats\`);
  if (!response.ok) {
    throw new Error(\`Stats endpoint returned \${response.status}\`);
  }
  const data = await response.json();
  if (typeof data.connectedClients !== 'number') {
    throw new Error('Stats missing connectedClients');
  }
}

/**
 * Test HTTP broadcast endpoint
 */
async function testBroadcastEndpoint(): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let receivedBroadcast = false;

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Broadcast not received'));
    }, 5000);

    ws.on('open', async () => {
      // Send broadcast via HTTP
      await fetch(\`\${HTTP_URL}/broadcast\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Test broadcast' }),
      });
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'broadcast' && message.from === 'system') {
        receivedBroadcast = true;
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    });

    ws.on('error', reject);
  });
}

/**
 * Main test runner
 */
async function main() {
  console.log('WebSocket API Test Suite');
  console.log(\`Testing: \${WS_URL}\\n\`);

  // Connection tests
  await runTest('Connection established', testConnection);
  await runTest('Receive connected message', testMessageReceive);
  await runTest('Room join and leave', testRoomJoinLeave);
  await runTest('Chat message between clients', testChatMessage);

  // HTTP endpoint tests
  await runTest('HTTP health endpoint', testHealthEndpoint);
  await runTest('HTTP stats endpoint', testStatsEndpoint);
  await runTest('HTTP broadcast to WebSocket', testBroadcastEndpoint);

  // Print summary
  console.log('\\n' + '='.repeat(50));
  console.log('Test Results Summary');
  console.log('='.repeat(50));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(\`Total: \${results.length} tests\`);
  console.log(\`Passed: \${passed}\`);
  console.log(\`Failed: \${failed}\`);
  console.log(\`Duration: \${totalDuration}ms\`);

  if (failed > 0) {
    console.log('\\nFailed tests:');
    for (const result of results.filter(r => !r.passed)) {
      console.log(\`  - \${result.name}: \${result.message}\`);
    }
    process.exit(1);
  } else {
    console.log('\\n✅ All tests passed!');
    process.exit(0);
  }
}

main().catch(console.error);
`,
    'package.json': `{
  "name": "{{name}}",
  "version": "1.0.0",
  "description": "{{description}}",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node --loader tsx src/server.ts",
    "generate-client": "tsx scripts/generate-client.ts asyncapi.yaml src/generated-client.ts --ts",
    "validate-asyncapi": "tsx scripts/validate-asyncapi.ts asyncapi.yaml",
    "test-websocket": "tsx scripts/test-websocket.ts"
  },
  "dependencies": {
    "ws": "^8.18.0",
    "express": "^4.19.2",
    "uuid": "^9.0.1",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10",
    "@types/express": "^4.17.21",
    "@types/uuid": "^9.0.8",
    "typescript": "^5.5.4",
    "tsx": "^4.16.2",
    "nodemon": "^3.1.4"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*", "scripts/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,
    '.env.example': `# Server Configuration
PORT=3000
WS_PORT=3001

# Environment
NODE_ENV=development
`,
    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Install dev dependencies for tsx
RUN npm ci

# Expose ports
EXPOSE 3000 3001

# Set environment
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]
`,
    'docker-compose.yml': `version: '3.8'

services:
  websocket-server:
    build: .
    container_name: {{name}}-server
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - PORT=3000
      - WS_PORT=3001
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
`,
    'README.md': `# {{name}} - WebSocket API Documentation

WebSocket API with AsyncAPI specification, client code generation, and comprehensive documentation.

## Features

- **WebSocket Server**: Real-time bidirectional messaging
- **Room-Based Messaging**: Join/leave rooms for targeted communication
- **Broadcast**: Send messages to all connected clients
- **AsyncAPI Specification**: Standard API documentation format
- **Client Code Generation**: Auto-generate JavaScript/TypeScript clients
- **Type Safety**: Full TypeScript support
- **Testing Suite**: Comprehensive WebSocket and HTTP endpoint tests

## Quick Start

### Installation

\`\`\`bash
npm install
\`\`\`

### Configuration

\`\`\`bash
cp .env.example .env
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

The server will start:
- HTTP API: \`http://localhost:3000\`
- WebSocket: \`ws://localhost:3001\`

## API Documentation

### WebSocket Messages

#### Client → Server Messages

| Type | Description | Payload |
|------|-------------|---------|
| \`join\` | Join a room | \`{ type: "join", room: string }\` |
| \`leave\` | Leave a room | \`{ type: "leave", room: string }\` |
| \`message\` | Send chat message | \`{ type: "message", room: string, content: string }\` |
| \`broadcast\` | Broadcast to all | \`{ type: "broadcast", content: string }\` |
| \`ping\` | Ping server | \`{ type: "ping" }\` |
| \`list_rooms\` | List active rooms | \`{ type: "list_rooms" }\` |
| \`list_clients\` | List connected clients | \`{ type: "list_clients" }\` |

#### Server → Client Messages

| Type | Description | Payload |
|------|-------------|---------|
| \`connected\` | Connection established | \`{ type: "connected", clientId: string, timestamp: string }\` |
| \`joined\` | Successfully joined room | \`{ type: "joined", room: string, timestamp: string }\` |
| \`left\` | Successfully left room | \`{ type: "left", room: string, timestamp: string }\` |
| \`chat_message\` | Chat message received | \`{ type: "chat_message", id, clientId, room, content, timestamp }\` |
| \`broadcast\` | Broadcast received | \`{ type: "broadcast", from, content, timestamp }\` |
| \`pong\` | Pong response | \`{ type: "pong", timestamp: string }\` |
| \`rooms_list\` | List of rooms | \`{ type: "rooms_list", rooms: string[] }\` |
| \`clients_list\` | List of clients | \`{ type: "clients_list", clients: [{ id, rooms }] }\` |
| \`error\` | Error occurred | \`{ type: "error", message: string }\` |

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/\` | GET | API information |
| \`/health\` | GET | Health check |
| \`/stats\` | GET | Connection statistics |
| \`/docs\` | GET | API documentation (JSON) |
| \`/asyncapi.yaml\` | GET | AsyncAPI specification |
| \`/broadcast\` | POST | Broadcast message to WebSocket clients |

## Client Usage

### JavaScript

\`\`\`javascript
import { createClient } from './src/client/index.js';

const client = createClient({ url: 'ws://localhost:3001' });

// Set up event handlers
client.on({
  onConnected: (data) => console.log('Connected:', data.clientId),
  onChatMessage: (data) => console.log('Message:', data.content),
  onError: (data) => console.error('Error:', data.message),
});

// Connect
await client.connect();

// Join a room
client.joinRoom('general');

// Send a message
client.sendChatMessage('general', 'Hello!');

// Leave room
client.leaveRoom('general');

// Disconnect
client.disconnect();
\`\`\`

### TypeScript

\`\`\`typescript
import { createClient, WebSocketClient } from './src/client';

const client: WebSocketClient = createClient({
  url: 'ws://localhost:3001',
  reconnect: true,
  heartbeat: true,
});

// Type-safe event handlers
client.on({
  onConnected: (data) => {
    console.log('Connected with ID: ' + data.clientId);
  },
  onChatMessage: (data) => {
    console.log('[' + data.room + '] ' + data.clientId + ': ' + data.content);
  },
});

await client.connect();
\`\`\`

### Browser Example

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Client Demo</title>
</head>
<body>
  <div id="messages"></div>
  <input id="messageInput" type="text" placeholder="Type a message...">
  <button onclick="sendMessage()">Send</button>

  <script type="module">
    import { createClient } from './src/client/index.js';

    const client = createClient();
    const messagesDiv = document.getElementById('messages');
    const input = document.getElementById('messageInput');

    client.on({
      onConnected: (data) => {
        addMessage('System', 'Connected as ' + data.clientId);
      },
      onChatMessage: (data) => {
        addMessage(data.clientId, data.content);
      },
    });

    await client.connect();
    client.joinRoom('lobby');

    function addMessage(sender, text) {
      const div = document.createElement('div');
      div.textContent = '[' + sender + '] ' + text;
      messagesDiv.appendChild(div);
    }

    function sendMessage() {
      client.sendChatMessage('lobby', input.value);
      input.value = '';
    }
  </script>
</body>
</html>
\`\`\`

## Code Generation

### Generate Client from AsyncAPI Spec

\`\`\`bash
npm run generate-client
\`\`\`

This generates a TypeScript client from \`asyncapi.yaml\`.

### Validate AsyncAPI Spec

\`\`\`bash
npm run validate-asyncapi
\`\`\`

## Testing

Run the WebSocket test suite:

\`\`\`bash
npm run test-websocket
\`\`\`

Tests include:
- Connection establishment
- Message receive
- Room join/leave
- Chat messaging
- HTTP endpoints
- Broadcast functionality

## AsyncAPI Specification

The AsyncAPI specification is available at:

- \`http://localhost:3000/asyncapi.yaml\` - YAML format
- \`http://localhost:3000/docs\` - JSON documentation

## Docker

### Build

\`\`\`bash
docker build -t {{name}} .
\`\`\`

### Run

\`\`\`bash
docker-compose up
\`\`\`

## License

MIT
`,
  },
};
