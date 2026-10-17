// NPC dialogue trees and shop inventories.
import { SETTLEMENT_HOSTS } from './world.js';
import { act } from '../game/hooks.js';
// A dialogue function receives `api` and returns a node:
//   { text, options: [{ label, do?(api), next?: node | (api) => node }] }
// An option without `next` closes the dialogue (after running `do`).

export const SHOPS = {
  dorran: {
    name: "Dorran's Forge",
    weapons: ['rusty_dagger', 'cutlass', 'bronze_sword', 'hunters_spear', 'iron_knuckles', 'oak_club', 'woodcutter_axe', 'farmhand_scythe', 'serrated_shiv', 'spiked_mace', 'tourney_lance', 'steel_longsword', 'watch_pike', 'duelist_rapier', 'iron_greatsword', 'driftsteel_katana', 'bonebreaker', 'tidebreaker', 'warden_mace'],
    enchanting: true,
    items: ['smithing_stone'],
  },
  ysolde: { name: "Ysolde's Threads", outfits: ['sailor', 'traveler', 'leather', 'scout', 'mystic', 'guard_plate', 'knight_plate'] },
  pell: { name: "Pell's Provisions", items: ['bread', 'apple', 'berries', 'honeycomb', 'salt', 'waterskin', 'fishing_rod', 'mushroom', 'herb', 'stew', 'elixir', 'ether_tonic', 'sanity_draught', 'cleansing_salts', 'mantra_spark', 'firewood'] },
  brynja: { name: "Brynja's Stock", items: ['steak', 'frost_lily', 'waterskin', 'elixir', 'frost_salve', 'firewood'], outfits: ['frosthide'] },
  ignis: { name: "Ignis's Curios", items: ['ember_pepper', 'ether_tonic', 'elixir', 'sanity_draught', 'fireproof_salve', 'iron_draught', 'mantra_spark'] },
  moss: { name: "Moss's Catch", items: ['fishing_rod', 'fish_cooked', 'fish_stew', 'apple', 'salt', 'waterskin', 'herb', 'cleansing_salts', 'firewood'], outfits: ['fen_cloak'] },
  ama: { name: "Ama's Pack", items: ['berries', 'honeycomb', 'herb', 'elixir', 'cleansing_salts', 'fishing_rod', 'firewood'], outfits: ['scout'] },
  hollow_man: {
    name: 'Wares of the Drowned', currency: 'rift_shard',
    weapons: ['gravewarden_scythe'],
    shardPrices: { gravewarden_scythe: 24, elixir: 3, sanity_draught: 2, ether_tonic: 3, iron_draught: 4, cleansing_salts: 2, mantra_spark: 8, ember_of_life: 30 },
    items: ['sanity_draught', 'elixir', 'ether_tonic', 'iron_draught', 'cleansing_salts', 'mantra_spark', 'ember_of_life'],
    outfits: ['riftwalker'],
  },
  // Each faction's own stores, opened by its officer to the Trusted (data/storyDialogue.js)
  watch_stores: { name: 'The Watch Stores', weapons: ['cutlass', 'hunters_spear', 'spiked_mace', 'steel_longsword', 'watch_pike'], items: ['bread', 'waterskin', 'elixir', 'iron_draught', 'cleansing_salts'], outfits: ['leather', 'guard_plate'] },
  enclave_stores: { name: 'The Enclave Quartermaster', weapons: ['duelist_rapier', 'tourney_lance', 'iron_greatsword', 'warden_mace'], items: ['elixir', 'iron_draught', 'ether_tonic', 'fireproof_salve'], outfits: ['guard_plate', 'knight_plate'] },
  ministry_stores: { name: 'The Ministry Stores', weapons: ['wavecutter_kris'], items: ['sanity_draught', 'ether_tonic', 'cleansing_salts', 'frost_salve', 'mantra_spark'], outfits: ['mystic', 'fen_cloak'] },
};
// Torren keeps the Fort Meridian forge on Dorran's stock list; the sign over it is his own
SHOPS.torren = { ...SHOPS.dorran, name: "Torren's Forge" };

const bye = { label: 'Farewell.' };

