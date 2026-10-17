// Dialogue for the main storyline: Maren and Hale in the Lantern City, the Enclave's envoy
// and commander, the Ministry's clerk and minister. Registered into DIALOGUES (data/npcs.js).
// The api comes from ui/interact.js plus game/realm.js (flags, standing, fines, items).
import { DIALOGUES, questOffer, questTurnIn, questHub } from './npcs.js';
import { TIERS } from './factions.js';

const bye = { label: 'Farewell.' };
const topic = (label, text, more = []) => ({ label, next: { text, options: [...more, bye] } });

// Paying off a wanted mark at a faction's officer.
function fineOption(api, f, who) {
  if (!(api.wanted(f) || api.rep(f) <= -50)) return null;
  const cost = api.fine(f);
  return {
    label: `Settle my debt with ${who}. (${cost} silver)`,
    next: () => (api.payFine(f) ? { text: 'Paid. The record is clean, as far as it goes. Do not make me reopen it.', options: [bye] } : { text: 'You do not have the silver. Come back when you do, and keep your hands off your weapon until then.', options: [bye] }),
  };
}

// An officer opens the faction's own stores (data/npcs.js) to the Trusted who are not wanted.
const TRUSTED = TIERS.find((t) => t.name === 'Trusted').min;
function storesOption(api, f, shop) {
  if (api.rep(f) < TRUSTED || api.wanted(f) || api.atWar(f)) return null;
  return { label: 'Show me the stores.', do: (a) => a.openShop(shop) };
}

const LORE_MAREN = [
  topic('What was the Fracture?', 'A night a hundred and thirteen years ago when the coast broke. The regulators under the shelf took more pressure than they were built for, the land went under, and the sky split along the seams. Since then the sea gives some of its dead back. You, for one.'),
  topic('What is the Rift?', 'The place beneath the sea where the break is open. Die out here and you wake there. Those who get out climb the Ascent under its hanging citadel. Die down there and you do not come back at all.'),
  topic('Who rules Saltreach?', 'The Regent, from the Lantern Palace. Saltreach has called its king the Regent since the second year: he holds the lamp in the Anchor\'s name until there is an Anchor worth the name again. The Keepers govern in his name, and I speak for the Keepers.'),
    topic('Who are the Enclave?', 'Ships that left before the coast went under, and the grandchildren of the people on them. They call themselves the Enclave and their soldiers Peacekeepers. A century at sea teaches people a great deal about obedience and very little about neighbors.'),
  topic('Who are the Ministry?', 'Clerks. Very old clerks, in a very foggy place. Once they measured the shelf for the Compact. Now they measure the dead. They know more than I do, and they have never once said so out loud.'),
];

