// localStorage persistence: three character slots, each with its own rolling backup, plus the
// settings every slot shares. Saves are migrated on load (core/migrate.js), and the backup guards
// against a corrupted write. Legacy (the register of the lost) keeps its own key: core/legacy.js.
import { migrateCharacter } from './migrate.js';

export const SLOT_COUNT = 3;
// Slot 1 keeps the key the single save always used, so that save simply is slot 1.
const slotKey = (n) => (n === 1 ? 'unstable.save.v1' : `unstable.save.v1.slot${n}`);
const backupKey = (n) => slotKey(n) + '.bak';
const BACKUP_EVERY_MS = 60 * 1000;
const lastBackup = {};
const SETTINGS_KEY = 'unstable.settings.v1';

function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (_) {
    return false;
  }
}
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const alive = (s) => isObj(s) && isObj(s.character) && !s.character.wiped;
const validSlot = (n) => Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT;
// The save a slot holds: its main copy, or the backup when the main one is missing or unreadable.
// A wiped character stays wiped; its backup is not brought back.
function pick(n) {
  const main = safeGet(slotKey(n));
  if (alive(main) || (isObj(main) && isObj(main.character) && main.character.wiped)) return main;
  const bak = safeGet(backupKey(n));
  return alive(bak) ? bak : null;
}

// Settings: [default, min, max] for numbers, [default, allowed values] for choices, [default]
// for switches. A stored value of the wrong type or out of range falls back to its default.
const SETTING_RULES = {
  sensitivity: [1.0, 0.2, 3],
  invertY: [false],
  fov: [70, 55, 100],
  master: [0.8, 0, 1],
  sfx: [0.9, 0, 1],
  music: [0.45, 0, 1],
  shadows: [true],
  quality: ['high', ['high', 'medium', 'low']],
  damageNumbers: [true],
  viewDistance: [1.0, 0.5, 1.5],
  cameraShake: [1.0, 0, 1.5],
  bounceLight: [false], // P6, the world-life session's: off until the user judges it
  tips: [true], // first-time tips (game/tips.js)
  uiScale: [1.0, 0.85, 1.3], // the interface's size: menus, HUD and text
  reduceFlashing: [false], // dims screen flashes and lowers camera shake
  soundCues: [false], // captions for warning sounds, with their direction
};

export const Save = {
  slot: 1, // the slot being played: saves and clears without a slot number go here

  use(n) {
    if (validSlot(n)) this.slot = n;
    return this.slot;
  },
  hasCharacter(n = this.slot) {
    return validSlot(n) && alive(pick(n));
  },
  load(n = this.slot) {
    if (!validSlot(n)) return null;
    const data = pick(n);
    if (!data) return null;
    try {
      migrateCharacter(data.character);
    } catch (e) {
      console.error('[save] migration failed', e);
    }
    return data;
  },
  save(data, n = this.slot) {
    if (!validSlot(n)) return false;
    data.savedAt = Date.now();
    data.slot = n;
    // keep the previous good save as a backup (at most once a minute)
    if (Date.now() - (lastBackup[n] || 0) > BACKUP_EVERY_MS) {
      try {
        const prev = localStorage.getItem(slotKey(n));
        if (prev && alive(JSON.parse(prev))) {
          localStorage.setItem(backupKey(n), prev);
          lastBackup[n] = Date.now();
        }
      } catch (_) {
        /* ignore */
      }
    }
    return safeSet(slotKey(n), data);
  },
  clearCharacter(n = this.slot) {
    // Permadeath and starting a new character in a slot remove that slot's backup too.
    if (!validSlot(n)) return;
    try {
      localStorage.removeItem(slotKey(n));
      localStorage.removeItem(backupKey(n));
    } catch (_) {
      /* ignore */
    }
    lastBackup[n] = 0;
  },
  // What the slot list shows, read without migrating or writing anything.
  summary(n) {
    const data = validSlot(n) ? pick(n) : null;
    if (!alive(data)) return null;
    const ch = data.character;
    const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
    return {
      slot: n,
      name: typeof ch.name === 'string' && ch.name ? ch.name : 'Unnamed',
      race: typeof ch.race === 'string' ? ch.race : '',
      level: num(ch.level, 1),
      place: typeof ch.place === 'string' ? ch.place : ch.inRift ? 'The Rift' : '',
      playtime: num(isObj(ch.stats) ? ch.stats.playtime : 0),
      lives: num(ch.lives, 3),
      maxLives: num(ch.maxLives, 3),
      savedAt: num(data.savedAt),
      dangerQuit: !!ch.dangerQuit,
    };
  },
  slots() {
    const out = [];
    for (let n = 1; n <= SLOT_COUNT; n++) out.push(this.summary(n));
    return out;
  },
  // Continue goes to the slot played last: the living character saved most recently.
  lastSlot() {
    let best = null;
    for (const s of this.slots()) if (s && (!best || s.savedAt > best.savedAt)) best = s;
    return best ? best.slot : null;
  },
  firstEmptySlot() {
    for (let n = 1; n <= SLOT_COUNT; n++) if (!this.hasCharacter(n)) return n;
    return null;
  },

  defaultSettings() {
    const out = {};
    for (const k in SETTING_RULES) out[k] = SETTING_RULES[k][0];
    return out;
  },
  sanitizeSettings(raw) {
    const s = this.defaultSettings();
    if (!isObj(raw)) return s;
    for (const k in SETTING_RULES) {
      const [def, a, b] = SETTING_RULES[k];
      const v = raw[k];
      if (typeof def === 'number') {
        if (typeof v === 'number' && Number.isFinite(v)) s[k] = Math.min(b, Math.max(a, v));
      } else if (typeof def === 'boolean') {
        if (typeof v === 'boolean') s[k] = v;
      } else if (Array.isArray(a) && a.includes(v)) s[k] = v;
    }
    return s;
  },
  loadSettings() {
    return this.sanitizeSettings(safeGet(SETTINGS_KEY));
  },
  saveSettings(s) {
    return safeSet(SETTINGS_KEY, s);
  },
};
