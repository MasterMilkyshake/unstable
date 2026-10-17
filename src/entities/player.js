// The player character: controller, combat inputs, survival stats and progression.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Actor, SWIM_Y, GRAVITY } from './actor.js';
import { HumanoidRig } from './rig.js';
import { STANCE_FOR_CLASS } from './anims.js';
import { RACE_BY_ID } from '../data/races.js';
import { TALENTS } from '../data/talents.js';
import { VOWS } from '../data/vows.js';
import { MANTRAS } from '../data/mantras.js';
import { makeCamp } from '../game/camp.js';
import { WEAPONS, WEAPON_CLASSES, RUNNING_ATTACK, AERIAL_ATTACK, ENCHANTS, weaponFeel, weightEffects } from '../data/weapons.js';
import { wieldedTrait, traitSwingMul, traitAfterHit, traitStruck } from '../combat/weaponTraits.js';
import { OUTFITS, ITEMS } from '../data/items.js';
import { computeDerived, sumMods, weaponScaling, meetsReqs, xpForLevel, MAX_LEVEL, POINTS_PER_LEVEL, ATTUNE_ATTRS, RESIST_ELEMENTS } from '../data/stats.js';
import { makeCastDef } from '../combat/mantraRuntime.js';
import { collectMods, ACTIONS } from '../game/hooks.js';
import { applyHit, areaHit, actorsNear, hostile } from '../combat/combat.js';
import { INPUT_BUFFER, COMBAT } from '../combat/rules.js';
import { clamp, damp, dampAngle, forwardFromYaw, angleDiff, chance, angleWrap, hypot } from '../core/util.js';

const _v = new THREE.Vector3();
const _move = new THREE.Vector3();

// Climbing is by ledges, Deepwoken's way: in the air, moving into a wall whose top edge comes
// within reach, the hands catch it and hang. From the hang, jump leaps up (holding forward carries
// you onto the top), and back or dodge lets go. In the air against a wall with no edge in reach,
// jump hops up it. Catches and hops share derived.latches, which landing restores.
const LATCH_LO = 1.2; // a top lower than this above the feet is jumped or stepped onto
const LATCH_HI = 2.3; // the hands' reach above the feet
const HANG = 1.95; // the feet hang this far below the edge
const COYOTE = 0.12; // a jump pressed this soon after the feet left an edge (a tread, a kerb) still jumps
const JUMP_BUFFER = 0.12; // a jump pressed this soon before landing jumps on touching down
const GRAB_INTO = 0.5; // the hands catch an edge only when the input pushes into its wall (within 60 degrees)

export class Player extends Actor {
  constructor(ch) {
    super({ team: 'player', name: ch.name, radius: 0.42, height: 1.8 });
    this.ch = ch;
    this.race = RACE_BY_ID[ch.race];
    const look = Object.assign({}, ch.look, {
      features: this.race.features,
      outfit: (OUTFITS[ch.equipped.outfit] || OUTFITS.rags).colors,
      scale: (this.race.scale || 1) * (ch.look.height || 1),
    });
    this.attachModel(new HumanoidRig(look));
    // lent by the world, which keeps the scene's light count fixed (see World.lendLight)
    this.rimLight = G.world.lendLight(this.model.root, new THREE.Vector3(-0.55, 1.55, 0.75), '#9cb4e8', 11, 1.6);
    this.fillLight = G.world.lendLight(this.model.root, new THREE.Vector3(0.45, 1.15, -0.65), '#e8c8a0', 8, 1.8);
    this.height = 1.8 * look.scale;
    this.trail = G.vfx.newTrail('#ffffff');
    this.combo = 0;
    this.comboTimer = 0;
    this.comboChain = 0;
    this.queued = false;
    this.critCd = 0;
    this.feintCd = 0;
    this.dodgeCd = 0;
    this.dodgeT = 0;
    this.dodgeDir = new THREE.Vector3();
    this.dodgeEvaded = false;
    this.slideT = 0;
    this.climbing = false; // hanging from a ledge (the LAN flag and the rig's climb pose)
    this.latches = 0; // ledges caught and wall hops since the feet last touched ground
    this.latchCd = 0; // after letting go, a moment before the hands catch again
    this.hangY = 0; // the edge's height while hanging
    this.charging = false; // mana charging is gone; kept false for the LAN pose flag and the rig
    // keys pressed a moment before they can act still fire (combat/rules.js INPUT_BUFFER)
    this.buf = { dodge: 0, crit: 0, chase: 0, jump: 0 };
    this.coyoteT = 0; // seconds a ground jump stays open after the feet left the ground
    this.lmbPress = 0; // counts LMB presses: a swing holds (flourish) only on the press that started it
    this.chaseWin = 0; // after an uppercut lands: seconds left to leap after the foe
    this.chaseTarget = null;
    this.chase = null; // { target, t, rise, hits } while chasing a launched foe
    this.dangerT = 0;
    this.cooldowns = {};
    this.selected = 0;
    this.knockedT = 0;
    this.gripT = 0;
    this.gripTarget = null;
    this.eatT = 0;
    this.sitting = false;
    this.jumps = 0;
    this.airDodges = 0;
    this.secondWindT = 0;
    this.undyingT = 0;
    this.unbrokenT = 0;
    this.mayhem = 0;
    this.mayhemT = 0;
    this.riposteT = 0;
    this.fallStart = 0;
    this.boat = null;
    this.stepT = 0;
    this.sanityTick = 0;
    this.lowHpBeat = 0;
    this.speed = 0;
    this.mods = {};
    this.ensureProgress();
    if (ch.level < MAX_LEVEL) this.earnPoints(true); // a save from before the gate: its due points
    this.equipOutfit(ch.equipped.outfit || 'rags', true);
    this.refreshWeapon();
    this.recompute();
    this.hp = ch.hp > 0 ? Math.min(ch.hp, this.maxHp) : this.maxHp;
  }

  // ------------------------------------------------------------ stats
  get attrs() {
    return this.ch.attrs;
  }
  get level() {
    return this.ch.level;
  }
  set level(v) {}

  recompute() {
    const ch = this.ch;
    const talentMods = [];
    const flags = {};
    for (const id of ch.talents) {
      const t = TALENTS[id];
      if (!t) continue;
      if (t.mods) talentMods.push(t.mods);
      for (const f of t.flags || []) flags[f] = true;
    }
    const outfit = OUTFITS[ch.equipped.outfit] || OUTFITS.rags;
    const w = this.weaponItemDef();
    const enchantMods = {};
    const en = this.weaponEnchant();
    if (en && ENCHANTS[en]) {
      if (ENCHANTS[en].lifesteal) enchantMods.lifesteal = ENCHANTS[en].lifesteal;
      if (ENCHANTS[en].dmg) enchantMods.physDmg = ENCHANTS[en].dmg;
    }
    const mods = sumMods([this.race.mods, ...talentMods, outfit.mods, this.buffMods(), enchantMods, ...collectMods(this)]);
    Object.assign(mods, flags);
    if (w && WEAPON_CLASSES[w.cls] && WEAPON_CLASSES[w.cls].type === 'medium' && mods.mediumDmg) mods.physDmg = (mods.physDmg || 0) + mods.mediumDmg;
    this.mods = mods;
    const d = (this.derived = computeDerived(ch.attrs, ch.level, mods, this.race.scale || 1));
    const hpFrac = this.maxHp ? this.hp / this.maxHp : 1;
    this.maxHp = d.maxHp;
    this.hp = Math.min(this.maxHp, Math.max(1, hpFrac * this.maxHp));
    this.maxPosture = d.maxPosture + (mods.maxPosture || 0) * 0;
    this.maxEther = d.maxEther;
    this.maxSanity = d.maxSanity;
    ch.ether = Math.min(ch.ether ?? this.maxEther, this.maxEther);
    ch.sanity = Math.min(ch.sanity ?? this.maxSanity, this.maxSanity);
    this.resist = { phys: Math.min(0.75, outfit.armor + d.physResist + (mods.physResist ? 0 : 0)) };
    for (const el of RESIST_ELEMENTS) this.resist[el] = (outfit.resist[el] || 0) + (mods['resist_' + el] || 0);
    this.armorBuff = 0;
    // a heavy weapon slows the walk and the roll (data/weapons.js WEIGHT); lowered hands carry it all the same
    const wt = weightEffects(weaponFeel(w).weight);
    if (mods.titanGrip) {
      wt.roll = 1; // Titan Grip: no weapon's weight slows the roll
      wt.rollCd = 0;
    }
    this.weightFx = wt;
    d.dodgeCd += wt.rollCd;
    this.speedBase = 5.8 * d.moveMul * wt.move;
  }

  onBuffsChanged() {
    this.recompute();
  }

  get ether() {
    return this.ch.ether;
  }
  set ether(v) {
    this.ch.ether = clamp(v, 0, this.maxEther);
  }
  get sanity() {
    return this.ch.sanity;
  }
  addSanity(v) {
    this.ch.sanity = clamp(this.ch.sanity + (v < 0 ? v * this.derived.sanityDrain : v), 0, this.maxSanity);
  }

  heal(amount) {
    if (this.dead || this.knocked) return;
    const a = amount * this.derived.healMul;
    this.hp = Math.min(this.maxHp, this.hp + a);
    if (a > 2) G.vfx.number(this.center(_v), '+' + Math.round(a), 'heal');
  }

  // ------------------------------------------------------------ equipment
  weaponItem() {
    const uidv = this.ch.equipped.weapon;
    if (!uidv) return null;
    return this.ch.inventory.weapons.find((w) => w.uid === uidv) || null;
  }
  weaponItemDef() {
    const it = this.weaponItem();
    return it ? WEAPONS[it.id] : WEAPONS.fists;
  }
  weaponEnchant() {
    const it = this.weaponItem();
    if (!it) return null;
    return it.enchant || WEAPONS[it.id].enchant || null;
  }
  weaponClass() {
    return WEAPON_CLASSES[this.weaponItemDef().cls];
  }
  // Hands are down until the weapon slot raises them: a new character washes up with its
  // fists lowered and cannot swing, block, parry or grip until [1] raises them. Saves from
  // before the slot could be lowered have no flag and stay armed.
  get armed() {
    return this.ch.armed !== false;
  }
  setArmed(on) {
    if (on === this.armed || this.atk || this.dead || this.knocked) return false;
    this.ch.armed = on;
    if (!on) {
      this.blocking = false;
      this.parryT = 0;
      this.queued = false;
      this.actBuf = 0;
    }
    this.combo = 0;
    this.refreshWeapon();
    G.audio.play('ui', { pitch: on ? 1.25 : 0.85, vol: 0.5 });
    G.ui.toast(on ? `You raise your ${this.weaponItem() ? this.weaponItemDef().name : 'fists'}.` : `You lower your ${this.weaponItem() ? this.weaponItemDef().name : 'fists'}.`);
    return true;
  }
  // Said once in a while when a fighting key is pressed with the hands down.
  handsDown() {
    const now = performance.now();
    if (now - (this._handsDownT || 0) < 2500) return;
    this._handsDownT = now;
    G.ui.toast(`Your hands are down. Press [1] to raise your ${this.weaponItem() ? this.weaponItemDef().name : 'fists'}.`);
  }
  refreshWeapon() {
    const def = this.weaponItemDef();
    const en = this.weaponEnchant();
    this.trailTint = en && ENCHANTS[en] ? ENCHANTS[en].color : null;
    this.model.setWeapon(this.armed ? def : null, this.weaponEnchant());
    this.model.anim.setStance(STANCE_FOR_CLASS[def.cls] || 'oneHand');
  }
  equipWeapon(uidv) {
    if (uidv) {
      const it = this.ch.inventory.weapons.find((w) => w.uid === uidv);
      if (!it) return false;
      const def = WEAPONS[it.id];
      if (!meetsReqs(def.reqs, this.ch.attrs)) {
        G.ui.toast('You lack the attributes to wield this.', 'bad');
        return false;
      }
    }
    this.ch.equipped.weapon = uidv;
    if (uidv) this.ch.armed = true; // equipping a blade is reaching for it
    this.refreshWeapon();
    this.recompute();
    this.combo = 0;
    return true;
  }
  equipOutfit(id, silent = false) {
    const o = OUTFITS[id];
    if (!o) return false;
    if (!silent && !meetsReqs(o.reqs, this.ch.attrs)) {
      G.ui.toast('You lack the attributes to wear this.', 'bad');
      return false;
    }
    this.ch.equipped.outfit = id;
    const m = this.model.mats;
    m.main.color.set(o.colors.main);
    m.trim.color.set(o.colors.trim);
    m.pants.color.set(o.colors.pants);
    m.boots.color.set(o.colors.boots);
    if (!silent) this.recompute();
    return true;
  }

