import { WebSocketServer } from 'ws';
import http from 'http';
import url from 'url';

const PORT = 3005;
const server = http.createServer();
const wss = new WebSocketServer({ server });

/** 
 * Map<roomId, Set<WebSocket>> 
 * In a real production app, use Redis Pub/Sub for scalability across processes.
 */
const rooms = new Map();

wss.on('connection', (ws, req) => {
  console.log(`[Jam] New incoming connection attempt from: ${req.url}`);
  
  // Extract roomId from query string (/any-path?roomId=XYZ)
  let roomId = null;
  try {
    const params = new URL(req.url, 'http://localhost').searchParams;
    roomId = params.get('roomId');
    
    // Fallback if URL parsing is tricky in some environments
    if (!roomId && req.url.includes('roomId=')) {
        roomId = req.url.split('roomId=')[1]?.split('&')[0];
    }
  } catch (e) {
    console.error('[Jam] URL parsing failed, trying manual split:', e);
    roomId = req.url.split('roomId=')[1]?.split('&')[0];
  }

  if (!roomId) {
    console.error('[Jam] Rejecting connection: No roomId found in URL:', req.url);
    ws.close(1008, 'Room ID required');
    return;
  }

  // Join Room
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  const clients = rooms.get(roomId);
  clients.add(ws);

  console.log(`[Jam] New client joined Room: ${roomId}. Total in room: ${clients.size}`);

  // Broadcast participation count to the room
  broadcast(roomId, { type: 'participants-update', payload: { count: clients.size } });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      // Relay message to all OTHER clients in the same room
      broadcastRelay(roomId, data, ws);
    } catch (e) {
      console.error('[Jam] Message parse error:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (clients.size === 0) {
      rooms.delete(roomId);
    } else {
      broadcast(roomId, { type: 'participants-update', payload: { count: clients.size } });
    }
    console.log(`[Jam] Client left Room: ${roomId}. Total remaining: ${clients.size}`);
  });
});

function broadcast(roomId, message) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) client.send(data);
  });
}

function broadcastRelay(roomId, message, sender) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client !== sender && client.readyState === 1) client.send(data);
  });
}

server.listen(PORT, () => {
  console.log(`\n🚀 Nexus Jam WebSocket Server running on ws://localhost:${PORT}`);
  console.log(`   Waiting for rhythmic connections...\n`);
});
