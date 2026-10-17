// Mantras: castable abilities. `behavior` selects the runtime implementation in
// combat/mantraRuntime.js, `p` holds its parameters.
// el: attunement key (scales with that attunement) or 'phys' / 'support' / 'move'. Every mantra costs
// ether only; attunement mantras once also drew charged mana, folded into their ether at half weight.

export const MANTRAS = {
  // ---------------- EMBERWEAVE ----------------
  ember_bolt: {
    name: 'Ember Bolt', el: 'ember', type: 'combat', reqs: { ember: 10 }, ether: 18, cd: 3, cast: 0.32, anim: 'castPush',
    behavior: 'projectile', p: { dmg: 16, posture: 8, speed: 36, radius: 0.55, size: 0.45, status: 'burn', life: 1.6 },
    desc: 'Hurl a bolt of living flame that sets its target alight.',
  },
  cinder_grasp: {
    name: 'Cinder Grasp', el: 'ember', type: 'combat', reqs: { ember: 20 }, ether: 32, cd: 9, cast: 0.2, anim: 'castGrab',
    behavior: 'grab', p: { dmg: 24, posture: 20, range: 9, speed: 24, status: 'burn', explode: 3.2 },
    desc: 'Dash forward and seize your foe in burning hands, then detonate.',
  },
  ash_pillar: {
    name: 'Pillar of Ash', el: 'ember', type: 'combat', reqs: { ember: 30 }, ether: 37, cd: 10, cast: 0.45, anim: 'castRaise',
    behavior: 'eruption', p: { dmg: 30, posture: 18, range: 24, delay: 0.6, radius: 3.2, launch: 9, status: 'burn' },
    desc: 'A column of flame erupts beneath your target after a brief delay.',
  },
  searing_nova: {
    name: 'Searing Nova', el: 'ember', type: 'combat', reqs: { ember: 40 }, ether: 49, cd: 14, cast: 0.5, anim: 'castSlam',
    behavior: 'nova', p: { dmg: 28, posture: 25, radius: 7.5, knockback: 13, status: 'burn' },
    desc: 'Release a ring of fire around you, hurling enemies away.',
  },
  flare_leap: {
    name: 'Flare Leap', el: 'ember', type: 'mobility', reqs: { ember: 15 }, ether: 15, cd: 6, cast: 0.1, anim: 'castSlam',
    behavior: 'leap', p: { up: 17, forward: 9, trail: true },
    desc: 'Explode off the ground in a burst of flame, launching skyward.',
  },

  // ---------------- RIMEBIND ----------------
  frost_shards: {
    name: 'Frost Shards', el: 'rime', type: 'combat', reqs: { rime: 10 }, ether: 18, cd: 3.5, cast: 0.3, anim: 'castPush',
    behavior: 'multiProjectile', p: { count: 3, spread: 14, dmg: 8, posture: 5, speed: 34, radius: 0.4, size: 0.3, status: 'chill', life: 1.2 },
    desc: 'Fire a fan of ice shards that chill whatever they strike.',
  },
  glacial_grip: {
    name: 'Glacial Grip', el: 'rime', type: 'combat', reqs: { rime: 20 }, ether: 32, cd: 10, cast: 0.2, anim: 'castGrab',
    behavior: 'grab', p: { dmg: 18, posture: 15, range: 8, speed: 22, status: 'freeze' },
    desc: 'Lunge forward and encase your target in ice.',
  },
  frost_spikes: {
    name: 'Frost Spikes', el: 'rime', type: 'combat', reqs: { rime: 30 }, ether: 37, cd: 10, cast: 0.45, anim: 'castSlam',
    behavior: 'spikesLine', p: { dmg: 24, posture: 15, length: 17, count: 9, launch: 8, status: 'chill' },
    desc: 'Drive a line of jagged ice spikes forward through the earth.',
  },
  rime_wall: {
    name: 'Rime Wall', el: 'rime', type: 'support', reqs: { rime: 35 }, ether: 33, cd: 16, cast: 0.4, anim: 'castRaise',
    behavior: 'wall', p: { width: 7, height: 4, duration: 8, dist: 4 },
    desc: 'Raise a wall of ice that blocks movement and projectiles.',
  },
  ice_skate: {
    name: 'Ice Skate', el: 'rime', type: 'mobility', reqs: { rime: 15 }, ether: 15, cd: 6, cast: 0.05, anim: 'castPush',
    behavior: 'dash', p: { distance: 15, duration: 0.45, dmg: 6, status: 'chill', trail: 'rime' },
    desc: 'Glide forward on a path of fresh ice, chilling anyone you pass.',
  },

  // ---------------- STORMCALL ----------------
  volt_spear: {
    name: 'Volt Spear', el: 'storm', type: 'combat', reqs: { storm: 10 }, ether: 20, cd: 4, cast: 0.35, anim: 'castPush',
    behavior: 'beam', p: { dmg: 18, posture: 10, range: 30, status: 'shock', width: 0.8 },
    desc: 'Loose a spear of lightning that strikes instantly along a line.',
  },
  thunderclap: {
    name: 'Thunderclap', el: 'storm', type: 'combat', reqs: { storm: 20 }, ether: 29, cd: 9, cast: 0.3, anim: 'castClap',
    behavior: 'nova', p: { dmg: 20, posture: 20, radius: 5.5, knockback: 6, status: 'shock' },
    desc: 'Clap your hands together and release a stunning shockwave.',
  },
  skyfall: {
    name: 'Skyfall', el: 'storm', type: 'combat', reqs: { storm: 30 }, ether: 37, cd: 11, cast: 0.5, anim: 'castRaise',
    behavior: 'skyStrike', p: { dmg: 34, posture: 20, range: 26, delay: 0.75, radius: 3.6, status: 'shock' },
    desc: 'Call a bolt down from the heavens onto your target.',
  },
  arc_chain: {
    name: 'Arc Chain', el: 'storm', type: 'combat', reqs: { storm: 40 }, ether: 41, cd: 12, cast: 0.35, anim: 'castPush',
    behavior: 'chain', p: { dmg: 20, posture: 10, range: 20, jumps: 3, jumpRange: 10, status: 'shock' },
    desc: 'Lightning leaps from foe to foe.',
  },
  bolt_step: {
    name: 'Bolt Step', el: 'storm', type: 'mobility', reqs: { storm: 15 }, ether: 15, cd: 6, cast: 0.05, anim: 'castPush',
    behavior: 'blink', p: { distance: 13, dmg: 10, status: 'shock' },
    desc: 'Become lightning for an instant and reappear ahead, shocking anything in your path.',
  },

  // ---------------- GALESONG ----------------
  gale_palm: {
    name: 'Gale Palm', el: 'gale', type: 'combat', reqs: { gale: 10 }, ether: 17, cd: 3.5, cast: 0.3, anim: 'castPush',
    behavior: 'projectile', p: { dmg: 12, posture: 20, speed: 42, radius: 0.9, size: 0.7, knockback: 14, life: 0.9 },
    desc: 'A compressed blast of air that sends enemies flying.',
  },
  wind_carve: {
    name: 'Wind Carve', el: 'gale', type: 'combat', reqs: { gale: 20 }, ether: 25, cd: 6, cast: 0.3, anim: 'castSlash',
    behavior: 'projectile', p: { dmg: 18, posture: 8, speed: 38, radius: 1.0, size: 0.9, pierce: true, status: 'bleed', crescent: true, life: 1.0 },
    desc: 'Throw a crescent of cutting wind that passes through enemies.',
  },
  cyclone: {
    name: 'Cyclone', el: 'gale', type: 'combat', reqs: { gale: 30 }, ether: 37, cd: 12, cast: 0.45, anim: 'castRaise',
    behavior: 'vortex', p: { dmg: 6, ticks: 7, interval: 0.3, radius: 6.5, range: 18, pull: 9 },
    desc: 'Summon a vortex that drags enemies inward and shreds them.',
  },
  gale_leap: {
    name: 'Gale Leap', el: 'gale', type: 'mobility', reqs: { gale: 10 }, ether: 13, cd: 5, cast: 0.05, anim: 'castSlam',
    behavior: 'leap', p: { up: 21, forward: 5 },
    desc: 'Ride a column of wind high into the air.',
  },
  tempest_guard: {
    name: 'Tempest Guard', el: 'gale', type: 'support', reqs: { gale: 35 }, ether: 32, cd: 18, cast: 0.3, anim: 'castRaise',
    behavior: 'ward', p: { duration: 4.5, knockback: 9, radius: 3.2 },
    desc: 'Wrap yourself in winds that deflect projectiles and repel attackers.',
  },

  // ---------------- UMBRACAST ----------------
  umbral_orb: {
    name: 'Umbral Orb', el: 'umbra', type: 'combat', reqs: { umbra: 10 }, ether: 20, cd: 4, cast: 0.35, anim: 'castPush',
    behavior: 'projectile', p: { dmg: 18, posture: 8, speed: 19, radius: 0.6, size: 0.55, homing: 3, status: 'blind', life: 3 },
    desc: 'A slow, seeking orb of shadow that blinds on contact.',
  },
  shade_step: {
    name: 'Shade Step', el: 'umbra', type: 'mobility', reqs: { umbra: 20 }, ether: 22, cd: 8, cast: 0.1, anim: 'castPush',
    behavior: 'teleportBehind', p: { range: 18, buff: 0.3 },
    desc: 'Melt into shadow and step out behind your target. Your next hit is empowered.',
  },
  void_eruption: {
    name: 'Void Eruption', el: 'umbra', type: 'combat', reqs: { umbra: 30 }, ether: 37, cd: 11, cast: 0.5, anim: 'castRaise',
    behavior: 'eruption', p: { dmg: 34, posture: 20, range: 22, delay: 0.85, radius: 4.5, launch: 4, status: 'blind' },
    desc: 'Tear open the ground beneath your foe; the void bursts upward.',
  },
  night_veil: {
    name: 'Night Veil', el: 'umbra', type: 'support', reqs: { umbra: 35 }, ether: 32, cd: 22, cast: 0.3, anim: 'castRaise',
    behavior: 'stealth', p: { duration: 6, bonus: 0.5 },
    desc: 'Become nearly invisible. Your first strike from the veil deals +50% damage.',
  },

  // ---------------- PHYSICAL ARTS ----------------
  shoulder_bash: {
    name: 'Shoulder Bash', el: 'phys', type: 'combat', reqs: { strength: 15 }, ether: 14, cd: 8, cast: 0.15, anim: 'bash',
    behavior: 'bash', p: { distance: 8, dmg: 10, posture: 40, knockback: 9 },
    desc: 'Charge forward and slam into an enemy, battering their guard.',
  },
  heel_drop: {
    name: 'Heel Drop', el: 'phys', type: 'combat', reqs: { agility: 20, strength: 10 }, ether: 16, cd: 9, cast: 0.4, anim: 'heelDrop',
    behavior: 'melee', p: { wMul: 1.4, posture: 45, range: 3, arc: 80, unparryable: true, launchDown: true },
    desc: 'A leaping axe kick that cannot be parried.',
  },
  rending_flurry: {
    name: 'Rending Flurry', el: 'phys', type: 'combat', reqs: { light: 25 }, ether: 18, cd: 10, cast: 0.15, anim: 'flurry',
    behavior: 'flurry', p: { hits: 5, wMul: 0.55, posture: 6, range: 3, status: 'bleed', duration: 0.7 },
    desc: 'Unleash a blur of cuts that leave the target bleeding.',
  },
  piercing_lunge: {
    name: 'Piercing Lunge', el: 'phys', type: 'combat', reqs: { medium: 25 }, ether: 18, cd: 10, cast: 0.38, anim: 'lunge',
    behavior: 'lunge', p: { distance: 11, wMul: 1.8, posture: 25, unblockable: true },
    desc: 'Close the gap with a thrust that pierces through guards.',
  },
  whirling_blade: {
    name: 'Whirling Blade', el: 'phys', type: 'combat', reqs: { medium: 35 }, ether: 20, cd: 11, cast: 0.2, anim: 'whirlwind',
    behavior: 'spin', p: { hits: 3, wMul: 0.8, posture: 12, radius: 4.2, duration: 0.8 },
    desc: 'Spin with your blade extended, striking everything around you.',
  },
  earthsplitter: {
    name: 'Earthsplitter', el: 'phys', type: 'combat', reqs: { heavy: 25 }, ether: 20, cd: 12, cast: 0.55, anim: 'heavySlam',
    behavior: 'slam', p: { wMul: 1.6, posture: 40, radius: 5.5, launch: 7 },
    desc: 'Bring your weapon down hard enough to split the earth around you.',
  },
  strong_leap: {
    name: 'Strong Leap', el: 'phys', type: 'mobility', reqs: { strength: 20 }, ether: 10, cd: 7, cast: 0.15, anim: 'castSlam',
    behavior: 'leap', p: { up: 18, forward: 7 },
    desc: 'Crouch and spring into the air with raw strength.',
  },
  swift_dash: {
    name: 'Swift Dash', el: 'phys', type: 'mobility', reqs: { agility: 25 }, ether: 10, cd: 6, cast: 0.02, anim: 'castPush',
    behavior: 'dash', p: { distance: 14, duration: 0.35 },
    desc: 'A burst of speed that carries you far.',
  },

  // ---------------- SUPPORT ----------------
  rally: {
    name: 'Rally', el: 'support', type: 'support', reqs: { charisma: 20 }, ether: 22, cd: 25, cast: 0.6, anim: 'castRaise',
    behavior: 'heal', p: { pct: 0.2, cleanse: true, color: '#ffd27a' },
    desc: 'Steel yourself, healing 20% health and shaking off bleeds and burns.',
  },
  war_cry: {
    name: 'War Cry', el: 'support', type: 'support', reqs: { charisma: 30 }, ether: 22, cd: 24, cast: 0.5, anim: 'castRaise',
    behavior: 'warcry', p: { radius: 9, posture: 25, duration: 8, mods: { physDmg: 0.15 } },
    desc: 'A roar that staggers nearby foes and emboldens you (+15% damage).',
  },
  inner_calm: {
    name: 'Inner Calm', el: 'support', type: 'support', reqs: { willpower: 25 }, ether: 20, cd: 30, cast: 0.8, anim: 'castRaise',
    behavior: 'heal', p: { pct: 0.12, sanity: 35, hot: 0.15, color: '#b98cff' },
    desc: 'Center your mind: restore sanity and slowly heal.',
  },

  // ---------------- EXPANDED ARTS ----------------
  fire_blade: {
    name: 'Fire Blade', el: 'ember', type: 'combat', reqs: { ember: 25 }, ether: 26, cd: 7, cast: 0.3, anim: 'castSlash',
    behavior: 'projectile', p: { dmg: 20, posture: 10, speed: 34, radius: 1.0, size: 0.9, pierce: true, crescent: true, status: 'burn', life: 0.9 },
    desc: 'Swing a crescent of flame that cuts through every foe in its path.',
  },
  flame_repulsion: {
    name: 'Flame Repulsion', el: 'ember', type: 'combat', reqs: { ember: 20 }, ether: 25, cd: 8, cast: 0.25, anim: 'castClap',
    behavior: 'nova', p: { dmg: 14, posture: 30, radius: 4.5, knockback: 18, status: 'burn' },
    desc: 'A sudden burst of heat that throws attackers off you.',
  },
  relentless_flames: {
    name: 'Relentless Flames', el: 'ember', type: 'combat', reqs: { ember: 35 }, ether: 33, cd: 9, cast: 0.35, anim: 'castPush',
    behavior: 'multiProjectile', p: { count: 5, spread: 9, dmg: 8, posture: 5, speed: 32, radius: 0.45, size: 0.35, status: 'burn', life: 1.3 },
    desc: 'Fan out five embers that set everything they touch alight.',
  },
  ice_lance: {
    name: 'Ice Lance', el: 'rime', type: 'combat', reqs: { rime: 25 }, ether: 24, cd: 6, cast: 0.35, anim: 'castThrow',
    behavior: 'projectile', p: { dmg: 22, posture: 18, speed: 44, radius: 0.45, size: 0.35, rod: true, status: 'chill', life: 1.2 },
    desc: 'Hurl a spear of ice that pierces armor and slows its target.',
  },
  ice_eruption: {
    name: 'Ice Eruption', el: 'rime', type: 'combat', reqs: { rime: 40 }, ether: 41, cd: 13, cast: 0.45, anim: 'castRaise',
    behavior: 'eruption', p: { dmg: 28, posture: 22, range: 22, delay: 0.5, radius: 4, launch: 10, status: 'freeze' },
    desc: 'A glacier bursts from the ground beneath your foe, freezing it solid.',
  },
  blizzard: {
    name: 'Blizzard', el: 'rime', type: 'combat', reqs: { rime: 45 }, ether: 44, cd: 16, cast: 0.5, anim: 'castRaise',
    behavior: 'vortex', p: { dmg: 5, ticks: 9, interval: 0.3, radius: 6, range: 20, pull: 4, status: 'chill' },
    desc: 'Call down a howling storm of ice that slowly freezes all within.',
  },
  jolt_grab: {
    name: 'Jolt Grab', el: 'storm', type: 'combat', reqs: { storm: 25 }, ether: 29, cd: 9, cast: 0.15, anim: 'castGrab',
    behavior: 'grab', p: { dmg: 20, posture: 18, range: 10, speed: 28, status: 'shock', explode: 3 },
    desc: 'Flash forward, seize your foe, and release a thunderous discharge.',
  },
  lightning_beam: {
    name: 'Lightning Beam', el: 'storm', type: 'combat', reqs: { storm: 35 }, ether: 33, cd: 8, cast: 0.45, anim: 'castPush',
    behavior: 'beam', p: { dmg: 26, posture: 12, range: 40, status: 'shock', width: 1.2 },
    desc: 'A sustained lance of lightning that reaches across the battlefield.',
  },
  thunderhead: {
    name: 'Thunderhead', el: 'storm', type: 'combat', reqs: { storm: 45 }, ether: 44, cd: 16, cast: 0.5, anim: 'castRaise',
    behavior: 'vortex', p: { dmg: 7, ticks: 10, interval: 0.4, radius: 5.5, range: 22, pull: 0, status: 'shock' },
    desc: 'Summon a storm cloud that hammers the area with lightning.',
  },
  pressure_blast: {
    name: 'Pressure Blast', el: 'gale', type: 'combat', reqs: { gale: 25 }, ether: 29, cd: 10, cast: 0.3, anim: 'castClap',
    behavior: 'nova', p: { dmg: 16, posture: 25, radius: 6, knockback: 22 },
    desc: 'Compress the air around you and let it explode outward.',
  },
  gale_lunge: {
    name: 'Gale Lunge', el: 'gale', type: 'combat', reqs: { gale: 20 }, ether: 25, cd: 8, cast: 0.12, anim: 'castGrab',
    behavior: 'grab', p: { dmg: 16, posture: 22, range: 12, speed: 30, knockback: 16 },
    desc: 'Ride the wind into your foe and blast them away.',
  },
  air_blades: {
    name: 'Air Blades', el: 'gale', type: 'combat', reqs: { gale: 40 }, ether: 33, cd: 9, cast: 0.3, anim: 'castSlash',
    behavior: 'multiProjectile', p: { count: 3, spread: 18, dmg: 11, posture: 12, speed: 40, radius: 0.7, size: 0.6, status: 'bleed', life: 1.0 },
    desc: 'Three spinning blades of wind that leave shallow, bleeding cuts.',
  },
  shadow_gun: {
    name: 'Shadow Gun', el: 'umbra', type: 'combat', reqs: { umbra: 25 }, ether: 24, cd: 5, cast: 0.25, anim: 'castPush',
    behavior: 'projectile', p: { dmg: 22, posture: 8, speed: 52, radius: 0.5, size: 0.4, life: 1.2 },
    desc: 'Fire a fast, silent bolt of condensed shadow.',
  },
  darkfire_chain: {
    name: 'Darkfire Chain', el: 'umbra', type: 'combat', reqs: { umbra: 35 }, ether: 36, cd: 12, cast: 0.35, anim: 'castPush',
    behavior: 'chain', p: { dmg: 18, posture: 8, range: 20, jumps: 2, jumpRange: 11, status: 'blind' },
    desc: 'Black flame leaps between enemies, blinding each.',
  },
  shadow_seed: {
    name: 'Shadow Seed', el: 'umbra', type: 'combat', reqs: { umbra: 45 }, ether: 47, cd: 16, cast: 0.5, anim: 'castRaise',
    behavior: 'eruption', p: { dmg: 44, posture: 26, range: 24, delay: 1.4, radius: 5.5, launch: 6, status: 'blind' },
    desc: 'Plant a seed of void that blooms into a devastating eruption.',
  },
  rushing_strike: {
    name: 'Rushing Strike', el: 'phys', type: 'combat', reqs: { strength: 25, agility: 10 }, ether: 16, cd: 9, cast: 0.3, anim: 'lunge',
    behavior: 'lunge', p: { distance: 14, wMul: 1.5, posture: 30 },
    desc: 'Charge across the field and drive your weapon home.',
  },
  reapers_spin: {
    name: "Reaper's Spin", el: 'phys', type: 'combat', reqs: { heavy: 35 }, ether: 22, cd: 12, cast: 0.25, anim: 'whirlwind',
    behavior: 'spin', p: { hits: 5, wMul: 0.6, posture: 10, radius: 4.6, duration: 1.0 },
    desc: 'A long, sweeping spin that cuts down everything around you.',
  },
  soaring_leap: {
    name: 'Soaring Leap', el: 'phys', type: 'mobility', reqs: { agility: 35, strength: 15 }, ether: 12, cd: 8, cast: 0.15, anim: 'castSlam',
    behavior: 'leap', p: { up: 24, forward: 11 },
    desc: 'A tremendous jump that clears rooftops and cliffs.',
  },
  bulwark_stance: {
    name: 'Bulwark Stance', el: 'support', type: 'support', reqs: { fortitude: 30 }, ether: 18, cd: 22, cast: 0.3, anim: 'castRaise',
    behavior: 'buff', p: { duration: 6, mods: { physResist: 0.3, maxPosture: 40 }, color: '#d9a441' },
    desc: 'Plant your feet: +30% physical resistance and +40 posture for 6s.',
  },
  meditative_breath: {
    name: 'Meditative Breath', el: 'support', type: 'support', reqs: { willpower: 35 }, ether: 16, cd: 28, cast: 0.7, anim: 'castRaise',
    behavior: 'heal', p: { pct: 0.15, sanity: 15, hot: 0.1, cleanse: true, color: '#c8b8ff' },
    desc: 'A slow, deliberate breath. Heals, steadies the mind and clears ailments.',
  },
  battle_hymn: {
    name: 'Battle Hymn', el: 'support', type: 'support', reqs: { charisma: 45 }, ether: 24, cd: 28, cast: 0.5, anim: 'castRaise',
    behavior: 'warcry', p: { radius: 12, posture: 15, duration: 10, mods: { physDmg: 0.1, mantraDmg: 0.1, speed: 0.06 } },
    desc: 'Sing a war-song: staggers nearby foes; +10% damage and +6% speed for 10s.',
  },

  // ---------------- BELLS (granted by great foes; game/bells.js) ----------------
  bell_cinder: {
    name: 'Bell of the Cinder Heart', el: 'ember', type: 'combat', reqs: { vow: 'bell' }, vow: 'bell', bell: 'cinder_colossus', ether: 38, cd: 32, cast: 0.6, anim: 'castRaise',
    behavior: 'meteorShower', p: { count: 7, interval: 0.22, spread: 7, range: 30, delay: 0.7, radius: 3, dmg: 30, posture: 22, launch: 7, status: 'burn' },
    desc: 'Bell. The Colossus\'s heart still beats in you. Call down a shower of molten stone around your foe.',
  },
  bell_rime: {
    name: 'Bell of the White Hollow', el: 'rime', type: 'combat', reqs: { vow: 'bell' }, vow: 'bell', bell: 'frost_warden', ether: 36, cd: 30, cast: 0.5, anim: 'castSlam',
    behavior: 'glacierRings', p: { rings: [3, 6, 9], dmg: 30, posture: 26, launch: 6, status: 'freeze' },
    desc: 'Bell. The Warden\'s vigil, made yours. Rings of ice burst outward and freeze everything they catch.',
  },
  bell_king: {
    name: 'Bell of the Old King', el: 'phys', type: 'combat', reqs: { vow: 'bell' }, vow: 'bell', bell: 'primadon', ether: 34, cd: 26, cast: 0.55, anim: 'heavySlam',
    behavior: 'quake', p: { waves: 3, interval: 0.3, radius: 9, dmg: 26, posture: 40, launch: 8, knockback: 10 },
    desc: 'Bell. Strike the earth like the Primadon. Three shockwaves roll out, hurling foes into the air.',
  },
  bell_lantern: {
    name: 'Bell of the Lost Lanterns', el: 'umbra', type: 'combat', reqs: { vow: 'bell' }, vow: 'bell', bell: 'lanternless', ether: 40, cd: 34, cast: 0.5, anim: 'castRaise',
    behavior: 'lanternSwarm', p: { count: 8, range: 30, speed: 18, homing: 3.5, dmg: 18, posture: 10, status: 'blind', color: '#ff5a7a' },
    desc: 'Bell. The lanterns the Ferryman carried follow you now. Release them, and they hunt.',
  },
  bell_reed: {
    name: 'Bell of Witchwater', el: 'blood', type: 'combat', reqs: { vow: 'bell' }, vow: 'bell', bell: 'witch_queen', ether: 32, cd: 28, cast: 0.5, anim: 'castSlam',
    behavior: 'thornField', p: { range: 24, radius: 5, ticks: 7, interval: 0.3, dmg: 9, posture: 6, status: 'bleed', color: '#4a6a2a' },
    desc: 'Bell. Mother Reed\'s brambles answer you. Thorns erupt again and again where you point.',
  },
  bell_tide: {
    name: 'Bell of the Drowned Crown', el: 'umbra', type: 'combat', reqs: { vow: 'bell' }, vow: 'bell', bell: 'hollow_duke', ether: 40, cd: 36, cast: 0.6, anim: 'castPush',
    behavior: 'tidalWave', p: { width: 7, speed: 20, life: 1.2, dmg: 32, posture: 30, knockback: 16, status: 'blind' },
    desc: 'Bell. The sea beneath the sea rises at your command - a wall of black water that carries all before it.',
  },
  bell_toll: {
    name: 'Bell of Hightoll', el: 'phys', type: 'combat', reqs: { vow: 'bell' }, vow: 'bell', bell: 'castellan', ether: 34, cd: 28, cast: 0.55, anim: 'heavySlam',
    behavior: 'knell', p: { rings: [3.5, 6.5, 9.5], interval: 0.32, dmg: 22, posture: 44, knockback: 9, color: '#ffd98a' },
    desc: 'Bell. The castellan\'s toll, rung through you. Three rings of sound roll out from where you strike, breaking guards as they pass.',
  },
  bell_red: {
    name: 'Bell of the Red Warlord', el: 'support', type: 'support', reqs: { vow: 'bell' }, vow: 'bell', bell: 'warlord', ether: 30, cd: 40, cast: 0.6, anim: 'castRaise',
    behavior: 'buff', p: { duration: 12, mods: { physDmg: 0.22, speed: 0.1, lifesteal: 0.04 }, color: '#e0243f' },
    desc: 'Bell. Kaelen\'s fury in your blood: +22% damage, +10% speed and 4% lifesteal for 12s.',
  },

  // ---------------- RESONANCES (active abilities on [Z]; game/resonance.js) ----------------
  res_ardour: {
    name: 'Ardour', el: 'ember', type: 'mobility', reqs: { vow: 'resonance' }, vow: 'resonance', ether: 0, cd: 14, cast: 0.08, anim: 'castPush',
    behavior: 'dash', p: { distance: 16, duration: 0.4, dmg: 22, posture: 30, status: 'burn', trail: 'ember' },
    desc: 'Resonance. Become a streak of fire and charge through everything in your way.',
  },
  res_tacet: {
    name: 'Tacet', el: 'phys', type: 'support', reqs: { vow: 'resonance' }, vow: 'resonance', ether: 0, cd: 22, cast: 0.15, anim: 'castRaise',
    behavior: 'stealth', p: { duration: 4, bonus: 0.6 },
    desc: 'Resonance. Fall silent and vanish. Your first strike from the silence deals 60% more.',
  },
  res_rhythm: {
    name: 'Rhythm', el: 'support', type: 'support', reqs: { vow: 'resonance' }, vow: 'resonance', ether: 0, cd: 20, cast: 0.1, anim: 'castRaise',
    behavior: 'buff', p: { duration: 4, mods: { parryWindow: 0.12, blockPosture: 0.5 }, color: '#ffe9a3' },
    desc: 'Resonance. For 4 seconds every parry window is wide open and blocking barely dents your posture.',
  },
  res_sanguine: {
    name: 'Sanguine', el: 'blood', type: 'support', reqs: { vow: 'resonance' }, vow: 'resonance', ether: 0, hpCost: 0.12, cd: 25, cast: 0.2, anim: 'castClap',
    behavior: 'resSanguine', p: { ether: 70 },
    desc: 'Resonance. Spill your own blood to restore 70 ether and ready your critical attack at once.',
  },
  res_updraft: {
    name: 'Updraft', el: 'gale', type: 'mobility', reqs: { vow: 'resonance' }, vow: 'resonance', ether: 0, cd: 12, cast: 0.05, anim: 'castSlam',
    behavior: 'leap', p: { up: 26, forward: 8 },
    desc: 'Resonance. A column of wind hurls you skyward - higher than any mantra can.',
  },

  // ---------------- VOW MANTRAS ----------------
  gale_rend: {
    name: 'Gale Rend', el: 'phys', type: 'combat', reqs: { vow: 'galeblade' }, ether: 16, cd: 7, cast: 0.15, anim: 'iaido', vow: 'galeblade',
    behavior: 'airDash', p: { distance: 14, wMul: 1.6, posture: 20 },
    desc: 'Vow of the Galeblade. Dash through the air and cut through everything in your path. Usable mid-air.',
  },
  mayhem_rush: {
    name: 'Mayhem Rush', el: 'phys', type: 'combat', reqs: { vow: 'silence' }, ether: 18, cd: 9, cast: 0.1, anim: 'flurry', vow: 'silence',
    behavior: 'rush', p: { distance: 10, hits: 3, wMul: 0.8, posture: 12 },
    desc: 'Vow of Silence. Blitz forward and strike three times in an instant.',
  },
  mending_light: {
    name: 'Mending Light', el: 'support', type: 'support', reqs: { vow: 'seer' }, ether: 24, cd: 22, cast: 0.5, anim: 'castRaise', vow: 'seer',
    behavior: 'heal', p: { pct: 0.3, cleanse: true, color: '#fff3a6', sanity: 20 },
    desc: 'Vow of the Seer. A radiant light restores 30% health and cleanses ailments.',
  },
  arc_ward: {
    name: 'Arc Ward', el: 'support', type: 'support', reqs: { vow: 'arc' }, ether: 20, cd: 14, cast: 0.1, anim: 'castRaise', vow: 'arc',
    behavior: 'arcWard', p: { duration: 1.2 },
    desc: 'Vow of the Arc. For a moment, automatically parry every attack and reflect projectiles.',
  },
  dawn_lance: {
    name: 'Dawn Lance', el: 'ember', type: 'combat', reqs: { vow: 'dawn' }, ether: 26, cd: 8, cast: 0.4, anim: 'castThrow', vow: 'dawn',
    behavior: 'beam', p: { dmg: 30, posture: 18, range: 36, width: 1.0, status: 'burn', unblockable: true },
    desc: 'Vow of the Dawn. A spear of sunlight that cannot be blocked.',
  },
  abyssal_step: {
    name: 'Abyssal Step', el: 'phys', type: 'mobility', reqs: { vow: 'abyss' }, ether: 16, cd: 8, cast: 0.08, anim: 'castPush', vow: 'abyss',
    behavior: 'teleportBehind', p: { range: 22, buff: 0.5 },
    desc: 'Vow of the Abyss. Fold through the dark and reappear behind your foe. Your next hit deals 50% more.',
  },
  death_mark: {
    name: 'Death Mark', el: 'phys', type: 'support', reqs: { vow: 'contract' }, ether: 14, cd: 14, cast: 0.2, anim: 'castPush', vow: 'contract',
    behavior: 'mark', p: { range: 26, amp: 0.2, duration: 8, color: '#ff3a3a' },
    desc: 'Vow of the Contract. Mark a target: it takes 20% more damage from everything for 8s.',
  },
  blade_dance: {
    name: 'Blade Dance', el: 'phys', type: 'combat', reqs: { vow: 'blades' }, ether: 18, cd: 9, cast: 0.15, anim: 'whirlwind', vow: 'blades',
    behavior: 'spin', p: { hits: 4, wMul: 0.8, posture: 14, radius: 4.2, duration: 0.7 },
    desc: 'Vow of Blades. Whirl your weapon in a four-cut flurry around you.',
  },
  hollow_surge: {
    name: 'Hollow Surge', el: 'phys', type: 'combat', reqs: { vow: 'hollow' }, ether: 20, cd: 10, cast: 0.3, anim: 'castSlam', vow: 'hollow',
    behavior: 'nova', p: { dmg: 22, posture: 30, radius: 5, knockback: 8, color: '#ffffff' },
    desc: 'Vow of the Hollow. Release raw unattuned force in a burst around you.',
  },
};

export const MANTRA_TYPES = { combat: 'Combat', mobility: 'Mobility', support: 'Support' };

// Star upgrades (Mantra Sparks): +15% damage, -8% cooldown per star.
export const MAX_STARS = 3;
