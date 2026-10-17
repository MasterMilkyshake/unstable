import { defineConfig } from 'vite';
import { lanPlugin } from './server/lanRelay.js';

export default defineConfig({
  plugins: [lanPlugin()],
  // No hot-reload: a file change must never yank players back to the main menu mid-game.
  // allowedHosts: let friends join through a Cloudflare quick tunnel (`npm run tunnel`)
  // when the network blocks device-to-device traffic (e.g. campus Wi-Fi).
  server: { port: 5173, hmr: false, allowedHosts: ['.trycloudflare.com'] },
  preview: { port: 4173, allowedHosts: ['.trycloudflare.com'] },
  // three.js in a chunk of its own: it changes far less often than the game, so a browser keeps
  // it cached across updates. Boot time is the same either way (docs/agent/EVIDENCE_LEDGER, E-211).
  build: { rollupOptions: { output: { manualChunks: (id) => (id.includes('/node_modules/three/') ? 'three' : undefined) } } },
});
