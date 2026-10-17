// LAN co-op relay. Runs inside the Vite dev/preview server (see vite.config.js):
// clients connect to ws://<host>:<port>/lan?role=host|guest&name=...
// The relay only routes JSON messages; the hosting browser is the world's authority.
import os from 'node:os';
import { WebSocketServer } from 'ws';

const MAX_PLAYERS = 4;

export function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if ((a.family === 'IPv4' || a.family === 4) && !a.internal) out.push(a.address);
    }
  }
  return out;
}

export function attachLanRelay(httpServer, log = console.log) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1 << 20 });
  const clients = new Map(); // id -> { ws, role, name }
  let hostId = null;
  let nextId = 1;

  const sendTo = (id, obj) => {
    const c = clients.get(id);
    if (c && c.ws.readyState === 1) c.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
  };
  const broadcast = (obj, except = null) => {
    const data = typeof obj === 'string' ? obj : JSON.stringify(obj);
    for (const [id, c] of clients) if (id !== except && c.ws.readyState === 1) c.ws.send(data);
  };

  httpServer.on('upgrade', (req, socket, head) => {
    if (!req.url || !req.url.startsWith('/lan')) return; // leave Vite's HMR socket alone
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    const name = (url.searchParams.get('name') || 'Wanderer').slice(0, 32);
    const reject = (msg) => {
      ws.send(JSON.stringify({ t: 'error', msg }));
      ws.close();
    };
    if (role === 'host' && hostId !== null) return reject('Someone is already hosting on this server. Choose Join instead.');
    if (role === 'guest' && hostId === null) return reject('No one is hosting yet. Ask your friend to choose Host first.');
    if (clients.size >= MAX_PLAYERS) return reject(`The game is full (${MAX_PLAYERS} players).`);

    const id = nextId++;
    clients.set(id, { ws, role, name });
    if (role === 'host') hostId = id;
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    sendTo(id, {
      t: 'welcome', id, hostId,
      peers: [...clients].filter(([pid]) => pid !== id).map(([pid, c]) => ({ id: pid, name: c.name, role: c.role })),
    });
    broadcast({ t: 'join', id, name, role }, id);
    log(`[unstable] ${name} joined as ${role} (${clients.size} connected)`);

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (_) {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      msg.from = id;
      const to = msg.to;
      if (to !== undefined && to !== null) {
        delete msg.to;
        sendTo(to, msg);
      } else broadcast(msg, id);
    });

    ws.on('close', () => {
      clients.delete(id);
      broadcast({ t: 'leave', id, name });
      if (id === hostId) {
        hostId = null;
        broadcast({ t: 'hostLeft' });
      }
      log(`[unstable] ${name} left (${clients.size} connected)`);
    });
  });

  const heartbeat = setInterval(() => {
    for (const c of clients.values()) {
      if (!c.ws.isAlive) {
        c.ws.terminate();
        continue;
      }
      c.ws.isAlive = false;
      try {
        c.ws.ping();
      } catch (_) {
        /* ignore */
      }
    }
  }, 10000);
  httpServer.on('close', () => clearInterval(heartbeat));
  return wss;
}

// Vite plugin: adds the relay and a small /lan/info endpoint to dev and preview servers.
export function lanPlugin() {
  const info = (httpServer, hostOpt) => (req, res) => {
    const addr = httpServer.address();
    const bound = addr && typeof addr === 'object' ? addr.address : '';
    const exposed = !!hostOpt || bound === '0.0.0.0' || bound === '::';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ addresses: lanAddresses(), port: addr && typeof addr === 'object' ? addr.port : null, exposed }));
  };
  return {
    name: 'unstable-lan',
    configureServer(server) {
      if (!server.httpServer) return;
      attachLanRelay(server.httpServer, (m) => server.config.logger.info(m));
      server.middlewares.use('/lan/info', info(server.httpServer, server.config.server.host));
      server.httpServer.once('listening', () => {
        if (!server.config.server.host) return; // `npm run dev`: local only
        const port = server.httpServer.address().port;
        server.config.logger.info(`\n  [unstable] LAN co-op ready. Friends join at: ${lanAddresses().map((a) => `http://${a}:${port}`).join('  ') || '(no network found)'}\n`);
      });
    },
    configurePreviewServer(server) {
      attachLanRelay(server.httpServer, (m) => server.config.logger.info(m));
      server.middlewares.use('/lan/info', info(server.httpServer, server.config.preview.host));
    },
  };
}