DIALOGUES.maren = (api) => {
  const q = (id) => api.quest(id);
  const fl = q('first_light');
  const writ = q('writ');
  const tooth = q('red_tooth');
  const grey = q('grey_letter');
  const fr = q('fracture');
  const iron = q('iron_tide');
  const bas = q('bastion');
  const sov = q('sovereign');
  const more = { label: 'Tell me about the world.', next: { text: 'Ask, then. I will answer what I can and admit what I cannot.', options: [...LORE_MAREN, bye] } };

  if (fl.state === 'active') return { text: 'Another one from the tide. Sit a moment. You are not the first, and you will not be the last.', options: [more, bye] };
  if (fl.state === 'ready') {
    return {
      text: 'Another one from the tide. Sit, child. Wren sends them all to me eventually. You will not remember your name, and I will not ask for the old one. Saltreach was built by people who washed up exactly as you did. We keep the lamp lit and the gates watched, and we take in whoever the sea gives back.',
      options: [{
        label: 'Something is wrong out there. What is happening?', do: (a) => a.completeQuest('first_light'),
        next: {
          text: 'Several things, and one of them anchored in our harbor at dawn: a black warship flying a chain banner, the first crown colors anyone alive has seen. Its envoy nailed a writ to the Sea Gate before she even asked my name. Captain Hale was on the wall when it came in. Talk to him, read the writ, then hear the envoy out. I would like to know what they want before I answer them.',
          options: [{ label: "I'll find out what they want.", do: (a) => a.startQuest('writ') }, more],
        },
      }],
    };
  }
  if (writ.state === 'active') {
    const hint = ['Hale first. He was on the wall when it anchored, and he will want to say something rude about it.', 'The writ is on the Sea Gate. Read it before you talk to its author.', 'The envoy waits by her pier in the harbor. Captain Crane. Hear her out; you need not agree with her.'][writ.stage || 0] || 'Go on.';
    return { text: hint, options: [more, bye] };
  }
  if (writ.state === 'ready') {
    const papered = api.flag('registryPapers');
    return questTurnIn(api, 'writ', papered
      ? 'You gave them your name. I will not pretend I like it, and I will not hold it against you. A name was given to you once already by a stranger on a beach. Just remember who counts you, and why. There is a man on Thornwood the Enclave wants more than any of us: Kaelen the Red. He carries something that belongs under the sea.'
      : 'You told the crown no on our own docks. Brave, or foolish, or both; Saltreach was founded by people who were all three. Crane will not forget it. Neither will I. Now: the Enclave did not sail a century home for harbor dues. They want something Kaelen the Red carries on Thornwood.');
  }
  if (tooth.state === 'active') return { text: tooth.stage >= 2 ? 'Kaelen holds the back of Brigand Hold, in the Thornwood forest. He carries a fragment of the old command chain. Bring it to me before the Enclave takes it off his body.' : 'Hale will tell you what the Watch knows of Kaelen. Then cross to Thornwood: rent a boat at the harbor and sail west to Rook\'s Landing.', options: [more, bye] };
  if (tooth.state === 'ready') return questTurnIn(api, 'red_tooth', 'So that is the tooth. It is warm. It should not be warm. Before the Fracture there were three regulators answering to the Keep under the sea, and this was torn out of the chain that bound them. Kaelen took it from a harbor vault in the year the ferries were seized. There is a clerk in grey who has been sitting under the Lantern Tree for three days asking for you. I suspect this is why.');
  if (grey.state === 'active') return { text: 'The Ministry of Soundings wants you on the Hush. Go. Listen. Remember that people who measure everything rarely tell you all of what they measured.', options: [more, bye] };
  if (fr.state === 'none' && grey.state === 'done') return { text: 'Grow stronger. The Warden and the Colossus are not Kaelen. When you are ready, come back to me.', options: [more, bye] };
  if (fr.state === 'active') {
    const left = [['frost_warden', 'the Frost Warden in the White Hollow'], ['cinder_colossus', 'the Cinder Colossus in the Caldera'], ['warlord', 'Kaelen on Thornwood']].filter(([b]) => !api.bossDefeated(b)).map(([, t]) => t);
    return { text: left.length ? `Command, cold and heat. Still to silence: ${left.join(', and ')}. Each will be guarding works nobody came back to tend. Bring three cores.` : 'All three guardians are down. Bring me three cores; the fragment counts as one.', options: [more, bye] };
  }
  if (fr.state === 'ready') return questTurnIn(api, 'fracture', 'Command, cold and heat. Lay them side by side and they all lean the same way: down, toward the throne under the sea. The works they ran will need hands now; a guardian can be killed, a furnace still has to be fed. Take this ember. If the Rift takes a life from you, it will give one back.');
  if (iron.state === 'active') {
    if ((iron.stage || 0) <= 1) {
      return {
        text: 'They came for the cores at dawn. Crane, with Peacekeepers behind her, and a writ that says the cores are crown property because the works were crown property. They hold the harbor. I have hidden the cores where even Hale cannot find them, and I will not tell you either, so they cannot take it from you. Rally Hale. Then put the Enclave back on its ships.',
        options: [topic('Will this mean war with the Enclave?', 'It already does. They made that choice on our docks. Their Peacekeepers will treat you as an enemy now, wherever you meet them, papers or no papers.'), more, bye],
      };
    }
    return { text: 'The harbor. Break their hold on it, and the rest of the town will remember it can say no.', options: [more, bye] };
  }
  if (iron.state === 'ready') return questTurnIn(api, 'iron_tide', 'The harbor is ours again, and Crane is on a boat to Meridian with a message for her Grand Warden. Before she went she said something I believe: the Grand Warden means to take the Anchor\'s seat himself. Sit on the throne the Duke still grips, and make the broken chain answer to one will again. That is how the coast was lost the first time. Go to Meridian. Find him.');
  if (bas.state === 'active') return { text: 'Fort Meridian sits on the far side of the western sea. The Enclave keeps its Vice Warden there, its Registry and its iron, and the Grand Warden came ashore there. Sail carefully; their ships watch the channels.', options: [more, bye] };
  if (sov.state === 'active') return { text: sov.stage >= 4 ? 'The Duke is gone? Then the seat is empty. What happens to it is your choice now, not mine. I trust you more than I have trusted anyone in a long time, which is not the same as trusting you completely.' : 'The Grand Warden went down through the Crown Sluice. Follow him into the Rift and stop him before he reaches the throne. And the Duke... he was the last Anchor. Whatever is left of him has been holding that chain for a hundred and thirteen years.', options: [more, bye] };
  if (sov.state === 'ready') {
    const e = api.ending;
    const reply = e === 'break' ? 'You broke it. No throne, no Anchor, no one to blame and no one to obey. Just the works, and all of us. Gods help us. I have never been prouder of anyone.'
      : e === 'seal' ? 'The Ministry\'s answer. Fewer will come back now. Fewer will drown twice, either. Quill will write it down exactly, and I will spend the rest of my life wondering whose name did not come home.'
        : e === 'claim' ? 'You sat. You are holding it now: I can see it in your shoulders. The Enclave will kneel to you, or pretend to. I will not. I will keep the lamp lit and watch the gates, as we always have, and one day I will be the one who tells some half-drowned child what you were.'
          : 'You have come back from the bottom of everything. Sit. Tell me all of it.';
    return questTurnIn(api, 'sovereign', `${reply} The tide is quieter. Whatever comes now, the isles will remember who stood at that throne.`);
  }
  return { text: 'The isles are quieter thanks to you. Never stable. Quieter. Go, live, keep your blade close, and come back for supper now and then.', options: [more, bye] };
};

