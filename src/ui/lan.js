// LAN co-op screen: host/join, the address friends should open, player list.
import { G } from '../core/globals.js';
import { Save } from '../core/save.js';
import { escapeHtml } from '../core/util.js';

let cachedInfo = null;
// false only when the relay said it listens on this computer alone (net.js words its host toast by it)
export const lanExposed = () => !(cachedInfo && cachedInfo.exposed === false);

async function fetchInfo() {
  try {
    const r = await fetch('/lan/info', { cache: 'no-store' });
    if (!r.ok) throw new Error('no relay');
    cachedInfo = await r.json();
  } catch (_) {
    cachedInfo = { error: true };
  }
  return cachedInfo;
}

function addressBlock(info) {
  if (!info) return '<div class="muted">Checking your network…</div>';
  if (info.error) {
    return `<div class="bad">The multiplayer server isn't running. Close the game and start it with <kbd>npm run lan</kbd>.</div>`;
  }
  const here = location.hostname;
  const onLocalhost = here === 'localhost' || here === '127.0.0.1';
  const urls = (info.addresses || []).map((a) => `http://${a}:${info.port || location.port}`);
  if (!urls.length) return '<div class="bad">No network connection found on this computer.</div>';
  const exposedNote = info.exposed === false
    ? `<div class="bad" style="margin-top:6px;font-size:14px">This server only accepts connections from this computer. Restart with <kbd>npm run lan</kbd> so friends can connect.</div>`
    : '';
  return `<div class="lan-addr">
      <div class="muted" style="font-size:14px">${onLocalhost ? 'Your friend opens this address in their browser (same Wi-Fi):' : 'Friends on this network open:'}</div>
      ${urls.map((u) => `<div class="lan-url"><span>${u}</span><button class="btn small" data-copy="${u}">Copy</button></div>`).join('')}
      ${exposedNote}
    </div>`;
}

export function openLan(ui, fromMenu = false) {
  const game = ui.game;
  const net = game.net;
  const render = () => {
    const status = net.status;
    let body = '';
    if (status === 'online') {
      const me = game.player;
      const rows = [];
      if (me) rows.push(`<div class="lan-player"><span class="gold">${escapeHtml(me.ch.name)}</span><span class="muted">, you, Power ${me.ch.level}${net.isHost ? ', host' : ''}</span></div>`);
      for (const a of net.avatars.values()) {
        const d = me && a.netPos ? Math.round(a.pos.distanceTo(me.pos)) : null;
        const realm = a.pos.x > 3000 ? 'in the Rift' : d != null ? `${d}m away` : '';
        const isHost = a.peerId === net.hostId;
        rows.push(`<div class="lan-player"><span>${escapeHtml(a.name)}</span><span class="muted">, Power ${a.level}${isHost ? ', host' : ''}, ${realm}${a.knocked ? ', <span class="bad">KNOCKED</span>' : ''}</span>
          </div>`);
      }
      body = `<div class="good" style="font-family:var(--display);letter-spacing:.1em">${net.isHost ? 'HOSTING' : 'CONNECTED'}: ${net.playerCount} player${net.playerCount > 1 ? 's' : ''}</div>
        <div class="lan-list">${rows.join('')}</div>
        ${net.avatars.size === 0 && net.isHost ? '<div class="muted" style="margin:8px 0">Waiting for friends to join…</div>' : ''}
        ${net.isHost ? addressBlock(cachedInfo) : ''}
        <div class="muted" style="font-size:13px;margin-top:8px">The world keeps running while menus are open in multiplayer.</div>
        <div class="divider"></div>
        <div class="row-flex"><span class="space"></span><button class="btn danger" data-a="leave">${net.isHost ? 'Stop Hosting' : 'Leave Game'}</button></div>`;
    } else if (status === 'connecting') {
      body = `<div class="muted">Connecting…</div>`;
    } else {
      const has = game.state === 'playing' || !!Save.lastSlot();
      body = `<p style="margin-top:0">Play together on the same network. One person <b>hosts</b> (their world, enemies and bosses are shared); everyone else <b>joins</b> with their own character.</p>
        ${addressBlock(cachedInfo)}
        <div class="divider"></div>
        <div class="row-flex" style="gap:12px">
          <button class="btn primary" data-a="host" style="flex:1">Host a Game</button>
          <button class="btn primary" data-a="join" style="flex:1">Join a Game</button>
        </div>
        ${fromMenu ? `<div class="muted" style="font-size:13px;margin-top:8px">${has ? 'You will choose which character to bring.' : 'You will create a character first.'}</div>` : ''}
        <div class="muted" style="font-size:13px;margin-top:10px">Each player keeps their own character, inventory, quests and lives. Loot and experience are personal; kills count for everyone nearby.</div>`;
    }
    return `<div class="panel" style="width:min(620px,calc(94 * var(--sw)))"><h2>MULTIPLAYER</h2>${body}</div>`;
  };
  const el = ui.openModal('lan', render());
  const rerender = () => {
    if (ui.modal && ui.modal.el === el) {
      const scroll = el.querySelector('.panel') ? el.querySelector('.panel').scrollTop : 0;
      el.innerHTML = render();
      const x = document.createElement('button');
      x.className = 'modal-x';
      x.textContent = '✕';
      x.addEventListener('click', () => ui.closeModal(!fromMenu));
      el.querySelector('.panel').appendChild(x);
      el.querySelector('.panel').scrollTop = scroll;
    }
  };
  ui._lanRerender = rerender;
  fetchInfo().then(rerender);
  el.addEventListener('click', (e) => {
    const t = e.target;
    const copy = t.closest('[data-copy]');
    if (copy) {
      navigator.clipboard && navigator.clipboard.writeText(copy.dataset.copy).then(() => ui.toast('Address copied.', 'good'), () => {});
      return;
    }
    const a = t.closest('[data-a]');
    if (!a) return;
    G.audio.init();
    G.audio.play('ui');
    if (a.dataset.a === 'leave') {
      net.disconnect();
      rerender();
    } else if (a.dataset.a === 'host' || a.dataset.a === 'join') {
      const role = a.dataset.a === 'host' ? 'host' : 'guest';
      if (game.state === 'playing') {
        net.connect(role);
        rerender();
        return;
      }
      // from the main menu: load or create a character, then connect
      game.pendingNet = role;
      ui.closeModal(false);
      // the character comes from a slot: a filled one continues, an empty one starts a new soul
      if (Save.lastSlot()) ui.openSlots('lan');
      else ui.showCreation();
    }
  });
}
