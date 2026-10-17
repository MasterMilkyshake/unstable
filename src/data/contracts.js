// The contract boards (docs/agent/WORLD_LIFE_PLAN.md, task 9): work each faction's officer
// posts, three at a time, turned over each in-game day (game/contracts.js). Built on the
// world's own events: an escort is a real convoy, a clearing is a real camp, a recovery is a
// thing set down at a real place. Final world metres (+x west).
//
// kind: escort (see one of the faction's convoys in), clear (kill `count` of `types` within
// `r` of `at`), recover (fetch the `item` set down at `at`), supply (bring `item` x `count`),
// witness (watch one of the Ministry's soundings), war (only while at war with the Enclave:
// break the guard of the Enclave checkpoint `checkpoint`). Field work is paid at the board.
export const CONTRACTS = {
  watch: [
    { id: 'w_escort_north', kind: 'escort', title: 'See the North Watch provisioned', text: 'A cart of bread and lamp oil leaves for the North Watch. Walk with it.', silver: 60, rep: 5 },
    { id: 'w_clear_greywood', kind: 'clear', title: 'Break the Greywood crew', text: 'Redwake hands are camped in Greywood, robbing the track to Hollowbrook.', at: [268, 398], r: 45, types: ['brigand', 'brigand_cutthroat'], count: 2, silver: 70, rep: 6 },
    { id: 'w_clear_cove', kind: 'clear', title: "Clear the smugglers' cove", text: "The cove past the West Downs is a Redwake landing again. Clear it.", at: [404, 166], r: 40, types: ['brigand', 'brigand_cutthroat', 'brigand_brute'], count: 3, silver: 80, rep: 6 },
    { id: 'w_clear_wash', kind: 'clear', title: 'Thin the mudlurkers on the strand', text: 'The lurkers on the Wash are taking the salvagers\' finds, and the salvagers.', at: [30, -384], r: 50, types: ['mudlurker'], count: 3, silver: 35, rep: 3 },
    { id: 'w_supply_bread', kind: 'supply', title: 'Bread for the gate', text: 'The night gate eats more than the stores allow. Bring bread.', item: 'bread', count: 4, silver: 30, rep: 3 },
    { id: 'w_recover_satchel', kind: 'recover', title: "A courier's satchel", text: 'A Watch courier dropped his satchel fleeing the Lamp Bluff. Bring it back.', at: [-150, 175], item: 'courier_satchel', silver: 55, rep: 5 },
    { id: 'w_war_checkpoint', kind: 'war', title: 'Break the Garrison Road checkpoint', text: 'The Enclave stops our people on the road to Rook\'s Landing. Not any more.', checkpoint: 'cp_garrison', silver: 120, rep: 10 },
  ],
  enclave: [
    { id: 'e_escort_docks', kind: 'escort', title: "Guard the harbour's cargo", text: 'Stores come up the Dock Road to the Lower Works. The Redwake know when.', silver: 80, rep: 5 },
    { id: 'e_clear_redwake', kind: 'clear', title: 'Disperse the Red Trail camp', text: 'A Redwake camp sits on the Red Trail below the Hold. Disperse it.', at: [1280, 190], r: 75, types: ['brigand', 'brigand_cutthroat', 'brigand_brute'], count: 3, silver: 90, rep: 6 },
    { id: 'e_clear_owls', kind: 'clear', title: 'An owl on the signal trail', text: 'A gloomowl nests on the Signal Keepers\' Trail and harries the relief.', at: [1377, -659], r: 50, types: ['gloomowl'], count: 1, silver: 60, rep: 4 },
    { id: 'e_supply_iron', kind: 'supply', title: 'Draughts for the garrison', text: 'The fort\'s surgeons are short of iron draughts.', item: 'iron_draught', count: 2, silver: 70, rep: 5 },
    { id: 'e_recover_writ', kind: 'recover', title: 'A lost writ case', text: 'A Peacekeeper lost a writ case at the Crown Drydock\'s edge. The Registry wants it.', at: [1214, -876], item: 'writ_case', silver: 60, rep: 5 },
  ],
  ministry: [
    { id: 'm_recover_line', kind: 'recover', title: 'A sounding line at the Drowned Bell', text: 'A line was cut at the Drowned Bell. Its weight and its knots are records; fetch them.', at: [-1530, 1040], item: 'sounding_line', silver: 70, rep: 6 },
    { id: 'm_clear_riftlings', kind: 'clear', title: 'Quiet the Bell', text: 'Riftlings gather where the bell answers. They spoil the readings.', at: [-1520, 1040], r: 45, types: ['riftling'], count: 3, silver: 90, rep: 6 },
    { id: 'm_clear_hollows', kind: 'clear', title: 'The hollows on the moor', text: 'Hollows walk the moor below the Sounding House. Lay them down.', at: [-1310, 1040], r: 40, types: ['hollow'], count: 2, silver: 80, rep: 5 },
    { id: 'm_supply_salts', kind: 'supply', title: 'Sanity draughts for the listeners', text: 'The listeners at the stones drink them faster than we brew them.', item: 'sanity_draught', count: 2, silver: 60, rep: 5 },
    { id: 'm_witness', kind: 'witness', title: 'Watch a sounding', text: 'Follow a party to a sounding, at a respectful distance, and tell us what you saw.', silver: 50, rep: 6 },
  ],
};

// How many offers a board shows, and how long a day of offers lasts (seconds of play).
export const BOARD = { offers: 3, day: 900, held: 2 };