DIALOGUES.hale = (api) => {
  const writ = api.quest('writ');
  const tooth = api.quest('red_tooth');
  const iron = api.quest('iron_tide');
  const opts = [];
  const fine = fineOption(api, 'watch', 'the Watch');
  if (fine) opts.push(fine);
  const stores = storesOption(api, 'watch', 'watch_stores');
  if (stores) opts.push(stores);
  opts.push(...questHub(api, [
    { id: 'bounty', offer: 'Any work for a blade?', title: 'Red Bandanas', pitch: 'The brigands on Thornwood, red bandanas, raid our ferries. Thin them out. Six should send a message.', active: (q) => `Six brigands. You've put down ${q.progress || 0}.`, done: 'The brigands are thinned.' },
    { id: 'warlord', offer: 'Tell me about Kaelen.', title: 'The Red Warlord', when: (a) => a.quest('bounty').state === 'done', pitch: 'Kaelen the Red holds the back of Brigand Hold. A monster with that axe, and he leaps. Kill him and the rest will scatter. I\'ll outfit you in Watch plate if you do.', active: 'Back of the hold, on Thornwood. He leaps.', done: 'Kaelen is dead.' },
  ]));
  // the Watch's own path is a chain of its own, offered beside the brigand work rather than after it
  opts.push(...questHub(api, [
    { id: 'watch_lamp', offer: 'The Watch looks stretched.', title: 'Lamp and Gate', when: (a) => a.quest('writ').state === 'done', pitch: 'Stretched thin as old rope. Lurkers and scuttlers creep up the coast road every night. Eight of them, and you\'ll have the Watch\'s thanks and my silver.', active: (q) => `Eight creatures. ${q.progress || 0} so far.`, done: 'The coast road is clear.' },
    { id: 'watch_scraps', offer: 'How can I hurt the Enclave?', title: 'Proof of Passage', when: (a) => a.atWar('enclave'), pitch: 'Every Peacekeeper carries a scrap of the writ that sent them, stamped with their ship. Bring me five. I want to know how many ships, and which.', active: (q) => `Five writ scraps. You have ${q.progress || 0}.`, done: 'Five writ scraps.' },
  ]));
  opts.push(topic('What does the Watch actually do?', 'Keeps the gates. Runs the ferry patrols. Puts out fires, breaks up fights, fishes drunks out of the harbor. Hits anyone who hits us first. We do not hit you unless you start it, and if you do, you\'ll find there are a lot of us.'), bye);
  if (writ.state === 'active' && (writ.stage || 0) <= 1) {
    return { text: 'Crown colors. Black hull, chain on the banner. Haven\'t seen the like in my lifetime; my grandmother swore the crown ships went down with the coast. The envoy came ashore with ten Peacekeepers and a hammer. Read what she nailed to my gate. Then hear what she has to say, if you can stomach it. I couldn\'t.', options: opts };
  }
  if (tooth.state === 'active' && (tooth.stage || 0) <= 1) {
    return { text: 'Kaelen. I knew him before the raids: he held a ferry against three boarding crews once and would not step back until the last passenger was ashore. Then the harbor seized the ferries, the crews went unpaid, and they became the Redwake. Whatever he carries, he took it the winter they broke the chains. He keeps the back of Brigand Hold on Thornwood. Rent a boat at the harbor; Rook\'s Landing is the pier on Thornwood\'s coast.', options: opts };
  }
  if (iron.state === 'active' && (iron.stage || 0) === 2) {
    return { text: 'Peacekeepers on our docks, halberds at our own gate, and I\'ve got half a watch and a wet harbor. You lead, I\'ll hold the streets behind you. Break their line at the harbor, eight of them down, and Crane will have to choose between her ship and her pride.', options: opts };
  }
  return { text: api.atWar('enclave') ? 'Keep your guard up near the water. The Enclave has ships, and we have a lamp. I like our odds better than I should.' : 'Practice on the dummies if you like. A good parry is worth ten swings.', options: opts };
};

