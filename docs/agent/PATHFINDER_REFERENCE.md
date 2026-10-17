# Deepwoken Pathfinder reference

Pathfinder is a quality benchmark for feel, risk and depth. It is not a feature list to copy. Unstable keeps its own systems, and **the user decides which reference mechanics belong in the game**.

## Rejected for Unstable

| Mechanic | Decision |
| --- | --- |
| Vent | rejected by the user 2026-10-15; built and fully removed |
| Tempo | rejected by the user 2026-10-15 ("excess junk") |
| Mana charging on G | removed at the user's request; mantras cost ether only, G is unbound |

## Accepted for Unstable

What the user approved from the reference, as Unstable built it (its own numbers, names and rules; see ARCHITECTURE_DECISIONS.md for each system's ADR).

| Mechanic | Unstable's version | Where | Approved |
| --- | --- | --- | --- |
| Flourish (delayed M1) | Hold LMB as an M1 starts to hold it at the top of its wind-up, up to 0.35 s; it can still be feinted. A foe that has seen flourishes may wait for the top and parry the hold; humanoid foes flourish too | combat/rules.js `COMBAT.flourish`, actor.js `updateAttack`, enemy.js `react` | 2026-10-16 |
| Uppercut and air chase | LMB in a slide: a rising strike that launches light and medium foes (never bosses or large creatures), who cannot defend until they land. Space within 0.6 s leaps after them; two air cuts and a slam that drives them down | player.js `startUppercut`, `startChase`, `startAirString`; rules.js `canLaunch` | 2026-10-16 |
| Roll-cancel | F in the first 60% of a roll ends it for a block or parry at once; the next roll waits 0.6 s longer | player.js `rollCancel` | 2026-10-16 |
| Directional block | Block and parry cover 140° in front; the rim costs 1.3× posture; a guard turns at most 4.2 rad/s, so flanks work, for enemies too | rules.js `COMBAT.guard`, `guardCovers` | 2026-10-16 |
| Blind affects enemies | 3 m perception, no parry, block or dodge reaction, no tracking mid-swing, swings at the last place seen; half as long on bosses | actor.js, enemy.js | 2026-10-16 |
| Power gated by investment | XP earns points one at a time (15 per Power, today's curve); investing the 15th point earned since the last Power raises it. Creation and Shrine refunds don't count | player.js `invest`, `powerUp`; stats.js `totalPoints` | 2026-10-16 |
| Weapon identity and traits | Each weapon's own reach, speed, posture, chip, pierce and weight; one trait on every rare or named weapon | data/weapons.js, combat/weaponTraits.js | standing direction (2026-10-16) |
| Talents that change play | 45 number talents reworked into behaviours, with exclusions | data/talents.js | standing direction |
| Group AI | Turns (at most two press), flanks, falling back and calling for help, ranged and support foes behind the line; six new archetypes | entities/tactics.js, data/enemies.js | standing direction |

## Facts gathered (unverified against the live game)

Fandom pages return HTTP 402 to fetches, so these come from search snippets and are recorded only for context.

- Tempo: a bar with a base of 120 that raises ether regeneration in combat and pays for Vent. ([Combat Mechanics](https://deepwoken.fandom.com/wiki/Combat_Mechanics))
- Vent: costs 40 Tempo, knocks nearby enemies back with minor damage, and can be parried, blocked or rolled. ([Talents](https://deepwoken.fandom.com/wiki/Talents), [Controls](https://deepwoken.fandom.com/wiki/Controls))
- Posture: once the bar is full, the next blocked hit guard-breaks. Shaky block frames show the posture bar red. Parry and block cooldowns appear as HUD icons.
- Progression: 15 investment points per Power, max Power 20. Power is gated by investment, not by XP alone.

**Not verified at all:** the exact parry window, the missed-parry cooldown (a 1.2 s figure circulates), successful-parry protection (0.45 s) and dodge i-frames. Unstable's values are its own tuning (combat/rules.js) and must not be presented as Pathfinder numbers.
