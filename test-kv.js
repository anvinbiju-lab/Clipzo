require('dotenv').config({ path: '.env.local' });
const { RoomManager } = require('./server/room-manager.ts');
// Actually, since it's typescript, we should use ts-node