DIALOGUES.envoy_crane = (api) => {
  const writ = api.quest('writ');
  const lore = [
    topic('Who is the Grand Warden?', 'Aurek Vell, Grand Warden of the Enclave, heir of the Anchor\'s line. He was born at sea, like his father and his father\'s father. He has never set foot on land that his family once ruled, and he intends to. The Warden keeps the fleet at sea in his name; the Vice Warden holds Fort Meridian.'),
    topic('Why "Warden"?', 'The regulators had Wardens before the Anchorage had kings. The one in the White Hollow still keeps the cold. We took the old titles because we mean to keep the old works, tide-born. Somebody must.'),
    topic('Why have you come back now?', 'Because the coast is failing, envoy to envoy. The regulators are dying without tending, the deeps run colder, the tide gives back more of its dead every year. Someone must hold the chain again. It may as well be the family that held it before.'),
    topic('What is the Registry?', 'A count of the returned. Name, kindred, where the sea gave them back. The Enclave protects what it has counted. Out here, in the gaps between your towns, that is worth more than you think.'),
  ];
  if (api.flag('harbor_occupied') && !api.flag('harbor_freed')) return { text: 'Saltreach chose. So have you, I see. The cores are crown property; the works were crown works. I am only collecting what was always ours.', options: [...lore, bye] };
  if (writ.state === 'active' && (writ.stage || 0) === 2 && !api.flag('writ_answered')) {
    return {
      text: 'You are tide-born. I can always tell: you look at the sea as if it owes you something. I am Captain Thessaly Crane, envoy of the Enclave. The Grand Warden has come home to the Anchorage, and he will protect every soul in it who is counted. I can enter your name today. Or you can stay uncounted, and belong to no one, and see how long that lasts out there.',
      options: [
        ...lore,
        { label: 'Enter my name in the Registry.', do: (a) => { a.setFlag('registryPapers'); a.giveItem('registry_papers', 1); a.addRep('enclave', 15); a.addRep('watch', -5); a.setFlag('writ_answered'); }, next: { text: 'Done. Keep the papers dry. Peacekeepers will let you pass; the Chain Citadel will open to you. Welcome to the count.', options: [bye] } },
        { label: 'No one counts my name but me.', do: (a) => { a.setFlag('writ_refused'); a.addRep('enclave', -10); a.addRep('watch', 5); a.setFlag('writ_answered'); }, next: { text: 'Then you are no one\'s. I hope the sea is kinder to no one than I expect it will be.', options: [bye] } },
      ],
    };
  }
  if (!writ.state || writ.state === 'none') return { text: 'The writ is on the Sea Gate. Read it. Then we can talk.', options: [bye] };
  if (api.flag('registryPapers')) return { text: 'Your papers are in order. If you are ever on Meridian, Commander Rell will have work for counted folk.', options: [...lore, bye] };
  return { text: 'The offer stands until it doesn\'t. Commander Rell keeps the Registry on Meridian, if you change your mind.', options: [...lore, bye] };
};

