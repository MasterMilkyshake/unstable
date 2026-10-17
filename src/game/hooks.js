// Extension points so self-contained gameplay systems (traits, trinkets, foraging,
// fishing, cooking, the arena...) can plug into the core without editing it.

// Functions (player) => modifier bag, summed into Player.recompute alongside talents/outfit/buffs.
export const MOD_PROVIDERS = [];

// Called once per simulated frame while playing: fn(game, dt).
export const UPDATE_HOOKS = [];

// Called when a character is created or loaded: fn(game, ch, isNew).
export const START_HOOKS = [];

// Called once at boot, after the world is built and before the warm-up compiles the scene:
// fn(game). Whatever a system adds to the scene here is compiled and uploaded behind the menu,
// not in the first frames of play.
export const BOOT_HOOKS = [];

// Called once per enemy death the local player should be credited for: fn(game, enemy).
export const KILL_HOOKS = [];

// Named actions systems expose to dialogue/data (e.g. ACTIONS.openJeweler(ui)).
export const ACTIONS = {};
export function act(name, ...args) {
  if (ACTIONS[name]) return ACTIONS[name](...args);
  console.warn('[action] missing', name);
}

export function collectMods(player) {
  const out = [];
  for (const f of MOD_PROVIDERS) {
    try {
      const m = f(player);
      if (m) out.push(m);
    } catch (e) {
      console.error('[mod provider]', e);
    }
  }
  return out;
}

export function runUpdateHooks(game, dt) {
  for (const f of UPDATE_HOOKS) {
    try {
      f(game, dt);
    } catch (e) {
      console.error('[update hook]', e);
    }
  }
}

export function runBootHooks(game) {
  for (const f of BOOT_HOOKS) {
    try {
      f(game);
    } catch (e) {
      console.error('[boot hook]', e);
    }
  }
}

export function runStartHooks(game, ch, isNew) {
  for (const f of START_HOOKS) {
    try {
      f(game, ch, isNew);
    } catch (e) {
      console.error('[start hook]', e);
    }
  }
}
