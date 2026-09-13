const fs = require('fs');
let content = fs.readFileSync('server/room-manager.ts', 'utf8');
content = content.replace(
  /seenMessageIds: Set<string>;/,
  `seenMessageIds: Set<string>;
  httpMessageQueue?: Array<{ t: 'msg', id: string, d: string, ts: number }>;`
);
fs.writeFileSync('server/room-manager.ts', content);
console.log('RoomManager patched.');
