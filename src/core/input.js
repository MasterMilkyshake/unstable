// Keyboard / mouse state with per-frame pressed/released edges and pointer lock.

export const BIND = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  dodge: ['KeyQ'],
  block: ['KeyF'],
  crit: ['KeyR'],
  interact: ['KeyE'],
  grip: ['KeyB'],
  slide: ['KeyC', 'ControlLeft'],
  menu: ['Tab'],
  backpack: ['Backquote'],
  map: ['KeyM'],
  journal: ['KeyJ'],
  resonance: ['KeyZ'],
  pause: ['Escape'],
};

// How a key reads on screen.
const NAMES = { Backquote: '`', Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', Escape: 'Esc', Tab: 'Tab', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
export function keyLabel(code) {
  if (NAMES[code]) return NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return code;
}
// An action's first key, or a mouse button ('mouse:LMB', 'mouse:LMB hold') as written.
export function bindLabel(action) {
  if (action.startsWith('mouse:')) return action.slice(6);
  if (action === 'hotbar') return '1–0';
  return BIND[action] ? keyLabel(BIND[action][0]) : action;
}

// Every control, as the help screen and README's table show it. `keys` are BIND actions,
// 'hotbar', or mouse buttons; {action} in the text names that action's key. A test holds the
// help screen, README and BIND to this table (tests/controls.test.js).
export const CONTROLS = [
  { keys: ['forward', 'left', 'back', 'right'], text: 'Move.' },
  { keys: ['sprint'], text: 'Hold while moving to sprint.' },
  { keys: ['jump'], text: 'Jump. Jump into a ledge to catch it; from the hang, {jump} leaps up ({forward}: onto it, {back} or {dodge}: let go). In the air against a wall, {jump} hops up it.' },
  { keys: ['slide'], text: 'Slide while sprinting. Jump out of a slide to keep its momentum.' },
  { keys: ['mouse:LMB'], text: 'Attack (chains into a combo).' },
  { keys: ['mouse:LMB hold'], text: 'Flourish: hold an attack at the top of its wind-up (up to 0.35 s), let go to strike. A held swing can still be feinted.' },
  { keys: ['slide', 'mouse:LMB'], text: 'Uppercut: attack during a slide to launch a light or medium foe (never a boss or a large creature).' },
  { keys: ['jump', 'mouse:LMB'], text: 'Air chase: within 0.6 s of a launch, jump to leap after the foe; attack in the air for two cuts and a closing slam.' },
  { keys: ['crit'], text: 'Critical attack. Each weapon class has its own, on a cooldown.' },
  { keys: ['mouse:RMB'], text: 'Feint: cancel your attack\'s wind-up.' },
  { keys: ['block'], text: 'Hold to block. Tap it just before a hit lands to parry. Block and parry cover 140° in front: blows from the side or behind land, and a blow on the guard\'s rim costs more posture.' },
  { keys: ['dodge'], text: 'Dodge with brief invulnerability. It can cancel a wind-up and puts out fire.' },
  { keys: ['dodge', 'block'], text: 'Roll-cancel: block early in a roll (first 60%) to end it and parry at once; the next roll waits 0.6 s longer.' },
  { keys: ['hotbar'], text: '{hotbar:1} raises or lowers your weapon (a new character wakes with its fists down); {hotbar:2}–{hotbar:0} cast a mantra or use an item.' },
  { keys: ['grip'], text: 'Grip (execute) a knocked enemy.' },
  { keys: ['interact'], text: 'Interact or talk.' },
  { keys: ['menu'], text: 'Character: attributes and investment, talents, mantras, the backpack, quests.' },
  { keys: ['backpack'], text: 'Backpack: everything you carry and the mantras you know, as tiles; drag supplies and mantras onto the hotbar.' },
  { keys: ['map'], text: 'Map.' },
  { keys: ['journal'], text: 'Journal: the story, standing, the Atlas, sources, investigations, the Guide.' },
  { keys: ['resonance'], text: 'Resonance ability (from Power 15, once attuned at the Vowkeeper).' },
  { keys: ['pause'], text: 'Pause, and release the mouse.' },
];
// Any text with {action}, {hotbar:n} or {mouse:LMB} placeholders, each named by its key and
// styled by `wrap`: the help screen, README and every tip name keys this way.
export const KEY_PLACEHOLDER = /\{(hotbar:(\d)|mouse:[A-Za-z ]+|[a-z]+)\}/g;
export function keyText(text, wrap = (k) => k) {
  return text.replace(KEY_PLACEHOLDER, (m, a, d) => (d != null ? wrap(d) : BIND[a] || a.startsWith('mouse:') ? wrap(bindLabel(a)) : m));
}
export function controlText(row, wrap = (k) => k) {
  return keyText(row.text, wrap);
}
export function controlKeys(row) {
  return row.keys.map(bindLabel);
}

export const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mDown = [false, false, false];
    this.mPressed = [false, false, false];
    this.mReleased = [false, false, false];
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.locked = false;
    this.onLockChange = null;
    this.onKey = null; // raw key hook for UI (receives event)

    const TEXT_TYPES = ['text', 'search', 'email', 'password', 'number', 'url', 'tel'];
    const isTyping = (e) => {
      const t = e.target;
      if (!t) return false;
      if (t.tagName === 'TEXTAREA' || t.isContentEditable) return true;
      return t.tagName === 'INPUT' && TEXT_TYPES.includes((t.type || 'text').toLowerCase());
    };

    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      // A focused-but-hidden button (e.g. the main menu's "Continue") must not be re-clicked by Enter/Space.
      const ae = document.activeElement;
      if ((e.code === 'Enter' || e.code === 'Space') && ae && ae.tagName === 'BUTTON' && ae.offsetParent === null) {
        e.preventDefault();
        ae.blur();
      }
      if (!e.repeat) {
        this.down.add(e.code);
        // keys handled by the UI (closing a panel, etc.) must not also reach the game this frame
        const handled = this.onKey ? this.onKey(e) : false;
        if (!handled) this.pressed.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button > 2) return;
      if (!this.locked) return;
      this.mDown[e.button] = true;
      this.mPressed[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button > 2) return;
      if (this.mDown[e.button]) this.mReleased[e.button] = true;
      this.mDown[e.button] = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX || 0;
      this.dy += e.movementY || 0;
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.locked) this.wheel += Math.sign(e.deltaY);
      },
      { passive: true }
    );
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.clear();
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  clear() {
    this.down.clear();
    this.mDown = [false, false, false];
    this.endFrame();
  }

  requestLock() {
    if (!this.locked && this.canvas.requestPointerLock) {
      const fallback = () => {
        try {
          const q = this.canvas.requestPointerLock();
          if (q && q.catch) q.catch(() => {});
        } catch (_) {
          /* ignore */
        }
      };
      try {
        const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
        if (p && p.catch) p.catch(fallback);
      } catch (_) {
        fallback();
      }
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(action) {
    const codes = BIND[action] || [action];
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }
  wasPressed(action) {
    const codes = BIND[action] || [action];
    for (const c of codes) if (this.pressed.has(c)) return true;
    return false;
  }
  wasReleased(action) {
    const codes = BIND[action] || [action];
    for (const c of codes) if (this.released.has(c)) return true;
    return false;
  }
  consume(action) {
    const codes = BIND[action] || [action];
    let hit = false;
    for (const c of codes) if (this.pressed.delete(c)) hit = true;
    return hit;
  }

  swallowEdges() {
    this.pressed.clear();
    this.released.clear();
    this.mPressed = [false, false, false];
    this.mReleased = [false, false, false];
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mPressed = [false, false, false];
    this.mReleased = [false, false, false];
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
  }
}
