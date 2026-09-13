const fs = require('fs');

// 1. Fix server.ts HMR destruction
let serverTs = fs.readFileSync('server.ts', 'utf8');
serverTs = serverTs.replace(
  /\} else \{\s*socket\.destroy\(\);\s*\}/,
  `} else {
      // Let Next.js handle HMR upgrades
      // We don't destroy the socket here
    }`
);
fs.writeFileSync('server.ts', serverTs);

// 2. Fix PcView.tsx infinite loop
let pcView = fs.readFileSync('components/PcView.tsx', 'utf8');
pcView = pcView.replace('import React, { useEffect, useState } from \'react\';', 'import React, { useEffect, useState, useRef } from \'react\';');
pcView = pcView.replace(
  /  \/\/ Auto-trigger room creation if not yet initialized\s*useEffect\(\(\) => \{\s*if \(\!code && \!expired\) \{\s*onCreateRoom\(\);\s*\}\s*\}, \[code, expired, onCreateRoom\]\);/,
  `  // Auto-trigger room creation if not yet initialized
  const hasRequestedRoom = useRef(false);
  useEffect(() => {
    if (!code && !expired && !hasRequestedRoom.current) {
      hasRequestedRoom.current = true;
      onCreateRoom();
    }
  }, [code, expired, onCreateRoom]);`
);
fs.writeFileSync('components/PcView.tsx', pcView);

// 3. Fix app/j/[code]/page.tsx infinite loop
let joinPage = fs.readFileSync('app/j/[code]/page.tsx', 'utf8');
joinPage = joinPage.replace('import React, { useEffect } from \'react\';', 'import React, { useEffect, useRef } from \'react\';');
joinPage = joinPage.replace(
  /  \/\/ Automatically attempt joining upon mounting with the URL code\s*useEffect\(\(\) => \{\s*if \(rawCode && rawCode\.length === 4 && \!socket\.code\) \{\s*socket\.joinRoom\(rawCode, 'phone'\);\s*\}\s*\}, \[rawCode, socket\]\);/,
  `  // Automatically attempt joining upon mounting with the URL code
  const hasRequestedJoin = useRef(false);
  useEffect(() => {
    if (rawCode && rawCode.length === 4 && !socket.code && !hasRequestedJoin.current) {
      hasRequestedJoin.current = true;
      socket.joinRoom(rawCode, 'phone');
    }
  }, [rawCode, socket.code, socket.joinRoom]);`
);
fs.writeFileSync('app/j/[code]/page.tsx', joinPage);

console.log('Patched correctly');
