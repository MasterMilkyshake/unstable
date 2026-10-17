// First-time tips: each system explained once, when it first matters (game/tips.js decides when).
// {action}, {hotbar:n} and {mouse:LMB} name keys from BIND (core/input.js), so a tip can never
// name a key the game doesn't use; {name}-style fields are filled in when the tip shows.
// Other systems can show one by id: ACTIONS.tip('contracts').
export const TIPS = {
  fight: { title: 'A fight', text: 'Strike with {mouse:LMB}. Hold {block} to block, and tap it just before a blow lands to parry. {dodge} rolls clear. Red flashes can\'t be parried; orange ones can\'t be blocked.' },
  fists: { title: 'Fists down', text: 'You woke with your fists lowered. {hotbar:1} raises them; until then you can\'t strike, block or parry.' },
  grip: { title: 'A foe is down', text: '{who} is knocked down. Grip them with {grip} before they get back up.', guide: 'A foe you knock down can be gripped with {grip} before it gets back up.' },
  moves: { title: 'More ways to fight', text: 'Hold {mouse:LMB} to flourish a swing. Attack in a slide ({slide}) to uppercut, then {jump} to chase the foe into the air. {block} early in a roll cancels it into a parry. Your guard covers 140° in front.' },
  ledge: { title: 'Ledges', text: 'Jump into an edge above you to catch it. From the hang, {jump} leaps up (hold {forward} to climb onto the top); {back} or {dodge} lets go. In the air against a wall, {jump} hops up it. Catches and hops share a count that landing restores.' },
  lines: { title: 'Carrier lines', text: '{interact} at a line\'s trolley to ride the cable. A haul line draws you up to a height; every line sets you down at its far end. Lines reach places no road climbs to.' },
  power: { title: 'Power', text: 'Experience earns investment points one at a time. Sit at a campfire to invest them ({menu}, Attributes, Confirm); the fifteenth since your last Power raises you to the next. Old Wren\'s fire on the Wash is the nearest, or lay your own from three Sticks or a Firewood.' },
  picks: { title: 'Talents and mantras', text: 'You have a talent or a mantra card to choose. Open {menu} to pick it, wherever you are.' },
  hunger: { title: 'Food and water', guide: 'When you get hungry or thirsty, eat or drink from the hotbar: a new character keeps bread on {hotbar:0} and water on {hotbar:9}. Wells refill waterskins, and campfires cook.', text: 'You\'re getting {need}. Eat or drink from the hotbar: a new character keeps bread on {hotbar:0} and water on {hotbar:9}. Wells refill waterskins, and campfires cook.' },
  rift: { title: 'The Rift', text: 'Sanity drains down here, and dying here ends you for good. The way home is the Ascent: north through the Great South Gate into the keep, through its gate hall and out its north door to the stone lift ({interact}), which carries you to the summit. Step through the Wound there.' },
  lifeLost: { title: 'A name-knot spent', guide: 'Quitting or reloading while in danger costs a life, a name-knot. An Ember of Life restores one. Lose the last and the character is gone for good, as it is after any death in the Rift: its name goes into the Register of the Lost, it earns Remembrance for the next soul, and it may leave one heirloom at the Wash.', text: 'Fleeing danger cost you a life: {lives} of {max} left. An Ember of Life restores one. Lose the last and the character is gone for good, as it is after any death in the Rift.' },
  slots: { title: 'Save slots', text: 'Each of three save slots keeps its own character, backup and lives. Settings and the Register of the Lost are shared. Load or start one from the main menu.' },
  heirloom: { title: 'An heirloom', guide: 'Something a lost character left waits in the keepsake chest by Wren\'s fire for the next new character. {interact} to take it.', text: '{from} left something for you in the keepsake chest by Wren\'s fire. {interact} to take it.' },
  sail: { title: 'Boats', text: 'Rent a boat at the dock to sail between the islands. W and S set the throttle, A and D steer, Shift for speed, {interact} to step off. There is no fast travel.' },
  vow: { title: 'A vow', text: 'At Power 5 the Vowkeeper on Saltreach\'s northern perch will hear an oath: a Vow gives talents and a mantra of its own, for good.' },
  resonance: { title: 'A second voice', text: 'Sworn and at Power 15, you can be attuned to a Resonance at the Vowkeeper: a passive, and an ability on {resonance}.' },
  spark: { title: 'A Mantra Spark', text: 'Offer a Spark at a Mantra Altar to add a star and a modifier to a mantra you know.' },
  journal: { title: 'The Journal', text: 'What you read goes into your Journal ({journal}): its sources, the chronicle and investigations that pay when their records agree. The Guide there explains every system.' },
  loot: { title: 'Take what you want', text: 'Take things one by one, or everything at once; what you leave stays where it is. To leave things for someone, open your backpack in the character menu ({menu}), and leave a pouch.' },
  lostPouch: { title: 'What you dropped', text: 'Dying left part of what you carried where you fell, in a pouch: half your silver and some of your goods. Go back for it before someone else does. What you keep in a Keepers\' strongbox is safe.' },
  bank: { title: 'The strongbox', text: 'Every inn\'s host keeps the same strongbox for you. What you put in it waits at any inn, and dying never touches it.' },
  worldEvents: { title: 'Something nearby', text: 'The world moves without you: Rift Breaches, falling stars and more. Follow the toast to the light; each pays when it\'s done.' },
  contracts: { title: 'Contracts', text: 'Each faction\'s officer keeps a board of contracts that turns over every day. Take one, see it done, and bring word back for silver and standing.' },
  hunters: { title: 'Hunted', text: 'Stay wanted too long and the faction sends hunters on your trail. Pay your fine to its officer and they stand down, or lose them over the water.' },
  patrols: { title: 'Cutters', text: 'Wanted at sea, you draw the Enclave\'s cutters. Heave to and pay, or run for shore: they shoot as they chase, and land marines where you come ashore.' },
  checkpoints: { title: 'Columns and checkpoints', text: 'Columns march the roads between forts and posts and fight whatever they meet. At low standing you\'ll be stopped at a checkpoint: pay the toll, show your Writ, or fight through.' },
};
