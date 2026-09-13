const { WebSocket } = require('ws');
const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.on('open', () => {
  console.log('Connected to WS');
  ws.send(JSON.stringify({ t: 'create' }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
  setTimeout(() => ws.close(), 500);
});

ws.on('error', (err) => {
  console.error('WS Error:', err.message);
});

ws.on('close', () => console.log('Closed'));
