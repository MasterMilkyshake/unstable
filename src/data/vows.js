// Vows: a permanent oath sworn at the Vowkeeper's Perch (Power 5+).

export const VOWS = {
  hollow: {
    name: 'Vow of the Hollow', color: '#e8e8e8', reqs: { level: 5 },
    lore: 'Swear to nothing. The Hollow give up the power of an oath in exchange for the freedom of having none.',
    perks: ['+5% all damage, +15% ether regen', 'Gain 2 extra talent picks now', 'Mantra: Hollow Surge'],
    talents: ['vow_hollow_1'], mantras: ['hollow_surge'], bonusPicks: 2,
  },
  galeblade: {
    name: 'Vow of the Galeblade', color: '#a6ffd2', reqs: { level: 5, agility: 15 },
    lore: 'The Galeblades never touch the ground for long. Their oath is to the open sky.',
    perks: ['Double jump and air dodge', 'Aerial attacks +25% damage', 'Any blow that lifts a foe opens the air chase', 'Mantra: Gale Rend (usable mid-air)'],
    talents: ['vow_galeblade_1'], mantras: ['gale_rend'],
  },
  silence: {
    name: 'Vow of Silence', color: '#ff5a5a', reqs: { level: 5, strength: 15 },
    lore: 'Silence the mantras. Silence the doubt. Let the body speak and nothing else.',
    perks: ['Cannot cast attunement mantras', '+18% physical damage, +8% speed', 'Mayhem stacks on hit', 'Mantra: Mayhem Rush'],
    talents: ['vow_silence_1'], mantras: ['mayhem_rush'],
  },
  seer: {
    name: 'Vow of the Seer', color: '#fff3a6', reqs: { level: 5, willpower: 15 },
    lore: 'Close your eyes and see. The Seers parry what others cannot perceive.',
    perks: ['Parry window +60ms', 'Parries heal 4% health', 'A missed parry is ready again twice as fast', 'Immune to blindness', 'Mantra: Mending Light'],
    talents: ['vow_seer_1'], mantras: ['mending_light'],
  },
  arc: {
    name: 'Vow of the Arc', color: '#7fc8ff', reqs: { level: 5, fortitude: 15 },
    lore: 'Become the wall the world breaks against. What is thrown at an Arcwarder returns twice as hard.',
    perks: ['Reflect parried projectiles for double damage', 'Blocking a projectile costs no posture', '+20 posture', 'Mantra: Arc Ward (auto-parry)'],
    talents: ['vow_arc_1'], mantras: ['arc_ward'],
  },
  dawn: {
    name: 'Vow of the Dawn', color: '#ffc85a', reqs: { level: 5, ember: 15 },
    lore: 'The Dawnwalkers swear to the sun that has not risen the same way since the sky cracked. While it shines, so do they.',
    perks: ['While the sun is up: +12% damage and +20% fire resistance', 'Burns you inflict last 25% longer', 'Mantra: Dawn Lance (an unblockable spear of sunlight)'],
    talents: ['vow_dawn_1'], mantras: ['dawn_lance'],
  },
  abyss: {
    name: 'Vow of the Abyss', color: '#7a5aff', reqs: { level: 5, willpower: 15 },
    lore: 'Look into the Rift long enough and it looks back. The Abysswalkers stopped looking away.',
    perks: ['In the Rift: +15% damage and sanity drains 50% slower', '+1% damage for every 10% of sanity you are missing', 'Mantra: Abyssal Step (vanish and strike from behind)'],
    talents: ['vow_abyss_1'], mantras: ['abyssal_step'],
  },
  contract: {
    name: 'Vow of the Contract', color: '#e04a4a', reqs: { level: 5, charisma: 15 },
    lore: 'Every life has a price. The Contractors simply agree to pay it - in someone else\'s coin.',
    perks: ['Each kill grants a Bounty stack: +4% damage and +10% silver (up to 5, 30s)', '+10% silver from all sources', 'Mantra: Death Mark (your target takes 20% more damage for 8s)'],
    talents: ['vow_contract_1'], mantras: ['death_mark'],
  },
  blades: {
    name: 'Vow of Blades', color: '#c9d0dc', reqs: { level: 5, anyOf: [{ light: 15 }, { medium: 15 }, { heavy: 15 }] },
    lore: 'There is no mantra, no oath, no god - only the edge and the arm behind it. The Bladesworn polish one and strengthen the other.',
    perks: ['Critical attacks deal 20% more damage and recharge 25% faster', '+15% posture damage', 'Mantra: Blade Dance (a whirling four-cut flurry)'],
    talents: ['vow_blades_1'], mantras: ['blade_dance'],
  },
};
