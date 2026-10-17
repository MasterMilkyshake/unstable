// The Journal's Guide tab: every first-time tip (data/tips.js) and a short entry for each of the
// game's systems. {action} names a key from BIND (core/input.js); `k` is the action whose key
// the entry's title shows.
import { escapeHtml } from '../core/util.js';
import { keyText, bindLabel } from '../core/input.js';
import { TIPS } from '../data/tips.js';

export const GUIDE = [
  { t: 'Fighting', x: 'Strike with {mouse:LMB}; a string of strikes is a combo. {crit} is your weapon class\'s critical attack, on a cooldown. {mouse:RMB} feints, cancelling a wind-up. Hold {block} to block: blocking fills your posture, and when posture breaks you are stunned. Tap {block} just before a blow lands to parry: it costs nothing and staggers the attacker. Your guard covers 140° in front; blows from the side or behind land, and a blow on the guard\'s rim costs more posture. {dodge} rolls with a moment of invulnerability. Red flashes cannot be parried; orange ones cannot be blocked.' },
  { t: 'More moves', x: 'Hold {mouse:LMB} at the top of a wind-up (up to 0.35 s) to flourish, and let go to strike; a held swing can still be feinted. Attack in a slide to uppercut a light or medium foe into the air, then {jump} within 0.6 s to chase it: two cuts in the air and a closing slam. {block} early in a roll ends it in a parry; the next roll waits a little longer.' },
  { t: 'Weapon handling', x: 'Each weapon\'s card shows how it handles. Reach: how far past the class\'s reach it strikes. Speed: how fast it swings. Chip: the share of its damage that gets through a block. Pierce: the share of armour it ignores. Weight: heavy weapons slow your walk and your roll. Rare and named weapons carry one property of their own.' },
  { t: 'Ailments', x: 'Burn, chill (to a freeze), shock, bleed and blind. A blinded enemy sees only a few metres, cannot parry or block, and swings where it last saw you. {dodge} puts out a fire on you.' },
  { t: 'Great foes', x: 'Twelve great foes keep their arenas. A boss\'s summoning can be interrupted, but it will try again a few seconds later. Slaying a great foe may teach you its Bell.' },
  { t: 'Fighting a group', x: 'Foes fight together. At most two press you at once while the rest circle at the edge and wait their turn, and the second comes in from your side: watch your flank. A badly hurt foe falls back and calls the rest of its side from up to 30 m. Throwers keep their distance and menders stay behind the line; a Bonesetter\'s mending is a long cast, and a blow during it stops it. A Skirmisher waits for you to look away; a Breaker swings through light blows and is never launched; Shellbacks and Cairn Hulks follow patterns you can learn.' },
  { t: 'Talents', k: 'menu', x: 'Each Power brings a talent ({menu}, Talents). Most talents change how something works rather than adding a number. Some rule each other out: a card says what it is "Not with". The Shrine of Order refunds attributes and traits, not talents.' },
  { t: 'Power', k: 'menu', x: 'Experience earns investment points one at a time. Sit at a campfire to invest them ({menu}, Attributes, Confirm): the fifteenth point earned since your last Power raises you to the next, with a full heal, a talent card and a mantra card, which you can choose anywhere ({menu}). Up to Power 20. Sitting by a fire tells you when points wait.' },
  { t: 'Attunements', k: 'menu', x: 'Five attunements give mana a shape: Emberweave (flame), Rimebind (cold), Stormcall (lightning), Galesong (wind) and Umbracast (shadow). Choose one as you create a character: it starts at 10, awakened, and you know its first mantra. Without one, Sage Ilvar in Saltreach awakens mana once you reach Power 2. Invest in attunements like any attribute ({menu}, Attributes); every five points or so opens new mantras.' },
  { t: 'Ledges', x: 'There is no climbing any wall. Jump into an edge 1.2 to 2.3 m above your feet to catch it; from the hang, {jump} leaps about 2.3 m up (hold {forward} to climb onto the top) and can catch the next edge mid-leap. {back} or {dodge} lets go; a blow knocks you off. In the air against a wall with no edge in reach, {jump} hops up it. Catches and hops share a count (3, more with Agility, some talents, the Kithari and Updraft) that landing restores.' },
  { t: 'Carrier lines', x: 'Cable strung where no road climbs, at Hightoll and beyond. {interact} at a line\'s trolley to ride it; some lines start on a station, a timber tower or stage you climb by its stair. A haul line draws you up to a height, and every line sets you down at its far end.' },
  { t: 'Travel by sea', x: 'There is no fast travel. Rent a skiff, sloop or longship at any dock and sail yourself: W and S throttle, A and D steer, Shift for speed, {interact} to step off. Friends can board your boat as passengers.' },
  { t: 'Chests, pouches and the strongbox', x: 'A chest opens to show what is inside: take things one by one or everything at once, and what you leave stays. From your backpack ({backpack}), you can leave anything you carry (not quest items, nor what you wear or wield) in a pouch at your feet; anyone who finds it can take from it, and an empty pouch is gone. Dying on the surface leaves part of what you carry where you fell: half your silver, some of your goods, perhaps a spare weapon or a loose trinket. Every inn\'s host keeps the Keepers\' strongbox, one account for the whole coast, and what is in it is safe when you die.' },
  { t: 'Lives and death', x: 'A surface death drags you into the Rift whole: climb the Ascent home. A death in the Rift ends the character for good. Keepers call lives name-knots; you begin with three, and you spend one only by quitting or reloading while in danger. An Ember of Life restores a lost life, up to your maximum.' },
  { t: 'The Register of the Lost', x: 'When a character dies in the Rift, or spends its last life fleeing danger, it is gone for good. Its name goes into the Register of the Lost (on the main menu) with its Power, cause, playtime, kills, chapters and great foes. It earns Remembrance by how far it got, which the next new character spends at creation: another race reroll, Wren\'s Bundle or a kept Ember. On the wipe screen it may leave one weapon or trinket in the keepsake chest by Wren\'s fire, for the next new character, in any slot, to take once.' },
  { t: 'Save slots', x: 'Three slots, each with its own character, backup and lives. Continue picks up the slot played last; Load lists them all; New asks before it replaces anyone. Settings and the Register of the Lost are shared.' },
  { t: 'Food, water and sanity', x: 'Hunger empties in about half an hour and water sooner; sprinting and climbing burn both faster. Starving slowly costs health. Wells refill waterskins. In the Rift your sanity drains, and with none left your health goes; Calming Draughts and rest help.' },
  { t: 'Rest', x: 'Talk to an innkeeper and pay for a room (10 silver) to set where you wake if you fall. Campfires let you sit, recover faster and cook; sitting by one is where you invest your points.' },
  { t: 'Making camp', x: 'Gather Sticks from fallen branches in the woods ({interact}), or buy Firewood at a general store. Use three Sticks or one Firewood, from your pack or a hotbar key, to lay a campfire just ahead of you; it burns about five minutes. Sit by it to invest your points, and cook there. Not in the Rift, in danger, in water or aboard a boat.' },
  { t: 'Standing', x: 'The Watch, the Enclave and the Ministry each judge you from Hated to Exalted. Strike a guard and you are wanted; pay the fine to that faction\'s officer to clear it. At war, a faction\'s soldiers attack on sight. Trusted opens an officer\'s own stock. Honored brings a faction\'s outfit and trinket, and its checkpoints wave you through. Exalted earns something no one else carries, and a title. Favour with one faction can cool another: the Enclave and the Ministry pull against each other, with the Watch between.' },
  { t: 'Contracts and the hunt', x: 'Each faction\'s officer keeps a board of contracts that turns over every day. Stay wanted too long and hunters come after you; wanted at sea, the Enclave\'s cutters give chase. Columns march the roads between forts, and at low standing a checkpoint will stop you: pay the toll, show your Writ, or fight through.' },
  { t: 'A coast that remembers', x: 'What you answer to the Writ, whether the harbor falls, and what you decide at the Anchor\'s Seat change who patrols the roads, who stops you, and who holds the coast. The map\'s cartouche says who holds it now.' },
  { t: 'Traits', k: 'gear', x: 'Innate talents of body and spirit: Vitality, Erudition, Proficiency and Songchant. You get two points at creation and one more at Power 5, 10, 15 and 20, up to three per trait. Assign them in Gear & Traits {gear}.' },
  { t: 'Trinkets', k: 'gear', x: 'Wear one trinket on your head, one at your neck and one on your finger. Corwin sells them in Saltreach and forges starmetal pieces. Great foes carry unique ones.' },
  { t: 'Vows', x: 'At Power 5 the Vowkeeper on the northern perch of Saltreach lets you swear one of nine oaths. A Vow is permanent and grants unique talents and a mantra.' },
  { t: 'Bells', x: 'Slaying a great foe may teach you its Bell: a rare, powerful mantra that needs no attunement. Bells go into a free hotbar key on their own.' },
  { t: 'Mantra Sparks', x: 'At the Mantra Altar in Saltreach, each Mantra Spark adds a star to a mantra and lets you pick a modifier: Potent, Swift, Thrifty, Far-Reaching, Twin, Lingering or Empowered. Each modifier can be chosen once per mantra, up to three stars.' },
  { t: 'Resonances', k: 'resonance', x: 'Sworn tide-born of Power 15 can hear a second voice. The Vowkeeper attunes you to one Resonance. Each gives a passive and an ability on {resonance}.' },
  { t: 'Shrine of Order', x: 'Kneel at the black cube in Saltreach to refund every attribute and trait point for silver. Talents, mantras and your Vow stay.' },
  { t: 'Foraging & Cooking', x: 'Berry bushes, hives, frost lilies, ember peppers, salt crusts, glowcaps and mendleaf can be gathered ({interact}) and regrow over time. Cook them into meals at any campfire for lasting buffs.' },
  { t: 'Fishing', x: 'Buy a rod from Pell or Moss, then press {interact} at a dock end or a rippling fishing spot. Reel when the marker is in the green. Each region has its own catch, and some catches are rare.' },
  { t: 'Tempering', x: 'Dorran in Saltreach tempers weapons up to +3 with silver, Smithing Stones and Star Shards. Each temper adds 7% damage and 5% posture damage.' },
  { t: 'The Crucible', x: 'Pitmaster Vorn runs a wave arena east of Saltreach. If you fall, the healers bring you back outside. Clear trials for silver and Crucible Marks, then trade the marks for unique prizes.' },
  { t: 'World events', x: 'A Rift Breach may tear open nearby (violet light: clear its guardians for a cache), or a star may fall (harvest the starmetal). Both appear on the surface while you explore.' },
  { t: 'Weather', x: 'Rain and thunderstorms roll over the temperate isles. Frosthollow has snow and blizzards, and ash falls around the Ashen Spire\'s cone. Storms pull the fog in close.' },
  { t: 'The Ascent', x: 'The way out of the Rift is the Ascent under the hanging citadel. Go through the keep\'s gate hall and out its north door: a single stone lift against the keep\'s north wall carries you from the courtyard to the summit, where you step through the Wound to leave the Rift.' },
  { t: 'The Abyss', x: 'Beyond the Rift\'s islands the dark drops away forever. It is not water: fall in and you die. Stay on the rock.' },
  { t: 'The Journal', k: 'journal', x: 'The story, your standing, the chronicle, the Atlas, written sources, investigations, a bestiary of every creature you slay, your records, and this Guide.' },
];

