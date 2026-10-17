// Authored coastlines are shared by terrain, navigation, discovery and scattering.
// Coordinates follow the game convention: +z north, +x west.
export const COASTLINES = {
  saltreach: [
    [440,210],[470,140],[424,95],[290,40],[190,-45],[115,-140],
    [65,-130],[18,-141],[-9,-139],[-22,-184],[24,-258],[64,-360],
    [10,-410],[-120,-460],[-295,-410],
    // The fen's drowned outlet and the head of the bay silted up into the Arch Mere's low
    // country: Saltreach's shore runs on round the bay to the Fenwall's western spur, where
    // the Hundred Arches come ashore (data/greatBridge.js).
    [-306,-425],[-312,-442],[-319,-460],[-330,-476],[-340,-493],[-354,-508],
    [-363,-528],[-380,-542],[-398,-555],[-410,-574],[-431,-586],[-446,-604],
    [-469,-613],[-486,-632],[-510,-643],[-528,-662],[-545,-678],[-566,-688],
    [-585,-690],
    // a shore under the Arches' Foot, where its camp stands above the tide
    [-601,-701],[-625,-724],[-660,-738],[-700,-746],[-748,-750],[-785,-641],[-924,-565],[-1002,-418],
    [-1016,-251],[-930,-172],[-1000,-88],[-921,50],[-780,61],
    [-766,81],[-756,104],[-733,114],[-716,132],[-704,149],[-702,170],
    [-685,188],[-660,192],[-641,215],[-620,236],[-600,246],[-578,250],
    [-563,269],[-546,286],[-522,297],[-500,312],[-488,332],[-470,346],
    [-448,366],[-423,384],
    [-355,479],[-204,551],[0,559],[134,479],[262,533],[347,462],
    [313,341],[432,285],
  ],
  // Thornwood, Meridian and the Ashen Spire: one continent, in Thornwood's authored frame
  // (data/worldPlacement.js adds [400, -120]). Down Thornwood's east coast to Meridian's port,
  // along the Ashen Spire's north coast and round past Cinderstead, back along the long south
  // shore to Meridian's drydock, and home along the west coast.
  thornwood: [
    [733,302],[763,252],[744,201],[756,114],[704,21],[684,-136],
    [611,-252],
    // Meridian's north shore: the old harbour is dry land between the Ward and the Ember
    // Head, and the port stands out on the open coast in a shallow bay (data/world.js)
    [599,-265],[590,-280],[574,-286],[562,-298],[550,-308],[536,-316],
    [520,-318],[506,-326],[491,-323],[476,-320],[464,-312],[450,-306],
    [437,-299],[422,-298],[409,-302],[396,-306],[383,-309],[372,-318],
    [364,-319],[356,-320],
    // the Ember Head, and the Ashen Spire's north coast facing Saltreach across the channel,
    // out to the Saltward cape and back into Ember Cove
    [341,-319],[328,-326],[318,-340],[304,-350],[286,-355],[268,-356],
    [254,-344],[236,-342],[222,-353],[204,-354],[194,-371],[176,-380],
    [164,-377],[152,-372],[136,-361],[122,-348],[107,-346],[92,-350],
    [77,-357],[70,-372],[66,-388],[62,-404],[48,-417],[44,-436],
    [27,-442],[14,-454],[1,-465],[-8,-480],[-24,-492],[-30,-510],
    [-29,-527],[-28,-544],[-19,-557],[-8,-570],[4,-583],[10,-600],
    [7,-620],[4,-640],[0,-661],[-8,-680],[-8,-701],
    // the Ashen Spire: the volcano's north shore, Cinderstead's point, its south shore
    [-8,-722],[0,-770],[28,-816],
    [15,-860],[-74,-912],[-129,-1002],[-156,-1124],[-218,-1170],[-177,-1216],
    [-133,-1253],[-79,-1246],[55,-1304],[186,-1272],
    // the long south shore under the lava fields, swinging up to the drydock's cove
    [211,-1257],[240,-1264],[266,-1241],[300,-1242],[322,-1221],[352,-1220],
    [380,-1228],[406,-1216],[427,-1198],[450,-1184],[481,-1176],[510,-1164],
    [530,-1146],[550,-1130],[577,-1132],[600,-1116],[626,-1102],[640,-1076],
    [661,-1054],[680,-1030],[697,-1008],[700,-980],[717,-964],[732,-946],
    [751,-921],[746,-890],[763,-868],[760,-840],[752,-821],[752,-800],
    [747,-783],
    [740,-766],[837,-789],[980,-846],[1130,-720],[1127,-560],[1292,-404],
    [1380,-176],[1312,-40],[1401,156],[1350,332],[1245,376],[1201,516],
    [1098,552],[980,477],[914,408],[770,363],
  ],
  verdance: [
    [4,873],[51,893],[124,914],[169,1000],[264,1050],[288,1170],
    [237,1210],[147,1200],[102,1338],[19,1430],[-36,1376],
    [-46,1268],[-140,1227],[-225,1130],[-205,1073],[-92,1085],
    [-114,1002],[-58,965],[-29,920],
  ],
  // Frosthollow and the Hush, in Frosthollow's frame (the Hush's own points lie 240 m north
  // of where it is authored). The two meet across the Hush's old north shore, with a harbour
  // bay to the west between the two landings and a sheltered bay to the east.
  frosthollow: [
    [-554,780],[-570,725],[-625,747],[-659,794],[-714,765],
    [-768,716],[-779,638],[-710,596],[-740,535],[-804,477],
    [-816,400],[-955,337],[-1130,412],[-1164,524],[-1297,572],
    [-1352,694],[-1371,726],[-1380,762],[-1359,791],[-1360,826],
    [-1346,851],[-1326,872],[-1342,899],[-1340,930],[-1333,957],
    [-1312,976],[-1331,998],[-1350,1020],[-1373,1048],[-1390,1080],
    [-1391,1116],[-1392,1150],[-1395,1180],[-1397,1210],[-1394,1241],
    [-1398,1276],[-1300,1408],
    [-1120,1467],[-1030,1355],[-969,1330],[-814,1304],
    [-724,1221],[-657,1242],[-606,1134],[-638,1064],
    [-579,997],[-632,937],[-609,856],
  ],
};

export function coastDistance(points, x, z) {
  let inside = false, distance2 = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[j], [bx, bz] = points[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    distance2 = Math.min(distance2, (x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2);
  }
  return Math.sqrt(distance2) * (inside ? -1 : 1);
}

export function coastArea(points) {
  return Math.abs(points.reduce((sum, [x, z], i) => {
    const [nx, nz] = points[(i + 1) % points.length];
    return sum + x * nz - nx * z;
  }, 0)) / 2;
}

export function islandBounds(island, pad = 0) {
  const points = island.outline || [{ x: island.cx, z: island.cz, r: island.radius }, ...(island.lobes || [])]
    .flatMap(l => [[l.x - l.r, l.z - l.r], [l.x + l.r, l.z + l.r]]);
  return {
    x0: Math.min(...points.map(p => p[0])) - pad, x1: Math.max(...points.map(p => p[0])) + pad,
    z0: Math.min(...points.map(p => p[1])) - pad, z1: Math.max(...points.map(p => p[1])) + pad,
  };
}
