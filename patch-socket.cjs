const fs = require('fs');

let socketHook = fs.readFileSync('lib/useQuickDropSocket.ts', 'utf8');

// Add error setting on socket close if never connected
socketHook = socketHook.replace(
  /ws\.onerror = \(\) => \{\s*\/\/ Will trigger onclose and attempt reconnect\s*\};/,
  `ws.onerror = () => {
        setState((prev) => ({ 
          ...prev, 
          error: !prev.code ? 'Unable to connect to server. Ensure you ran "npm run dev" (tsx server.ts).' : 'Connection error' 
        }));
      };`
);

socketHook = socketHook.replace(
  /if \(\!prev\.expired && \(prev\.code \|\| prev\.token\)\) \{/,
  `if (!prev.expired && (prev.code || prev.token)) {`
);

// If it fails to connect and we don't have a code, let's also give a retry button in PcView.
fs.writeFileSync('lib/useQuickDropSocket.ts', socketHook);

let pcView = fs.readFileSync('components/PcView.tsx', 'utf8');
pcView = pcView.replace(
  /<span className="text-neutral-400 text-sm font-medium animate-pulse">\s*Generating code...\s*<\/span>/,
  `{error ? (
              <button 
                onClick={() => { hasRequestedRoom.current = false; onCreateRoom(); }} 
                className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg text-sm font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
              >
                Retry Connection
              </button>
            ) : (
              <span className="text-neutral-400 text-sm font-medium animate-pulse">
                Generating code...
              </span>
            )}`
);
fs.writeFileSync('components/PcView.tsx', pcView);

console.log('Patched');