DIALOGUES.grey_clerk = (api) => {
  const g = api.quest('grey_letter');
  const lore = [
    topic('What is the Ministry of Soundings?', 'The office that measured the shelf for the old Compact: how deep, how fast it moved, how much pressure the regulators held. After the Fracture we kept measuring. Now we mostly measure the passage. You came through it.'),
    topic('Why were you waiting for me?', 'The bell in the Hush rang when Kaelen\'s fragment changed hands. It has not rung for anyone in twenty years. The Minister would like to know who rang it.'),
  ];
  if (g.state === 'active' && (g.stage || 0) <= 1) {
    if (!api.flag('grey_letter_given')) api.setFlag('grey_letter_given');
    if (!api.hasItem('grey_letter')) api.giveItem('grey_letter', 1);
    return { text: 'There you are. Three days I have been sitting under this tree, and the pigeons have learned my name, which is more than most people bother with. This is for you. Grey wax, no crest. The Minister of Soundings asks you to come to the Hush. Rent a boat at the harbor and sail north-east into the fog; Hush Landing lies on Frosthollow\'s southern shore.', options: [...lore, bye] };
  }
  if (!g.state || g.state === 'none') return { text: 'Not yet. When you are ready to listen, so are we.', options: [...lore, bye] };
  return { text: 'The Minister speaks well of you, which is to say she has written your name down twice.', options: [...lore, bye] };
};

