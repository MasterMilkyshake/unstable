// The footprints that keep scatter, camps and dressing off built ground (world.exclusions)
// number in the thousands, and placement asks "is this spot inside any of them?" hundreds of
// thousands of times while the world is built. A grid answers it with the same test a scan
// of the whole list makes, and takes in entries as later passes append them. An entry whose
// radius is a getter (the Rift's, which shrinks once vegetation is placed) is read afresh on
// every query.
const CELL = 32;
const MAX_PAD = 16; // larger pads fall back to the scan
const BIG = 96; // radii above this are few: they are always checked

const indexes = new WeakMap();

function dynamicRadius(e) {
  const d = Object.getOwnPropertyDescriptor(e, 'r');
  return !!(d && d.get);
}

class ExclusionIndex {
  constructor(list) {
    this.list = list;
    this.count = 0;
    this.cells = new Map();
    this.always = [];
  }

  _sync() {
    const list = this.list;
    for (; this.count < list.length; this.count++) {
      const e = list[this.count];
      if (dynamicRadius(e) || !(e.r >= 0 && e.r <= BIG) || !Number.isFinite(e.x) || !Number.isFinite(e.z)) {
        this.always.push(e);
        continue;
      }
      const reach = e.r + MAX_PAD;
      const x0 = Math.floor((e.x - reach) / CELL), x1 = Math.floor((e.x + reach) / CELL);
      const z0 = Math.floor((e.z - reach) / CELL), z1 = Math.floor((e.z + reach) / CELL);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const k = ix * 100003 + iz;
          let cell = this.cells.get(k);
          if (!cell) this.cells.set(k, (cell = []));
          cell.push(e);
        }
      }
    }
  }

  // list.some((e) => (x - e.x) ** 2 + (z - e.z) ** 2 < (e.r + pad) ** 2)
  hit(x, z, pad = 0) {
    if (this.list.length !== this.count) this._sync();
    if (!(pad <= MAX_PAD) || pad < 0) {
      for (const e of this.list) if ((x - e.x) ** 2 + (z - e.z) ** 2 < (e.r + pad) ** 2) return true;
      return false;
    }
    for (const e of this.always) if ((x - e.x) ** 2 + (z - e.z) ** 2 < (e.r + pad) ** 2) return true;
    const cell = this.cells.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
    if (cell) for (const e of cell) if ((x - e.x) ** 2 + (z - e.z) ** 2 < (e.r + pad) ** 2) return true;
    return false;
  }
}

// The index of an exclusion list (one per list, kept while the list lives).
export function exclusionIndex(list) {
  let ix = indexes.get(list);
  if (!ix) indexes.set(list, (ix = new ExclusionIndex(list)));
  return ix;
}

// Whether (x, z) lies within `pad` metres of any exclusion in the list.
export function excludedAt(list, x, z, pad = 0) {
  return exclusionIndex(list).hit(x, z, pad);
}
