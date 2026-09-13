const { WebSocket } = require('ws');
const ws = new WebSocket('ws://127.0.0.1:3000/api/ws');
ws.on('open', () => console.log('Connected!'));
ws.on('error', (err) => console.log('Error:', err));
ws.on('close', () => console.log('Closed'));
ws.on('unexpected-response', (req, res) => console.log('Unexpected response:', res.statusCode));