// Systems another session adds can append their own entries.
export function addGuide(entry) {
  if (entry && entry.t && entry.x && !GUIDE.some((g) => g.t === entry.t)) GUIDE.push(entry);
}

const keys = (s) => {
  const text = escapeHtml(keyText(s, (k) => `\u0001${k}\u0002`));
  return text.replace(/\u0001([^\u0002]*)\u0002/g, '<kbd>$1</kbd>').replace(/\{[a-z]+\}/g, '…');
};

export function guideHtml(query = '') {
  const q = query.trim().toLowerCase();
  const hit = (t, x) => !q || t.toLowerCase().includes(q) || keyText(x).toLowerCase().includes(q);
  const entry = (t, x, k) => `<div class="lore-entry"><div class="lt">${escapeHtml(t)}${k ? ` <kbd>${escapeHtml(bindLabel(k))}</kbd>` : ''}</div><div class="lx" style="font-style:normal">${keys(x)}</div></div>`;
  const tips = Object.values(TIPS).filter((t) => hit(t.title, t.guide || t.text)).map((t) => entry(t.title, t.guide || t.text));
  const sys = GUIDE.filter((g) => hit(g.t, g.x)).map((g) => entry(g.t, g.x, g.k));
  return `${tips.length ? `<h3 class="guide-h">First steps</h3>${tips.join('')}` : ''}${sys.length ? `<h3 class="guide-h">The systems</h3>${sys.join('')}` : ''}` || '<div class="muted">Nothing matches.</div>';
}
