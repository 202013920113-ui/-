const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('index.html not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map();

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'join' && msg.room) {
      if (currentRoom && rooms.has(currentRoom)) {
        rooms.get(currentRoom).delete(ws);
      }
      currentRoom = String(msg.room).toUpperCase();
      if (!rooms.has(currentRoom)) {
        rooms.set(currentRoom, new Set());
      }
      const clients = rooms.get(currentRoom);
      if (clients.size >= 2) {
        ws.send(JSON.stringify({ type: 'full' }));
        return;
      }
      clients.add(ws);

      broadcastToRoom(currentRoom, ws, {
        type: 'hello',
        name: msg.name || 'プレイヤー',
        ready: !!msg.ready
      });
      return;
    }

    if (currentRoom) {
      broadcastToRoom(currentRoom, ws, msg);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      broadcastToRoom(currentRoom, ws, { type: 'leave' });
      const clients = rooms.get(currentRoom);
      clients.delete(ws);
      if (clients.size === 0) rooms.delete(currentRoom);
    }
  });
});

function broadcastToRoom(roomId, senderWs, payload) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  const text = JSON.stringify(payload);
  for (const client of clients) {
    if (client !== senderWs && client.readyState === 1) {
      client.send(text);
    }
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`対戦サーバー起動中: http://localhost:${PORT}`);
});
