# QuickDrop ⚡

> **Phone to PC. No login. No hassle.**  
> Ultra-fast, minimal, ephemeral web application for transferring text, programming code, URLs, commands, and snippets from a mobile phone to a computer in seconds.

---

## 🚀 The QuickDrop Workflow

1. **On College PC**: Open QuickDrop. A temporary 4-character room code (e.g. `K7P4`) appears automatically.
2. **On Phone**: Open QuickDrop. Type the 4 characters (or scan the optional QR code). The phone automatically connects on the 4th character.
3. **Transfer**: Paste text or code on your phone and tap **SEND**.
4. **On PC**: The exact, unaltered text appears instantly. Click **COPY** (`Copied ✓`).
5. Send subsequent snippets without entering the code again!
6. All temporary room data is purged automatically after 30 minutes of inactivity (or 2 hours max lifetime).

---

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 (Minimalist, monochrome with subtle status indicators)
- **Realtime**: Native Browser WebSocket API + Node.js `ws` (`WebSocketServer`)
- **Testing**: Vitest
- **PWA**: Installable web application with manifest and offline-ready icons

---

## 🔒 Security & Privacy Architecture

- **Public Code vs. Private Secret**:
  - **4-Character Code** (`ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789`, ~9.8 million combinations) serves strictly as a convenient human discovery identifier.
  - Upon room establishment, both PC and Phone receive cryptographically secure 256-bit private session tokens (`crypto.randomBytes(32)`).
  - All subsequent WebSocket actions, message relays, and reconnects are authorized via the private session token. A 3rd party cannot hijack an active session by guessing the 4-character code.
- **Single-Pairing Lock**:
  - Each room is strictly 1 PC receiver + 1 Phone sender. If another device attempts to join an occupied room, the server rejects it with `"Room already in use"`.
- **Anti-Brute-Force & Rate Limiting**:
  - Maximum 5 failed join attempts per minute per IP $\rightarrow$ 60-second lockout.
  - Maximum 10 room creations per minute per IP.
  - Maximum 60 messages per minute per session.
- **Data Integrity**:
  - Maximum 256 KB per message.
  - Exact byte preservation: indentation, linebreaks, unicode, and syntax formatting are transferred byte-for-byte without alteration.
- **Ephemeral & Private**:
  - Zero database persistence.
  - Text is relayed in-memory and discarded upon session close or expiration.

---

## 💻 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

To simulate the workflow locally:
- **Tab 1**: Open `http://localhost:3000` (defaults to PC mode or toggle `[ 💻 PC ]`). Note the 4-char code.
- **Tab 2**: Open `http://localhost:3000` in a second window and toggle `[ 📱 Phone ]` (or navigate to `http://localhost:3000/j/<CODE>`).
- Paste any code snippet and tap **SEND**.
- Click **COPY** on Tab 1.

---

## 🧪 Running Automated Tests

QuickDrop includes comprehensive automated unit and end-to-end WebSocket protocol tests:

```bash
npm test
```

Test coverage includes:
- Secure 4-character code generation and entropy distribution
- Alphabet integrity (verifying no ambiguous characters `0, O, 1, I, l`)
- Collision handling and unique code generation
- In-memory rate limiting and brute-force lockout
- Room lifecycle: creation, single pairing, 2nd device rejection, token authorization
- Message relay, 256 KB size limits, and deduplication
- Full end-to-end WebSocket client/server handshake, ACK delivery, and error states

---

## 🚢 Deployment

### Option A: Standalone Node / Docker (Recommended for Persistent WebSockets)
Since QuickDrop includes a unified custom Node server (`server.ts`) hosting both Next.js and the native WebSocket server on the same port:

```bash
npm run build
npm start
```

Deployable with 1 click to Railway, Render, Fly.io, or any VPS container.

### Option B: Vercel Deployment
1. Import the repository into Vercel.
2. Build Command: `npm run build`
3. Output Directory: `.next`
4. Deploy!

---

## 📡 WebSocket Wire Protocol

All communication uses lightweight, typed JSON messages:

| Message Type | Direction | Payload | Description |
|---|---|---|---|
| `create` | Client $\rightarrow$ Server | `{ t: 'create' }` | PC initiates room creation |
| `created` | Server $\rightarrow$ Client | `{ t: 'created', code, pcToken }` | Returns 4-char code and private token |
| `join` | Client $\rightarrow$ Server | `{ t: 'join', code, role, token? }` | Phone joins or client re-attaches |
| `joined` | Server $\rightarrow$ Client | `{ t: 'joined', role, token, code, peerConnected }` | Join confirmation |
| `peer_joined` | Server $\rightarrow$ Client | `{ t: 'peer_joined' }` | Notifies peer that counterpart connected |
| `peer_left` | Server $\rightarrow$ Client | `{ t: 'peer_left' }` | Notifies peer that counterpart disconnected |
| `msg` | Phone $\rightarrow$ Server $\rightarrow$ PC | `{ t: 'msg', id, d, token }` | Relays exact text snippet |
| `ack` | Server $\rightarrow$ Phone | `{ t: 'ack', id }` | Delivery confirmation (`Sent ✓`) |
| `ping` / `pong` | Bidirectional | `{ t: 'ping' }` / `{ t: 'pong' }` | Heartbeat keepalive |
| `err` | Server $\rightarrow$ Client | `{ t: 'err', msg }` | Protocol / validation error |
| `expired` | Server $\rightarrow$ Client | `{ t: 'expired' }` | Session expired |
