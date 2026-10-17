// Tile and slot labels (backpack tiles, hotbar slots, the backpack's hotbar strip) are small boxes
// holding item names. A name word wider than its box used to break mid-word ("WANDERE / R'S");
// instead each label is shrunk, half a pixel at a time, until its longest word fits, and only
// a word that still doesn't fit at the smallest size may break (class `fit-break`).
const MIN_PX = 6.5;

export function fitLabels(root, sel = '.bp-lbl, .slot .lbl') {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  for (const el of root.querySelectorAll(sel)) fitLabel(el);
}

export function fitLabel(el) {
  if (!el || !el.textContent || !el.clientWidth) return;
  el.classList.remove('fit-break', 'long'); // `long`: hotbar's guess, used until a label can be measured
  el.style.fontSize = '';
  el.style.letterSpacing = '';
  el.style.padding = '';
  let px = parseFloat(getComputedStyle(el).fontSize) || 9;
  // scrollWidth grows past clientWidth only when an unbreakable word overflows the box
  while (el.scrollWidth > el.clientWidth + 0.5 && px > MIN_PX) {
    px = Math.max(MIN_PX, px - 0.5);
    el.style.fontSize = px + 'px';
    if (px < 8) el.style.letterSpacing = '-0.03em';
  }
  if (el.scrollWidth > el.clientWidth + 0.5) {
    // last resort before a break: the box's own padding, and tighter letters
    el.style.padding = '0';
    el.style.letterSpacing = '-0.06em';
  }
  if (el.scrollWidth > el.clientWidth + 0.5) el.classList.add('fit-break');
}
