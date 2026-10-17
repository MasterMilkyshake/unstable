import { placeCatalog } from './worldPlacement.js';
// Factions of the Anchorage: institutions with guards, standing and long memories.
// Standing runs from -100 (hated) to +100 (exalted). Guards of a faction fight anyone it
// hates, anyone it has marked as wanted, and anyone at open war with it (story flags).

export const FACTIONS = {
  watch: {
    name: 'The Saltreach Watch', short: 'the Watch', color: '#6a8fc8', home: 'Saltreach',
    desc: 'The harbor guard of the Lantern City: drill yards, ferry patrols, a captain who still argues about unpaid wages. They keep the gates watched and the lamp lit.',
    fineBase: 30, officer: 'hale',
  },
  enclave: {
    name: 'The Enclave', short: 'the Enclave', color: '#b8303a', home: 'Fort Meridian',
    desc: 'Heirs of the crown fleet that fled the Fracture, returned after a century at sea to reclaim the Anchorage. A Grand Warden commands them, a Warden keeps the fleet at sea and a Vice Warden holds Fort Meridian: titles taken from the regulator Wardens of the old works, to say who means to keep them now. Their soldiers, the Peacekeepers, go wherever the returned wash up. Disciplined, well armed, certain of their right. They register the returned and call it peace.',
    fineBase: 60, officer: 'meridian_captain',
  },
  ministry: {
    name: 'The Ministry of Soundings', short: 'the Ministry', color: '#9aa0c8', home: 'The Hush',
    desc: 'The old Compact office that measured the shelf, now measuring the passage of the dead. Grey-robed clerks, sealed archives, a bell that answers from below. They know more than they say and say it very quietly.',
    fineBase: 45, officer: 'minister_quill',
  },
};

// Standing tiers, highest first.
export const TIERS = [
  { min: 80, name: 'Exalted', color: '#ffd27a' },
  { min: 40, name: 'Honored', color: '#9fe0a0' },
  { min: 10, name: 'Trusted', color: '#b8e0b0' },
  { min: -9, name: 'Neutral', color: '#d6c496' },
  { min: -49, name: 'Distrusted', color: '#e0a070' },
  { min: -100, name: 'Hated', color: '#e05050' },
];
export const HATED = -50;

export function tierOf(rep) {
  return TIERS.find((t) => rep >= t.min) || TIERS[TIERS.length - 1];
}

// Places a faction guards closely: below `minRep` you are told to leave, then marked wanted.
export const RESTRICTED = [
  { faction: 'enclave', name: 'the Chain Citadel', x: 790, z: -626, r: 16, minRep: 10, papers: true },
  { faction: 'ministry', name: 'the Quiet Archive', x: -975, z: 395, r: 22, minRep: 10, guestFlag: 'ministry_guest' },
];

// What standing brings (docs/agent/WORLD_LIFE_PLAN.md, task 9). Trusted opens the officer's own
// stores (the officers' dialogue, data/storyDialogue.js). Honored sends a faction outfit and
// trinket by courier, once, and the faction's checkpoints wave you through. Exalted sends a
// unique trinket and gives a title. Item ids are data/items.js OUTFITS and data/trinkets.js.
export const TIER_REWARDS = {
  watch: { honored: { outfit: 'watch_greatcoat', trinket: 'watch_lamp_badge' }, exalted: { trinket: 'first_lamp_signet', title: 'Friend of the Lamp' } },
  enclave: { honored: { outfit: 'enclave_blacks', trinket: 'enclave_chain_link' }, exalted: { trinket: 'crown_fleet_pin', title: 'Hand of the Registry' } },
  ministry: { honored: { outfit: 'ministry_greys', trinket: 'ministry_tuning_fork' }, exalted: { trinket: 'listening_stone', title: 'One Who Listens' } },
};

// Rivalries: a change of standing with one faction moves its rivals the other way by a share
// of it, shown on the same toast. The Enclave and the Ministry pull against each other; the
// Watch sits between, a quarter of the Enclave's change and a fifth the other way.
export const RIVALS = {
  enclave: { ministry: -1 / 3, watch: -1 / 4 },
  ministry: { enclave: -1 / 3 },
  watch: { enclave: -1 / 5 },
};

// Standing shifts for deeds against or for a faction.
export const REP = {
  hitGuard: -3, // per provocation (rate limited)
  killGuard: -15,
  defendGuard: 1, // kill a monster that was fighting a guard
};

placeCatalog(RESTRICTED);
