import { BackendTemplate } from '../types';

/**
 * WebSocket Real-time Communication Template
 * Full-featured WebSocket server with rooms, broadcasts, and authentication
 */
export const websocketRealtimeTemplate: BackendTemplate = {
  id: 'websocket-realtime',
  name: 'websocket-realtime',
  displayName: 'WebSocket Real-time Communication',
  description: 'Complete WebSocket real-time communication server with rooms, broadcasts, authentication, reconnection handling, and scaling support',
  language: 'javascript',
  framework: 'websocket',
  version: '1.0.0',
  tags: ['websocket', 'realtime', 'ws', 'socket', 'broadcasting', 'rooms'],
  port: 3000,
  dependencies: {},
  features: ['websockets', 'docker', 'rest-api', 'monitoring'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "node test/test.js"
  },
  "dependencies": {
    "ws": "^8.16.0",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.1"
  }
}
`,

    'websocket/server.js': `import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * WebSocket Connection Manager
 * Handles connection lifecycle, rooms, and broadcasting
 */
class ConnectionManager {
  constructor() {
    // Map of socket ID to socket instance
    this.connections = new Map();
    // Map of room name to Set of socket IDs
    this.rooms = new Map();
    // Map of socket ID to user data
    this.users = new Map();
  }

  /**
   * Add a new connection
   */
  addConnection(ws, userId = null) {
    const socketId = uuidv4();
    ws.id = socketId;
    ws.userId = userId;
    ws.rooms = new Set();

    this.connections.set(socketId, ws);
    if (userId) {
      this.users.set(socketId, { userId, connectedAt: new Date() });
    }

    return socketId;
  }

  /**
   * Remove a connection
   */
  removeConnection(socketId) {
    const ws = this.connections.get(socketId);
    if (ws) {
      // Remove from all rooms
      ws.rooms.forEach(room => this.leaveRoom(socketId, room));
      this.connections.delete(socketId);
      this.users.delete(socketId);
    }
  }

  /**
   * Join a room
   */
  joinRoom(socketId, roomName) {
    const ws = this.connections.get(socketId);
    if (!ws) return false;

    ws.rooms.add(roomName);

    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }
    this.rooms.get(roomName).add(socketId);