export function questOffer(api, id, intro, accept = 'I will do it.') {
  return {
    text: intro,
    options: [
      { label: accept, do: (a) => a.startQuest(id) },
      { label: 'Not now.' },
    ],
  };
}

export function questTurnIn(api, id, text) {
  return {
    text,
    options: [{ label: 'Here.', do: (a) => a.completeQuest(id) }],
  };
}

// Builds dialogue options for every quest an NPC hands out. Each entry:
// { id, offer: 'label', pitch: 'offer text', active: (q) => 'reminder', done: 'turn-in label', when?: (api) => bool }
// Only the first not-yet-finished quest in the list is offered, so lists read as a chain.
export function questHub(api, entries) {
  const opts = [];
  let offered = false;
  for (const e of entries) {
    const q = api.quest(e.id);
    if (q.state === 'ready') opts.unshift({ label: e.done || 'It is done.', do: (a) => a.completeQuest(e.id) });
    else if (q.state === 'active') opts.push({ label: `About "${e.title || e.offer}"...`, next: { text: typeof e.active === 'function' ? e.active(q) : e.active, options: [bye] } });
    else if (q.state === 'none' && !offered && (!e.when || e.when(api))) {
      offered = true;
      opts.push({ label: e.offer, next: () => questOffer(api, e.id, e.pitch, e.accept) });
    }
  }
  return opts;
}

