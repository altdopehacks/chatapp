import { WebSocketServer } from 'ws';
import { createServer } from 'vite';

// Create Vite dev server
const vite = await createServer({
  server: { port: 5173 }
});
await vite.listen();

// Create WebSocket server
const wss = new WebSocketServer({ port: 3000 });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('message', (data) => {
    // Broadcast message to all connected clients except sender
    const message = data.toString();
    clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

console.log('WebSocket server running on ws://localhost:3000');