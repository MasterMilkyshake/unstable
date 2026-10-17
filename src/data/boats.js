// Boat types. seats: local [x, z] offsets on the deck (seat 0 is the helm).
// speed/boost in m/s, turn is a multiplier, accel the throttle response.

export const BOATS = {
  skiff: {
    name: 'Skiff', rent: 20, desc: 'A one-mast fishing skiff. Quick to turn, room for one friend.',
    seats: [[0, -1.4], [0, 0.6]], speed: 14, boost: 19, turn: 1.0, accel: 1.2, length: 5, hull: '#7a5434', sail: '#efe6d2',
  },
  sloop: {
    name: 'Sloop', rent: 60, desc: 'A twin-sailed coastal sloop. Faster on open water, seats four.',
    seats: [[0, -2.6], [-0.75, -0.6], [0.75, -0.6], [0, 1.4]], speed: 18, boost: 24, turn: 0.75, accel: 0.9, length: 8, hull: '#5a3e28', sail: '#e8dcc0', stripe: '#2a4a7a',
  },
  longship: {
    name: 'Longship', rent: 150, desc: 'A long, shield-hung war boat. Slow to answer the helm, fast once running. Seats seven.',
    seats: [[0, -4.4], [-0.8, -2.4], [0.8, -2.4], [-0.8, -0.4], [0.8, -0.4], [-0.8, 1.6], [0.8, 1.6]], speed: 21, boost: 27, turn: 0.55, accel: 0.7, length: 12,
    hull: '#4a3020', sail: '#d8c8a8', stripe: '#a8281c',
  },
  // Captained crossings (game/travel.js). Not rentable.
  ferry: {
    name: 'Ferry', desc: 'A broad-beamed passenger ferry.', captained: true,
    seats: [[0, -3.0], [-0.8, -1.0], [0.8, -1.0], [-0.8, 1.0], [0.8, 1.0], [0, 2.6]], speed: 22, boost: 22, turn: 0.8, accel: 0.8, length: 9,
    hull: '#3a4a5a', sail: '#efe6d2', stripe: '#d4b04a',
  },
};

// The Enclave's cutters, which run down a wanted sailor (game/worldLife.js). Not rentable.
BOATS.cutter = {
  name: 'Enclave Cutter', desc: 'A black-hulled sloop of the Enclave, quick on the wind.', captained: true,
  seats: [[0, -2.6], [-0.75, -0.6], [0.75, -0.6], [0, 1.4]], speed: 18.5, boost: 23, turn: 0.85, accel: 1.0, length: 8, hull: '#26262c', sail: '#3a3a40', stripe: '#8e1f24',
};

export const RENTABLE = ['skiff', 'sloop', 'longship'];