  // ------------------------------------------------------------ progression
  // Power is gated by investment, as in Pathfinder. XP earns investment points one at a time,
  // POINTS_PER_LEVEL per Power along xpForLevel, and Power rises when the last point earned since
  // the last Power is invested (invest). Points from creation and from the Shrine of Order's refund
  // are spent first and never count toward a Power. XP past a full bar is banked, up to one more
  // Power's worth, and flows on once the Power rises.
  //   ch.earned   points earned toward the next Power (0..POINTS_PER_LEVEL)
  //   ch.invested of those, how many have been invested
  //   ch.xpBank   XP waiting for the next Power
  ensureProgress() {
    const ch = this.ch;
    const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number.isFinite(v) ? v : 0)));
    ch.level = int(ch.level, 1, MAX_LEVEL);
    ch.earned = int(ch.earned, 0, POINTS_PER_LEVEL);
    ch.invested = int(ch.invested, 0, ch.earned);
    ch.points = int(ch.points, 0, 100000);
    ch.xp = Number.isFinite(ch.xp) ? Math.max(0, ch.xp) : 0;
    ch.xpBank = Number.isFinite(ch.xpBank) ? Math.max(0, ch.xpBank) : 0;
  }

  addXp(n) {
    const ch = this.ch;
    this.ensureProgress();
    if (ch.level >= MAX_LEVEL) {
      ch.xp = 0;
      return;
    }
    this.gainXp(Math.round(n * this.derived.xpMul));
  }

  gainXp(amount) {
    const ch = this.ch;
    const need = xpForLevel(ch.level);
    ch.xp += amount;
    let lost = 0;
    if (ch.xp > need) {
      const cap = ch.level + 1 < MAX_LEVEL ? xpForLevel(ch.level + 1) : 0;
      const want = ch.xpBank + ch.xp - need;
      ch.xpBank = Math.min(cap, want);
      lost = want - ch.xpBank;
      ch.xp = need;
    }
    this.earnPoints();
    // The bank holds one Power's worth: say so when XP spills past it, instead of losing it silently.
    if (lost > 0) this.xpCapped(Math.round(lost));
  }

  xpCapped(lost) {
    this.xpLost = (this.xpLost || 0) + lost;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this._capToastAt && now - this._capToastAt < 15000) return;
    this._capToastAt = now;
    G.ui && G.ui.toast && G.ui.toast(`XP capped: ${lost} XP lost. Rest at a campfire and invest your points to rise, then XP flows again.`, 'bad');
  }

  // Points due for the XP gathered toward the next Power, paid one at a time.
  earnPoints(quiet = false) {
    const ch = this.ch;
    const due = Math.min(POINTS_PER_LEVEL, Math.floor((POINTS_PER_LEVEL * ch.xp) / xpForLevel(ch.level) + 1e-9));
    if (due <= ch.earned) return 0;
    const n = due - ch.earned;
    ch.earned = due;
    ch.points += n;
    if (!quiet && G.ui && G.ui.toast) {
      if (due >= POINTS_PER_LEVEL) {
        // banners show their title alone; what to do next goes in a toast
        G.ui.banner && G.ui.banner('READY TO RISE');
        G.ui.toast(`Rest at a campfire and invest your points [Tab] to reach Power ${ch.level + 1}.`, 'good');
        G.audio.play('levelup', { vol: 0.45 });
      } else G.ui.toast(`+${n} investment point${n > 1 ? 's' : ''} (${due}/${POINTS_PER_LEVEL} toward Power ${ch.level + 1}): invest at a campfire [Tab]`, 'good');
    }
    return n;
  }

  // As in Deepwoken, points are invested only while resting at a campfire (sitting by one:
  // ui/interact.js openCampfire), never in danger. So Power rises at a fire; the talent and mantra
  // cards it brings can be chosen anywhere.
  resting() {
    return !!this.sitting && !this.dead && !this.knocked && !this.inDanger;
  }

  // Spend `pending` ({attr: n}) investment points at a campfire. Returns how many counted toward the next
  // Power, or -1 if refused (not resting, nothing to spend, or more than there is).
  invest(pending) {
    const ch = this.ch;
    this.ensureProgress();
    let n = 0;
    for (const k in pending) n += Math.max(0, Math.floor(pending[k] || 0));
    if (n <= 0 || n > ch.points || !this.resting()) return -1;
    const counting = Math.min(ch.points, ch.earned - ch.invested); // earned and not yet invested
    const other = ch.points - counting; // creation and refunded points, spent first
    const counted = clamp(n - other, 0, counting);
    for (const k in pending) if (pending[k] > 0) ch.attrs[k] = (ch.attrs[k] || 0) + Math.floor(pending[k]);
    ch.points -= n;
    ch.invested += counted;
    this.recompute();
    if (ch.invested >= POINTS_PER_LEVEL && ch.level < MAX_LEVEL) this.powerUp();
    return counted;
  }

  // Take a talent card or learn a mantra card with a pick earned at a rise (anywhere, as in Deepwoken).
  pickTalent(id) {
    const ch = this.ch;
    if (!(ch.talentPicks > 0) || !TALENTS[id] || ch.talents.includes(id)) return false;
    ch.talents.push(id);
    ch.talentPicks--;
    ch.talentOffer = null;
    this.recompute();
    return true;
  }
  pickMantra(id) {
    const ch = this.ch;
    if (!(ch.mantraPicks > 0) || !MANTRAS[id] || ch.mantras[id]) return false;
    ch.mantras[id] = { stars: 0 };
    ch.mantraPicks--;
    ch.mantraOffer = null;
    return true;
  }

  powerUp() {
    const ch = this.ch;
    ch.level++;
    ch.xp = 0;
    ch.earned = 0;
    ch.invested = 0;
    ch.talentPicks += 1;
    ch.mantraPicks += 1;
    this.recompute();
    this.hp = this.maxHp;
    this.ether = this.maxEther;
    G.audio.play('levelup');
    G.vfx.burst(this.center(_v), 'support', 60, { speed: 8, up: 4, color: '#ffe9a3' });
    G.vfx.ring(this.pos, 'support', 4, 0.8, { color: '#ffe9a3' });
    G.ui.banner(`POWER ${ch.level}`);
    G.ui.toast('You grow stronger. Choose a talent and a mantra [Tab].', 'good');
    // banked XP flows into the new Power
    const bank = ch.xpBank;
    ch.xpBank = 0;
    if (ch.level >= MAX_LEVEL) ch.xp = 0;
    else if (bank > 0) this.gainXp(bank);
    G.game.save && G.game.save();
  }

  addSilver(n) {
    this.ch.silver = Math.max(0, this.ch.silver + Math.round(n));
  }

  // ------------------------------------------------------------ hit building
  weaponHitTemplate() {
    const w = this.weaponItemDef();
    const cls = WEAPON_CLASSES[w.cls];
    const dmg = w.damage * weaponScaling(w, this.ch.attrs) * this.derived.physDmg;
    return { dmg, posture: w.posture * (cls.postureMul || 1) * this.derived.postureDmg, element: 'phys', kind: 'melee', status: this.procStatuses() };
  }

  procStatuses() {
    const out = [];
    const en = this.weaponEnchant();
    if (en && ENCHANTS[en] && ENCHANTS[en].status && chance(ENCHANTS[en].chance || 0)) out.push(ENCHANTS[en].status);
    if (this.mods.spellblade) {
      let best = null;
      let bv = 0;
      for (const k of ATTUNE_ATTRS) if (this.ch.attrs[k] > bv) {
        bv = this.ch.attrs[k];
        best = k;
      }
      const st = { ember: 'burn', rime: 'chill', storm: 'shock', gale: null, umbra: 'blind' }[best];
      if (st && chance(0.25)) out.push(st);
    }
    return out.length ? out : null;
  }

  buildHit(d, target) {
    const w = this.weaponItemDef();
    const cls = WEAPON_CLASSES[w.cls];
    let dmg = w.damage * weaponScaling(w, this.ch.attrs) * this.derived.physDmg * (d.dmgMul || 1);
    if (d.crit) dmg *= this.derived.critDmg;
    if (d.crit && target && target.guardBroken) dmg *= 1.6; // posture-break punish
    if (d.running) dmg *= 1 + (this.mods.runAtk || 0);
    if (d.aerial) dmg *= 1 + (this.mods.airDmg || 0);
    if (this.mods.momentum) dmg *= 1 + 0.06 * Math.min(4, this.comboChain);
    if (this.mods.mayhem) dmg *= 1 + 0.03 * this.mayhem;
    if (this.riposteT > 0) {
      dmg *= 1.4;
      this.riposteT = 0;
    }
    dmg *= traitSwingMul(this, d);
    if (this.evasiveT > 0 && this.mods.evasive) {
      dmg *= 1.3; // Evasive: the blow after a last-moment dodge
      this.evasiveT = 0;
    }
    const feel = weaponFeel(w);
    const en = this.weaponEnchant();
    let posture = w.posture * (cls.postureMul || 1) * (d.postureMul || 1) * this.derived.postureDmg;
    if (en === 'weighty') posture *= 1.25;
    if (d.crit && this.mods.shatter && target && target.blocking) posture *= 3;
    if (this.mods.balancedStance && this.atk && this.atk.def === d && (this.atk.held || 0) > 0.2) posture *= 1.25; // a held flourish
    return {
      dmg, posture, element: 'phys', unparryable: !!d.unparryable, unblockable: !!d.unblockable,
      knockback: d.knockback || (d.crit ? 5 : 0), launch: d.launch || 0, status: this.swingStatuses(d), kind: 'melee',
      crit: !!d.crit, heavy: cls.type === 'heavy' || !!d.crit, launcher: !!d.launcher, upper: !!d.upper, spike: d.spike || 0,
      chip: feel.chip, pen: feel.pen, trait: w.trait || null, running: !!d.running,
    };
  }

  // Ailments a swing carries: the enchant's, Spellblade's, and Ardour's fire on a running attack.
  swingStatuses(d) {
    const out = this.procStatuses() || [];
    if (d && d.running && this.mods.ardourBurn) out.push('burn');
    return out.length ? out : null;
  }

  mantraPowerFn(m) {
    const a = this.ch.attrs;
    if (ATTUNE_ATTRS.includes(m.el)) return (1 + a[m.el] * 0.012) * this.derived.mantraDmg;
    if (m.el === 'support') return 1 + a.charisma * 0.006;
    return 1 + a.strength * 0.006;
  }

  onDealtHit(tgt, dmg, h) {
    this.refreshDanger();
    if (tgt && tgt.team === 'guard' && ACTIONS.onHitGuard) ACTIONS.onHitGuard(tgt, this); // faction standing, wanted
    if (this.mods.lifesteal && dmg > 0) this.heal(dmg * this.mods.lifesteal * (this.mods.sanguine && tgt && tgt.statuses && tgt.statuses.bleed ? 3 : 1));
    if (this.mods.mayhem && h.kind === 'melee') {
      this.mayhem = Math.min(10, this.mayhem + 1);
      this.mayhemT = 4;
    }
    if (h.kind === 'melee') {
      this.comboChain++;
      traitAfterHit(this, tgt);
    }
    if (h.mantra && this.mods.nightHunger && h.element === 'umbra') this.heal(dmg * 0.15);
    if (h.mantra && this.mods.efficientCasting && dmg > 0) this.ether += 3; // Efficient Casting
    // an uppercut that lifted its foe opens the air chase (Space within COMBAT.launch.chaseWindow)
    // (the Galeblade's oath opens it after any blow that lifts a foe; Updraft doubles the window)
    if (tgt && (h.upper || (this.mods.galeChase && h.launch > 0)) && (tgt.launched || h.fromHost)) {
      this.chaseWin = COMBAT.launch.chaseWindow * (this.mods.updraftChase ? 2 : 1);
      this.chaseTarget = tgt;
    }
  }

  // ------------------------------------------------------------ defense hooks
  canDefend() {
    return !this.dead && !this.knocked && !this.stunned && !this.climbing && (!this.atk || this.atk.phase === 'recovery') && this.gripT <= 0;
  }
  onParry(att) {
    this.refreshDanger();
    if (this.mods.perfectParry) {
      this.ether += 10;
      this.posture = Math.max(0, this.posture - this.maxPosture * 0.08);
    }
    if (this.mods.riposte) this.riposteT = 1.5;
    if (this.mods.seerParry) this.heal(this.maxHp * 0.04);
    if (this.mods.rhythm) this.ether += 8; // Rhythm (resonance)
    G.game.stats && (G.game.stats.parries = (G.game.stats.parries || 0) + 1);
  }
  onBlock() {
    this.refreshDanger();
  }
  onEvade(att) {
    // Perfect dodge: dodging at the last moment steadies you.
    if (!this.perfectDodged && G.time - (this.dodgeStartT || -9) < 0.2) {
      this.perfectDodged = true;
      if (this.mods.evasive) this.evasiveT = 1;
      this.posture = Math.max(0, this.posture - this.maxPosture * 0.25);
      G.vfx.burst(this.center(_v), 'phys', 18, { color: '#e8f4ff', speed: 5 });
      G.audio.play('dodge', { pos: this.pos, pitch: 1.6, vol: 0.7 });
      G.vfx.number(this.center(_v), 'PERFECT', 'heal');
    }
    if (!this.dodgeEvaded && this.mods.ghostStep) {
      this.dodgeEvaded = true;
      this.dodgeCd = 0;
      G.vfx.burst(this.center(_v), 'phys', 14, { color: '#c8e8ff', speed: 4 });
    }
  }
  onDamaged(att, dmg) {
    this.refreshDanger();
    this.sitting = false;
    if (dmg > 0 && att && att !== this) traitStruck(this);
    if (this.boat) this.leaveBoat();
    // Rallying Spirit: below 30% health, ether and posture come back, once a minute
    if (this.mods.rallying && !(this.rallyT > 0) && this.hp > 0 && this.hp < this.maxHp * 0.3) {
      this.rallyT = 60;
      this.ether += 25;
      this.posture = Math.max(0, this.posture - this.maxPosture * 0.2);
      G.ui.toast('Rallying Spirit!', 'good');
    }
    if (this.mods.secondWind && this.secondWindT <= 0 && this.hp - 0 < this.maxHp * 0.2 && this.hp > 0) {
      this.secondWindT = 180;
      this.hp += this.maxHp * 0.25 * this.derived.healMul;
      G.ui.toast('Second Wind!', 'good');
      G.vfx.burst(this.center(_v), 'support', 30, { color: '#a6ffd2' });
    }
    G.ui.damageFlash(Math.min(1, dmg / this.maxHp * 4));
  }
  undyingCheck() {
    if (this.mods.undying && this.undyingT <= 0) {
      this.undyingT = 300;
      G.ui.toast('Undying - you refuse to fall.', 'good');
      G.vfx.sphereFlash(this.center(_v), 'phys', 2, 0.4, { color: '#ffd27a' });
      return true;
    }
    return false;
  }
  onStatus(id) {
    if (id === 'blind') G.ui.flashBlind(this.statuses.blind ? this.statuses.blind.t : 3);
  }

  refreshDanger(t = 20) {
    this.dangerT = Math.max(this.dangerT, t);
  }
  get inDanger() {
    return this.dangerT > 0;
  }

  onLethal(src) {
    if (this.dead || this.knocked) return;
    // Drowning on the surface, or already past the abyss rim in the Rift: no knock, just die.
    if (this.swimming || (G.game.inRift && this.pos.y < -8 && (this.groundH ?? 0) < -20)) return this.die(src);
    this.knocked = true;
    this.state = 'knocked';
    this.hp = 0;
    this.knockedT = 0;
    this.knockBleed = 12;
    this.cancelAttack();
    this.blocking = false;
    this.charging = false;
    this.climbing = false;
    this.noGravity = false;
    this.knockedBy = src;
    G.audio.play('knock', { pos: this.pos });
    G.vfx.addShake(0.36);
    G.vfx.hitStop(0.08);
    if (this.mods.unbroken && this.unbrokenT <= 0) {
      this.unbrokenT = 360;
      this.knockedT = 4.5;
      this.rising = true;
    }
  }

  rise(frac, iframe = 1) {
    this.knocked = false;
    this.state = 'idle';
    this.hp = Math.max(1, this.maxHp * frac);
    this.posture = 0;
    this.iframes = iframe;
    this.rising = false;
  }

  die(src) {
    if (this.dead) return;
    super.die(src);
    G.game.onPlayerDeath(src);
  }

  getGripped(by) {
    // executed while knocked
    if (!this.knocked || this.dead) return;
    G.vfx.blood(this.center(_v), null, 30);
    G.audio.play('grip', { pos: this.pos });
    G.vfx.addShake(0.4);
    G.vfx.hitStop(0.1);
    this.die(by);
  }

  // ------------------------------------------------------------ actions
  selectSlot(i) {
    const hb = this.ch.hotbar;
    const entry = hb[i];
    // 1 is always the weapon, and raises or lowers it. Mantras and items fire on the key
    // itself — never "equip" a mantra in place of the weapon (that forced LMB to cast
    // instead of swing).
    if (i === 0) {
      this.selected = 0;
      this.setArmed(!this.armed);
      return;
    }
    if (!entry) {
      this.selected = 0;
      return;
    }
    if (entry.type === 'item') {
      this.useItem(entry.id);
      return;
    }
    if (entry.type === 'mantra') {
      this.selected = 0;
      this.tryCast(i);
      return;
    }
    this.selected = this.selected === i ? 0 : i;
    G.audio.play('ui', { pitch: 1.2, vol: 0.5 });
  }

  useItem(id) {
    const it = ITEMS[id];
    const inv = this.ch.inventory.items;
    if (!it || !inv[id]) return G.ui.toast(`You have no ${it ? it.name : id}.`);
    if (this.atk || this.knocked || this.dead || this.eatT > 0) return;
    if (it.camp) return void makeCamp(this, id); // Sticks or Firewood: lay a campfire (game/camp.js)
    if (it.type === 'material' || it.type === 'quest') return G.ui.toast(id === 'mantra_spark' ? 'Use Mantra Sparks at a Mantra Altar.' : `${it.name} can't be used.`);
    if (id === 'waterskin') {
      if ((this.ch.waterCharges || 0) <= 0) return G.ui.toast('Your waterskin is empty. Refill it at a well or spring.');
      this.ch.waterCharges--;
    } else if (id === 'ember_of_life') {
      if (this.ch.lives >= this.ch.maxLives) return G.ui.toast('Your lives are already full.');
      this.ch.lives++;
      inv[id]--;
      if (inv[id] <= 0) delete inv[id];
      G.ui.toast('A lost life returns to you.', 'good');
      G.audio.play('heal');
      G.vfx.burst(this.center(_v), 'ember', 50, { speed: 6, up: 5 });
      return;
    } else {
      inv[id]--;
      if (inv[id] <= 0) delete inv[id];
    }
    this.eatT = 1.1;
    this.cancelAttack();
    this.model.anim.playPose('eat', 1.1);
    if (G.net) G.net.localEvent({ t: 'anim', pose: 'eat', d: 1.1 });
    G.audio.play(it.type === 'food' ? 'eat' : 'drink', { pos: this.pos });
    const ch = this.ch;
    if (it.hunger) ch.hunger = Math.min(100, ch.hunger + it.hunger);
    if (it.water) ch.water = Math.min(100, ch.water + it.water);
    const fed = this.mods.heartyAppetite ? 1.1 : 1; // Hearty Appetite
    if (it.heal) this.heal(it.heal * fed);
    if (it.healPct) this.heal(this.maxHp * it.healPct * fed);
    if (it.hot) this.addBuff('herb', 6, { regen: it.hot / 6 }, '#7aff9a');
    if (it.ether) this.ether += it.ether;
    if (it.sanity) this.addSanity(it.sanity);
    if (it.buff) this.addBuff(it.buff.id, it.buff.t, it.buff.mods, it.buff.color);
    if (it.cleanse) for (const s of ['burn', 'bleed', 'chill', 'blind', 'freeze']) this.clearStatus(s);
    G.ui.refreshHotbar();
  }

  startCombo() {
    const cls = this.weaponClass();
    const w = this.weaponItemDef();
    const enSpeed = this.weaponEnchant() === 'swift' ? 0.08 : 0;
    let speedMul = 1 + enSpeed;
    if (cls.type === 'heavy') speedMul += this.mods.heavySpeed || 0;
    if (cls.type === 'light') speedMul += this.mods.lightSpeed || 0;
    const feel = weaponFeel(w);
    const trait = wieldedTrait(this);
    speedMul *= feel.speed;
    // Ebb and Flow: the first swing out of a roll comes faster
    if (trait === 'ebb' && G.time - ((this.dodgeStartT ?? -9) + 0.36) < 1) speedMul *= 1.2;
    const reach = cls.range + feel.reach;
    // LMB in a slide: the uppercut, a rising strike that ends the slide and lifts light foes
    if (this.slideT > 0 && this.grounded) return this.startUppercut(cls, speedMul, reach);
    // chasing a launched foe: a short air string, closed by a slam that drives it down
    if (this.chase && !this.grounded && !this.swimming) return this.startAirString(cls, speedMul, reach);
    // aerial
    const airH = this.pos.y - (this.groundH ?? this.pos.y);
    if (!this.grounded && !this.swimming && airH > 1.0) {
      const d = Object.assign({}, AERIAL_ATTACK, {
        range: reach, arc: 120, aerial: true, vertical: 3.5, trackTarget: false,
        onActive: (a) => (a.vel.y = -22),
        onActiveTick: (a, def, st) => {
          a.vel.y = -22;
          if (a.grounded) {
            st.phase = 'recovery';
            st.recT = 0;
            G.vfx.dust(a.pos, 16);
            G.vfx.ring(a.pos, 'phys', 3, 0.3);
            G.vfx.addShake(0.25);
            areaHit(a, a.pos, 2.6, () => Object.assign(this.buildHit(Object.assign({}, def, { dmgMul: 0.6 })), { from: a.pos.clone(), kind: 'aoe' }));
          }
        },
      });
      d.anim = 'aerialSlam';
      this.combo = 0;
      return this.beginAttack(d);
    }
    // running
    if (this.sprinting && this.speed > 7 && this.combo === 0) {
      const d = Object.assign({}, RUNNING_ATTACK, { range: reach + 0.4, arc: cls.arc, running: true, sound: cls.sound, pitch: cls.pitch });
      d.windup /= speedMul;
      return this.beginAttack(d);
    }
    const i = this.combo % cls.combo.length;
    const last = i === cls.combo.length - 1;
    // Heavy Momentum: each swing of a heavy string winds up 8% faster than the one before
    const momentum = cls.type === 'heavy' && this.mods.heavyMomentum ? Math.pow(0.92, i) : 1;
    const d = {
      anim: cls.combo[i],
      windup: (cls.windup / speedMul) * momentum,
      active: cls.active / speedMul,
      recovery: (cls.recovery + (last ? 0.18 : 0)) / speedMul,
      range: reach,
      arc: cls.arc,
      dmgMul: cls.comboDmg[i],
      sound: cls.sound,
      pitch: cls.pitch * (0.95 + Math.random() * 0.1),
      lunge: 2.2,
      comboIdx: i,
      hyperarmor: !!(last && cls.type === 'heavy' && this.mods.heavyHyper) || (trait === 'oathbound' && this.hp < this.maxHp * 0.4),
      flourish: true, // hold LMB to hold it at the top of the wind-up
      press: this.lmbPress,
    };
    if (last && trait === 'sentry') {
      d.arc += 40;
      d.range += 0.5;
    }
    if (last && trait === 'last_toll') {
      // the string's last swing rings out like the bell
      d.onActive = (a) => {
        const c = a.pos.clone();
        G.vfx.ring(c, 'phys', 2.5, 0.4, { color: '#e8d8a8' });
        G.audio.play('toll', { pos: c, vol: 0.6 });
        areaHit(a, c, 2.5, () => Object.assign(this.buildHit(Object.assign({}, d, { dmgMul: d.dmgMul * 0.4 })), { from: c.clone(), kind: 'aoe', trait: null }));
      };
    }
    this.combo = last ? 0 : this.combo + 1;
    this.comboTimer = 0;
    return this.beginAttack(d);
  }

  startUppercut(cls, speedMul = 1, reach = cls.range) {
    this.slideT = 0;
    const L = COMBAT.launch;
    const d = {
      anim: 'uppercut', windup: 0.14 / speedMul, active: 0.12, recovery: 0.36 / speedMul, range: Math.min(reach, 3.2), arc: 120,
      vertical: 3, dmgMul: 1.1, postureMul: 1.2, launch: L.speed * (this.mods.heavyHands ? Math.sqrt(1.25) : 1), launcher: true, upper: true, lunge: 3,
      sound: cls.sound, pitch: cls.pitch * 1.08,
    };
    this.combo = 0;
    return this.beginAttack(d);
  }

  // Up to two quick cuts that keep the foe aloft, then a slam that drives it to the ground.
  startAirString(cls, speedMul = 1, reach = cls.range) {
    const c = this.chase;
    const L = COMBAT.launch;
    const slam = c.hits >= 2;
    c.hits++;
    const d = slam
      ? { anim: 'airSlam', windup: 0.12, active: 0.14, recovery: 0.3, range: reach, arc: 150, vertical: 3.5, dmgMul: 1.3, postureMul: 1.5,
          aerial: true, spike: L.spike, chaseSlam: true, comboIdx: 2, sound: cls.type === 'heavy' ? 'swingHeavy' : cls.sound, pitch: cls.pitch * 0.9 }
      : { anim: c.hits === 1 ? 'airSlashR' : 'airSlashL', windup: 0.1 / speedMul, active: 0.1, recovery: 0.16 / speedMul, range: reach, arc: 150,
          vertical: 3.2, dmgMul: 0.8, postureMul: 0.8, aerial: true, launch: L.juggle, launcher: true, chaseHit: true, comboIdx: c.hits - 1,
          sound: cls.sound, pitch: cls.pitch * 1.1 };
    // the closing slam carries the chaser down with it; with Heavy Hands its landing staggers those near
    if (slam) {
      d.onActive = (a) => (a.vel.y = -14);
      if (this.mods.heavyHands) {
        d.onActiveTick = (a, def, st) => {
          if (!a.grounded || st.landed) return;
          st.landed = true;
          G.vfx.ring(a.pos, 'phys', 2.5, 0.35, { color: '#e8d8b0' });
          G.vfx.dust(a.pos, 14);
          areaHit(a, a.pos, 2.5, () => ({ dmg: 4, posture: 18, kind: 'aoe', stun: 0.5, from: a.pos.clone() }));
        };
      }
    }
    this.combo = 0;
    this.comboTimer = 0;
    const ok = this.beginAttack(d);
    // the string turns to the foe it chases, not to the camera
    if (ok && c.target && !c.target.dead) this.yaw = Math.atan2(c.target.pos.x - this.pos.x, c.target.pos.z - this.pos.z);
    return ok;
  }

  // Space within the chase window: leap after the launched foe. Never when a wall is in reach,
  // so a ledge catch or a wall hop is never swallowed by the chase.
  canChase() {
    const t = this.chaseTarget;
    if (!(this.chaseWin > 0) || !t || t.dead || t.knocked || this.swimming || this.climbing) return false;
    if (t.grounded && !t.netProxy) return false;
    if (this.probeWall()) return false;
    return hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z) < 7;
  }

  startChase() {
    const t = this.chaseTarget;
    const L = COMBAT.launch;
    if (this.atk) this.cancelAttack();
    const dx = t.pos.x - this.pos.x;
    const dz = t.pos.z - this.pos.z;
    const dist = hypot(dx, dz) || 1;
    const rise = clamp(t.pos.y + 0.4 - this.pos.y, 1.2, 4);
    const vy = Math.sqrt(2 * GRAVITY * rise);
    const apex = vy / GRAVITY;
    const hs = Math.max(0, dist - 1.1) / apex;
    this.vel.set((dx / dist) * hs, vy, (dz / dist) * hs);
    this.grounded = false;
    this.jumps = 1;
    this.yaw = Math.atan2(dx, dz);
    this.chase = { target: t, t: 0, rise: apex, hits: 0 };
    this.chaseWin = 0;
    this.buf.chase = 0;
    this.fallStart = this.pos.y + rise; // the chase's landing is no fall
    G.audio.play('jump', { pos: this.pos, pitch: 1.15 });
    G.vfx.dust(this.pos, 6);
    if (G.net) G.net.localEvent({ t: 'anim', pose: 'jump', d: 0.3 });
  }

  endChase() {
    this.chase = null;
  }

  // F in the first part of a roll ends it at once, so a block or parry can follow.
  rollCancel() {
    const R = COMBAT.rollCancel;
    if (!(this.dodgeT > 0) || this.dodgeT < 0.36 * (1 - R.frac)) return false;
    this.dodgeT = 0;
    this.iframes = 0;
    this.vel.x *= 0.25;
    this.vel.z *= 0.25;
    this.dodgeCd = Math.max(this.dodgeCd, 0) + (this.mods.quickstep ? 0 : R.cooldown); // Quickstep: free
    if (this.model.anim) this.model.anim.roll = null;
    G.audio.play('block', { pos: this.pos, vol: 0.35, pitch: 1.3 });
    if (G.net) G.net.localEvent({ t: 'rollX' });
    return true;
  }

  // A guard-broken enemy close by opens a critical window, even while R is recharging.
  brokenTarget() {
    let best = null;
    let bd = 4.5;
    for (const a of G.actors) {
      if ((a.team !== 'enemy' && !(a.team === 'guard' && a.target === this)) || a.dead || a.knocked || !a.guardBroken) continue;
      const d = hypot(a.pos.x - this.pos.x, a.pos.z - this.pos.z);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  startCrit() {
    const broken = this.brokenTarget();
    if (this.critCd > 0 && !broken) return false;
    if (broken) {
      this.yaw = Math.atan2(broken.pos.x - this.pos.x, broken.pos.z - this.pos.z);
      G.game.camYaw = this.yaw;
    }
    const cls = this.weaponClass();
    const c = cls.crit;
    const feel = weaponFeel(this.weaponItemDef());
    const d = Object.assign({}, c, {
      windup: c.windup / feel.speed,
      range: (c.range || cls.range * 1.1) + feel.reach, arc: c.arc || cls.arc, crit: true, sound: cls.type === 'heavy' ? 'swingHeavy' : 'swing',
      hits: c.hits || 1, hyperarmor: c.hyperarmor || !!this.mods.critHyperarmor, pitch: cls.pitch * 0.9,
    });
    if (c.shockwave) {
      d.onActive = (a) => {
        const p = a.pos.clone().addScaledVector(forwardFromYaw(a.yaw), 2);
        p.y = G.world.groundAt(p.x, p.z, p.y + 3);
        G.vfx.ring(p, 'phys', c.shockwave, 0.45, { color: '#ffe0b0' });
        G.vfx.dust(p, 18);
        G.vfx.addShake(0.4);
        areaHit(a, p, c.shockwave, (t) => Object.assign(this.buildHit(Object.assign({}, d, { dmgMul: c.dmgMul * 0.5 }), t), { from: p.clone(), kind: 'aoe' }));
      };
    }
    this.critCd = c.cd * (1 - (this.mods.critCdr || 0)); // Bladesworn recharges it faster
    this.combo = 0;
    return this.beginAttack(d);
  }

  // Light swings drift onto a foe already inside the arc. Heavies and casts keep the camera aim.
  softFoe(range) {
    let best = null;
    let bestAng = 0.65;
    for (const a of G.actors) {
      if (a === this || a.dead || a.knocked || !G.game.isFoe(a)) continue;
      const dx = a.pos.x - this.pos.x;
      const dz = a.pos.z - this.pos.z;
      if (hypot(dx, dz) > range + a.radius + (a.meleePad || 0)) continue;
      const ang = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz)));
      if (ang < bestAng) {
        bestAng = ang;
        best = a;
      }
    }
    return best;
  }

  beginAttack(d) {
    this.yaw = G.game.camYaw;
    const cls = this.weaponClass();
    if (cls && cls.type === 'light' && d.type !== 'cast' && !d.crit) {
      const foe = this.softFoe((d.range || cls.range || 2.4) + 0.8);
      if (foe) this.yaw = Math.atan2(foe.pos.x - this.pos.x, foe.pos.z - this.pos.z);
    }
    this.charging = false;
    this.sitting = false;
    this.startAttack(d);
    if (G.net) G.net.localAttack(d);
    return true;
  }

  tryCast(slot) {
    const entry = this.ch.hotbar[slot];
    if (!entry || entry.type !== 'mantra') return;
    const id = entry.id;
    const m = MANTRAS[id];
    const st = this.ch.mantras[id] || { stars: 0 };
    if (!m) return;
    // a stagger would cancel the cast on the next frame and waste its ether
    if (this.stunned || this.knocked) return;
    if ((this.cooldowns[id] || 0) > 0) return G.ui.toast(`${m.name} is on cooldown.`);
    const attune = ATTUNE_ATTRS.includes(m.el);
    if (attune && this.mods.noAttune) return G.ui.toast('Your Vow of Silence forbids attunement mantras.', 'bad');
    let mm = {};
    try {
      mm = (ACTIONS.mantraMods && ACTIONS.mantraMods(this, id)) || {}; // spark modifiers (altar)
    } catch (e) {
      console.error(e);
    }
    // Overflow: with ether full, the next mantra is free (once; the next free one waits for a refill)
    if (this.ether < this.maxEther - 0.5) this.overflowUsed = false;
    const free = this.mods.overflow && !this.overflowUsed && this.ether >= this.maxEther - 0.5;
    const etherCost = free ? 0 : m.ether * this.derived.etherCostMul * (mm.etherMul ?? 1);
    if (this.ether < etherCost) return G.ui.toast('Not enough ether.');
    if (this.swimming) return;
    const airOk = m.type === 'mobility' || m.behavior === 'airDash' || m.behavior === 'teleportBehind';
    if (!this.grounded && !airOk && this.pos.y - (this.groundH ?? 0) > 1.2) return;
    this.ether -= etherCost;
    if (free) this.overflowUsed = true;
    if (m.hpCost) {
      this.hp = Math.max(1, this.hp - this.maxHp * m.hpCost);
      G.vfx.blood(this.center(_v), null, 10);
    }
    this.cooldowns[id] = m.cd * this.derived.mantraCdMul * (1 - st.stars * 0.08) * (mm.cdMul ?? 1);
    const getAim = () => G.game.getAim(m.p.range || 30);
    this._lastCast = { stars: st.stars, aim: getAim() };
    const def = makeCastDef(this, id, getAim, st.stars);
    this.beginAttack(def);
    if (m.type === 'combat') this.refreshDanger(10);
  }

  // True when the roll happened (a buffered press keeps retrying until then).
  dodge() {
    // Resolve: once every 20 s, a roll out of a broken guard
    if (this.stunned && this.guardBroken && this.mods.resolve && !(this.resolveT > 0) && !this.knocked && !this.dead && !this.statuses.freeze) {
      this.stunT = 0;
      this.guardBroken = false;
      this.posture = this.maxPosture * 0.4;
      this.state = 'idle';
      this.resolveT = 20;
      this.dodgeCd = 0;
    }
    if (this.dodgeCd > 0 || this.knocked || this.dead || this.stunned || this.gripT > 0 || this.eatT > 0) return false;
    if (this.swimming || this.climbing) return false;
    if (this.atk) {
      if (this.atk.phase !== 'recovery' && !(this.atk.phase === 'windup' && !this.atk.def.hyperarmor)) return false;
    }
    // anyone can roll once in the air; Updraft and Sky Dancer give a second
    if (!this.grounded && !this.swimming) {
      if (this.airDodges >= (this.mods.airDodge ? 2 : 1)) return false;
      this.airDodges++;
      if (this.mods.tailwind) this.fallStart = this.pos.y; // Tailwind: a roll in the air breaks the fall
    }
    if (this.atk) this.cancelAttack();
    const input = this.inputDir(_move);
    const camYaw = G.game.camYaw;
    let dirName = 'f';
    if (input.lengthSq() < 0.01) {
      this.dodgeDir.copy(forwardFromYaw(this.yaw)).negate();
      dirName = 'b';
    } else {
      this.dodgeDir.copy(input).normalize();
      if (this.blocking) {
        const rel = angleDiff(this.yaw, Math.atan2(input.x, input.z));
        if (Math.abs(rel) < 0.6) dirName = 'f';
        else if (Math.abs(rel) > 2.5) dirName = 'b';
        else dirName = rel > 0 ? 'l' : 'r';
      } else {
        this.yaw = Math.atan2(input.x, input.z);
      }
    }
    const dist = 6.2 * (1 + (this.mods.dodgeDist || 0)) * ((this.weightFx && this.weightFx.roll) || 1);
    this.dodgeT = 0.36;
    this.dodgeSpeed = dist / 0.36;
    this.iframes = 0.27;
    this.dodgeEvaded = false;
    this.perfectDodged = false;
    this.dodgeStartT = G.time;
    this.dodgeCd = this.derived.dodgeCd;
    this.blocking = false;
    this.charging = false;
    this.model.anim.startRoll(dirName, 0.4);
    if (G.net) G.net.localEvent({ t: 'roll', d: dirName });
    this.clearStatus('burn');
    G.audio.play('dodge', { pos: this.pos });
    G.vfx.dust(this.pos, 6);
    return true;
  }

  inputDir(out) {
    const I = G.input;
    const f = (I.isDown('forward') ? 1 : 0) - (I.isDown('back') ? 1 : 0);
    const r = (I.isDown('right') ? 1 : 0) - (I.isDown('left') ? 1 : 0);
    const yaw = G.game.camYaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    // right = (-fz, 0, fx)
    out.set(fx * f - fz * r, 0, fz * f + fx * r);
    if (out.lengthSq() > 1) out.normalize();
    return out;
  }

  tryGrip() {
    if (this.gripT > 0 || this.atk || this.knocked) return;
    let best = null;
    let bd = 3;
    for (const a of G.actors) {
      if (!a.knocked || a.dead || a.team === 'player') continue;
      const d = a.pos.distanceTo(this.pos);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    if (!best) return G.ui.toast('No one to grip.');
    this.gripT = this.mods.presence ? 0.72 : 1.2; // Commanding Presence: 40% faster
    this.gripLen = this.gripT;
    this.gripTarget = best;
    this.gripDone = false;
    this.yaw = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z);
    this.model.anim.play('grip', { windup: 0.55, active: 0.2, recovery: 0.45 });
    if (G.net) G.net.localEvent({ t: 'anim', n: 'grip', w: 0.55, ac: 0.2, r: 0.45 });
  }

  // ------------------------------------------------------------ climbing helpers
  probeWall() {
    const f = forwardFromYaw(this.yaw, _v);
    const cl = G.world.colliders;
    const chestY = this.pos.y + 1.1;
    const d = cl.raycast(this.pos.x, chestY, this.pos.z, f.x, 0, f.z, this.radius + 0.6);
    if (d < this.radius + 0.6) return { kind: 'col' };
    const th = G.world.terrain.heightAt(this.pos.x + f.x * (this.radius + 0.5), this.pos.z + f.z * (this.radius + 0.5));
    if (th > this.pos.y + 1.3) return { kind: 'terrain' };
    return null;
  }
  // The top of the wall in front, if it is a ledge the hands can catch from here: within reach
  // above the feet, higher than a jump clears, with room above it to climb onto. NaN otherwise.
  probeLedge() {
    const f = forwardFromYaw(this.yaw, _v);
    const { colliders: cl, terrain } = G.world;
    const lo = this.pos.y + LATCH_LO;
    const hi = this.pos.y + LATCH_HI;
    const reach = this.radius + 0.45;
    const px = this.pos.x + f.x * reach;
    const pz = this.pos.z + f.z * reach;
    let top = NaN;
    // the top of a wall standing right in front at chest height
    const d = cl.raycast(this.pos.x, this.pos.y + 1.1, this.pos.z, f.x, 0, f.z, reach + 0.15);
    this.ledgeWallD = d < reach + 0.15 ? d : NaN;
    if (d < reach + 0.15) {
      const y = cl.groundAt(px, pz, hi);
      if (y > lo) top = y;
    }
    // or a shelf in the terrain: high here and no higher just beyond (a slope going on up is no ledge)
    const th = terrain.heightAt(px, pz);
    if (th > lo && th <= hi && !(top >= th) && terrain.heightAt(px + f.x * 0.6, pz + f.z * 0.6) < th + 0.6) top = th;
    if (!(top > lo)) return NaN;
    // the wall in front ends there: open ahead just over the edge (behind a thin wall, the floor
    // of the room inside is no ledge)
    if (d < reach + 0.15) {
      const past = d + 0.6;
      if (cl.raycast(this.pos.x, top + 0.3, this.pos.z, f.x, 0, f.z, past) < past) return NaN;
      if (cl.raycast(this.pos.x, top + 1.2, this.pos.z, f.x, 0, f.z, past) < past) return NaN;
    }
    // room to stand on it, at the edge and a stride in: a gap under an overhang is no ledge
    const room = this.height + 0.1;
    if (cl.raycast(px, top + 0.05, pz, 0, 1, 0, room) < room) return NaN;
    if (cl.raycast(px + f.x * 0.5, top + 0.05, pz + f.z * 0.5, 0, 1, 0, room) < room) return NaN;
    return top;
  }

  // The outward normal of the collider wall straight ahead at chest height, from two rays either
  // side of the body's centre line (their hit points give the face's run), or null. A terrain
  // shelf has no collider face: its slope gives the normal.
  wallNormal() {
    const f = forwardFromYaw(this.yaw, _v);
    const fx = f.x, fz = f.z, rx = -fz, rz = fx, y = this.pos.y + 1.1, far = this.radius + 0.9;
    const cl = G.world.colliders;
    const hits = [];
    for (const o of [-0.22, 0.22]) {
      const ox = this.pos.x + rx * o, oz = this.pos.z + rz * o;
      const d = cl.raycast(ox, y, oz, fx, 0, fz, far);
      if (d < far) hits.push([ox + fx * d, oz + fz * d]);
    }
    if (hits.length === 2) {
      const tx = hits[1][0] - hits[0][0], tz = hits[1][1] - hits[0][1];
      const tl = hypot(tx, tz);
      if (tl > 1e-4) {
        // the face's normal, the side facing the body
        let nx = -tz / tl, nz = tx / tl;
        if (nx * fx + nz * fz > 0) { nx = -nx; nz = -nz; }
        return { x: nx, z: nz };
      }
    }
    if (hits.length) return { x: -fx, z: -fz };
    const T = G.world.terrain, e = 0.5;
    const px = this.pos.x + fx * (this.radius + 0.45), pz = this.pos.z + fz * (this.radius + 0.45);
    const gx = T.heightAt(px + e, pz) - T.heightAt(px - e, pz), gz = T.heightAt(px, pz + e) - T.heightAt(px, pz - e);
    const gl = hypot(gx, gz);
    return gl > 1e-3 ? { x: -gx / gl, z: -gz / gl } : { x: -fx, z: -fz };
  }

  // Catch the ledge in front, unless the jump would carry the feet over it anyway. One too low to
  // hang from (the feet would touch the ground) is pulled straight up and over. The input must
  // push into the wall: running past a wall's top, or along it, catches nothing.
  tryLatch(input) {
    if (this.climbing || this.latchCd > 0 || this.vel.y < -10 || this.latches >= this.derived.latches) return;
    const top = this.probeLedge();
    if (!(top > -Infinity)) return;
    const n = this.wallNormal();
    const il = input ? hypot(input.x, input.z) : 0;
    if (input && il > 0.1 && -(input.x * n.x + input.z * n.z) / il < GRAB_INTO) return;
    const apex = this.pos.y + (this.vel.y > 0 ? (this.vel.y * this.vel.y) / (2 * GRAVITY) : 0);
    if (apex > top + 0.1) return;
    const { colliders: cl, terrain } = G.world;
    const floor = Math.max(terrain.heightAt(this.pos.x, this.pos.z), cl.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.1, this.radius * 0.5));
    this.latches++;
    if (top - floor < HANG + 0.05) {
      this.vel.y = Math.sqrt(2 * GRAVITY * (top + 0.35 - this.pos.y));
      this.vaultT = 0.35;
      this.vaultFrom = floor;
      G.audio.play('jump', { pos: this.pos, vol: 0.5 });
      return;
    }
    // square to the wall, up against it, the hands on its edge: face the wall's normal, then
    // close the gap along it, so a diagonal approach no longer hangs askew, half off the edge.
    // If the edge is not there square on (a pillar's corner), nothing is caught.
    const was = { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw };
    this.pos.y = top - HANG;
    this.yaw = Math.atan2(-n.x, -n.z);
    const reach = this.radius + 1.2;
    const gap = cl.raycast(this.pos.x, this.pos.y + HANG - 0.85, this.pos.z, -n.x, 0, -n.z, reach);
    if (gap < reach) this.pos.addScaledVector(_v.set(-n.x, 0, -n.z), gap - this.radius - 0.05);
    else if (this.ledgeWallD > this.radius + 0.05) this.pos.addScaledVector(forwardFromYaw(was.yaw, _v), this.ledgeWallD - this.radius - 0.05);
    if (!(Math.abs(this.probeLedge() - top) < 0.3)) {
      this.pos.set(was.x, was.y, was.z);
      this.yaw = was.yaw;
      this.latches--;
      return;
    }
    this.climbing = true;
    this.vaultT = 0;
    this.hangY = top;
    this.vel.set(0, 0, 0);
    this.fallStart = this.pos.y; // the catch breaks the fall
    this.cancelAttack();
    this.blocking = false;
    this.charging = false;
    G.audio.play('step', { pos: this.pos, vol: 0.7, surface: 'stone' });
  }

  // In the air against a wall with no edge in reach: a hop up it.
  wallHop() {
    if (this.latches >= this.derived.latches || !this.probeWall()) return false;
    this.latches++;
    this.vel.y = this.derived.wallHop * (this.mods.wallRunner ? Math.sqrt(1.4) : 1); // Wall Runner: 40% higher
    G.audio.play('jump', { pos: this.pos, vol: 0.6 });
    return true;
  }

  // ------------------------------------------------------------ boat
  enterBoat(boat) {
    if (boat.netProxy) {
      // a friend's boat: take a passenger seat and ask its owner to confirm
      const seat = G.net ? G.net.passengerSeat(boat) : -1;
      if (seat < 0) return G.ui.toast('No free seat aboard.', 'bad');
      this.boat = boat;
      boat.board(this, seat);
      G.net.requestBoard(boat, seat);
    } else {
      this.boat = boat;
      if (boat.board) boat.board(this, boat.freeSeat ? boat.freeSeat() : 0);
      else boat.driver = this;
    }
    this.climbing = false;
    this.swimming = false;
    this.cancelAttack();
  }
  leaveBoat() {
    if (!this.boat) return;
    const b = this.boat;
    if (b.netProxy && G.net) G.net.send({ t: 'unboard', to: b.netOwner, b: b.netBoatId });
    if (b.leave) b.leave(this);
    else if (b.driver === this) b.driver = null;
    this.boat = null;
    // step off onto dry ground beside the boat (a pier, a beach) where the boat finds some
    // (Boat.landingSpot, agent 5's), else over the starboard side into the water
    const spot = b.landingSpot ? b.landingSpot() : null;
    if (spot) this.pos.copy(spot);
    else {
      const side = new THREE.Vector3(Math.cos(b.yaw), 0, -Math.sin(b.yaw)).multiplyScalar(2.2);
      this.pos.copy(b.pos).add(side);
      this.pos.y = Math.max(G.world.groundAt(this.pos.x, this.pos.z, 5), SWIM_Y);
    }
    this.vel.set(0, 0, 0);
  }

  // ------------------------------------------------------------ main update
  update(dt) {
    const I = G.input;
    const ch = this.ch;
    const canAct = !this.dead && !this.knocked && G.game.controlsEnabled();
    const d = this.derived;

    // timers
    for (const k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k] -= dt;
    // a swing started on this LMB press holds at the top of its wind-up while LMB stays down
    if (this.atk && this.atk.def.flourish) {
      this.atk.hold = canAct && !!I.mDown[0] && this.atk.def.press === this.lmbPress;
      // LAN: the avatar's replayed swing holds and lets go with this one
      if (G.net && this.atk.sentHold !== this.atk.hold) {
        this.atk.sentHold = this.atk.hold;
        G.net.localEvent({ t: 'hold', on: this.atk.hold ? 1 : 0 });
      }
    }
    if (this.chaseWin > 0) this.chaseWin = Math.max(0, this.chaseWin - dt);
    this.critCd = Math.max(0, this.critCd - dt);
    this.feintCd = Math.max(0, this.feintCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (!(this.mods.flurryMaster && this.dodgeT > 0)) this.comboTimer += dt; // Flurry Master: a roll keeps the string
    if (this.comboTimer > 0.75 && !this.atk) {
      this.combo = 0;
      this.comboChain = 0;
    }
    this.dangerT = Math.max(0, this.dangerT - dt);
    this.secondWindT -= dt;
    this.undyingT -= dt;
    this.unbrokenT -= dt;
    this.riposteT = Math.max(0, this.riposteT - dt);
    if (this.evasiveT > 0) this.evasiveT -= dt;
    if (this.carryT > 0) this.carryT -= dt;
    if (this.rallyT > 0) this.rallyT -= dt;
    if (this.resolveT > 0) this.resolveT -= dt;
    if (this.mayhemT > 0) {
      this.mayhemT -= dt;
      if (this.mayhemT <= 0) this.mayhem = 0;
    }
    if (this.stealth > 0) this.stealth -= dt;
    if (this.wardT > 0) this.wardT -= dt;
    if (this.eatT > 0) this.eatT -= dt;

    this.baseUpdate(dt);

    const sky = G.game?.world?.sky;
    const inRift = !!G.game?.inRift;
    const night = sky?.isNight?.() ?? false;
    const rim = inRift ? 1.05 : night ? 0.55 : 0.14;
    const fill = inRift ? 0.75 : night ? 0.38 : 0.08;
    this.rimLight.intensity = rim;
    this.fillLight.intensity = fill;
    if (inRift) {
      this.rimLight.color.set('#a8b8ff');
      this.fillLight.color.set('#c8b0d8');
    } else if (night) {
      this.rimLight.color.set('#8aa8d8');
      this.fillLight.color.set('#d8c090');
    } else {
      this.rimLight.color.set('#9cb4e8');
      this.fillLight.color.set('#e8c8a0');
    }

    // riding a carrier line: game/ziplines.js carries the rider along the cable
    if (this.zip) {
      if (this.knocked || this.dead) this.zip.drop(this);
      else {
        this.zip.step(this, dt);
        this.vel.set(0, 0, 0);
        if (this.zip) this.fallStart = this.pos.y;
        this.syncModel(dt, { climbing: !!this.zip, climbSpeed: 0, grounded: !this.zip, weaponOut: false });
        this.survival(dt);
        return;
      }
    }

    // knocked state
    if (this.knocked) {
      this.knockedT += dt;
      this.vel.x = damp(this.vel.x, 0, 6, dt);
      this.vel.z = damp(this.vel.z, 0, 6, dt);
      const foe = (r) => G.actors.some((a) => !a.dead && !a.knocked && (a.team === 'enemy' || (a.team === 'guard' && a.target === this)) && !a.dummy && !a.illusion && a.aggro && a.pos.distanceTo(this.pos) < r);
      // knocked: rise if no foe is watching after a while (sooner with Unbroken Will), or bleed out
      // or be gripped; there is no struggling up and no giving in (the user's call, 2026-10-16)
      const watching = foe(30);
      const bleed = this.knockBleed || 12;
      if (this.rising && this.knockedT > 5) this.rise(0.3);
      else if (!watching && this.knockedT > 5) this.rise(0.15);
      else if (this.knockedT > bleed) this.die(this.knockedBy);
      this.physics(dt);
      this.syncModel(dt, { knocked: true });
      return;
    }
    if (this.dead) {
      this.physics(dt);
      this.syncModel(dt, { dead: true });
      return;
    }

    // boat driving
    if (this.boat) {
      if (this.boat.driver === this) this.boat.drive(dt, canAct ? I : null);
      this.pos.copy(this.boat.seatPos(this));
      this.yaw = this.boat.yaw;
      this.vel.set(0, 0, 0);
      if (canAct && (I.consume('interact') || I.consume('jump'))) this.leaveBoat();
      this.syncModel(dt, { sit: true, grounded: true, weaponOut: false });
      this.survival(dt);
      return;
    }

    // ------------- inputs
    const input = canAct ? this.inputDir(_move) : _move.set(0, 0, 0);
    const wantsSprint = canAct && I.isDown('sprint');
    if (this.sitting && (input.lengthSq() > 0.01 || !this.grounded)) this.sitting = false;
    this.yaw = angleWrap(this.yaw);
    const busy = !!this.atk || this.stunned || this.gripT > 0 || this.eatT > 0;

    if (canAct) {
      // hotbar
      for (let i = 0; i < 10; i++) if (I.consume(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'][i])) this.selectSlot(i);
      const buf = this.buf;
      for (const k in buf) buf[k] = Math.max(0, buf[k] - dt);
      if (I.mPressed[0]) this.lmbPress++;
      if (I.consume('dodge')) buf.dodge = INPUT_BUFFER;
      if (buf.dodge > 0 && this.dodge()) buf.dodge = 0;
      if (I.consume('grip')) this.armed ? this.tryGrip() : this.handsDown();

      // block / parry
      const blockHeld = I.isDown('block');
      if (I.wasPressed('block')) {
        if (this.atk && this.atk.phase === 'windup' && this.feintCd <= 0 && !this.atk.def.hyperarmor) {
          this.feint();
          this.feintCd = 1.2 * (wieldedTrait(this) === 'kestrel' ? 0.5 : 1) * (this.mods.lightningReflexes ? 0.6 : 1);
        }
        if (this.armed) this.rollCancel();
        if (!this.armed) this.handsDown();
        else if (!this.atk && !this.stunned && this.parryCd <= 0 && !this.climbing && !this.swimming) {
          this.startParry(d.parryWindow, COMBAT.parry.missCooldown * (this.mods.seerRead ? 0.5 : 1) - (this.mods.sharpReflexes ? 0.3 : 0));
          if (this.dodgeT <= 0) this.yaw = G.game.camYaw; // the guard faces the aim
          this.model.play('parry', { windup: 0.04, active: 0.12, recovery: 0.16 });
          if (G.net) G.net.localEvent({ t: 'anim', n: 'parry', w: 0.04, ac: 0.12, r: 0.16 });
        }
      }
      this.blocking = blockHeld && this.armed && !this.atk && !this.stunned && !this.climbing && !this.swimming && this.dodgeT <= 0 && this.gripT <= 0 && this.eatT <= 0;
      if (this.blocking) {
        this.charging = false;
        this.sitting = false;
      }

      // feint
      if (I.mPressed[2] && this.atk && this.atk.phase === 'windup' && this.feintCd <= 0) {
        if (this.feint()) this.feintCd = 1.4 * (wieldedTrait(this) === 'kestrel' ? 0.5 : 1) * (this.mods.lightningReflexes ? 0.6 : 1);
      }

      // attacks — a short buffer so a click landing between frames still comes out.
      // Mantras cast from their hotbar keys; LMB is always the weapon.
      this.actBuf = Math.max(0, (this.actBuf || 0) - dt);
      if (!this.armed) {
        if (I.mPressed[0]) this.handsDown();
        this.actBuf = 0;
      }
      const wantAttack = this.armed && (I.mPressed[0] || this.actBuf > 0);
      // Blade Dancer: LMB late in a roll cuts it short with a swing
      if (wantAttack && this.mods.bladeDancer && this.dodgeT > 0 && this.dodgeT < 0.36 * 0.45 && !this.atk) this.dodgeT = 0;
      if (wantAttack && !this.blocking && !this.charging && this.dodgeT <= 0 && this.gripT <= 0 && this.eatT <= 0 && !this.swimming && !this.climbing) {
        if (!this.stunned) {
          if (!this.atk) this.startCombo();
          else this.queued = true;
          this.actBuf = 0;
        }
      } else if (I.mPressed[0] && this.armed) this.actBuf = 0.25;
      if (I.consume('crit')) {
        if (!this.armed) this.handsDown();
        else if (this.critCd > 0 && !this.brokenTarget()) G.ui.toast(`Critical attack recharging (${this.critCd.toFixed(1)}s)`);
        else buf.crit = INPUT_BUFFER;
      }
      // a crit pressed during a swing's tail or a roll comes out as soon as it can
      if (buf.crit > 0 && !this.atk && !this.stunned && !this.blocking && !this.swimming && !this.climbing && this.dodgeT <= 0 && this.eatT <= 0 && this.gripT <= 0) {
        buf.crit = 0;
        this.startCrit();
      }
    } else {
      this.blocking = false;
      this.charging = false;
      this.buf.dodge = this.buf.crit = 0;
    }

    // combo chaining from buffer
    if (this.atk && this.queued && this.atk.phase === 'recovery' && this.atk.def.comboIdx !== undefined) {
      if (this.atk.recT > this.atk.def.recovery * 0.3) {
        this.queued = false;
        this.cancelAttack();
        this.startCombo();
      }
    } else if (!this.atk && this.queued) {
      this.queued = false;
    }

    // ether regen
    const regenMul = (this.mods.meditation && !this.inDanger ? 2 : 1) * (this.sitting && this.mods.deepBreath ? 3 : 1);
    this.ether += d.etherRegen * regenMul * dt;

    // ------------- movement
    let targetSpeed = 0;
    const moving = input.lengthSq() > 0.01;
    this.sprinting = wantsSprint && moving && !this.blocking && !this.charging;
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      const f = Math.max(0, this.dodgeT / 0.36);
      const sp = this.dodgeSpeed * (0.35 + 0.65 * f);
      this.vel.x = this.dodgeDir.x * sp;
      this.vel.z = this.dodgeDir.z * sp;
    } else if (this.climbing) {
      this.updateHang(canAct);
    } else if (this.vaultT > 0) {
      this.vaultT -= dt;
      // over the edge and onto the top: stop there rather than walk off a narrow wall's far side
      if (this.grounded && this.pos.y > (this.vaultFrom ?? Infinity) + 0.5) {
        this.vaultT = 0;
        this.vel.x *= 0.2;
        this.vel.z *= 0.2;
      } else {
        const f = forwardFromYaw(this.yaw, _v);
        this.vel.x = f.x * 4;
        this.vel.z = f.z * 4;
      }
    } else if (this.slideT > 0) {
      this.slideT -= dt;
      const f = this.slideT / (this.slideLen || 0.75);
      this.vel.x = this.slideDir.x * 11.5 * (0.3 + 0.7 * f);
      this.vel.z = this.slideDir.z * 11.5 * (0.3 + 0.7 * f);
      if (Math.random() < dt * 30) G.vfx.dust(this.pos, 1, '#c8b89a', 0.4);
      if (this.mods.slideStrike) {
        for (const a of actorsNear(this.pos, 1.4, (x) => hostile(this, x) && !x.slideHit)) {
          a.slideHit = true;
          setTimeout(() => (a.slideHit = false), 800);
          applyHit(this, a, { dmg: 4, posture: 22, kind: 'melee', element: 'phys', stun: 0.7, from: this.pos.clone() });
        }
      }
      if (canAct && I.consume('jump')) {
        this.slideT = 0;
        this.vel.y = 9.5;
        this.vel.x *= 1.35;
        this.vel.z *= 1.35;
        this.grounded = false;
        G.audio.play('jump', { pos: this.pos });
      }
    } else {
      let speedMul = 1;
      if (this.blocking) speedMul = 0.45;
      if (this.charging) speedMul = 0.35;
      if (this.atk) speedMul = this.atk.phase === 'recovery' ? 0.6 : 0.35;
      if (this.eatT > 0) speedMul = this.mods.heartyAppetite ? 0.75 : 0.4; // Hearty Appetite eats at a walk
      if (this.statuses.chill) speedMul *= 1 - this.statuses.chill.stacks * 0.004;
      if (this.stunned || this.gripT > 0) speedMul = 0;
      const swimMul = this.swimming ? 0.62 * d.swimSpeed : 1;
      const base = this.speedBase * (this.sprinting ? 1.68 : 1) * swimMul;
      targetSpeed = moving ? base * speedMul : 0;
      // on the ground speed follows the input closely; just after a landing at speed, more gently
      // (the speed of a slide-jump carries a moment); in the air, steering keeps the speed already
      // won when the input goes the same way
      const k = this.swimming ? 16 : this.grounded ? (this.carryT > 0 ? 4 : 16) : 2.5;
      const chaseRise = this.chase && this.chase.t < this.chase.rise;
      if (!(this.atk && this.atk.def.lunge && this.atk.phase !== 'windup') && !chaseRise && !(this.atk && this.atk.def.aerial && this.chase)) {
        const hv = hypot(this.vel.x, this.vel.z);
        const il = hypot(input.x, input.z);
        const along = hv > 1e-3 && il > 0.1 ? (this.vel.x * input.x + this.vel.z * input.z) / (hv * il) : 0;
        if (!this.grounded && !this.swimming && hv > targetSpeed && along > 0.3) {
          const keep = Math.max(targetSpeed, hv - 1.5 * dt); // a little air drag
          const nx = damp(this.vel.x / hv, input.x / il, 2.5, dt);
          const nz = damp(this.vel.z / hv, input.z / il, 2.5, dt);
          const nl = hypot(nx, nz) || 1;
          this.vel.x = (nx / nl) * keep;
          this.vel.z = (nz / nl) * keep;
        } else {
          this.vel.x = damp(this.vel.x, input.x * targetSpeed, k, dt);
          this.vel.z = damp(this.vel.z, input.z * targetSpeed, k, dt);
        }
      }
      // facing
      if (!this.atk && !this.stunned && this.gripT <= 0) {
        if (this.blocking || this.charging || this.parryT > 0) this.yaw = dampAngle(this.yaw, G.game.camYaw, 14, dt);
        else if (moving) this.yaw = dampAngle(this.yaw, Math.atan2(input.x, input.z), 16, dt);
      } else if (this.atk && this.atk.phase === 'windup') {
        let aim = G.game.camYaw;
        const def = this.atk.def;
        const wcls = this.weaponClass();
        const ct = this.chase && this.chase.target;
        if (def.aerial && ct && !ct.dead) aim = Math.atan2(ct.pos.x - this.pos.x, ct.pos.z - this.pos.z);
        if (wcls && wcls.type === 'light' && def.type !== 'cast' && !def.crit && this.atk.t <= (def.windup || 0.2) * 0.6) {
          const foe = this.softFoe((def.range || wcls.range || 2.4) + 0.8);
          if (foe) aim = Math.atan2(foe.pos.x - this.pos.x, foe.pos.z - this.pos.z);
        }
        this.yaw = dampAngle(this.yaw, aim, 16, dt);
      }

      if (canAct) {
        // Space soon after an uppercut lifted a foe: leap after it (the uppercut's tail may be cut)
        if (this.chaseWin > 0 && I.wasPressed('jump')) this.buf.chase = INPUT_BUFFER;
        const upperTail = this.atk && this.atk.def.upper && this.atk.phase === 'recovery';
        if (this.buf.chase > 0 && (!busy || upperTail) && this.canChase()) {
          I.consume('jump');
          this.startChase();
        }
        // jump; in the air against a wall, a hop up it. A press just after the feet left an edge
        // still jumps from the ground (coyote time), and one just before landing jumps on
        // touching down (it waits in buf.jump); a hop or a double jump only on the press itself.
        const jumpPress = I.consume('jump');
        if (jumpPress) this.buf.jump = JUMP_BUFFER;
        if (this.buf.jump > 0 && !busy) {
          if (this.swimming) {
            this.buf.jump = 0;
            this.vel.y = this.mods.seafarer ? 9.2 : 6.5; // Seafarer: out of the water as off the ground
            this.swimming = false;
          } else if (this.grounded || (this.coyoteT > 0 && this.vel.y <= 0.01)) {
            this.buf.jump = 0;
            this.coyoteT = 0;
            this.vel.y = 9.2;
            this.grounded = false;
            this.jumps = 1;
            G.audio.play('jump', { pos: this.pos });
          } else if (!jumpPress) {
            // waiting for the ground
          } else if (this.wallHop()) {
            this.buf.jump = 0; // hopped up the wall in front
          } else if (this.mods.doubleJump && this.jumps < 2) {
            this.buf.jump = 0;
            this.vel.y = 8.5;
            this.jumps = 2;
            G.vfx.ring(this.pos, 'phys', 1.5, 0.3, { color: '#c8e8ff' });
            G.audio.play('dodge', { pos: this.pos, vol: 0.6 });
          }
        }
        // slide
        // Blitz: a slide from a run, and 40% longer
        if (I.consume('slide') && this.grounded && (this.sprinting || this.mods.blitz) && this.speed > (this.mods.blitz ? 4.5 : 7) && !busy) {
          this.slideLen = this.mods.blitz ? 1.05 : 0.75;
          this.slideT = this.slideLen;
          this.slideDir = new THREE.Vector3(this.vel.x, 0, this.vel.z).normalize();
          G.audio.play('dodge', { pos: this.pos, vol: 0.5 });
        }
      }
    }
    if (this.grounded || this.swimming) this.latches = 0;
    if (this.latchCd > 0) this.latchCd -= dt;
    if (this.grounded) {
      this.jumps = 0;
      this.airDodges = 0;
    }

    // grip progress
    if (this.gripT > 0) {
      this.gripT -= dt;
      this.vel.x = this.vel.z = 0;
      if (!this.gripDone && this.gripT < (this.gripLen || 1.2) * (0.55 / 1.2)) {
        this.gripDone = true;
        const t = this.gripTarget;
        if (t && t.knocked && !t.dead) {
          G.vfx.blood(t.center(), null, 30);
          G.vfx.addShake(0.3);
          t.finish && t.finish(this);
          if (this.mods.presence) this.heal(this.maxHp * 0.05);
        }
      }
    }

    // the air chase: up with the foe, a short string, then down; it ends on landing or a catch
    if (this.chase) {
      const c = this.chase;
      c.t += dt;
      if (this.grounded && c.t > 0.1) this.endChase();
      else if (this.climbing || this.swimming || c.t > COMBAT.launch.chaseTime) this.endChase();
      else if (this.atk && this.atk.def.chaseHit && this.atk.phase !== 'recovery') this.vel.y = 0; // hang with the foe while cutting
    }
    // in the air, moving into a wall: the hands catch its edge (mid-leap too, for the next one up),
    // but not on the chase's rising leap, which is aimed at a foe, not a wall
    const chaseLeap = this.chase && this.chase.t < this.chase.rise;
    if (canAct && !this.grounded && !this.swimming && moving && !busy && this.dodgeT <= 0 && !chaseLeap) this.tryLatch(input);
    this.noGravity = this.climbing || !!(this.chase && this.atk && this.atk.def.chaseHit && this.atk.phase !== 'recovery');
    const preVy = this.vel.y;
    this.physics(dt);
    // The abyss under the Rift is not an ocean: fall past the rim and you are gone.
    if (!this.dead && G.game?.inRift && this.pos.y < -8 && (this.groundH ?? 0) < -20) {
      this.die({ name: 'the Abyss' });
      return;
    }
    if (this.grounded && !this.wasGrounded) {
      // landed
    }
    // a fall is measured from the top of the arc it ends: a hop off a wall, a leap from a hang or
    // a catch starts a new one, so kicking off a wall low in a long drop breaks the fall
    if (!this.grounded && (this.wasGrounded || this.vel.y >= 0)) this.fallStart = this.pos.y;
    this.wasGrounded = this.grounded;
    this.coyoteT = this.grounded && !this.climbing ? COYOTE : Math.max(0, this.coyoteT - dt);
    this.speed = hypot(this.vel.x, this.vel.z);

    // footsteps
    if (this.grounded && this.speed > 1 && !this.climbing) {
      this.stepT -= dt * this.speed * 0.38;
      if (this.stepT <= 0) {
        this.stepT = 1;
        G.audio.play('step', { pos: this.pos, pitch: 0.8 + Math.random() * 0.4, surface: G.world.surfaceAt(this.pos.x, this.pos.z, this.pos.y) });
      }
    }
    if (this.swimming && this.speed > 1 && Math.random() < dt * 2) G.audio.play('swim', { pos: this.pos });

    // leap trails
    if (this.leapTrail) {
      this.leapTrail.t -= dt;
      G.vfx.trailPuff(this.center(_v), this.leapTrail.el, 0.4, 2);
      if (this.leapTrail.t <= 0) this.leapTrail = null;
    }

    // regen buffs
    const bm = this.buffMods();
    if (bm.regen) this.heal(bm.regen * dt);

    this.survival(dt);
    this.hazards(dt);

    this.syncModel(dt, {
      speed: this.speed,
      grounded: this.grounded,
      swimming: this.swimming,
      climbing: this.climbing,
      climbSpeed: this.climbing ? this.vel.y : 0,
      sliding: this.slideT > 0,
      blocking: this.blocking,
      charging: this.charging,
      stunned: this.stunned,
      vy: this.vel.y,
      flinch: this.flinch,
      runSpeed: this.speedBase * 1.68,
      sit: this.sitting,
      weaponOut: this.armed,
      leap: this.vaultT > 0, // up off a ledge: arms reaching for the edge
    });
    if (this.stealth <= 0 && this.model.mats.skin.opacity < 1) this.model.setOpacity(1);
  }

  breakStealth() {
    this.stealth = 0;
    this.model.setOpacity(1);
    const i = this.buffs.findIndex((b) => b.id === 'veil');
    if (i >= 0) this.buffs.splice(i, 1);
  }

  onLand(impact) {
    if (this.dead) return;
    const fall = this.fallStart - this.pos.y;
    const thr = 9 + (this.mods.fallResist || 0) * 14;
    // Cat's Grace: a roll just before landing takes the fall
    const rolled = this.mods.catsGrace && G.time - (this.dodgeStartT ?? -9) < 0.45;
    if (fall > thr && !this.swimming && !rolled) {
      const dmg = (fall - thr) * 6;
      this.hp -= dmg;
      G.vfx.number(this.center(_v), dmg, 'taken');
      G.ui.damageFlash(0.6);
      G.vfx.addShake(0.4);
      G.audio.play('land', { pos: this.pos, vol: 1 });
      if (this.hp <= 0) {
        this.hp = 0;
        this.onLethal(null);
      }
    } else if (impact > 8) G.audio.play('land', { pos: this.pos, vol: 0.4 });
    if (impact > 12) G.vfx.dust(this.pos, 8);
    if (hypot(this.vel.x, this.vel.z) > this.speedBase * 1.68 * 1.05) this.carryT = 0.3; // landing at speed carries it
    this.fallStart = this.pos.y;
  }

  onEnterWater() {
    G.audio.play('splash', { pos: this.pos });
    G.vfx.splash(this.pos);
    this.climbing = false;
    this.cancelAttack();
    this.clearStatus('burn');
  }

  // Hanging from a ledge: jump leaps up (forward carries you onto the top), back or dodge lets go.
  // Letting go is forced when a blow lands or the edge is gone (a gate opened).
  updateHang(canAct) {
    const I = G.input;
    this.vel.set(0, 0, 0);
    this.pos.y = this.hangY - HANG;
    if (this.stunned || this.knocked || !(Math.abs(this.probeLedge() - this.hangY) < 0.3)) return this.letGo();
    if (!canAct) return;
    if (I.consume('jump')) {
      this.climbing = false;
      this.vel.y = this.derived.latchLeap;
      this.vaultFrom = this.pos.y;
      if (I.isDown('forward')) this.vaultT = 0.55;
      G.audio.play('jump', { pos: this.pos });
    } else if (this.buf.dodge > 0 || I.isDown('back')) {
      this.buf.dodge = 0;
      this.letGo();
    }
  }

  letGo() {
    this.climbing = false;
    this.latchCd = 0.4;
    this.push.addScaledVector(forwardFromYaw(this.yaw, _v), -2);
  }

  // hunger, water, sanity, regen
  survival(dt) {
    const ch = this.ch;
    const d = this.derived;
    const exert = (this.sprinting || this.climbing) && !this.mods.ironLungs ? 1.6 : 1; // Iron Lungs
    ch.hunger = Math.max(0, ch.hunger - dt * 0.055 * d.hungerMul * exert);
    ch.water = Math.max(0, ch.water - dt * 0.075 * d.hungerMul * exert);
    const starving = ch.hunger <= 0 || ch.water <= 0;
    if (starving && !this.knocked) {
      this.hp -= dt * 0.8;
      if (this.hp <= 0) {
        this.hp = 0;
        this.onLethal(null);
      }
    } else if (!this.inDanger && !this.knocked && ch.hunger > 15 && ch.water > 15) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.012 * dt * (this.sitting ? 3 : 1));
    }
    // sanity
    if (G.game.inRift) {
      this.addSanity(-dt * 0.75);
      if (ch.sanity <= 0 && !this.knocked) {
        this.hp -= this.maxHp * 0.02 * dt;
        if (this.hp <= 0) {
          this.hp = 0;
          this.onLethal(null);
        }
      }
    } else this.addSanity(dt * 2.5 * (this.sitting && this.mods.deepBreath ? 3 : 1)); // Deep Breath
    // low health heartbeat
    if (this.hp < this.maxHp * 0.25 && !this.knocked) {
      this.lowHpBeat -= dt;
      if (this.lowHpBeat <= 0) {
        this.lowHpBeat = 1.1;
        G.audio.play('heartbeat', { vol: 0.7 });
      }
    }
  }

  hazards(dt) {
    for (const h of G.world.hazards) {
      if (this.mods.firewalker && h.element === 'ember') continue; // Firewalker
      if (hypot(this.pos.x - h.x, this.pos.z - h.z) < h.r && this.pos.y < h.y + 0.6) {
        this.takeDot(h.dps * dt, h.element, null);
        if (h.status && Math.random() < dt * 2) this.applyStatus(h.status, 1, null);
        this.refreshDanger(5);
      }
    }
  }

  takeDot(amount, element, src) {
    super.takeDot(amount, element, src);
  }

  revive(pos, hpFrac = 1) {
    this.dead = false;
    this.knocked = false;
    this.state = 'idle';
    this.removeT = -1;
    this.recompute();
    this.hp = Math.max(1, this.maxHp * hpFrac);
    this.posture = 0;
    for (const k in this.statuses) this.clearStatus(k);
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.push.set(0, 0, 0);
    this.iframes = 2;
    this.climbing = false;
    this.swimming = false;
    this.noGravity = false;
    this.fallStart = pos.y;
    this.gripT = 0;
    this.eatT = 0;
    this.cancelAttack();
    this.model.anim.stop();
  }

  // save the transient state into ch
  snapshot() {
    const ch = this.ch;
    ch.hp = this.hp;
    ch.pos = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    ch.yaw = this.yaw;
    return ch;
  }
}

export { VOWS };
