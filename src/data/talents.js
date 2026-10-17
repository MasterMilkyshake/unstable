// Talent cards. mods are additive modifier bags (see stats.computeDerived and
// combat code for keys). flags are boolean switches checked by gameplay code (each one's effect
// has a test in tests/talents.test.js). excludes: talents that cannot be held together.

export const TALENTS = {
  // ---- General ----
  iron_gut: { name: 'Iron Gut', cat: 'General', reqs: null, mods: { hungerRate: 0.3 }, desc: 'Hunger and thirst drain 30% slower.' },
  second_wind: { name: 'Second Wind', cat: 'General', reqs: null, flags: ['secondWind'], excludes: ['rallying_spirit'], desc: 'Once every 3 minutes, dropping below 20% health heals you for 25%.' },
  seafarer: { name: 'Seafarer', cat: 'General', reqs: null, mods: { swimSpeed: 0.45 }, flags: ['seafarer'], desc: 'Swim 45% faster. You jump out of deep water as high as off the ground, high enough to catch a ledge above the waterline.' },
  scavenger: { name: 'Scavenger', cat: 'General', reqs: null, mods: { silverGain: 0.3 }, desc: '+30% silver from enemies and chests.' },
  quick_study: { name: 'Quick Study', cat: 'General', reqs: null, mods: { xpGain: 0.1 }, desc: '+10% experience.' },
  thick_skin: { name: 'Thick Skin', cat: 'General', reqs: null, mods: { physResist: 0.05 }, flags: ['thickSkin'], desc: '+5% physical resistance. Burning and bleeding on you wear off twice as fast.' },
  sure_footed: { name: 'Sure-Footed', cat: 'General', reqs: null, mods: { fallResist: 0.5 }, flags: ['lessKnockback'], desc: 'Halved fall damage and knockback.' },
  sharp_reflexes: { name: 'Sharp Reflexes', cat: 'General', reqs: { anyOf: [{ light: 15 }, { medium: 15 }, { heavy: 15 }] }, mods: { parryWindow: 0.02 }, flags: ['sharpReflexes'], desc: 'Parry window +20ms, and a missed parry is ready again 0.3 s sooner.' },

  // ---- Strength ----
  brute_force: { name: 'Brute Force', cat: 'Strength', reqs: { strength: 10 }, mods: { physDmg: 0.08 }, desc: '+8% physical damage.' },
  bone_crusher: { name: 'Bone Crusher', cat: 'Strength', reqs: { strength: 20 }, mods: { postureDmg: 0.2 }, flags: ['boneCrusher'], desc: '+20% posture damage. A guard you break stays broken 0.4 s longer.' },
  bull_rush: { name: 'Bull Rush', cat: 'Strength', reqs: { strength: 30 }, mods: { runAtk: 0.2 }, flags: ['bullRush'], desc: 'Running attacks deal 20% more, and against a block they deal 50% more posture and shove the blocker back.' },
  titan_grip: { name: 'Titan Grip', cat: 'Strength', reqs: { strength: 40, heavy: 30 }, mods: { heavySpeed: 0.12 }, flags: ['titanGrip'], desc: "Heavy weapons swing 12% faster, and no weapon's weight slows your roll." },
  unstoppable: { name: 'Unstoppable', cat: 'Strength', reqs: { strength: 50 }, flags: ['critHyperarmor'], desc: 'Your critical attacks cannot be interrupted.' },

  // ---- Fortitude ----
  hardened: { name: 'Hardened', cat: 'Fortitude', reqs: { fortitude: 10 }, mods: { maxHp: 25 }, desc: '+25 maximum health.' },
  iron_posture: { name: 'Iron Posture', cat: 'Fortitude', reqs: { fortitude: 20 }, mods: { maxPosture: 20 }, flags: ['ironPosture'], desc: '+20 maximum posture. Your posture recovers even while you hold a block.' },
  bulwark: { name: 'Bulwark', cat: 'Fortitude', reqs: { fortitude: 30 }, mods: { blockPosture: 0.25 }, flags: ['bulwark'], desc: 'Blocking takes 25% less posture, and no chip damage gets through your guard.' },
  undying: { name: 'Undying', cat: 'Fortitude', reqs: { fortitude: 40 }, flags: ['undying'], desc: 'Once every 5 minutes, survive a lethal blow with 1 health.' },
  juggernaut: { name: 'Juggernaut', cat: 'Fortitude', reqs: { fortitude: 50 }, mods: { physResist: 0.12 }, flags: ['juggernaut'], excludes: ['colossus'], desc: '+12% physical resistance. Light blows no longer interrupt your swings.' },

  // ---- Agility ----
  fleet_foot: { name: 'Fleet Foot', cat: 'Agility', reqs: { agility: 10 }, mods: { speed: 0.06 }, desc: '+6% movement speed.' },
  cats_grace: { name: "Cat's Grace", cat: 'Agility', reqs: { agility: 20 }, mods: { latches: 1 }, flags: ['catsGrace'], desc: 'One more ledge catch or wall hop before you must land. A roll just before you land takes no fall damage.' },
  quickstep: { name: 'Quickstep', cat: 'Agility', reqs: { agility: 30 }, mods: { dodgeCd: 0.25 }, flags: ['quickstep'], desc: 'Dodge cooldown 25% shorter. Cancelling a roll with [F] costs no extra cooldown.' },
  acrobat: { name: 'Acrobat', cat: 'Agility', reqs: { agility: 40 }, flags: ['doubleJump'], desc: 'Jump again in mid-air.' },
  ghost_step: { name: 'Ghost Step', cat: 'Agility', reqs: { agility: 50 }, flags: ['ghostStep'], excludes: ['evasive'], desc: 'Dodging through an attack refreshes your dodge.' },
  slide_strike: { name: 'Slide Strike', cat: 'Agility', reqs: { agility: 15 }, flags: ['slideStrike'], desc: 'Sliding into enemies trips them, dealing posture damage.' },

  // ---- Intelligence ----
  arcane_focus: { name: 'Arcane Focus', cat: 'Intelligence', reqs: { intelligence: 10 }, mods: { mantraDmg: 0.08 }, desc: '+8% mantra damage.' },
  mana_flow: { name: 'Mana Flow', cat: 'Intelligence', reqs: { intelligence: 20 }, mods: { etherRegen: 0.15 }, desc: 'Ether regenerates 15% faster.' },
  efficient_casting: { name: 'Efficient Casting', cat: 'Intelligence', reqs: { intelligence: 30 }, mods: { etherCost: 0.2 }, flags: ['efficientCasting'], desc: 'Mantras cost 20% less ether. Each mantra hit that lands returns 3 ether.' },
  spellblade: { name: 'Spellblade', cat: 'Intelligence', reqs: { intelligence: 40, anyOf: [{ ember: 30 }, { rime: 30 }, { storm: 30 }, { gale: 30 }, { umbra: 30 }] }, flags: ['spellblade'], desc: 'Weapon hits carry your strongest attunement, adding damage and its ailment.' },
  overflow: { name: 'Overflow', cat: 'Intelligence', reqs: { intelligence: 50 }, mods: { mantraCd: 0.2 }, flags: ['overflow'], desc: 'Mantra cooldowns 20% shorter. With your ether full, your next mantra costs nothing.' },

  // ---- Willpower ----
  stalwart_mind: { name: 'Stalwart Mind', cat: 'Willpower', reqs: { willpower: 10 }, mods: { sanityResist: 0.25, maxSanity: 20 }, desc: 'Sanity drains 25% slower; +20 max sanity.' },
  ether_well: { name: 'Ether Well', cat: 'Willpower', reqs: { willpower: 20 }, mods: { maxEther: 30 }, desc: '+30 maximum ether.' },
  meditation: { name: 'Meditation', cat: 'Willpower', reqs: { willpower: 30 }, flags: ['meditation'], desc: 'Ether regenerates twice as fast outside of danger.' },
  resolve: { name: 'Resolve', cat: 'Willpower', reqs: { willpower: 40 }, mods: { stunResist: 0.3 }, flags: ['resolve'], desc: 'Stuns and guard breaks last 30% shorter. Once every 20 s you can roll out of a broken guard.' },
  unbroken: { name: 'Unbroken Will', cat: 'Willpower', reqs: { willpower: 50 }, flags: ['unbroken', 'blindImmune'], desc: 'Immune to blindness. Once every 6 minutes, rise from being knocked at 30% health.' },

  // ---- Charisma ----
  silver_tongue: { name: 'Silver Tongue', cat: 'Charisma', reqs: { charisma: 10 }, mods: { discount: 0.1, sellBonus: 0.15 }, desc: 'Prices 10% lower; sell for 15% more.' },
  rallying_spirit: { name: 'Rallying Spirit', cat: 'Charisma', reqs: { charisma: 20 }, mods: { etherRegen: 0.25 }, flags: ['rallying'], excludes: ['second_wind'], desc: 'Ether regenerates 25% faster. Falling below 30% health restores 25 ether and a fifth of your posture, once a minute.' },
  inspiring: { name: 'Inspiring Presence', cat: 'Charisma', reqs: { charisma: 30 }, mods: { heal: 0.25 }, desc: 'All healing you receive is 25% stronger.' },
  intimidate: { name: 'Intimidate', cat: 'Charisma', reqs: { charisma: 40 }, mods: { dmgTaken: -0.08 }, flags: ['intimidate'], desc: 'Enemies deal 8% less damage to you, and foes of lower Power than yours wait 30% longer between attacks.' },

  // ---- Weapon ----
  flurry_master: { name: 'Flurry Master', cat: 'Light Weapon', reqs: { light: 20 }, mods: { lightSpeed: 0.1 }, flags: ['flurryMaster'], desc: 'Light weapons and fists attack 10% faster. A roll no longer breaks your string.' },
  exploit_weakness: { name: 'Exploit Weakness', cat: 'Light Weapon', reqs: { light: 35 }, flags: ['exploit'], desc: 'Hits on stunned or guard-broken enemies deal 30% more damage.' },
  balanced_stance: { name: 'Balanced Stance', cat: 'Medium Weapon', reqs: { medium: 20 }, mods: { mediumDmg: 0.08 }, flags: ['balancedStance'], desc: 'Medium weapons deal 8% more damage. A flourish held over 0.2 s deals 25% more posture.' },
  riposte: { name: 'Riposte', cat: 'Medium Weapon', reqs: { medium: 35 }, flags: ['riposte'], desc: 'After a successful parry, your next hit within 1.5s deals 40% more damage.' },
  momentum: { name: 'Momentum', cat: 'Heavy Weapon', reqs: { heavy: 20 }, flags: ['momentum'], desc: 'Each consecutive combo hit deals 6% more damage.' },
  shatter: { name: 'Shatter', cat: 'Heavy Weapon', reqs: { heavy: 35 }, flags: ['shatter'], desc: 'Critical attacks deal triple posture damage to blocking enemies.' },

  // ---- Attunements ----
  kindled_blood: { name: 'Kindled Blood', cat: 'Emberweave', reqs: { ember: 10 }, mods: { burnDur: 0.5 }, desc: 'Burns you inflict last 50% longer.' },
  firewalker: { name: 'Firewalker', cat: 'Emberweave', reqs: { ember: 20 }, mods: { resist_ember: 0.25 }, flags: ['firewalker'], desc: '+25% fire resistance. Burning ground and lava do not hurt you.' },
  ignition: { name: 'Ignition', cat: 'Emberweave', reqs: { ember: 30 }, flags: ['ignition'], desc: 'Fire mantras deal 20% more damage to burning enemies.' },
  permafrost: { name: 'Permafrost', cat: 'Rimebind', reqs: { rime: 10 }, mods: { chillPower: 0.35 }, desc: 'Chill builds 35% faster.' },
  winter_coat: { name: 'Winter Coat', cat: 'Rimebind', reqs: { rime: 20 }, mods: { resist_rime: 0.25 }, flags: ['winterCoat'], desc: '+25% ice resistance. Chill never freezes you solid.' },
  shatterpoint: { name: 'Shatterpoint', cat: 'Rimebind', reqs: { rime: 30 }, flags: ['shatterpoint'], desc: 'Hitting a frozen enemy shatters the ice for 40% bonus damage.' },
  static_charge: { name: 'Static Charge', cat: 'Stormcall', reqs: { storm: 10 }, mods: { shockDur: 0.4 }, flags: ['staticCharge'], desc: 'Shocks you inflict last 40% longer. Shock no longer stuns you.' },
  overcharge: { name: 'Overcharge', cat: 'Stormcall', reqs: { storm: 30 }, mods: { chainJumps: 2 }, desc: 'Chaining lightning jumps to 2 more targets.' },
  tailwind: { name: 'Tailwind', cat: 'Galesong', reqs: { gale: 10 }, mods: { speed: 0.06, dodgeDist: 0.2 }, flags: ['tailwind'], desc: '+6% speed and 20% longer dodges. A roll in the air breaks your fall.' },
  updraft: { name: 'Updraft', cat: 'Galesong', reqs: { gale: 30 }, flags: ['airDodge'], desc: 'You can dodge a second time in mid-air.' },
  shroud: { name: 'Shroud', cat: 'Umbracast', reqs: { umbra: 10 }, mods: { stealth: 0.35 }, flags: ['shroud'], desc: 'Enemies notice you from 35% closer. Your first blow on a foe that has not noticed you deals 40% more.' },
  night_hunger: { name: 'Night Hunger', cat: 'Umbracast', reqs: { umbra: 30 }, flags: ['nightHunger'], desc: 'Shadow mantras heal you for 15% of their damage.' },

  // ---- Expanded pool ----
  hearty_appetite: { name: 'Hearty Appetite', cat: 'General', reqs: null, mods: { hungerRate: 0.15 }, flags: ['heartyAppetite'], desc: 'Hunger drains 15% slower. You eat and drink at a walk instead of a shuffle, and food heals 10% more.' },
  treasure_sense: { name: 'Treasure Sense', cat: 'General', reqs: { level: 3 }, mods: { silverGain: 0.15 }, flags: ['treasureSense'], desc: '+15% silver. An unopened chest within 25 m chimes once to let you know it is there.' },
  deep_breath: { name: 'Deep Breath', cat: 'General', reqs: null, mods: { swimSpeed: 0.25 }, flags: ['deepBreath'], desc: 'Swim 25% faster. Sitting restores sanity and ether three times as fast.' },
  tough_hide: { name: 'Tough Hide', cat: 'General', reqs: { level: 4 }, mods: { maxHp: 15, maxPosture: 5 }, desc: '+15 maximum health and +5 posture.' },
  perfectionist: { name: 'Perfectionist', cat: 'General', reqs: { level: 8 }, flags: ['perfectParry'], desc: 'Parries restore 10 ether and 8% of your posture bar.' },
  crushing_blows: { name: 'Crushing Blows', cat: 'Strength', reqs: { strength: 25 }, mods: { critDmg: 0.08 }, flags: ['crushingBlows'], desc: 'Critical attacks deal 8% more. A critical attack on a blocking foe past half its posture breaks the guard outright.' },
  heavy_hands: { name: 'Heavy Hands', cat: 'Strength', reqs: { strength: 35 }, mods: { physDmg: 0.06 }, flags: ['heavyHands'], desc: "+6% physical damage. Your uppercut lifts a quarter higher, and the air string's slam staggers foes within 2.5 m where you land." },
  stonewall: { name: 'Stonewall', cat: 'Fortitude', reqs: { fortitude: 30 }, mods: { maxPosture: 8 }, flags: ['stonewall'], desc: '+8 posture. While you block, nothing knocks you back or lifts you, and your guard covers 180°.' },
  iron_lungs: { name: 'Iron Lungs', cat: 'Fortitude', reqs: { fortitude: 25 }, mods: { maxHp: 20 }, flags: ['ironLungs'], desc: '+20 maximum health. Sprinting and climbing no longer make you hungry or thirsty faster.' },
  last_bastion: { name: 'Last Bastion', cat: 'Fortitude', reqs: { fortitude: 45 }, flags: ['lastBastion'], desc: 'Below 30% health, you take 20% less damage.' },
  wall_runner: { name: 'Wall Runner', cat: 'Agility', reqs: { agility: 25 }, mods: { latches: 1 }, flags: ['wallRunner'], desc: 'One more ledge catch or wall hop. Your wall hops carry you 40% higher.' },
  evasive: { name: 'Evasive', cat: 'Agility', reqs: { agility: 35 }, mods: { dodgeDist: 0.15 }, flags: ['evasive'], excludes: ['ghost_step'], desc: 'Dodges carry 15% further. A last-moment dodge makes your next hit within 1 s deal 30% more.' },
  blitz: { name: 'Blitz', cat: 'Agility', reqs: { agility: 45 }, mods: { speed: 0.05 }, flags: ['blitz'], desc: '+5% speed. Your slides last 40% longer and start from a run, not only a sprint.' },
  focused_mind: { name: 'Focused Mind', cat: 'Intelligence', reqs: { intelligence: 15 }, mods: { etherCost: 0.08 }, flags: ['focusedMind'], desc: "Mantras cost 8% less ether. Light blows no longer break a mantra's wind-up." },
  scholar: { name: 'Scholar', cat: 'Intelligence', reqs: { intelligence: 25 }, mods: { xpGain: 0.08, mantraDmg: 0.04 }, desc: '+8% experience and +4% mantra damage.' },
  arcane_mastery: { name: 'Arcane Mastery', cat: 'Intelligence', reqs: { intelligence: 45 }, mods: { mantraDmg: 0.12 }, flags: ['arcaneMastery'], desc: '+12% mantra damage. Mantras deal 20% more to a foe suffering an ailment.' },
  clear_head: { name: 'Clear Head', cat: 'Willpower', reqs: { willpower: 15 }, mods: { sanityResist: 0.2, maxSanity: 15 }, flags: ['clearHead'], desc: 'Sanity drains 20% slower; +15 max sanity. Blindness on you lasts half as long.' },
  deep_reserves: { name: 'Deep Reserves', cat: 'Willpower', reqs: { willpower: 35 }, mods: { maxEther: 40, etherRegen: 0.1 }, desc: '+40 maximum ether and +10% ether regeneration.' },
  haggler: { name: 'Haggler', cat: 'Charisma', reqs: { charisma: 15 }, mods: { discount: 0.06, silverGain: 0.1 }, desc: 'Prices 6% lower; +10% silver found.' },
  leadership: { name: 'Leadership', cat: 'Charisma', reqs: { charisma: 35 }, mods: { etherRegen: 0.15, heal: 0.1 }, desc: 'Ether regenerates 15% faster. Healing received +10%.' },
  presence: { name: 'Commanding Presence', cat: 'Charisma', reqs: { charisma: 50 }, mods: { dmgTaken: -0.06 }, flags: ['presence'], desc: 'Enemies deal 6% less damage to you. Your grip finishes a knocked foe 40% faster and heals you 5%.' },
  lightning_reflexes: { name: 'Lightning Reflexes', cat: 'Light Weapon', reqs: { light: 15 }, mods: { lightSpeed: 0.05 }, flags: ['lightningReflexes'], desc: 'Light weapons swing 5% faster. Your feints are ready again 40% sooner.' },
  assassin: { name: 'Assassin', cat: 'Light Weapon', reqs: { light: 45 }, flags: ['backstab'], desc: 'Hits from behind deal 35% more damage and ignore blocks.' },
  duelists_poise: { name: "Duelist's Poise", cat: 'Medium Weapon', reqs: { medium: 15 }, mods: { mediumDmg: 0.05, parryWindow: 0.01 }, desc: 'Medium weapons deal 5% more damage; parry window +10ms.' },
  blade_dancer: { name: 'Blade Dancer', cat: 'Medium Weapon', reqs: { medium: 45 }, mods: { mediumDmg: 0.08 }, flags: ['bladeDancer'], desc: 'Medium weapons deal 8% more damage. [LMB] late in a roll cuts the roll short with a swing.' },
  heavy_momentum: { name: 'Heavy Momentum', cat: 'Heavy Weapon', reqs: { heavy: 15 }, flags: ['heavyMomentum'], desc: 'Each swing of a heavy string winds up 8% faster than the one before.' },
  colossus: { name: 'Colossus', cat: 'Heavy Weapon', reqs: { heavy: 45, strength: 25 }, flags: ['heavyHyper'], excludes: ['juggernaut'], desc: 'The final swing of a heavy combo cannot be interrupted.' },
  conflagration: { name: 'Conflagration', cat: 'Emberweave', reqs: { ember: 20 }, mods: { burnDur: 0.3 }, flags: ['conflagration'], desc: 'Burns you inflict last 30% longer. A burning foe that falls sets the foes within 3 m alight.' },
  glacial_core: { name: 'Glacial Core', cat: 'Rimebind', reqs: { rime: 40 }, mods: { chillPower: 0.3 }, flags: ['glacialCore'], desc: 'Chill builds 30% faster. Striking a frozen foe spreads chill to the foes within 3 m.' },
  conductor: { name: 'Conductor', cat: 'Stormcall', reqs: { storm: 20 }, mods: { shockDur: 0.3, chainJumps: 1 }, flags: ['conductor'], desc: 'Shocks last 30% longer and chains jump once more. In the rain your Stormcall mantras deal 15% more.' },
  windrunner: { name: 'Windrunner', cat: 'Galesong', reqs: { gale: 20 }, mods: { speed: 0.05 }, flags: ['windrunner'], desc: '+5% speed. While you sprint, arrows, bolts and thrown things deal 30% less.' },
  dusk_shroud: { name: 'Dusk Shroud', cat: 'Umbracast', reqs: { umbra: 20 }, mods: { stealth: 0.2 }, flags: ['duskShroud'], desc: 'Enemies notice you from 20% closer. Blindness you inflict lasts 50% longer.' },

  // ---- Situational talents (effects in game/talentpowers.js) ----
  bloodthirst: { name: 'Bloodthirst', cat: 'General', reqs: { level: 10 }, flags: ['bloodthirst'], desc: 'Each kill heals 6% of your maximum health.' },
  ether_siphon: { name: 'Ether Siphon', cat: 'Willpower', reqs: { willpower: 25 }, flags: ['etherSiphon'], desc: 'Each kill restores 15 ether.' },
  tempo_hunter: { name: 'Ether Hunter', cat: 'Charisma', reqs: { charisma: 25 }, flags: ['etherHunter'], desc: 'Each kill restores 20 ether.' },
  adrenaline: { name: 'Adrenaline', cat: 'Agility', reqs: { agility: 30 }, flags: ['adrenaline'], desc: 'Below 35% health: +12% speed and +8% damage.' },
  nightstalker: { name: 'Nightstalker', cat: 'Umbracast', reqs: { anyOf: [{ umbra: 20 }, { agility: 35 }] }, flags: ['nightstalker'], desc: 'At night: +8% damage and enemies notice you from 20% closer.' },
  sun_blessed: { name: 'Sun-Blessed', cat: 'Emberweave', reqs: { ember: 25 }, flags: ['sunBlessed'], desc: 'While the sun is up: +8% mantra damage and +10% ether regeneration.' },
  deep_diver: { name: 'Deep Diver', cat: 'General', reqs: { level: 12 }, flags: ['deepDiver'], desc: 'In the Rift: +8% damage and sanity drains 15% slower.' },
  gourmand: { name: 'Gourmand', cat: 'General', reqs: { level: 4 }, flags: ['gourmand'], desc: 'Meal buffs last twice as long.' },
  forager: { name: 'Forager', cat: 'General', reqs: null, flags: ['forager'], desc: 'Gather one extra ingredient from every bush, hive and flower.' },
  angler: { name: 'Angler', cat: 'General', reqs: null, flags: ['angler'], desc: 'The fishing reel zone is 30% wider and rare catches are more common.' },
  lorekeeper: { name: 'Lorekeeper', cat: 'Intelligence', reqs: { intelligence: 15 }, mods: { xpGain: 0.04 }, flags: ['lorekeeper'], desc: 'Lore tablets grant triple experience. +4% experience.' },
  last_stand: { name: 'Last Stand', cat: 'Fortitude', reqs: { fortitude: 35, willpower: 15 }, flags: ['lastStand'], desc: 'While 3 or more enemies hunt you: +10% damage and +8% physical resistance.' },

  // ---- Vow talents (granted, not drawn) ----
  vow_hollow_1: { name: 'Unbound', cat: 'Vow', vow: 'hollow', mods: { physDmg: 0.05, mantraDmg: 0.05, etherRegen: 0.15 }, desc: '+5% all damage, +15% ether regeneration.' },
  vow_galeblade_1: { name: 'Sky Dancer', cat: 'Vow', vow: 'galeblade', flags: ['doubleJump', 'airDodge', 'galeChase'], mods: { airDmg: 0.25 }, desc: 'Double jump and a second air dodge. Aerial attacks deal 25% more damage, and any blow that lifts a foe opens the air chase, not only the uppercut.' },
  vow_silence_1: { name: 'Silent Heart', cat: 'Vow', vow: 'silence', flags: ['noAttune', 'mayhem'], mods: { physDmg: 0.18, speed: 0.08 }, desc: 'You cannot cast attunement mantras. +18% physical damage, +8% speed. Hits build Mayhem (+3% damage per stack, up to 10).' },
  vow_seer_1: { name: 'Third Eye', cat: 'Vow', vow: 'seer', flags: ['blindImmune', 'seerParry', 'seerRead'], mods: { parryWindow: 0.06 }, desc: 'Parry window +60ms. Successful parries heal 4% health, and a missed parry is ready again twice as fast. Immune to blindness.' },
  vow_dawn_1: { name: 'Sunbearer', cat: 'Vow', vow: 'dawn', mods: { burnDur: 0.25 }, desc: 'While the sun is up: +12% damage and +20% fire resistance. Burns last 25% longer.' },
  vow_abyss_1: { name: 'Abyssal Gaze', cat: 'Vow', vow: 'abyss', mods: { resist_umbra: 0.1 }, desc: 'In the Rift: +15% damage, sanity drains 50% slower. +1% damage per 10% sanity missing.' },
  vow_contract_1: { name: 'Bounty Hunter', cat: 'Vow', vow: 'contract', mods: { silverGain: 0.1 }, desc: 'Kills grant Bounty stacks (+4% damage, +10% silver each, up to 5). +10% silver.' },
  vow_blades_1: { name: 'Bladesworn', cat: 'Vow', vow: 'blades', mods: { critDmg: 0.2, postureDmg: 0.15, critCdr: 0.25 }, desc: 'Critical attacks deal 20% more damage and recharge 25% faster. +15% posture damage.' },
  vow_arc_1: { name: 'Arcwarder', cat: 'Vow', vow: 'arc', flags: ['reflect', 'arcBlock'], mods: { maxPosture: 20 }, desc: 'Parried projectiles are reflected with double damage, and blocking one costs no posture. +20 posture.' },
};

// A talent is not offered while the character holds one it excludes (either way round).
export function talentExcluded(id, owned) {
  const t = TALENTS[id];
  if (!t) return true;
  return owned.some((o) => (t.excludes || []).includes(o) || ((TALENTS[o] && TALENTS[o].excludes) || []).includes(id));
}

export const TALENT_CATS = ['General', 'Strength', 'Fortitude', 'Agility', 'Intelligence', 'Willpower', 'Charisma', 'Light Weapon', 'Medium Weapon', 'Heavy Weapon', 'Emberweave', 'Rimebind', 'Stormcall', 'Galesong', 'Umbracast', 'Vow'];
