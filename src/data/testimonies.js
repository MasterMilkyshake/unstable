// Testimony is perspective, not an omniscient replacement for recovered sources.
const bye = { label: 'I will remember that.' };
const topic = (label, text) => ({ label, next: { text, options: [bye] } });

export function worldDialogue(npcId, ch) {
  const read = (id) => (ch.lore || []).includes(id);
  const recorded = (id) => (ch.investigations || []).includes(id);
  const options = [];
  switch (npcId) {
    case 'wren':
      options.push(topic('Why do you keep taking people in?', 'Because someone did it for me. I used to give a longer answer. It made the thing sound more difficult than it is. Put a pot on. Find a blanket. Stay until they stop shaking.'));
      options.push(topic('How do I learn what happened here?', 'Read what people left where they worked. A king can order a history. He has a harder time ordering every repair plate, ration book and letter. Compare them in your Journal [J]. When the pieces fit, record the account there.'));
      if (read('wren_register')) options.push(topic('I read your register.', 'Then you know I do not write down what people ought to be. If a stranger says a name, I use it. Maybe the old one will come back. Maybe the new one will fit better. Either way, they get breakfast.'));
      break;
    case 'maren':
      options.push(topic('Why do you need three different cores?', 'The Warlord carries a stolen command tooth. The Warden holds cold; the Colossus releases heat. Three signatures make a direction. Three pieces from the same source only repeat the same answer. Their service shells can fall, but the passive works must eventually be tended.'));
      options.push(topic('Was Saltreach always a refuge?', 'It began as one. Then it needed lamp oil, walls, ferries, wages. Every exception to the shelter rule arrived wearing a sensible face. I have signed some of those exceptions. A town can become cruel one reasonable decision at a time.'));
      if (read('maren_confession')) options.push(topic('Whose courage are you spending?', 'Yours. You found the letter. My grandmother preserved the refusal; I preserved the excuse for hiding it. I cannot offer you a confession that repairs the coast. I can tell you this: the Duke was the last Anchor, and he chose the crown ships before the people at the gates.'));
      if (recorded('withheld_bell')) options.push(topic('The relief order proves the bell was sealed.', 'Then write both documents together. Put my name beneath the copy I kept hidden. No one should have to take my account on trust after this. The dead deserve more than a new version of the same official story.'));
      if (recorded('common_memory')) options.push(topic('Who will keep the archive now?', 'Bess has asked for a copy. Gull wants one in oilcloth. We will leave room for corrections. Witness — that is what they are calling you. I hope you let the title mean someone who can be questioned. We have had enough names that could not.'));
      break;
    case 'ilvar':
      options.push(topic('Where does magic come from?', 'The world is under pressure. Mana is that pressure in passage; ether is your capacity to shape it. Seven attunements, seven useful approaches, and at least seven ways to injure yourself through impatience. My primer is nearby.'));
      options.push(topic('Can the fracture be healed with a mantra?', 'A mantra can close a wound in a body because a body knows its own shape. The coast has lost pieces of itself. Anyone promising one spell will put everything back should be asked which people they intend to leave out.'));
      break;
    case 'hale':
      options.push(topic('Did you know Kaelen before the raids?', 'He held a ferry against three boarding crews once. Would not step back until the last passenger was ashore. I remember that man. I also read the names of the passengers his crews rob now. I have to answer to them.'));
      if (read('redwake_ledger')) options.push(topic('His crews were never paid.', 'No. The boats were seized against dues the crews could not cover without wages. I argued. Then I stayed in the Watch while he broke the chains. You can decide which of us was right that winter. This winter I still need the ferries to run.'));
      break;
    case 'bess':
      options.push(topic('What do ordinary people believe about the Rift?', 'That it takes too much, and that dinner still needs cooking. You want a theology, ask Ilvar. You want to know who is missing, I can show you which chairs I have not moved.'));
      if (read('bess_book')) options.push(topic('Does Hale know about the soup ledger?', 'Of course. He corrects my spelling. You thought every argument in this town meant we hated one another? Eat something. You have been reading too much on an empty stomach.'));
      break;
    case 'gull':
      options.push(topic('What does the lighthouse protect?', 'A route. People make a great deal of protecting a place. A route is how you reach a place that will take you. Thirty years of oil says that is worth keeping too.'));
      if (read('sera_diary')) options.push(topic('Sera says the footing here is honest.', 'Fine footing. Excellent view. A light that tells a tired captain where the rocks end. She found a place to test herself and forgot it was already doing something for other people.'));
      break;
    case 'moss':
      options.push(topic('Who lived here before the fishing camps?', 'The reed folk, I suppose. Never minded them until the nets came up black and people stopped coming home. You can call me ignorant. It does not put fish on a table.'));
      if (read('reed_testament')) options.push(topic('A warden left clean fish at your landing.', 'That was her? I thought it was bait for a curse. Threw the whole basket back. ...Do not look at me like that. I did not know. If she comes again, I can leave a clean basket. That much I can do.'));
      break;
    case 'brynja':
      options.push(topic('What does the White Cult want?', 'Nothing to change. No rot, no hunger, no loss. Sounds almost kind until you realize the breathing is something they mean to stop as well. I would rather keep mending coats.'));
      if (read('warden_maintenance')) options.push(topic('The Warden needed a relief crew.', 'Twelve tool hooks. I have seen them. Thought they were for offerings. Twelve people with the right tools might have done what armies are now dying to undo. Keep that plate. Someone ought to know how the thing was meant to work.'));
      break;
    case 'ignis':
      options.push(topic('Is the Colossus a god?', 'If it is, its makers fitted a remarkably practical drain valve. There is dignity in a useful machine. We do not improve that dignity by feeding people to it.'));
      if (read('furnace_instructions')) options.push(topic('The overflow galleries buy us time.', 'Yes. Time, precisely. Not a cure, not an endless reprieve. I will copy those instructions. When this is over, someone must come back with shovels, gauges, and a wage for the crew. Put that in your account of the heroism.'));
      break;
    case 'ama':
      options.push(topic('Who can become Mossbound?', 'I thought you had to be born here. Then one of their scouts shouted at me in a dock dialect from my own home. There is more moving between these groves than I understand.'));
      if (read('root_covenant')) options.push(topic('The masks carry their dead.', 'I called them trophies. You are telling me I paid people to steal a burial ground one face at a time. I still need this camp safe. I cannot pretend what you found makes my order clean. Keep their words beside mine.'));
      break;
    case 'vowkeeper':
      options.push(topic('Who first discovered the Vows?', 'People trying not to disappear. We remember nine shapes because enough people survived them to teach another. That is a history of practice, not proof that the world was made with nine empty places waiting for us.'));
      options.push(topic('Why can the Shrine of Order not undo a Vow?', 'It returns the points you invested, the habits you chose to train. A Vow changes who is making the choice. It cannot give you back a self that never made it. Read every gift and restriction before you ask me to witness you.'));
      break;
    case 'hollow_man':
      options.push(topic('How long have you been here?', 'I kept numbers. Then I kept the idea of numbers. If you read my scratches, do not mistake them for a clock. Some days I remembered dying before I remembered waking.'));
      if (read('relief_order')) options.push(topic('The knights were relieved. They never heard it.', 'Then someone tried. A very small comfort. Bring it anyway. We are not rich in comforts here.'));
      if (read('ferryman_manifest')) options.push(topic('There is an erased name in the manifest.', 'Mine? You do not know. Good. Say that. Do not hand me a stranger’s name because you want the story to close. Sit for a moment. We can leave a space without filling it with a lie.'));
      break;
    case 'dorran':
      options.push(topic('Who built the regulators?', 'People who needed tools sharpened. I know that is not the answer you came for. Look at the old plates: service intervals, crew counts, tolerances. Somebody spent a lifetime learning that work, and a king put his face on it.'));
      break;
    case 'ysolde':
      options.push(topic('Do the kindreds keep to themselves?', 'Stand in my shop for an afternoon. Twelve sorts of bodies, a hundred opinions about sleeves, and nobody agrees with their own cousins. You can learn something from a person’s people. You cannot skip meeting the person.'));
      break;
    default:
      return null;
  }
  return { text: 'What would you like to know?', options: [...options, { label: 'That is all.' }] };
}