    return true;
  }

  /**
   * Leave a room
   */
  leaveRoom(socketId, roomName) {
    const ws = this.connections.get(socketId);
    if (!ws) return false;

    ws.rooms.delete(roomName);

    const room = this.rooms.get(roomName);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) {
        this.rooms.delete(roomName);
      }
    }

    return true;
  }

  /**
   * Send message to specific socket
   */
  sendTo(socketId, data) {
    const ws = this.connections.get(socketId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  /**
   * Broadcast to all connections except sender
   */
  broadcast(data, excludeSocketId = null) {
    const message = JSON.stringify(data);
    for (const [id, ws] of this.connections) {
      if (id !== excludeSocketId && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Broadcast to a room
   */
  broadcastToRoom(roomName, data, excludeSocketId = null) {
    const room = this.rooms.get(roomName);
    if (!room) return 0;

    const message = JSON.stringify(data);
    let sent = 0;

    for (const socketId of room) {
      if (socketId !== excludeSocketId) {
        const ws = this.connections.get(socketId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(message);
          sent++;
        }
      }
    }

    return sent;
  }

  /**
   * Get room members count
   */
  getRoomCount(roomName) {
    const room = this.rooms.get(roomName);
    return room ? room.size : 0;
  }

  /**
   * Get all room names
   */
  getRooms() {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get connection stats
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      totalRooms: this.rooms.size,
      totalUsers: this.users.size
    };
  }
}

export { ConnectionManager };
`,

    'websocket/handlers.js': `import { ConnectionManager } from './server.js';

/**
 * WebSocket message handlers
 */
class MessageHandlers {
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Handle ping/pong for heartbeat
   */
  handlePing(ws, data) {
    this.manager.sendTo(ws.id, {
      type: 'pong',
      timestamp: Date.now(),
      echo: data.payload
    });
  }

  /**
   * Handle room join
   */
  handleJoinRoom(ws, data) {
    const room = data.room;
    if (!room) {
      return this.manager.sendTo(ws.id, {
        type: 'error',
        message: 'Room name is required'
      });
    }

    if (this.manager.joinRoom(ws.id, room)) {
      // Notify the client they joined
      this.manager.sendTo(ws.id, {
        type: 'room-joined',
        room: room,
        userCount: this.manager.getRoomCount(room)
      });

      // Notify others in the room
      this.manager.broadcastToRoom(room, {
        type: 'user-joined',
        room: room,
        userId: ws.userId || ws.id,
        timestamp: new Date().toISOString()
      }, ws.id);

      // Send room list to the client
      this.manager.sendTo(ws.id, {
        type: 'room-list',
        rooms: this.manager.getRooms().map(r => ({
          name: r,
          count: this.manager.getRoomCount(r)
        }))
      });
    }
  }

  /**
   * Handle room leave
   */
  handleLeaveRoom(ws, data) {
    const room = data.room;
    if (!room) return;

    if (this.manager.leaveRoom(ws.id, room)) {
      this.manager.sendTo(ws.id, {
        type: 'room-left',
        room: room
      });

      this.manager.broadcastToRoom(room, {
        type: 'user-left',
        room: room,
        userId: ws.userId || ws.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle broadcast message
   */
  handleBroadcast(ws, data) {
    const message = {
      type: 'broadcast',
      from: ws.userId || ws.id,
      message: data.message,
      timestamp: new Date().toISOString()
    };

    this.manager.broadcast(message, ws.id);
  }

  /**
   * Handle room message
   */
  handleRoomMessage(ws, data) {
    const room = data.room;
    if (!room) {
      return this.manager.sendTo(ws.id, {
        type: 'error',
        message: 'Room name is required'
      });
    }

    const message = {
      type: 'room-message',
      room: room,
      from: ws.userId || ws.id,
      message: data.message,
      timestamp: new Date().toISOString()
    };

    const sent = this.manager.broadcastToRoom(room, message, ws.id);

    this.manager.sendTo(ws.id, {
      type: 'message-delivered',
      room: room,
      deliveredTo: sent
    });
  }

  /**
   * Handle direct message to user
   */
  handleDirectMessage(ws, data) {
    const toSocketId = data.to;
    if (!toSocketId) {
      return this.manager.sendTo(ws.id, {
        type: 'error',
        message: 'Target user ID is required'
      });
    }

    const message = {
      type: 'direct-message',
      from: ws.userId || ws.id,
      message: data.message,
      timestamp: new Date().toISOString()
    };

    const sent = this.manager.sendTo(toSocketId, message);

    this.manager.sendTo(ws.id, {
      type: 'message-delivered',
      to: toSocketId,
      delivered: sent
    });
  }

  /**
   * Handle list rooms request
   */
  handleListRooms(ws) {
    this.manager.sendTo(ws.id, {
      type: 'room-list',
      rooms: this.manager.getRooms().map(r => ({
        name: r,
        count: this.manager.getRoomCount(r)
      }))
    });
  }

  /**
   * Handle stats request
   */
  handleStats(ws) {
    this.manager.sendTo(ws.id, {
      type: 'stats',
      ...this.manager.getStats()
    });
  }

  /**
   * Default handler for unknown message types
   */
  handleUnknown(ws, data) {
    this.manager.sendTo(ws.id, {
      type: 'error',
      message: \`Unknown message type: \${data.type}\`
    });
  }
}

export { MessageHandlers };
`,

    'index.js': `import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { ConnectionManager } from './websocket/server.js';
import { MessageHandlers } from './websocket/handlers.js';

const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// HTTP Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', websocket: 'running' });
});

app.get('/api/stats', (req, res) => {
  res.json(manager.getStats());
});

// Initialize WebSocket
const wss = new WebSocketServer({ server, path: '/ws' });
const manager = new ConnectionManager();
const handlers = new MessageHandlers(manager);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Handle WebSocket connections
 */
wss.on('connection', (ws, req) => {
  // Extract token from query string
  const url = new URL(req.url, \`http://\${req.headers.host}\`);
  const token = url.searchParams.get('token');

  let userId = null;

  // Verify token if provided
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      userId = decoded.userId || decoded.sub;
    } else {
      // Close connection if token is invalid
      ws.close(4001, 'Unauthorized');
      return;
    }
  }

  // Add connection
  const socketId = manager.addConnection(ws, userId);

  console.log(\`Client connected: \${socketId}\` + (userId ? \` (user: \${userId})\` : ''));

  // Send welcome message
  manager.sendTo(socketId, {
    type: 'connected',
    socketId,
    timestamp: new Date().toISOString()
  });

  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          handlers.handlePing(ws, message);
          break;
        case 'join-room':
          handlers.handleJoinRoom(ws, message);
          break;
        case 'leave-room':
          handlers.handleLeaveRoom(ws, message);
          break;
        case 'broadcast':
          handlers.handleBroadcast(ws, message);
          break;
        case 'room-message':
          handlers.handleRoomMessage(ws, message);
          break;
        case 'direct-message':
          handlers.handleDirectMessage(ws, message);
          break;
        case 'list-rooms':
          handlers.handleListRooms(ws);
          break;
        case 'stats':
          handlers.handleStats(ws);
          break;
        default:
          handlers.handleUnknown(ws, message);
      }
    } catch (err) {
      console.error('Error handling message:', err);
      manager.sendTo(ws.id, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log(\`Client disconnected: \${socketId}\`);
    manager.removeConnection(socketId);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(\`WebSocket error for \${socketId}:\`, error);
  });

  // Send heartbeat every 30 seconds
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// Heartbeat interval to detect dead connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(\`WebSocket server running on port \${PORT}\`);
  console.log(\`WebSocket endpoint: ws://localhost:\${PORT}/ws?token=<jwt-token>\`);
});
`,

    'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebSocket Test Client</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 20px; }
    .status { padding: 10px; border-radius: 5px; margin-bottom: 20px; }
    .status.connected { background: #d4edda; color: #155724; }
    .status.disconnected { background: #f8d7da; color: #721c24; }
    .panel { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .panel h2 { margin-bottom: 15px; font-size: 1.2em; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: 500; }
    input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
    button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0056b3; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .messages { height: 300px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 4px; }
    .message { padding: 8px; margin-bottom: 5px; border-radius: 4px; background: white; }
    .message.sent { background: #e3f2fd; }
    .message.received { background: #f1f8e9; }
    .message.system { background: #fff3cd; font-style: italic; }
    .message .meta { font-size: 0.8em; color: #666; }
    .rooms { display: flex; gap: 10px; flex-wrap: wrap; }
    .room-tag { background: #e9ecef; padding: 5px 10px; border-radius: 15px; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>WebSocket Test Client</h1>

    <div id="status" class="status disconnected">Disconnected</div>

    <div class="panel">
      <h2>Connection</h2>
      <div class="form-group">
        <label>Server URL:</label>
        <input type="text" id="serverUrl" value="ws://localhost:3000/ws">
      </div>
      <div class="form-group">
        <label>Auth Token (optional):</label>
        <input type="text" id="authToken" placeholder="JWT token">
      </div>
      <button id="connectBtn" onclick="toggleConnection()">Connect</button>
    </div>

    <div class="panel">
      <h2>Rooms</h2>
      <div class="form-group">
        <label>Room Name:</label>
        <input type="text" id="roomName" placeholder="Enter room name">
      </div>
      <button onclick="joinRoom()" id="joinBtn" disabled>Join Room</button>
      <button onclick="leaveRoom()" id="leaveBtn" disabled>Leave Room</button>
      <div id="roomsList" class="rooms" style="margin-top: 10px;"></div>
    </div>

    <div class="panel">
      <h2>Send Message</h2>
      <div class="form-group">
        <label>Message Type:</label>
        <select id="messageType">
          <option value="broadcast">Broadcast to All</option>
          <option value="room">Send to Room</option>
          <option value="direct">Direct Message</option>
        </select>
      </div>
      <div class="form-group" id="roomInputGroup" style="display: none;">
        <label>Room Name:</label>
        <input type="text" id="targetRoom">
      </div>
      <div class="form-group" id="directInputGroup" style="display: none;">
        <label>Target Socket ID:</label>
        <input type="text" id="targetSocketId">
      </div>
      <div class="form-group">
        <label>Message:</label>
        <textarea id="messageContent" rows="3" placeholder="Enter your message"></textarea>
      </div>
      <button onclick="sendMessage()" id="sendBtn" disabled>Send</button>
    </div>

    <div class="panel">
      <h2>Messages</h2>
      <div id="messages" class="messages"></div>
      <button onclick="clearMessages()" style="margin-top: 10px;">Clear Messages</button>
    </div>

    <div class="panel">
      <h2>Actions</h2>
      <button onclick="requestStats()">Get Stats</button>
      <button onclick="requestRoomList()">List Rooms</button>
      <button onclick="sendPing()">Send Ping</button>
    </div>
  </div>

  <script>
    let ws = null;
    let socketId = null;
    let myRooms = [];

    function toggleConnection() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else {
        connect();
      }
    }

    function connect() {
      const serverUrl = document.getElementById('serverUrl').value;
      const token = document.getElementById('authToken').value;
      const url = token ? \`\${serverUrl}?token=\${token}\` : serverUrl;

      ws = new WebSocket(url);

      ws.onopen = () => {
        updateStatus('connected');
        document.getElementById('connectBtn').textContent = 'Disconnect';
        enableButtons(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
      };

      ws.onclose = () => {
        updateStatus('disconnected');
        document.getElementById('connectBtn').textContent = 'Connect';
        enableButtons(false);
        socketId = null;
        myRooms = [];
        updateRoomsList();
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addMessage('system', 'Connection error occurred');
      };
    }

    function handleMessage(data) {
      switch (data.type) {
        case 'connected':
          socketId = data.socketId;
          addMessage('system', \`Connected as \${socketId}\`);
          break;
        case 'room-joined':
          myRooms.push(data.room);
          updateRoomsList();
          addMessage('system', \`Joined room: \${data.room} (\${data.userCount} users)\`);
          break;
        case 'room-left':
          myRooms = myRooms.filter(r => r !== data.room);
          updateRoomsList();
          addMessage('system', \`Left room: \${data.room}\`);
          break;
        case 'broadcast':
        case 'room-message':
        case 'direct-message':
          addMessage('received', \`[\${data.from || 'Unknown'}] \${data.message}\`);
          break;
        case 'user-joined':
          addMessage('system', \`User \${data.userId} joined \${data.room}\`);
          break;
        case 'user-left':
          addMessage('system', \`User \${data.userId} left \${data.room}\`);
          break;
        case 'room-list':
          displayRoomList(data.rooms);
          break;
        case 'stats':
          addMessage('system', \`Stats: \${JSON.stringify(data)}\`);
          break;
        case 'pong':
          addMessage('system', \`Pong: \${data.echo || 'No data'}\`);
          break;
        case 'error':
          addMessage('system', \`Error: \${data.message}\`);
          break;
        default:
          addMessage('system', \`Unknown message: \${data.type}\`);
      }
    }

    function updateStatus(status) {
      const el = document.getElementById('status');
      el.className = \`status \${status}\`;
      el.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }

    function enableButtons(enabled) {
      document.getElementById('joinBtn').disabled = !enabled;
      document.getElementById('leaveBtn').disabled = !enabled;
      document.getElementById('sendBtn').disabled = !enabled;
    }

    function addMessage(type, content) {
      const container = document.getElementById('messages');
      const msg = document.createElement('div');
      msg.className = \`message \${type}\`;
      msg.innerHTML = \`<div class="meta">\${new Date().toLocaleTimeString()}</div>\${content}\`;
      container.appendChild(msg);
      container.scrollTop = container.scrollHeight;
    }

    function clearMessages() {
      document.getElementById('messages').innerHTML = '';
    }

    function joinRoom() {
      const room = document.getElementById('roomName').value;
      if (!room) return alert('Enter a room name');

      ws.send(JSON.stringify({ type: 'join-room', room }));
    }

    function leaveRoom() {
      const room = document.getElementById('roomName').value;
      if (!room) return alert('Enter a room name');

      ws.send(JSON.stringify({ type: 'leave-room', room }));
    }

    function updateRoomsList() {
      const container = document.getElementById('roomsList');
      container.innerHTML = myRooms.map(r => \`<span class="room-tag">\${r}</span>\`).join('');
    }

    function displayRoomList(rooms) {
      const container = document.getElementById('roomsList');
      container.innerHTML = rooms.map(r =>
        \`<span class="room-tag">\${r.name} (\${r.count})</span>\`
      ).join('');
    }

    function sendMessage() {
      const type = document.getElementById('messageType').value;
      const content = document.getElementById('messageContent').value;

      if (!content) return alert('Enter a message');

      const message = { type };

      switch (type) {
        case 'broadcast':
          message.message = content;
          break;
        case 'room':
          message.room = document.getElementById('targetRoom').value;
          message.message = content;
          break;
        case 'direct':
          message.to = document.getElementById('targetSocketId').value;
          message.message = content;
          break;
      }

      ws.send(JSON.stringify(message));
      addMessage('sent', \`[You] \${content}\`);
      document.getElementById('messageContent').value = '';
    }

    function requestStats() {
      ws.send(JSON.stringify({ type: 'stats' }));
    }

    function requestRoomList() {
      ws.send(JSON.stringify({ type: 'list-rooms' }));
    }

    function sendPing() {
      ws.send(JSON.stringify({ type: 'ping', payload: 'Hello!' }));
    }

    // Show/hide input fields based on message type
    document.getElementById('messageType').addEventListener('change', (e) => {
      document.getElementById('roomInputGroup').style.display =
        e.target.value === 'room' ? 'block' : 'none';
      document.getElementById('directInputGroup').style.display =
        e.target.value === 'direct' ? 'block' : 'none';
    });
  </script>
</body>
</html>
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=\${JWT_SECRET:-your-secret-key}
    restart: unless-stopped

  # Redis for scaling WebSocket connections (optional)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
`,

    '.env.example': `# JWT Secret for authentication
JWT_SECRET=your-secret-key-change-this

# Server Port
PORT=3000

# Node Environment
NODE_ENV=development
`,

    'README.md': `# {{projectName}}

WebSocket real-time communication server with rooms, broadcasts, and authentication.

## Features

- **WebSocket Server**: Built on ws library with high performance
- **Room Support**: Create and join chat rooms for group communication
- **Broadcasting**: Send messages to all connected clients or specific rooms
- **Direct Messaging**: Send private messages between users
- **JWT Authentication**: Secure connections with token-based auth
- **Heartbeat**: Automatic ping/pong for connection health monitoring
- **Reconnection Ready**: Handles disconnections gracefully
- **Test Client**: Built-in HTML/JS test client for development

## Quick Start

\\\`\\\`\\\`bash
# Install dependencies
npm install

# Start server
npm start

# Dev mode with auto-reload
npm run dev
\\\`\\\`\\\`

## Connecting

Use the test client at \`http://localhost:3000\` or connect via WebSocket:

\\\`\\\`\\\`javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=<jwt-token>');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Join a room
ws.send(JSON.stringify({
  type: 'join-room',
  room: 'general'
}));

// Send message to room
ws.send(JSON.stringify({
  type: 'room-message',
  room: 'general',
  message: 'Hello everyone!'
}));
\\\`\\\`\\\`

## Message Types

- \`ping\` - Heartbeat ping
- \`pong\` - Heartbeat pong response
- \`join-room\` - Join a room
- \`leave-room\` - Leave a room
- \`broadcast\` - Send to all clients
- \`room-message\` - Send to a room
- \`direct-message\` - Send to specific user
- \`list-rooms\` - Get all rooms
- \`stats\` - Get server statistics

## License

MIT
`,

    'test/test.js': `// Simple test for WebSocket server
import { WebSocket } from 'ws';

const WS_URL = 'ws://localhost:3000/ws';

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  fn().then(() => {
    console.log(\`✓ \${name}\`);
    testsPassed++;
  }).catch((err) => {
    console.error(\`✗ \${name}: \${err.message}\`);
    testsFailed++;
  });
}

async function testConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      ws.close();
      resolve();
    });

    ws.on('error', reject);

    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

async function testJoinRoom() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const room = \`test-room-\${Date.now()}\`;

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'join-room', room }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'room-joined' && msg.room === room) {
        ws.close();
        resolve();
      }
    });

    ws.on('error', reject);

    setTimeout(() => {
      ws.close();
      reject(new Error('Join room timeout'));
    }, 5000);
  });
}

async function testBroadcast() {
  return new Promise((resolve, reject) => {
    const ws1 = new WebSocket(WS_URL);
    const ws2 = new WebSocket(WS_URL);
    let received = false;

    ws2.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'broadcast' && msg.message === 'test broadcast') {
        received = true;
      }
    });

    Promise.all([
      new Promise(r => ws1.on('open', r)),
      new Promise(r => ws2.on('open', r))
    ]).then(() => {
      ws1.send(JSON.stringify({
        type: 'broadcast',
        message: 'test broadcast'
      }));

      setTimeout(() => {
        ws1.close();
        ws2.close();
        if (received) {
          resolve();
        } else {
          reject(new Error('Broadcast not received'));
        }
      }, 1000);
    });

    setTimeout(() => {
      ws1.close();
      ws2.close();
      reject(new Error('Broadcast timeout'));
    }, 5000);
  });
}

async function runTests() {
  console.log('Running WebSocket server tests...\\n');

  await test('Connection', testConnection);
  await test('Join Room', testJoinRoom);
  await test('Broadcast', testBroadcast);

  console.log(\`\\nTests passed: \${testsPassed}\`);
  console.log(\`Tests failed: \${testsFailed}\`);

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(console.error);
`
  }
};