DIALOGUES.minister_quill = (api) => {
  const g = api.quest('grey_letter');
  const opts = [];
  const fine = fineOption(api, 'ministry', 'the Ministry');
  if (fine) opts.push(fine);
  const stores = storesOption(api, 'ministry', 'ministry_stores');
  if (stores) opts.push(stores);
  if (g.state === 'done') {
    opts.push(...questHub(api, [
      { id: 'ministry_soundings', offer: 'Is there work for me?', title: 'Soundings', pitch: 'Always. The passage runs closest under the sea at three deeps: the Gallows Channel, the Redwake Strait and the Pale Sound. Sail out over each and the instrument in your pack will do the rest. Do not swim.', active: 'Three deeps: the Gallows Channel, the Redwake Strait, the Pale Sound. Over them, not in them.', done: 'The soundings are taken.' },
      { id: 'ministry_bell', offer: 'Something else troubles you.', title: 'The Drowned Bell', when: (a) => a.quest('ministry_soundings').state === 'done', pitch: 'The relief bell on our far shore has started ringing on its own, and riftlings come ashore when it does. Go and see. Kill what comes out of the surf.', active: 'The Drowned Bell, on the Hush\'s far shore. Riftlings gather when it rings.', done: 'The bell is quiet.' },
    ]));
  }
  opts.push(
    topic('Why seal the passage?', 'Because it is a wound and wounds should close. Every year the returns rise and the memory that returns with them falls. One day the sea will give back bodies with nothing in them at all. We would rather it gave back no one.'),
    topic('What do you know of the Enclave?', 'That their ships left harbor the night the Anchor withheld the release, and that the release was withheld so their ships could leave. They are the reason the coast drowned and the only people alive who still believe that was correct.'),
    bye,
  );
  if (g.state === 'active' && (g.stage || 0) >= 4) {
    api.setFlag('ministry_guest');
    return {
      text: 'Sit. You rang our bell when Kaelen\'s fragment came into your hands. That fragment is a tooth of the command chain: the thing that let one throne beneath the sea give orders to the regulators. The Grand Warden of the Enclave means to sit on that throne. If he does, the regulators will answer to one will again, and the last time they did, the coast sank. The Ministry has a different answer. We would close the passage entirely. Read our soundings in the Quiet Archive; you are our guest, the clerks will let you in. Then decide whether you think we are right.',
      options: opts,
    };
  }
  if (g.state === 'ready') return questTurnIn(api, 'grey_letter', 'Now you have read what we measured. You need not agree with our recommendation. The Ministry has disagreed with itself about it for a hundred years. But you know why everyone wants what you carry. Gather the other two signatures; the Warden and the Colossus hold them. When it comes to the throne, remember us.');
  return { text: 'Welcome to the Hush. Mind the fog; it is honest, which is more than can be said for most weather.', options: opts };
};

DIALOGUES.meridian_captain = (api) => {
  const opts = [];
  if (api.atWar('enclave')) return { text: 'We are at war, tide-born, and you are on my island. I will not cut down anyone in my own ward who is not drawing steel. Leave before someone with less patience than me sees you.', options: [bye] };
  const fine = fineOption(api, 'enclave', 'the Enclave');
  if (fine) opts.push(fine);
  const stores = storesOption(api, 'enclave', 'enclave_stores');
  if (stores) opts.push(stores);
  if (!api.flag('registryPapers')) {
    opts.push({ label: 'Enter my name in the Registry.', do: (a) => { a.setFlag('registryPapers'); a.giveItem('registry_papers', 1); a.addRep('enclave', 10); a.addRep('watch', -5); }, next: { text: 'Done. Papers. Keep them dry. You may walk the Ward and the fort; the Citadel opens to the counted.', options: [bye] } });
  } else {
    opts.push(...questHub(api, [
      { id: 'enclave_pirates', offer: 'Do you have work?', title: 'Pirate Hunter', pitch: 'The Redwake raid the Thornwood coast. Eight of them, and the Enclave pays well and remembers longer. Saltreach will call it the second seizure. Saltreach calls a great many things by unkind names.', active: (q) => `Eight brigands. ${q.progress || 0} so far.`, done: 'Eight Redwake down.' },
    ]));
  }
  opts.push(
    topic('What does the Enclave want?', 'Order. A coast that answers when it is called. The regulators are dying, tide-born. Someone has to hold the chain, and we are the only ones who remember how.'),
    topic('What is the Chain Citadel?', 'The Vice Warden\'s seat, and the Grand Warden\'s when he is ashore. Counted folk may enter. The uncounted will be asked to leave, once.'),
    bye,
  );
  return { text: api.flag('registryPapers') ? 'Papers in order. Good. What do you need?' : 'Unregistered. The Registry is right behind me. It costs nothing but your name.', options: opts };
};
