// Shared runtime context. Populated by Game at startup so modules can reach
// each other without circular imports.
export const G = {
  game: null,
  scene: null,
  camera: null,
  renderer: null,
  world: null,
  player: null,
  audio: null,
  vfx: null,
  ui: null,
  input: null,
  actors: [],
  projectiles: [],
  time: 0,
  dt: 0,
  timeScale: 1,
  settings: null,
};