// Maren, Hale and the storyline's new arrivals live in data/storyDialogue.js.
export const DIALOGUES = {
  // The opening: who you are, and a few ways to go. Nothing here has to be done first.
  wren(api) {
    const aw = api.quest('awakening');
    const fl = api.quest('first_light');
    if (aw.state === 'ready') return questTurnIn(api, 'awakening', "Ha! Not bad for a drowned rat. Here - an old bronze sword from a wreck. Press 1 to raise whatever's in your hand. Keep it sharp.");
    const ways = () => {
      const opts = [];
      if (aw.state === 'none') opts.push({ label: 'I will clear the beach.', do: (a) => a.startQuest('awakening') });
      if (fl.state === 'none') opts.push({ label: "I'll head for Saltreach.", do: (a) => a.startQuest('first_light') });
      opts.push({ label: 'Sit by the fire.', do: (a) => a.sitByFire('cf_wash') }, bye);
      return {
        text: "Any way you like. North up the coast trail is Saltreach, the Lantern City: Elder Maren takes in the tide-born, Captain Hale of the Watch pays blades to fight the Thornwood brigands, and an Enclave warship has just anchored in the harbor. East along the shore, Moss at Moss's Landing pays to have the lurkers cleared out of the fen. Oskar rents boats at the Saltreach harbor: Thornwood lies west, the Verdance north, the Hush and Frostmark north-east, the Ashen Spire south. And right here, mudlurkers crawl up the beach. Clear three and I'll give you a bronze sword from a wreck.",
        options: opts,
      };
    };
    return {
      text: aw.state === 'active'
        ? "Still breathing? Good. Three mudlurkers, down by the water, and the sword is yours. Or go on and come back for it; it'll keep."
        : aw.state === 'none' && fl.state === 'none'
        ? "Easy, easy. You've swallowed half the sea. Don't remember your name, do you? None of you ever do. You're tide-born: the sea gives people back on this beach, and nobody owns the ones it returns. Where you go now is up to you."
        : 'The fire is yours whenever you need it. Where to next?',
      options: [
        { label: 'Where can I go from here?', next: ways },
        { label: 'Where am I?', next: { text: "The Wash, the southern beach of the Saltreach Coast. A hundred years ago the coast broke and the sky split; since then islands burn, freeze and sink, things crawl out of the Rift under the sea, and people like you keep washing up. Die out here and you wake down there.", options: [{ label: 'Where can I go from here?', next: ways }, bye] } },
        { label: 'Sit by the fire.', do: (a) => a.sitByFire('cf_wash') },
        bye,
      ],
    };
  },


  ilvar(api) {
    const q = api.quest('attunement');
    if (!api.manaUnlocked()) {
      if (api.level() < 2) return { text: 'Your mind is still waterlogged, tide-born. Return when you have grown stronger - Power 2 at least - and I will open it to mana.', options: [bye] };
      return {
        text: 'Ah. There is a spark in you now. Mana is everywhere - in the salt, the stone, the air. Most cannot hold it. Let me show you how. Afterwards, sit by any fire, open your attributes [Tab] and put a point into an attunement: Emberweave for flame, Rimebind for frost, Stormcall, Galesong for wind... and Umbracast, shadow, for the patient.',
        options: [{ label: 'Teach me.', do: (a) => { a.unlockMana(); a.startQuest('attunement'); } }, { label: 'Another time.' }],
      };
    }
    if (q.state === 'active') return { text: 'Mana without a shape runs straight through you. Give it a shape. Sit by any fire, open your attributes [Tab] and put a point into one attunement: Emberweave, Rimebind, Stormcall, Galesong or Umbracast. Then come back to me.', options: [bye] };
    if (q.state === 'ready') return questTurnIn(api, 'attunement', 'Good. Feel it settle into that shape? Keep investing and you will learn its mantras as you grow. Mantras are cast from your hotbar: press the key to cast, and they draw on your ether.');
    return {
      text: 'Mana is a river. Do not try to hold all of it at once. Is there anything else?',
      options: [
        { label: 'How do mantras work?', next: { text: 'When you grow in power you may choose new mantras whose requirements you meet. Assign them to your hotbar in the character menu [Tab]. Press the key to cast. Every mantra draws on your ether; rest and it returns.', options: [bye] } },
        { label: 'Can mantras be improved?', next: { text: 'With Mantra Sparks, at the altar in the town square. Each spark adds a star: more power, shorter cooldown. Three stars at most.', options: [bye] } },
        bye,
      ],
    };
  },

  dorran(api) {
    return {
      text: "Need steel? I've got steel. Need it sharper? I can do that too - for a price. I can also reforge an enchantment into your blade, though what comes out is up to the fire.",
      options: [
        { label: 'Show me your weapons.', do: (a) => a.openShop('dorran') }, { label: 'Temper a weapon.', do: () => act('openTemper') }, { label: 'Enchant my weapon. (300 silver)', do: (a) => a.enchant() },
        ...questHub(api, [
          {
            id: 'smiths_stones', offer: 'Busy forge.', title: 'Grist for the Forge', when: (a) => a.level() >= 3,
            pitch: "Too busy! Every tide-born with a blade wants it tempered, and I'm down to my last whetstone. Smithing stones turn up on half the brutes in the isles. Bring me six and I'll pay you in starmetal - the good stuff.",
            active: (q) => `Six smithing stones. You've got ${q.progress || 0}. Pry them off whatever you kill.`, done: 'Smithing stones, as promised.',
          },
        ]),
        bye,
      ],
    };
  },

  ysolde(api) {
    const opts = [{ label: 'Browse outfits.', do: (a) => a.openShop('ysolde') }];
    opts.push(...questHub(api, [
      {
        id: 'feathers', offer: 'Anything you need?', title: 'Down for a Mantle', when: (a) => a.level() >= 3,
        pitch: "Gloomowl down. The softest thing on these isles and the owls will not part with it politely. Five feathers and I'll make you a mantle that lets you fall off a cliff and land like a cat.",
        active: (q) => `Five feathers, darling. You have ${q.progress || 0}. The owls nest in Owlroost Hollow on Thornwood.`,
        done: 'Your feathers.',
      },
      {
        id: 'grovehide', offer: 'Working on anything new?', title: 'A Coat Worth Wearing', when: (a) => a.level() >= 11,
        pitch: "Always. They say the grove apes of the Verdance have hide like boiled leather that breathes like linen. Five hides and I'll make you the finest coat this side of the Rift.",
        active: (q) => `Five ape hides. You have ${q.progress || 0}.`, done: 'Five ape hides.',
      },
    ]));
    opts.push(bye);
    return { text: "Darling, you look like the sea chewed you up. Let me fix that. Armor, coats, robes - all stitched by hand.", options: opts };
  },

  pell(api) {
    const q = api.quest('satchel');
    const opts = [{ label: 'Show me your provisions.', do: (a) => a.openShop('pell') }];
    if (q.state === 'none' && api.level() >= 3) opts.push({ label: 'You look troubled.', next: () => questOffer(api, 'satchel', "A gloomowl took my satchel on the Thornwood road! Everything I'd earned that week. They nest in Owlroost Hollow, in the south-east of the island. Bring it back and I'll make it worth your while.") });
    if (q.state === 'ready') opts.unshift({ label: 'I found your satchel.', do: (a) => a.completeQuest('satchel') });
    opts.push(...questHub(api, [
      {
        id: 'honey_harvest', offer: 'What sells best?', title: 'Sweet Trade',
        pitch: "Honey cakes! Can't bake them fast enough. Wild hives grow on the old stumps all over Thornwood and Saltreach. Five combs and you'll get a cut - and a couple of cakes.",
        active: (q) => `Five honeycombs. You have ${q.progress || 0}.`, done: 'Your honeycomb.',
      },
    ]));
    opts.push(bye);
    return { text: "Bread, water, medicine - everything a sane person needs before heading out. Eat when you're hungry, drink when you're thirsty. You'd be surprised how many forget.", options: opts };
  },

  bess(api) {
    const opts = [{ label: 'Rent a bed. (10 silver)', do: (a) => a.rest('inn_salt', 10) }, { label: "Open the Keepers' strongbox.", do: () => act('openBank') }];
    opts.push(...questHub(api, [
      {
        id: 'pantry', offer: 'Business looks slow.', title: 'An Empty Pantry',
        pitch: "Slow? It's starving! Not a scrap of meat in the larder and sailors who eat like gulls. Bring me four cuts of raw meat - boar, wolf, I won't ask - and I'll make it worth your while.",
        active: (q) => `Four cuts of meat, love. You've brought ${q.progress || 0}. Wolves, crabs and owls all carry some.`,
        done: 'Meat for the larder.',
      },
      {
        id: 'fishermans_supper', offer: 'Where is your cook?', title: "A Fisherman's Supper", when: (a) => a.quest('pantry').state === 'done',
        pitch: "Gone! Ran off with a sailor. I need three bowls of fisherman's stew by supper. Two grilled fish and a pinch of salt each, cooked over a fire. You can manage that, can't you?",
        active: (q) => `Three bowls of fisherman's stew. You have ${q.progress || 0}. Cook them at any campfire.`, done: "Three bowls of stew, hot.",
      },
    ]));
    opts.push(
      { label: 'Any news?', next: { text: "Boats still go out, but the brigands on Thornwood have the captains spooked. Captain Hale's paying for heads. Gull up at the old lighthouse says some duelist has taken his tower. And the Enclave's crews swear something glows violet under the sluice at their drydock... the Rift's hungry lately.", options: [bye] } },
      bye,
    );
    return { text: 'Welcome to the Salted Anchor! A bed is 10 silver. You\'ll wake up here if the Rift spits you back out.', options: opts };
  },

  ama(api) {
    const opts = questHub(api, [
      {
        id: 'grove_apes', offer: 'What happened to the camp?', title: 'Trouble in the Canopy',
        pitch: "Apes. Grove apes - big as a door and twice as angry. They throw stones from the trees and smash anything that smells of food. Five of them, and they'll learn to keep their distance. Watch for the leap; they come down like a landslide.",
        active: (q) => `Five apes. ${q.progress || 0} so far. They roam the groves west and east of camp.`, done: 'The apes have learned.',
      },
      {
        id: 'mossbound_masks', offer: 'Who are the painted warriors?', title: 'Faces in the Moss', when: (a) => a.quest('grove_apes').state === 'done',
        pitch: "The Mossbound. They lived here long before us and they don't like sharing. Their warriors fight with spears and wind, their shamans with blood. Every mask is a name in their tribe. Take four, and they will think twice about raiding us.",
        active: (q) => `Four masks. You carry ${q.progress || 0}. Mossbound Hollow is north-east of camp.`, done: 'Four masks.',
      },
      {
        id: 'thresher_hunt', offer: 'What is under the eastern jungle?', title: 'The Bone Pit', when: (a) => a.level() >= 12,
        pitch: "Bonegnaw. A thresher - a worm as long as a ship, with a mouth like a well lined with knives. It nests in the Bone Pit to the east. It sinks into the earth, and then it is under you. When the ground trembles, MOVE.",
        active: 'It lurks in the Bone Pit, east of camp. When it vanishes underground, keep moving - it surfaces under you.', done: 'Bonegnaw is dead.',
      },
      {
        id: 'old_king', offer: 'Tell me about the Old King.', title: 'The Old King', when: (a) => a.quest('thresher_hunt').state === 'done',
        pitch: "The Primadon. It held the Verdance together, once - the jungle grew around it like a court around a throne. Since the sky cracked it has gone mad with rage. It waits at Kingsfall, in the north. It roars, it leaps, it throws boulders like pebbles. If you kill it... the jungle may finally rest.",
        accept: 'I will face the Old King.',
        active: 'Kingsfall, north of here. When it roars, you cannot block it. When it leaps, do not be where it lands.', done: 'The Old King has fallen.',
      },
    ]);
    opts.push(...questHub(api, [
      {
        id: 'jade_scales', offer: 'What are those charms you wear?', title: 'Scales of Jade', when: (a) => a.level() >= 10,
        pitch: "Jade scale charms. The Mossbound swear they turn aside snakebite. Bring me six scales and I'll make you one - whether it works is between you and the snakes.",
        active: (q) => `Six jade scales. You have ${q.progress || 0}.`, done: 'Six jade scales.',
      },
    ]));
    opts.push({ label: 'Trade.', do: (a) => a.openShop('ama') }, { label: 'I need a boat.', next: () => DIALOGUES.ferry(api, 'dock_verd') }, bye);
    return { text: 'Welcome to the Verdance. Everything here is either beautiful or trying to eat you. Usually both.', options: opts };
  },

  vorn(api) {
    return {
      text: "Welcome to the Crucible! Five waves, one fighter, no mercy - and no dying, either. Go down in my pit and my healers drag you out before the Rift gets a sniff. Pay the fee, pick your trial, and give the crowd a show.",
      options: [
        { label: 'Enter a trial.', do: () => act('openCrucible') },
        { label: 'Trade Crucible Marks.', do: () => act('openMarkShop') },
        ...questHub(api, [
          {
            id: 'crucible_rookie', offer: 'Got any work for a new fighter?', title: 'Blood on the Sand',
            pitch: "Work? This is the work! Clear the Bronze Trial and I'll put your name on the board - and two marks in your hand.",
            active: 'The Bronze Trial. Five waves of mud and brigands. Off you go.', done: 'The Bronze Trial is cleared.',
          },
          {
            id: 'crucible_champion', offer: 'Has anyone beaten the Champion\'s Trial?', title: 'Champion of the Crucible', when: (a) => a.level() >= 15,
            pitch: "Not in years. Knights of the deep, golems, apes, things from the Rift - all in my pit, all at once. Beat it, and I'll empty my strongbox for you.",
            active: "The Champion's Trial. Power 18 at least. Bring every trick you know.", done: "The Champion's Trial is cleared.",
          },
        ]),
        { label: 'How does this work?', next: { text: "Each trial is five waves. Clear them all and you earn silver and Crucible Marks. Fall, or step out of the ring, and you forfeit - but you keep your life. Harder trials need more Power. Marks buy things you won't find anywhere else.", options: [bye] } },
        bye,
      ],
    };
  },

  corwin(api) {
    return {
      text: "Rings, chains, circlets - little things that make a big difference. A good ring won't stop a sword, but it might make you quick enough that it doesn't need to.",
      options: [
        { label: 'Show me your trinkets.', do: () => act('openJeweler') },
        ...questHub(api, [
          {
            id: 'pearl_diver', offer: 'Any commissions?', title: 'Pearls of the Deep',
            pitch: "A circlet, set with three perfect pearls - and I have none. The sea gives them up to patient anglers, now and then. Bring me three and the circlet is yours.",
            active: (q) => `Three pearls. You have ${q.progress || 0}. Fish from the docks and the quiet shores.`, done: 'Three perfect pearls.',
          },
        ]),
        { label: 'How do trinkets work?', next: { text: "You wear one on your head, one at your neck and one on your finger. Each gives you a little edge. The great beasts of the isles carry some fine pieces too - if you can take them. Press K to see what you're wearing.", options: [bye] } },
        bye,
      ],
    };
  },

  gull(api) {
    const opts = questHub(api, [
      {
        id: 'lighthouse_duel', offer: 'What happened to the lighthouse?', title: 'A Blade at the Lighthouse',
        pitch: "A woman with a rapier and no manners. Sera Vane, she calls herself. Walked up, said the lighthouse had 'good footing', and has been cutting down anyone who climbs the hill since. She doesn't block much. She doesn't need to. Watch for the lunge - she comes in fast and red.",
        accept: "I'll get your lamp back.",
        active: "She's still up there. Parry her - she hates being parried. And when she glows red, don't stand there.",
        done: 'Sera Vane is beaten.',
      },
      {
        id: 'sunken_coins', offer: 'Who are the names on your wall?', title: 'Coins for the Drowned', when: (a) => a.quest('lighthouse_duel').state === 'done',
        pitch: "Every ship lost off Saltreach. When an angler pulls up a coin from a wreck, I send it to the family. Six more would close the list for the Saltmarrow. Fish for them, if you're the patient sort.",
        active: (q) => `Six sunken coins. You have ${q.progress || 0}.`, done: 'Six coins from the wrecks.',
      },
    ]);
    opts.push({ label: 'Who are you?', next: { text: "Gull. I've kept this lamp lit for thirty years. Ships still find Saltreach because of it - the ones that don't find the rocks first.", options: [bye] } }, bye);
    const q = api.quest('lighthouse_duel');
    return { text: q.state === 'done' ? 'The lamp burns again. Every ship that makes harbour tonight owes you, whether they know it or not.' : "Mind the hill. And mind the woman on top of it.", options: opts };
  },


  ferry(api, dockId) {
    return {
      text: "No more passenger runs - every captain for themselves now. Rent a skiff, sloop or longship from the yard and sail it: W and S for throttle, A and D to steer. Friends can board as passengers.",
      options: [
        { label: 'Rent a boat.', do: () => act('openBoatyard', undefined, dockId) },
        bye,
      ],
    };
  },

  oskar(api) {
    return DIALOGUES.ferry(api, 'dock_salt');
  },
  thorn_ferry(api) {
    return DIALOGUES.ferry(api, 'dock_thorn');
  },

  moss(api) {
    const opts = questHub(api, [
      {
        id: 'fen_cull', offer: 'Need a hand?', title: 'Quiet Waters',
        pitch: "Do I ever. Lurkers and scuttlers everywhere - can't cast a line without losing a toe. Kill eight of 'em and I'll pay in fish and silver.",
        active: (q) => `Eight of the beasts, friend. You've got ${q.progress || 0}.`, done: "The fen's quieter now.",
      },
      {
        id: 'witch_hunt', offer: 'Anything else troubling the fen?', title: 'Reeds and Whispers',
        pitch: "Witches. Green-eyed, reed-hooded, mutter in a tongue that makes the water go sour. They throw wind and shadow at you from a distance. Four of them, and I'll give you my old cloak - the marsh never sees you in it.",
        active: (q) => `Four witches. ${q.progress || 0} so far. They roam the east of the fen.`, done: 'The witches are gone.',
      },
      {
        id: 'witch_queen', offer: 'Who leads the witches?', title: 'Mother of Reeds', when: (a) => a.quest('witch_hunt').state === 'done',
        pitch: "Old Mother Reed. Older than the fen, if you believe the stories. She sits in Witchwater on a throne of brambles and calls the witches her daughters. She'll throw every spell they know at you - and call two more daughters when she's hurt. Bring salts for the blindness.",
        active: 'Witchwater, east of here. She dodges like a heron and her bramble-step glows red. Do not stand still.', done: 'Mother Reed is dead.',
      },
      {
        id: 'bog_mother', offer: 'Where do the lurkers come from?', title: 'The Bog Mother',
        pitch: "From her. The Bog Mother. Big as a cart, spits mud in your eyes and her tongue'll reach you from twenty paces. She sits in the middle of the fen. Kill her and the lurkers'll thin out for good.",
        active: 'She wallows in central Shimmerfen. Mind the tongue - you cannot parry it.', done: 'The Bog Mother is dead.',
      },
    ]);
    opts.push({ label: 'Trade.', do: (a) => a.openShop('moss') }, bye);
    return { text: 'Shimmerfen. Pretty at night, deadly all day.', options: opts };
  },

  brynja(api) {
    const opts = questHub(api, [
      {
        id: 'pelts', offer: 'Can I help?', title: 'White Pelts',
        pitch: 'Rimefangs. The pale wolves. Bring me four pelts and I will stitch you a coat that laughs at the cold.',
        active: 'Four pelts. The wolves roam inland, in packs. Watch for the pounce.', done: 'I have your pelts.',
      },
      {
        id: 'white_cult', offer: 'Who are the robed figures on the slopes?', title: 'The White Cult', when: (a) => a.level() >= 6,
        pitch: "The White Cult. They pray to the Warden's ice and throw frost from their hands. Three of my hunters didn't come back last month. Five of them, and you can have the salves I've been saving.",
        active: (q) => `Five cultists. ${q.progress || 0} so far. They gather on the slopes below the White Hollow.`, done: 'The cult is broken.',
      },
      {
        id: 'pale_stalkers', offer: 'Something else is out there, isn\'t it?', title: 'Shadows on the Snow', when: (a) => a.level() >= 8,
        pitch: "Stalkers. Rimefangs that went wrong - dark as a bruise and they leave no tracks. Bring me three of their fangs. I want to see one up close without it being in my throat.",
        active: (q) => `Three fangs. You have ${q.progress || 0}. They hunt the north of the island. Their pounce glows red - dodge it.`, done: 'Three stalker fangs.',
      },
      {
        id: 'lily_harvest', offer: 'What keeps your hunters going?', title: 'Flowers in the Frost',
        pitch: "Frost lily tea. Keeps the mind clear on the long nights. Pick me six lilies from the snowfields and I'll give you the amulet my mother wore.",
        active: (q) => `Six frost lilies. You have ${q.progress || 0}. They glow faintly blue in the snow.`, done: 'Six frost lilies.',
      },
    ]);
    opts.push({ label: 'Trade.', do: (a) => a.openShop('brynja') }, { label: 'I need a boat.', next: () => DIALOGUES.ferry(api, 'dock_frost') }, bye);
    return { text: "Cold enough for you? The Warden's ice spreads further every year. Something up in the White Hollow keeps it alive.", options: opts };
  },

  ignis(api) {
    const opts = questHub(api, [
      {
        id: 'ember_glass', offer: 'What are you studying?', title: 'Samples of the Deep Fire',
        pitch: 'The golems! Their cores produce a glass that records the island\'s instability. Three samples, please - and do try not to get crushed.',
        active: (q) => `Three samples of ember glass. You have ${q.progress || 0}.`, done: 'Your samples.',
      },
      {
        id: 'zealots', offer: 'Are you safe out here?', title: 'Zealots of the Spire', when: (a) => a.level() >= 9,
        pitch: "Safe? There are zealots on the slopes who think the Colossus is a god. Last week they threw my assistant into a lava vent to 'feed' it. Five of them. Please. They cast fire, so bring something that doesn't burn.",
        active: (q) => `Five zealots. ${q.progress || 0} so far. They patrol the high slopes, spears in hand.`, done: 'The zealots are dealt with.',
      },
      {
        id: 'starfall_study', offer: 'Have you seen the falling stars?', title: 'What Falls From the Sky', when: (a) => a.level() >= 6,
        pitch: "Seen them? I've chased them! I think they're pieces of the same fracture that split the sky. Four shards of starmetal and I can prove it. Watch the sky while you travel - and run toward the light, for once.",
        active: (q) => `Four star shards. You have ${q.progress || 0}.`, done: 'Four shards of starmetal.',
      },
    ]);
    opts.push({ label: 'Trade.', do: (a) => a.openShop('ignis') }, { label: 'I need a boat.', next: () => DIALOGUES.ferry(api, 'dock_ash') }, bye);
    return { text: 'Fascinating, isn\'t it? The whole spire is a wound that will not close. The Colossus in the caldera is the heart of it.', options: opts };
  },

  vowkeeper(api) {
    if (api.vow()) {
      const opts = [];
      if (api.level() >= 15) opts.push({ label: 'I hear something beneath my oath.', do: () => act('openResonances') });
      opts.push(bye);
      return { text: api.level() >= 15 ? `You are bound to the ${api.vowName()}. And yet... there is a second voice in you now. A resonance. I can help you hear it.` : `You are bound to the ${api.vowName()}. An oath cannot be unsworn.`, options: opts };
    }
    if (api.level() < 5) return { text: 'You are too unformed to swear anything, tide-born. Return at Power 5.', options: [bye] };
    return {
      text: 'You have climbed far for one so newly drowned. A Vow will define you. It cannot be broken. Choose carefully.',
      options: [{ label: 'Show me the Vows.', do: (a) => a.openVows() }, { label: 'Not yet.' }],
    };
  },

  hollow_man(api) {
    const opts = [{ label: 'Show me your wares.', do: (a) => a.openShop('hollow_man') }];
    opts.push(...questHub(api, [
      {
        id: 'rift_shards', offer: 'Who are you?', title: 'Whispers for Sale',
        pitch: "A man who died here. Then again. Then a hundred more times. Bring me twelve shards of this place and I'll return to you something it took. Something... vital.",
        active: (q) => `Twelve shards. You carry ${q.progress || 0}. Everything down here bleeds them.`, done: 'I have your shards.',
      },
      {
        id: 'into_the_abyss', offer: 'Who brought us all down here?', title: 'The Last Crossing',
        pitch: "Everyone thinks the Hollow Duke on his throne is the bottom of everything. He isn't. There is one who carried us all down here - the Lanternless. He took my name across the dark and never gave it back. He waits by his boat on the north-east lip, at the landing his crossings never reached. If you see a small light in his hand... break it.",
        accept: 'I will find him.',
        active: 'The Landing That Never Came, on the north-east lip past the Garrison Steps. The Lanternless keeps it with his hounds. Bring draughts - the mind frays near him.', done: 'The Lanternless is gone.',
      },
      {
        id: 'drowned_order', offer: 'Who are the knights in the dark?', title: 'The Drowned Order',
        pitch: "The Drowned Order. They swore to hold a keep against the sea, and the sea won, and they kept holding. Bring me five of their crests. I knew some of them, once. I'd like them to rest. And I'll give you a blade that cuts what isn't there.",
        active: (q) => `Five crests. ${q.progress || 0} so far. The knights guard the west of the Rift. They block everything - break their guard.`, done: 'Five crests of the Order.',
      },
      {
        id: 'abyssal_lenses', offer: 'What do the great eyes see?', title: 'Eyes That Watch Back',
        pitch: "Everything that ever fell. Bring me three of their lenses. I would like to see some of it. I'll give you a ring that the whispers cannot find.",
        active: (q) => `Three abyssal lenses. You have ${q.progress || 0}.`, done: 'Three abyssal lenses.',
      },
    ]));
    opts.push({ label: 'Do you have anything... rarer?', next: { text: "A ring of black iron. It weighs nothing, and the whispers can't find you through it. Twenty shards.", options: [{ label: 'Buy the Voidbound Ring. (20 shards)', do: () => act('buyTrinketWithShards', 'void_ring') }, { label: 'Not now.' }] } });
    opts.push({ label: 'How do I leave?', next: { text: 'The pale gates closed long ago. Climb. North through the great gate into the keep, across its gate hall and out the north door. One stone lift still runs up the keep\'s north wall to the summit, and the Wound up there lets the living out. Die here, though, and you are gone for good.', options: [bye] } }, bye);
    return { text: 'Another one. Welcome to the bottom of everything.', options: opts };
  },
};

for (const host of SETTLEMENT_HOSTS) {
  DIALOGUES[host.id] = () => ({
    text: 'The common room is open. Beds are upstairs; a room costs ten silver. Stock up before you take the inland road.',
    options: [
      { label: 'Rent a room. (10 silver)', do: a => a.rest(host.restId, 10) },
      { label: "Open the Keepers' strongbox.", do: () => act('openBank') },
      { label: 'Buy provisions.', do: a => a.openShop(host.shop) },
      bye,
    ],
  });
}
DIALOGUES.meridian_ferry = api => DIALOGUES.ferry(api, 'dock_meridian');
DIALOGUES.meridian_smith = () => ({ text: 'The garrison keeps me busy. Bring damaged steel to the forge; buy what you need before you sail.', options: [{ label: 'Show me your stock.', do: a => a.openShop('torren') }, bye] });
