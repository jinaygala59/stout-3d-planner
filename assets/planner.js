/* =============================================================================
   STOUT — 3D BATHROOM PLANNER  (Three.js)
   A real, orbit-able 3D room. Products mount on the walls/ceiling using the
   existing transparent product PNGs as textured panels (placeholders until real
   .glb product models exist — the engine is model-agnostic, so a GLTFLoader can
   later swap panels for true 3D geometry with no other changes).
   ========================================================================== */
(() => {
"use strict";
const { FINISHES, CATEGORIES, PRODUCTS } = window.STOUT;
const $ = s => document.querySelector(s);
if (!window.THREE) { $("#loading").textContent = "3D engine failed to load."; return; }

/* ---- room dimensions (metres) ------------------------------------------- */
const RW = 3.0, RH = 2.65, RD = 3.0;                 // width, height, depth
const HX = RW / 2, HZ = RD / 2;                       // half extents
const OFF = 0.025;                                    // how far a panel sits off its wall
/* How deep a fitting's BODY has to run to actually meet the wall. A piece is
   anchored OFF (2.5 cm) clear of its wall — the standoff that stops artwork
   z-fighting with the tiles — but the body we build for it only ran forward
   from that anchor. So every panel, trim, spout and jet stood on a 2.5 cm
   cushion of air: invisible in a room-wide shot, glaring the moment you look
   along the wall. Bodies now run from their face back THROUGH the anchor and
   into the wall, so the joint is a joint.
   The depth has to clear OFF at the SMALLEST size the resize control allows
   (0.6x — the body scales with the piece, so 2.5 cm of standoff needs 4.2 cm of
   body to still bridge it), hence 5 cm rather than 3. Everything past the wall
   face is occluded by the wall itself, so overshooting costs nothing. */
const WALL_SINK = 0.05;
const sinkFor = w => (w === "back" || w === "left" || w === "right") ? WALL_SINK : 0;
/* Ceiling fittings are flush-mounted, so they get their own two numbers instead:
   CEIL_RIM is the plate edge you actually see below the slab, and CEIL_EMBED is
   how far the housing is buried up into it. The embed is what keeps a plate
   welded to the ceiling however it is scaled or dragged. */
const CEIL_RIM = 0.026, CEIL_EMBED = 0.030;

/* per-category 3D defaults: where a fresh product lands + its real-world width */
const CAT3D = {
  // widths are showroom-scale (a touch larger than life) so every fitting reads
  // clearly from the default camera instead of vanishing on the 3m wall
  //
  // LAYOUT: everything except the showers lives on the RIGHT of the room, and
  // the RIGHT WALL is the shower wall — so the whole valve set lives on it, read
  // back-to-front by z (depth), not by x:
  //
  //    z -0.96   body jets, centred in the wet zone (its tray runs z -1.48 to
  //              -0.43). The lane was -1.08 with the columns ±0.32 off it, which
  //              put the back column at z -1.40 — 10 cm off the back wall, in the
  //              corner. Centred with a tighter straddle they sit in the shower,
  //              not in the join.
  //    z -0.50   the spout, at filling height. It was stacked under the valve at
  //              0.75, which is bath-filler height — and this room has no bath,
  //              so it read as pointing at bare floor. On its own lane it can
  //              come up to 1.05 without fouling the tall diverter trim, which
  //              reaches down to 0.89. The lane sits between the jets and the
  //              valve: the jets' lower row is at this exact height (y 1.05), so
  //              the clearance here is in DEPTH — 5.5 cm from the front jet
  //              column, 8 cm from the diverter.
  //    z -0.25   the valve, where your hand lands at the entry: thermostatic
  //              panel (1.48) with the diverter (1.06) under it. These are REACH
  //              heights — you set the temperature standing, without lifting your
  //              arm above your head. They were 1.72 / 1.30, which read fine only
  //              while the trims were rendering half a metre tall; at their real
  //              size a valve up there is unusable. 7 cm clear between them,
  //              measured with the tallest SKU in each category.
  //    z  0.52   the shattaf, up by the WC (wcZ 0.95)
  //
  // The diverters used to sit in a column on the right END of the BACK wall
  // (x 1.16) — which is not the right wall at all: you looked for them where
  // the jets are and they were round the corner, tucked against the niche.
  // Heights are a real valve wall now, and they clear each other: no two of
  // these overlap in both z and y, whatever their artwork's aspect.
  // Only the showers stay put: overhead on the ceiling, wall heads on the back
  // wall centre-line, both over the drain at x=0.
  "rain-shower":  { mount: "ceiling", width: 0.62, z: -0.55 },
  // --- the right wall, back → front ---
  /* A body jet is a SHAPE that stands proud of the tiles, and every jet render in
     the range bar the 16-jet panel is shot from three quarters — plate at one
     edge of the frame, nozzle at the other. Pressed flat as a `panel` that reads
     as a little box stuck on the wall at a diagonal, which is what these looked
     like. So they swing to face you (the treatment spouts already get) and `flip`
     mirrors the render whose nozzle would otherwise aim into the back corner.
     y 1.25 is the CENTRE of the 4-jet set: the rows straddle it at 1.45 and 1.05
     — shoulder blades and lumbar, where a body jet actually sprays. It was 1.52
     with rows at 1.76 / 1.30, and 1.76 m is the back of your head. */
  // Jets render their own PHOTOGRAPH, like every other product. A procedural jet
  // was tried to escape the 3/4 angle baked into the renders, and it did fix the
  // angle — but the piece on the wall was then geometry we invented, not the SKU
  // the client picked, which is not a trade this tool gets to make. buildBodyJet
  // is still there behind `jet3d` if a real per-SKU model ever arrives.
  /* THE SET, AND WHAT SITS IN THE MIDDLE OF IT. Four jets on a 0.64 m square,
     centred on the valve lane at z -0.25, y 1.34 — so the trim the client picks
     lands dead centre of the grid and the four jets frame it, which is how this
     wall is drawn in every brochure in the trade. The pitch is the same across
     as it is up (see SPREAD / RISE in placeProduct), so the four read as a
     square and not as two stacked pairs, and it clears the widest panel in the
     range on both axes. The rows land at 1.02 and 1.66: lumbar and shoulder
     blades, where a body jet is actually plumbed.
     0.11 m is what one of these plates measures. It was 0.15 — half again life
     size, four of them, and it looked it. */
  "body-jet":     { mount: "right", width: 0.11, z: -0.25, y: 1.34, billboard: false },
  // A filler spout belongs LOW and back in the wet zone. Dropping it to 0.78 is
  // where one actually sits, and it also frees the valve lane at z -0.25 — the
  // clash that had pushed the diverter out of that lane was this spout sitting at
  // 1.05, right where a full-height trim reaches.
  "bath-spout":   { mount: "right", width: 0.44, z: -0.72, y: 0.78, billboard: true },
  "thermostatic": { mount: "right", width: 0.50, z: -0.25, y: 1.34, panel: true },
  /* The valve lane is a single POINT, not a column: z -0.25, y 1.34, the centre
     of the jet grid. Both trim types answer to it, because on the wall they ARE
     one fitting — picking a second one out of the Diverters list replaces the
     first rather than joining it (placeProduct, `solo`). It is clear of the
     spout, which owns z -0.94..-0.50 at 0.63..0.93, and of the jets, which own
     z ±0.32 from this centre. */
  "diverter":     { mount: "right", width: 0.18, z: -0.25, y: 1.34, panel: true },
  "health-faucet":{ mount: "right", width: 0.20, y: 0.72, z: 0.52, billboard: true },  // shattaf beside the WC (wcZ 0.95)
  // --- the odds and ends the rail doesn't offer stay on the back wall, right
  //     end, clear of the niche (0.44–0.84) and of the vanity, which owns the left
  "wall-tap":     { mount: "back", width: 0.34, y: 0.42, x: 1.16, billboard: true },  // bucket tap, near the floor
  "hand-shower":  { mount: "back", width: 0.17, y: 1.15, x: 0.82, billboard: true },  // handset on a bracket
  // over the basin, which is the wall-hung vanity on the LEFT (COUNTER.x -1.06)
  // — the only place a basin mixer can go, whatever the rest of the layout does.
  // The deck-mounted ones override this with mount:"counter".
  "basin-mixer":  { mount: "back", width: 0.30, y: 1.22, x: -1.06, billboard: true },  // over the basin, under the mirror (1.37)
  "waste":        { mount: "back", width: 0.16, y: 0.40, x: 0.86 },
};
const catCfg = id => CAT3D[id] || { mount: "back", width: 0.34, y: 1.30 };

/* The TALLEST a fitting of each type can be, in metres.
   A cutout is sized from its width, and that quietly breaks for any product
   whose photograph is taller than it is wide: the Regale 3-Outlet Thermostat is
   211x637 px, so at its 0.26 m "width" it rendered 0.79 m tall — a two-and-a-
   half-foot valve on a 2.65 m wall. The concealed diverter came out 0.51 m, and
   a hand shower would have been 0.72 m. Width alone can't catch this, because
   the width is right — it is the aspect that runs away.
   So each type also declares the height it cannot exceed, and a piece whose art
   is tall is sized by THAT instead (see placeProduct). These are real catalogue
   maxima: no overhead plate in the range is over 0.60 m, no handset over 0.30 m.
   Verified against every SKU's artwork, so none of the correctly-sized pieces
   are touched — the cap only bites where the render was already wrong. */
const MAX_H = {
  "rain-shower": 0.85,     // overhead plates are genuinely large (biggest: 0.60)
  /* 0.36 / 0.34 were too low for this range and the cap stopped guarding and
     started deforming. A cap works by shrinking the WIDTH until the height
     fits, so on a genuinely tall plate — the concealed diverters are 235x744
     and 387x900 artwork — it did not shorten the piece, it squeezed it into a
     matchstick 10 cm wide and 34 cm tall. Real tall trims run to about half a
     metre, so the caps say so, and the widths below say what each plate really
     measures. The cap still bites on anything past that. */
  "thermostatic": 0.50, "diverter": 0.52, "body-jet": 0.34,
  "bath-spout": 0.30, "hand-shower": 0.30, "health-faucet": 0.30,
  "basin-mixer": 0.34, "wall-tap": 0.28, "waste": 0.30,
};
const maxHeight = (product, cfg) =>
  cfg.maxH != null ? cfg.maxH : (MAX_H[product.catId] == null ? 0.45 : MAX_H[product.catId]);

/* per-SKU overrides — the category default is only a starting point. `width` is
   the piece's REAL width in metres (so a 12 cm angle valve can't render at the
   same size as a 70 cm rain panel), `mount` moves a SKU off its category wall,
   and `shape:"head"` marks a round head that hangs off a short arm rather than
   sitting flush. Anything not listed here just uses its category default. */
const SKU3D = {
  // --- overhead plates (ceiling): real plate widths ---
  "ST-C1012": { width: 0.52 }, "ST-C1013": { width: 0.50 }, "ST-C1014": { width: 0.62 },
  "ST-C1015": { width: 0.68 }, "ST-C1016": { width: 0.50 }, "ST-C1017": { width: 0.50 },
  "ST-C1018": { width: 0.50 }, "ST-C1019": { width: 0.55 }, "ST-C1001": { width: 0.60 },
  "ST-C1002": { width: 0.60 }, "ST-C1003": { width: 0.62 }, "ST-C1004": { width: 0.62 },
  "ST-C1007": { width: 0.58 }, "ST-C1008": { width: 0.42 }, "ST-C1010": { width: 0.70 },
  "ST-C1011": { width: 0.78 },
  // --- round heads are NOT flush ceiling plates: they screw onto an arm coming
  //     out of the WALL, which is how every one of them is photographed and how
  //     they are actually installed. So they mount on the back wall at shower
  //     height and get a real flange + arm built for them (`shape:"head"`).
  //     ST-1017's artwork already contains its own arm and wall flange, so it
  //     just sits flat on the tiles — a second arm would double up. ---
  "ST-1017": { width: 0.34, mount: "back", y: 2.02 },
  "ST-1027": { width: 0.26, mount: "back", y: 2.00, shape: "head", reach: 0.30 },
  "ST-1033": { width: 0.24, mount: "back", y: 2.00, shape: "head", reach: 0.28 },
  // not a rain head at all — it is a handset, so it hangs on a wall outlet + hose
  "ST-OP1":  { width: 0.18, mount: "right", y: 0.75, z: 0.52, hose: true },   // beside the WC, where a jet spray actually goes
  // --- thermostatic trims / panels ---
  /* The three wide thermostatic bars are photographed running UPHILL to the
     right — 4.8 deg on the two Regale panels, 7.1 deg on the Compact. Laid flat
     on the tiles that is a bar mounted visibly crooked, and it shows badly
     because these sit right next to vertical grout lines. `roll` counter-rotates
     the cutout in its own plane and levels them, exactly as it does for the
     spouts (see placeProduct). The angles are measured off each render's own
     silhouette rather than guessed: the top and bottom edges are least-squares
     fitted across the frame and averaged, because the two disagree (-4.9 and
     -6.9 on the Grande) — the bar is slightly tapered as well as tilted, so its
     axis is the mean of the two. All three come out at the same -5.8 deg, which
     is what you would expect of one product family shot on one rig.
     The tall plates in this group measure 0.00 and are left alone. */
  "ST-D5018": { width: 0.55 },
  "ST-D5019": { width: 0.52 },
  "ST-D5020": { width: 0.44 },
  "ST-TX-01": { width: 0.22 },
  // 211x637 plates: a three-outlet column trim is ~0.16 wide, not 0.26. At 0.26
  // it wanted to be 0.79 m tall, which is what the old cap was there to stop —
  // and stopping it that way is what made it 12 cm wide. Right width, right cap.
  "ST-TD3":   { width: 0.16 }, "ST-TD4": { width: 0.16 },
  /* --- spouts + wall mixers: `roll` is MEASURED, never guessed. Fit the body's
     centreline through the artwork's alpha channel by least squares, take the
     angle, negate it. Every one of these three was set by eye first and every
     one was wrong — two of them in SIGN, so the piece was rolled further
     downhill and hung on the wall at a diagonal. If you change a roll, measure
     it: eyeballing a 3/4 product shot does not work. --- */
  "ST-PLAIN":  { width: 0.24 },   // artwork body slopes -22.4°
  // --- basin mixers. WM-001 and WM-002 are the WALL-mounted pair: both were
  //     filed as spouts and neither is one — see catalog.js. Their roll is
  //     measured the same way; it is a property of the photograph, not the
  //     category, so it travels with the SKU. ---
  "ST-WM-001": { width: 0.28 },   // measured -19.2°
  "ST-WM-002": { width: 0.26 },    // measured  +4.6° — nearly level already
  "ST-BM-001": { width: 0.16, mount: "counter" }, "ST-OB-D94": { width: 0.20, mount: "counter" },
  // wall taps + angle valves: low on the wall, where a bib tap actually goes
  "ST-SZ-01": { width: 0.20 }, "ST-SZ1": { width: 0.20 },
  "ST-MN-AC": { width: 0.12, y: 0.55 }, "ST-JF1": { width: 0.12, y: 0.55 },
  // --- body jets: BJ-01 is ONE 16-jet panel (its own patch of wall, clear of the
  //     shower column); the small single jets still come as a flanking set of 4.
  //     `flip` is per SKU because the range is not shot from one side: see the
  //     category note above and productTexture(). ---
  // BJ-01 is the odd one out — a face-on panel, genuinely flush, so it keeps the
  // flat body and takes no swing and no mirror.
  // the ONE genuine single: a PANEL with 16 jets in it, not a jet
  "ST-BJ-01": { width: 0.22, single: true, y: 1.32, panel: true, billboard: false, flip: false },
  // bossX / bossY are read off each render: where the escutcheon actually sits
  // in the frame, as a fraction of the piece, AFTER the mirror. See wallBoss().
  /* The ROUND jet is the one render in the range shot in near-profile: its face
     is an ellipse three-fifths as wide as it is tall, with the head's own body
     across the right of the frame. There is no square-on face in those pixels to
     recover, so it keeps its swing and its off-centre boss — it cannot be made
     to hang at 90 degrees without a new render from the factory. The two SQUARE
     jets below can, and are. */
  "ST-J06":   { width: 0.14, bossX: -0.15, bossY: 0.12, billboard: true },   // round jet: the frame carries its body as well as its face.
                                          // Plumbed as a flanking set of four, like every jet that is not a panel.
  // BJ-02 is photographed from the OTHER side: its plate already sits on the wall
  // side of the frame, so mirroring it would turn the nozzle back into the corner
  "ST-BJ-02": { width: 0.15, flip: false, bossX: -0.22, bossY: 0.07 },
  "ST-1030":  { width: 0.50 },                      // re-filed: it is an overhead plate, not a jet
  // --- 2026-09 Drive range ---
  "ST-FDP":   { width: 0.60 },                                   // wide overhead plate
  "ST-CP25":  { width: 0.26 }, "ST-MB2": { width: 0.26 }, "ST-CJ1": { width: 0.28 },   // digital control panels
  /* Concealed diverter plates, at the width each one actually measures. `y` is
     the plate CENTRE, so the taller a trim is the lower its centre has to sit —
     a 0.40 m plate centred at the category's 1.06 would put its top control at
     1.26 and its foot at 0.86, which is right; centring the 0.51 m one there
     would push it up into the thermostatic panel above. The tall ones therefore
     hang from reach height instead of straddling it. */
  "ST-D5001": { width: 0.16 }, "ST-D5002": { width: 0.15 }, "ST-D5003": { width: 0.17 },
  "ST-D5004": { width: 0.18 },
  "ST-D5009": { width: 0.17, y: 1.04 }, "ST-D5010": { width: 0.17, y: 1.03 },
  /* Square jets, hung SQUARE. `faceOn` swaps in the de-skewed copy of the same
     photograph (roomArt), which makes three things fall out at once: the plate
     is a true square so the artwork's aspect is 1:1 and it can't render as a
     leaning parallelogram; the escutcheon is dead centre of the frame, so the
     boss goes back to the origin (0 is falsy — wallBoss reads that as centred)
     and no longer has to be nudged per SKU; and there is nothing left to mirror,
     because a face-on plate has no side to be shot from. `billboard: false`
     keeps them flush: these are recessed plates, and a plate that swings to
     follow the camera is a plate that is no longer in the wall.
     0.11 m is the real plate; 0.15 was a jet the size of a side plate. */
  "ST-BJ21F": { width: 0.11, faceOn: true, billboard: false, flip: false, bossX: 0, bossY: 0 },
  "ST-2FBJ":  { width: 0.11, faceOn: true, billboard: false, flip: false, bossX: 0, bossY: 0 },
  // --- wastes + the re-filed square rain plate ---
  "ST-TXSQ-01": { width: 0.09 }, "ST-TSQ": { width: 0.09 }, "ST-SS304": { width: 0.50 },
  // --- concealed diverter: a tall trim plate (232x735 artwork), so it takes the
  //     diverter lane's height like the rest of them ---
  "ST-D5017": { width: 0.16, y: 1.00 },   // 235x744 — the tallest trim in the range, 0.51 m
};
/* the config a product is actually placed with: category default + its own overrides */
const skuCfg = product => Object.assign({}, catCfg(product.catId), SKU3D[product.code] || {});

/* =========================================================================
   THREE.js SETUP
   ========================================================================= */
const holder = $("#canvasHolder");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0d0f);

const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 100);
/* The opening / reset view. From the front-left corner looking into the back-right
   one, so the back wall AND the right wall are both in frame — body jets and
   spouts live on the right wall, and the old straight-on hero hid them. */
const HERO = { pos: [-1.25, 1.62, 1.35], tgt: [0.45, 1.22, -0.95] };
const heroPos = () => new THREE.Vector3(...HERO.pos);
const heroTgt = () => new THREE.Vector3(...HERO.tgt);
camera.position.set(...HERO.pos);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;                 // soft grounding shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
holder.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.target.set(...HERO.tgt);
controls.minDistance = 0.45; controls.maxDistance = 6.5;   // close-up inspection ↔ full-room
controls.maxPolarAngle = Math.PI * 0.62;             // low enough to look UP at ceiling heads, never under the floor
controls.minPolarAngle = Math.PI * 0.30;             // don't swing to a disorienting bird's-eye
// 180° FRONT-ONLY sweep — never orbit round to the backs / outside / tops of the
// walls. Centre the range on the room front (azimuth 0 faces the back wall).
controls.minAzimuthAngle = -Math.PI / 2;
controls.maxAzimuthAngle = Math.PI / 2;
controls.update();

/* =============================================================================
   ROOM THEMES — White / Black / Grey
   -----------------------------------------------------------------------------
   Every surface in the room is generated procedurally on a canvas as a matched
   set of COLOUR + BUMP + ROUGHNESS maps, so a "theme" is pure data — no image
   assets, no downloads. Three looks ship:

     white — seamless warm microcement / plaster, high-key light  (ref: minimal
             monolithic bathroom, backlit mirror, cove)
     black — charcoal large-format slabs + a split-face black stone feature wall,
             pale polished floor, dark walnut vanity, dramatic downlight pools
     grey  — book-matched grey marble slabs everywhere, white veining, polished
             floor, matt-black accents

   Switching a theme rebuilds the SHELL (walls / floor / ceiling / furniture /
   light rig / environment). Fittings the client already placed live in their own
   group and are never touched.
   ============================================================================= */
const texLoader = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();

/* deterministic RNG — a theme rebuilds pixel-identically every time */
function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const hex2 = h => { const n = parseInt(String(h).replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function shade(h, mul, add) {
  const p = hex2(h), k = mul == null ? 1 : mul, a = add || 0;
  const cl = v => Math.max(0, Math.min(255, Math.round(v * k + a)));
  return `rgb(${cl(p[0])},${cl(p[1])},${cl(p[2])})`;
}
function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function canvasTex(c, srgb) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  return t;
}
/* one shared tile of white noise — tiled over a surface in "soft-light" it gives
   the fine grain that stops a procedural material reading as flat vector art */
let _noiseTile = null;
function noiseTile() {
  if (_noiseTile) return _noiseTile;
  const N = 256, c = mkCanvas(N, N), x = c.getContext("2d");
  const id = x.createImageData(N, N), d = id.data, R = rng(4242);
  for (let i = 0; i < d.length; i += 4) { const v = (R() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  x.putImageData(id, 0, 0); _noiseTile = c; return c;
}
function grainOver(ctx, W, H, alpha, mode) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = mode || "soft-light";
  for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) ctx.drawImage(noiseTile(), x, y);
  ctx.restore();
}

/* ---- marble veining ------------------------------------------------------
   A vein is a wandering polyline (plus hairline offshoots). The SAME path is
   stroked into the colour, roughness and bump canvases so the vein is glossier
   and very slightly proud of the matrix — which is what sells real stone. */
function veinPath(R, W, H, dir) {
  /* One dominant flow direction per slab (real stone is bedded, not scribbled),
     walked both ways from a seed point so the vein crosses the whole face. */
  const paths = [];
  const sx = -0.4 * W + R() * 1.8 * W, sy = -0.4 * H + R() * 1.8 * H;
  const n = 40, step = Math.max(W, H) / n * 1.6;
  const walk = sign => {
    let x = sx, y = sy, a = dir + (R() - 0.5) * 0.35;
    const pts = [[x, y]];
    for (let i = 0; i < n; i++) {
      a += (R() - 0.5) * 0.26;
      const st = step * (0.7 + R() * 0.6);
      x += Math.cos(a) * st * sign; y += Math.sin(a) * st * sign;
      pts.push([x, y]);
      if (R() < 0.09 && i > 3) {                       // hairline offshoot
        let bx = x, by = y, ba = a + (R() < 0.5 ? -1 : 1) * (0.35 + R() * 0.5);
        const br = [[bx, by]];
        for (let k = 0; k < 7; k++) { ba += (R() - 0.5) * 0.3; bx += Math.cos(ba) * st * 0.6 * sign; by += Math.sin(ba) * st * 0.6 * sign; br.push([bx, by]); }
        paths.push({ pts: br, w: 0.38 });
      }
    }
    paths.push({ pts, w: 1 });
  };
  walk(1); walk(-1);
  return paths;
}
function strokePaths(ctx, paths, color, alpha, width) {
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = color; ctx.globalAlpha = alpha;
  paths.forEach(p => {
    const pts = p.pts; if (pts.length < 3) return;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineWidth = Math.max(0.6, width * p.w); ctx.stroke();
  });
  ctx.restore();
}

/* ---- split-face stone cladding (the black room's feature wall) ------------
   Rows of stacked stone strips, each row broken into random-width blocks with a
   top-lit / bottom-shadowed face + chipped striations. The bump map carries the
   same relief, so under the ceiling spots it genuinely looks three-dimensional. */
function drawSplitFace(c, b, r, W, H, R, spec) {
  const rows = spec.rows || 24, rh = H / rows;
  c.fillStyle = spec.mortar || "#0b0b0c"; c.fillRect(0, 0, W, H);
  b.fillStyle = "#242424"; b.fillRect(0, 0, W, H);
  r.fillStyle = "#ffffff"; r.fillRect(0, 0, W, H);
  for (let i = 0; i < rows; i++) {
    const y = i * rh; let x = -R() * rh * 2;
    while (x < W) {
      const w = rh * (1.0 + R() * 2.6), pad = Math.max(1, rh * 0.09);
      const t = 0.7 + R() * 0.55;
      const g = c.createLinearGradient(0, y, 0, y + rh);
      g.addColorStop(0.00, shade(spec.base, t * 1.5));
      g.addColorStop(0.28, shade(spec.base, t * 1.05));
      g.addColorStop(1.00, shade(spec.base, t * 0.45));
      c.fillStyle = g; c.fillRect(x + pad, y + pad, w - pad * 2, rh - pad * 2);
      for (let k = 0; k < 6; k++) {                       // chipped striations
        const sy = y + pad + R() * (rh - pad * 2);
        c.globalAlpha = 0.08 + R() * 0.14;
        c.fillStyle = R() < 0.5 ? "#ffffff" : "#000000";
        c.fillRect(x + pad, sy, w - pad * 2, Math.max(1, rh * 0.05 * R()));
        c.globalAlpha = 1;
      }
      const gb = b.createLinearGradient(0, y, 0, y + rh);
      gb.addColorStop(0.00, "#dedede"); gb.addColorStop(0.32, "#a4a4a4"); gb.addColorStop(1.00, "#1e1e1e");
      b.fillStyle = gb; b.fillRect(x + pad, y + pad, w - pad * 2, rh - pad * 2);
      r.fillStyle = shade("#ffffff", 0.62 + R() * 0.38);
      r.fillRect(x + pad, y + pad, w - pad * 2, rh - pad * 2);
      x += w;
    }
  }
}

/* ---- one surface = colour + bump + roughness, drawn at the surface's own
   aspect ratio so joints stay square and veining never stretches ----------- */
function buildSurface(spec, aspect, seed) {
  const W = spec.res || 1024, H = Math.max(320, Math.round(W / (aspect || 1)));
  const col = mkCanvas(W, H), bmp = mkCanvas(W, H), rgh = mkCanvas(W, H);
  const c = col.getContext("2d"), b = bmp.getContext("2d"), r = rgh.getContext("2d");
  const R = rng(seed || 11);

  if (spec.kind === "splitface") {
    drawSplitFace(c, b, r, W, H, R, spec);
    grainOver(c, W, H, 0.13); grainOver(b, W, H, 0.24, "overlay");
  } else {
    c.fillStyle = spec.base; c.fillRect(0, 0, W, H);
    b.fillStyle = "#8a8a8a"; b.fillRect(0, 0, W, H);
    r.fillStyle = "#ffffff"; r.fillRect(0, 0, W, H);

    /* soft clouding — stone/plaster is never one flat tone. cloudAlpha exists
       because on a pale wall this is the difference between "hand-finished" and
       "out of focus": big soft blotches at full strength are exactly what an
       unsharp photo looks like. */
    const clouds = spec.clouds == null ? 30 : spec.clouds;
    const cA = spec.cloudAlpha == null ? 1 : spec.cloudAlpha;
    for (let i = 0; i < clouds; i++) {
      const x = R() * W, y = R() * H, rad = Math.max(W, H) * (0.05 + R() * (spec.cloudSize == null ? 0.26 : spec.cloudSize)), up = R() < 0.5;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, up ? `rgba(255,255,255,${((0.05 + R() * 0.10) * cA).toFixed(3)})` : `rgba(0,0,0,${((0.05 + R() * 0.09) * cA).toFixed(3)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      const gr = r.createRadialGradient(x, y, 0, x, y, rad);      // patchy sheen
      gr.addColorStop(0, up ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      r.fillStyle = gr; r.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }

    /* trowel sweeps — the giveaway of real microcement / plaster */
    if (spec.trowel) {
      const tA = spec.trowelAlpha == null ? 1 : spec.trowelAlpha;
      for (let i = 0; i < spec.trowel; i++) {
        const x = R() * W, y = R() * H, w = W * (0.10 + R() * 0.30), h = H * (0.02 + R() * 0.05);
        c.save(); c.translate(x, y); c.rotate((R() - 0.5) * 0.9);
        const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
        const up = R() < 0.5;
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.5, up ? `rgba(255,255,255,${(0.09 * tA).toFixed(3)})` : `rgba(0,0,0,${(0.075 * tA).toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g; c.fillRect(-w / 2, -h / 2, w, h); c.restore();
      }
    }

    /* per-slab tone shift — no two slabs off the same block match exactly */
    if (spec.joints) {
      const J = spec.joints;
      for (let iy = 0; iy < J.rows; iy++) for (let ix = 0; ix < J.cols; ix++) {
        c.globalAlpha = 0.02 + R() * 0.03;
        c.fillStyle = R() < 0.5 ? "#ffffff" : "#000000";
        c.fillRect(ix * W / J.cols, iy * H / J.rows, W / J.cols, H / J.rows);
        c.globalAlpha = 1;
      }
    }

    /* veining */
    const vn = spec.veins || 0;
    const va = spec.veinAlpha == null ? 0.5 : spec.veinAlpha;
    const flow = (spec.flow == null ? -0.72 : spec.flow) + (R() - 0.5) * 0.4;
    /* veinSoft: a vein needs a BODY, not a line. Stroked straight onto the slab,
       even three passes deep, a vein is a wire — it reads as a scratch or a
       crack, which is what made the first marble attempt look like scribble on
       white paint. So every wide pass goes onto its own layer, that whole layer
       is blurred once, and only the hairline core is drawn crisp on top. That is
       what a real vein is: a diffuse bed of colour with a sharp seam in it. */
    const soft = spec.veinSoft ? spec.veinSoft * W / 1024 : 0;
    const hc = soft ? mkCanvas(W, H) : null;
    const hx = hc ? hc.getContext("2d") : null;
    for (let i = 0; i < vn; i++) {
      const paths = veinPath(R, W, H, flow), w = (W / 1400) * (0.55 + R() * 1.7);
      const halo = soft ? hx : c;
      // vein2: real marble is never one colour. A Calacatta vein is a warm bed
      // with a cooler grey seam running through it, so the widest pass is the
      // second tone and the core is the first.
      if (spec.vein2) strokePaths(halo, paths, spec.vein2, va * (soft ? 0.3 : 0.16), w * (soft ? 11 : 6.5));
      strokePaths(halo, paths, spec.vein || "#ffffff", va * (soft ? 0.34 : 0.09), w * (soft ? 6.5 : 4.5));
      strokePaths(halo, paths, spec.vein || "#ffffff", va * (soft ? 0.4 : 0.2), w * (soft ? 3.2 : 2.0));
      strokePaths(c, paths, spec.vein || "#ffffff", va * (soft ? 0.8 : 1) * (0.55 + R() * 0.45), w * (soft ? 1.35 : 1));
      strokePaths(r, paths, "#6e6e6e", 0.26, w * 1.8);     // veins polish glossier
      strokePaths(b, paths, "#a2a2a2", 0.2, w * 1.4);      // …and sit a hair proud
    }
    if (soft) { c.save(); c.filter = `blur(${soft.toFixed(2)}px)`; c.drawImage(hc, 0, 0); c.restore(); }

    grainOver(c, W, H, spec.grain == null ? 0.16 : spec.grain);
    // bumpGrain is the TOOTH of the surface. White noise in a bump map is
    // sandpaper if you let it get loud — a polished plaster has a tooth you can
    // only see in raking light, so this stays low and the bump scale carries it.
    grainOver(b, W, H, spec.bumpGrain == null ? 0.22 : spec.bumpGrain, "overlay");

    /* slab joints last, so nothing draws over them */
    if (spec.joints) {
      const J = spec.joints, gw = Math.max(1.4, (W / 1100) * (J.width || 2.4));
      const line = (ctx, style, x, y, w, h) => { ctx.fillStyle = style; ctx.fillRect(x, y, w, h); };
      for (let i = 1; i < J.cols; i++) {
        const x = Math.round(i * W / J.cols - gw / 2);
        line(c, "rgba(0,0,0,0.12)", x - gw * 1.8, 0, gw * 1.8, H);   // soft shadow beside…
        line(c, "rgba(0,0,0,0.07)", x + gw, 0, gw * 1.8, H);
        line(c, J.color || "#000", x, 0, gw, H);                     // …the joint itself
        line(b, "#1e1e1e", x, 0, gw, H);                             // recessed
        line(r, "#ffffff", x, 0, gw, H);                             // grout is matte
      }
      for (let i = 1; i < J.rows; i++) {
        const y = Math.round(i * H / J.rows - gw / 2);
        line(c, "rgba(0,0,0,0.12)", 0, y - gw * 1.8, W, gw * 1.8);
        line(c, "rgba(0,0,0,0.07)", 0, y + gw, W, gw * 1.8);
        line(c, J.color || "#000", 0, y, W, gw);
        line(b, "#1e1e1e", 0, y, W, gw);
        line(r, "#ffffff", 0, y, W, gw);
      }
    }
  }
  return { map: canvasTex(col, true), bump: canvasTex(bmp, false), rough: canvasTex(rgh, false) };
}
/* bumpRepeat: tile the RELIEF finer than the colour. A 1024px map stretched over
   a 3 m wall is ~3 px/cm — fine for a soft mottle, but far too coarse to read as
   a surface, which is what made the white room look like an unsharp photograph.
   Repeating the bump 4× puts the grain back at plaster scale (~0.7 mm a pixel)
   at no memory cost. Only safe where the bump carries nothing but grain — a
   slab's bump also holds its joints and veins, which must not repeat. */
function matFrom(spec, surf) {
  // MULTIPLY, never set: the four back-wall panels arrive here already cropped
  // to their slice of one shared texture set, and overwriting repeat would throw
  // that crop away. Each material owns its own bump texture, so this is in place.
  const br = spec.bumpRepeat == null ? 1 : spec.bumpRepeat;
  if (br !== 1) { surf.bump.repeat.multiplyScalar(br); surf.bump.needsUpdate = true; }
  const m = new THREE.MeshStandardMaterial({
    map: surf.map,
    bumpMap: surf.bump, bumpScale: spec.bumpScale == null ? 0.018 : spec.bumpScale,
    roughnessMap: surf.rough, roughness: spec.rough == null ? 0.6 : spec.rough,
    metalness: spec.metal == null ? 0.02 : spec.metal,
    envMapIntensity: spec.envI == null ? 1 : spec.envI,
  });
  // Polished stone lives or dies on its reflections, so it opts out of the
  // diffuse-env cap that stops matte surfaces bleaching out (tameDiffuseEnv).
  if (spec.keepEnv) m.userData.keepEnv = true;
  return m;
}
function surfaceMat(spec, aspect, seed) { return matFrom(spec, buildSurface(spec, aspect, seed)); }

/* ---- environment map: a simple room-like gradient (bright ceiling, wall band,
   darker floor) plus one soft "window" highlight. Without an environment,
   MeshStandardMaterial metals render black — this is what makes the chrome /
   gold / matt-black fittings read as real metal. */
function buildEnvMap(stops) {
  const c = mkCanvas(32, 128), x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.00, stops[0]); g.addColorStop(0.40, stops[1]);
  g.addColorStop(0.56, stops[1]); g.addColorStop(1.00, stops[2]);
  x.fillStyle = g; x.fillRect(0, 0, 32, 128);
  const wg = x.createRadialGradient(9, 46, 0, 9, 46, 30);
  wg.addColorStop(0, "rgba(255,255,255,0.8)"); wg.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = wg; x.fillRect(0, 12, 32, 70);
  const eq = canvasTex(c, false);
  eq.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromEquirectangular(eq).texture;
  eq.dispose(); pm.dispose();
  return t;
}

/* ---- soft contact / corner occlusion --------------------------------------
   Real rooms go darker where two surfaces meet. One "edge vignette" plane laid
   just in front of each wall (and over the floor) does more for believability
   than any amount of extra light — it is what stops a CG box reading as a box. */
function edgeVignette(sides) {
  const S = 256, c = mkCanvas(S, S), x = c.getContext("2d");
  const grad = (x0, y0, x1, y1, a) => {
    if (!a) return;
    const g = x.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0.00, `rgba(0,0,0,${a})`);
    g.addColorStop(0.16, `rgba(0,0,0,${(a * 0.52).toFixed(3)})`);
    g.addColorStop(0.45, `rgba(0,0,0,${(a * 0.16).toFixed(3)})`);
    g.addColorStop(1.00, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  };
  grad(0, 0, 0, S * 0.24, sides.top);
  grad(0, S, 0, S * 0.76, sides.bottom);
  grad(0, 0, S * 0.24, 0, sides.left);
  grad(S, 0, S * 0.76, 0, sides.right);
  const t = new THREE.CanvasTexture(c); t.anisotropy = maxAniso; return t;
}
function aoPlane(w, h, sides) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
    map: edgeVignette(sides), transparent: true, depthWrite: false, toneMapped: false,
  }));
}


/* =============================================================================
   THEME DATA
   ============================================================================= */
const THEMES = {
  white: {
    id: "white", label: "White", swatch: "#f1ede6",
    bg: 0x121214, exposure: 0.94,
    env: ["#e9e1d3", "#a89f8e", "#4c473e"],
    /* WHITE = MARBLE. Flat plaster was the problem: however finely you grain a
       plain wall, a room of four featureless surfaces has nothing in it for the
       eye to focus on, so it reads as an unsharp photograph rather than as a
       real room. Marble fixes that on its own terms — veins are detail with
       DIRECTION, panel joints are genuine hard edges, and a polished face
       carries a reflection gradient that tells you where the light is. So the
       walls are now book-matched large-format slabs: a warm Calacatta bed with
       cooler grey veining over it, in 1.5 x 1.3 m panels, polished (roughness
       0.2 — the floor's own polish for reference is 0.3). The feature wall gets
       the bolder run and a steeper flow, the side walls a quieter, flatter one,
       which is how a real stone bathroom is actually specified. */
    surfaces: {
      side:    { kind: "slab", base: "#eeebe3", vein: "#9a9181", vein2: "#c9b794", veins: 10, veinAlpha: 0.7, veinSoft: 7, flow: -0.55,
                 clouds: 16, cloudSize: 0.14, cloudAlpha: 0.7, grain: 0.05,
                 joints: { cols: 2, rows: 2, color: "#cfc8ba", width: 2.2 },
                 rough: 0.3, metal: 0.05, bumpScale: 0.01, envI: 0.72, keepEnv: true },
      feature: { kind: "slab", base: "#ebe7de", vein: "#8d8474", vein2: "#c0ac85", veins: 12, veinAlpha: 0.78, veinSoft: 8, flow: -0.88,
                 clouds: 16, cloudSize: 0.14, cloudAlpha: 0.7, grain: 0.05,
                 joints: { cols: 2, rows: 2, color: "#c9c2b4", width: 2.2 },
                 rough: 0.28, metal: 0.05, bumpScale: 0.011, envI: 0.78, keepEnv: true },
      // the floor is the same stone in a smaller format, so the room is one
      // material rather than three that happen to be pale
      floor:   { kind: "slab", base: "#ebe8e0", vein: "#b0a797", vein2: "#cdbf9f", veins: 9, veinAlpha: 0.44, veinSoft: 6, clouds: 20, grain: 0.06,
                 joints: { cols: 3, rows: 3, color: "#c2b9a7", width: 3.0 }, rough: 0.3, metal: 0.06, bumpScale: 0.018, envI: 1.05 },
      ceiling: { color: 0xf8f5ee, rough: 0.95 },
    },
    niche:  { lining: 0xd2ccbe, shelf: 0xf6f3ec, trim: 0xaaa496 },
    // and it was lit as flatly as it was textured: hemisphere everywhere, a
    // 0.26 key, nothing to cast a shadow or strike a highlight. The key and the
    // ceiling spots now carry the room, so surfaces have a light side and a dark
    // side; the cove haze that washed the top of the feature wall is pulled back.
    light:  { hemiSky: 0xfff4e2, hemiGround: 0xa79e8c, hemi: 0.18, amb: 0.04, ambColor: 0xffefdd,
              key: 0.38, keyColor: 0xffeed6, fill: 0.09, fillColor: 0xdfe8f6,
              spot: 0.58, spotColor: 0xffe9c9, trim: 0xa9a294, bulb: 0xfff6e6,
              cove: 0.2, coveColor: 0xffe6c4, coveAlpha: 0.22, niche: 0.16, mirror: 0.22, mirrorColor: 0xfff2e0 },
    furn:   { cab: 0xefebe3, counter: 0xf9f7f2, bowl: 0xfdfcfa, mixer: 0x4a4540, mixerRough: 0.34,
              wc: 0xfbfaf7, mirrorFrame: 0xd6d0c5, rail: 0x4a4540, towel: 0xf1ede4, mat: 0xded7c8, drain: 0xb2aca1, wet: 0xd8d2c4,
              pelmet: 0xf1eee7 },
    ao: 0.62, diffEnv: 0.32,
  },
  black: {
    id: "black", label: "Black", swatch: "#232326",
    bg: 0x08080a, exposure: 1.0,
    env: ["#63636a", "#26262b", "#0d0d10"],
    /* This room was BLACK, not dark: every surface sat between 0x0b and 0x2b, so
       the stone, the joints and the fittings all fell into the same hole and you
       could not read the room at all. The whole palette moves up into charcoal
       and graphite — still unmistakably the dark room, but now the split-face
       cladding, the slab veining and the grout lines are all legible, and a matt
       black fitting has something to sit against. */
    surfaces: {
      side:    { kind: "slab", base: "#3c3c42", vein: "#85878f", veins: 12, veinAlpha: 0.34, clouds: 20, cloudSize: 0.16, grain: 0.03,
                 joints: { cols: 2, rows: 3, color: "#1f1f23", width: 2.6 }, rough: 0.4, metal: 0.06, bumpScale: 0.022, envI: 1.2 },
      feature: { kind: "splitface", base: "#38383e", mortar: "#181820", rows: 26, rough: 0.7, metal: 0.03, bumpScale: 0.055, envI: 0.9 },
      floor:   { kind: "slab", base: "#35353b", vein: "#767780", veins: 11, veinAlpha: 0.36, clouds: 20, cloudSize: 0.16, grain: 0.035,
                 joints: { cols: 3, rows: 3, color: "#26262b", width: 2.4 }, rough: 0.3, metal: 0.08, bumpScale: 0.014, envI: 0.85 },
      ceiling: { color: 0x2b2b2f, rough: 0.9 },
    },
    niche:  { lining: 0x232327, shelf: 0x3a3a3f, trim: 0x9a958c },
    // a dark room still needs a light SIDE. The key and the fill were doing
    // almost nothing (0.17 / 0.07), which left the ceiling spots as the only
    // source and everything outside their cones unlit.
    light:  { hemiSky: 0xc4cdd9, hemiGround: 0x1b1b20, hemi: 0.26, amb: 0.075, ambColor: 0xdfe6f2,
              key: 0.3, keyColor: 0xfff1de, fill: 0.13, fillColor: 0xc9d6ea,
              spot: 0.6, spotColor: 0xffeed4, trim: 0x242427, bulb: 0xfff3e2,
              cove: 0.34, coveColor: 0xffd8a4, coveAlpha: 0.5, niche: 0.3, mirror: 0.4, mirrorColor: 0xfff0d8 },
    furn:   { cab: 0x3d2c20, counter: 0xefece6, bowl: 0x24242a, mixer: 0x242427, mixerRough: 0.42,
              wc: 0xf7f6f3, mirrorFrame: 0x1e1e22, rail: 0x242427, towel: 0xd6d3cd, mat: 0x26262b, drain: 0x2a2a2e, wet: 0x2f2f35,
              pelmet: 0x2b2b2f },
    ao: 0.58, diffEnv: 0.46,
  },
  grey: {
    id: "grey", label: "Grey", swatch: "#93969a",
    bg: 0x0e0f11, exposure: 0.96,
    env: ["#d3d3d7", "#84848a", "#2e2e32"],
    surfaces: {
      side:    { kind: "slab", base: "#9d9a96", vein: "#e6e3de", veins: 16, veinAlpha: 0.42, clouds: 20, grain: 0.07,
                 joints: { cols: 2, rows: 3, color: "#7c7975", width: 2.2 }, rough: 0.3, metal: 0.06, bumpScale: 0.014, envI: 1.2 },
      feature: { kind: "slab", base: "#8b8885", vein: "#e4e1dc", veins: 18, veinAlpha: 0.45, clouds: 20, grain: 0.07,
                 joints: { cols: 2, rows: 3, color: "#6d6a67", width: 2.2 }, rough: 0.28, metal: 0.07, bumpScale: 0.014, envI: 1.25 },
      floor:   { kind: "slab", base: "#a7a4a0", vein: "#e0ddd8", veins: 14, veinAlpha: 0.38, clouds: 20, grain: 0.07,
                 joints: { cols: 3, rows: 3, color: "#8b8884", width: 2.0 }, rough: 0.26, metal: 0.08, bumpScale: 0.01, envI: 1.3 },
      ceiling: { color: 0xd9d7d4, rough: 0.9 },
    },
    niche:  { lining: 0x6f6d6a, shelf: 0xe6e4e0, trim: 0x2a2c2f },
    light:  { hemiSky: 0xeef3fa, hemiGround: 0x3c3c40, hemi: 0.19, amb: 0.045, ambColor: 0xeef2f8,
              key: 0.24, keyColor: 0xfff4e6, fill: 0.09, fillColor: 0xdae4f2,
              spot: 0.5, spotColor: 0xfff3e2, trim: 0x2a2c2f, bulb: 0xfff6ea,
              cove: 0.24, coveColor: 0xffe2b8, coveAlpha: 0.4, niche: 0.2, mirror: 0.28, mirrorColor: 0xfff2e2 },
    furn:   { cab: 0x35373a, counter: 0xeceae7, bowl: 0xfbfaf9, mixer: 0x1b1b1d, mixerRough: 0.42,
              wc: 0xfbfaf8, mirrorFrame: 0x2a2c2f, rail: 0x1b1b1d, towel: 0xe1dfdb, mat: 0x8e8d8a, drain: 0x6c6e71, wet: 0x8d8a86,
              pelmet: 0xd9d7d4 },
    ao: 0.64, diffEnv: 0.38,
  },
};
const THEME_ORDER = ["white", "black", "grey"];
const THEME_KEY = "stout.3d.theme";

/* -----------------------------------------------------------------------------
   CEILING COLOUR
   Each room theme paints its own ceiling, but the ceiling is the one surface a
   client most often wants to take somewhere else — a dark slab over pale walls
   is a signature of the range. So it is choosable on its own, and the choice
   OUTLIVES a room change: pick Ink, switch White → Grey, the ceiling stays Ink.
   "auto" hands it back to whatever the room theme says.
   Darker paints are a little sheenier than chalk emulsion, hence the roughness
   walking down with the tone.                                              */
const CEILINGS = [
  { id: "auto",     name: "Match the room" },
  { id: "chalk",    name: "Chalk White",  color: 0xf8f5ee, rough: 0.95 },
  { id: "sand",     name: "Warm Sand",    color: 0xe7ddca, rough: 0.93 },
  { id: "dove",     name: "Dove Grey",    color: 0xcfcdc8, rough: 0.90 },
  { id: "graphite", name: "Graphite",     color: 0x3c3c40, rough: 0.86 },
  { id: "ink",      name: "Ink Black",    color: 0x1a1a1c, rough: 0.82 },
];
const CEILING_KEY = "stout.3d.ceiling";
const ceilingById = id => CEILINGS.find(c => c.id === id) || CEILINGS[0];
let ceilingChoice = "auto";
try {
  const savedCeil = localStorage.getItem(CEILING_KEY);
  if (savedCeil && CEILINGS.some(c => c.id === savedCeil)) ceilingChoice = savedCeil;
} catch (_) { /* storage blocked — stay on auto */ }
/* what the ceiling should actually be built from, for a given theme */
function ceilingSurface(t) {
  const c = ceilingById(ceilingChoice);
  return c.color == null ? t.surfaces.ceiling : { color: c.color, rough: c.rough };
}
/* the room, named for the spec sheet — with the ceiling only when it is a
   deliberate departure from the theme */
function roomLabel() {
  const c = ceilingById(ceilingChoice);
  return c.color == null ? THEME.label : `${THEME.label} · ${c.name} ceiling`;
}

/* =============================================================================
   SCENE GRAPH
     shell    — walls / floor / ceiling / furniture   (rebuilt on theme change)
     lightRig — every theme-owned light               (rebuilt on theme change)
     room     — the fittings the client places        (never touched)
   ============================================================================= */
const shell = new THREE.Group(); scene.add(shell);
const lightRig = new THREE.Group(); scene.add(lightRig);
const room = new THREE.Group(); scene.add(room);
const NICHE = { x: 0.64, y: 2.12, w: 0.40, h: 0.34, d: 0.13 };  // off-centre: the shower centre-line (x=0) is kept clear for the head + its arm
let THEME = THEMES.white;
let cornerBasinUnit = null, bathroomDetails = null;
let ceilMesh = null, pelmetMesh = null;        // repainted in place by setCeiling()
let basinVisible = true;

function metalMat(hex, rough) {
  return new THREE.MeshStandardMaterial({ color: hex, metalness: 1.0, roughness: rough == null ? 0.18 : rough * 0.8, envMapIntensity: 1.5 });
}
function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach(m => {
        ["map", "bumpMap", "roughnessMap", "emissiveMap", "alphaMap"].forEach(k => { if (m[k]) m[k].dispose(); });
        m.dispose();
      });
    }
  });
}
function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); disposeTree(c); } }
/* The environment map doubles as ambient light for MeshStandardMaterial. Metals
   need it strong (that is their reflection); matte surfaces do not, or the whole
   room bleaches out. Cap what non-metals take from it. */
function tameDiffuseEnv(root, cap) {
  root.traverse(o => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (m.userData && m.userData.keepEnv) return;
      if (m.isMeshStandardMaterial && m.metalness < 0.35 && m.envMapIntensity > cap) m.envMapIntensity = cap;
    });
  });
}

/* =============================================================================
   LIGHT RIG — a real bathroom is lit from the ceiling, not by a fake sun.
   Recessed downlights (visible trims + emissive lenses + spot pools) do the
   work; a soft directional keeps the shadows grounded and readable.
   ============================================================================= */
function buildLights(t) {
  const L = t.light;
  lightRig.add(new THREE.HemisphereLight(L.hemiSky, L.hemiGround, L.hemi));
  lightRig.add(new THREE.AmbientLight(L.ambColor, L.amb));

  const key = new THREE.DirectionalLight(L.keyColor, L.key);
  key.position.set(1.4, 3.8, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 14;
  key.shadow.camera.left = -3.2; key.shadow.camera.right = 3.2;
  key.shadow.camera.top = 3.6; key.shadow.camera.bottom = -1.2;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  lightRig.add(key);

  const fill = new THREE.DirectionalLight(L.fillColor, L.fill);
  fill.position.set(-2.6, 2.2, 2.4); lightRig.add(fill);

  /* recessed ceiling downlights */
  const trimMat = new THREE.MeshStandardMaterial({ color: L.trim, metalness: 0.85, roughness: 0.34, envMapIntensity: 1.2 });
  const lensMat = new THREE.MeshBasicMaterial({ color: L.bulb, toneMapped: false });
  [[-0.82, -0.86, true], [0.82, -0.86, true], [-0.82, 0.72, false], [0.82, 0.72, false]].forEach(([x, z, shadow]) => {
    const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.016, 30), trimMat);
    trim.position.set(x, RH - 0.008, z); lightRig.add(trim);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 30), lensMat);
    lens.rotation.x = Math.PI / 2; lens.position.set(x, RH - 0.017, z); lightRig.add(lens);
    const sp = new THREE.SpotLight(L.spotColor, L.spot, 7.2, 0.62, 0.85, 1.7);
    sp.position.set(x, RH - 0.03, z);
    sp.target.position.set(x * 1.25, 0, z * 1.1);
    if (shadow) {
      sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024);
      sp.shadow.bias = -0.0006; sp.shadow.normalBias = 0.02; sp.shadow.radius = 3;
      sp.shadow.camera.near = 0.2; sp.shadow.camera.far = 8;
    }
    lightRig.add(sp); lightRig.add(sp.target);
  });

  /* LED cove washing down the feature wall */
  // the pelmet is a strip of the ceiling turned down over the LED, so it takes
  // the ceiling's colour — left theme-white under an Ink ceiling it read as a
  // random white plank stuck to the wall
  const pelC = ceilingById(ceilingChoice).color;
  const pelmet = new THREE.Mesh(new THREE.BoxGeometry(RW - 0.18, 0.085, 0.1),
    new THREE.MeshStandardMaterial({ color: pelC == null ? t.furn.pelmet : pelC, roughness: 0.85, metalness: 0.03 }));
  pelmet.position.set(0, RH - 0.043, -HZ + 0.05); pelmet.castShadow = true; lightRig.add(pelmet);
  pelmetMesh = pelmet;
  const gc = mkCanvas(32, 256), gx = gc.getContext("2d");
  const gg = gx.createLinearGradient(0, 0, 0, 256);
  gg.addColorStop(0, `rgba(255,214,152,${L.coveAlpha})`);
  gg.addColorStop(0.45, `rgba(255,206,140,${(L.coveAlpha * 0.3).toFixed(3)})`);
  gg.addColorStop(1, "rgba(255,200,132,0)");
  gx.fillStyle = gg; gx.fillRect(0, 0, 32, 256);
  const coveGlow = new THREE.Mesh(new THREE.PlaneGeometry(RW - 0.24, 0.44),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  coveGlow.position.set(0, RH - 0.38, -HZ + 0.012); lightRig.add(coveGlow);
  const coveLight = new THREE.PointLight(L.coveColor, L.cove, 3.4, 2);
  coveLight.position.set(0, RH - 0.2, -HZ + 0.32); lightRig.add(coveLight);

  /* niche + mirror accents */
  const nl = new THREE.PointLight(0xffd9a6, L.niche, 1.2, 2);
  nl.position.set(NICHE.x, NICHE.y + NICHE.h / 2 - 0.06, -HZ - NICHE.d / 2); lightRig.add(nl);
  const ml = new THREE.PointLight(L.mirrorColor, L.mirror, 2.2, 2);
  ml.position.set(-1.08, 1.6, -HZ + 0.28); lightRig.add(ml);
}

/* =============================================================================
   THE ROOM SHELL
   ============================================================================= */
function buildShell(t) {
  const S = t.surfaces;

  /* FLOOR */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), surfaceMat(S.floor, RW / RD, 101));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.material.userData.keepEnv = true;   // polished stone keeps its sheen
  shell.add(floor);

  /* CEILING — the client's own colour when they have chosen one */
  const CS = ceilingSurface(t);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD),
    new THREE.MeshStandardMaterial({ color: CS.color, roughness: CS.rough, metalness: 0.0, envMapIntensity: 0.5 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; shell.add(ceil);
  ceilMesh = ceil;

  /* SIDE WALLS */
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(RD, RH), surfaceMat(S.side, RD / RH, 202));
  leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-HX, RH / 2, 0);
  leftWall.receiveShadow = true; shell.add(leftWall);
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(RD, RH), surfaceMat(S.side, RD / RH, 707));
  rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(HX, RH / 2, 0);
  rightWall.receiveShadow = true; shell.add(rightWall);

  /* FEATURE (BACK) WALL — four panels around a real rectangular opening, all cut
     from ONE texture set with matched repeat/offset so the stone runs continuous
     across the seams and the niche is a true recess, not a frame stuck on. */
  const bw = buildSurface(S.feature, RW / RH, 303);
  const nx0 = NICHE.x - NICHE.w / 2, nx1 = NICHE.x + NICHE.w / 2;
  const ny0 = NICHE.y - NICHE.h / 2, ny1 = NICHE.y + NICHE.h / 2;
  function bwPanel(x0, y0, w, h) {
    const cut = tex => { const c2 = tex.clone(); c2.needsUpdate = true; c2.repeat.set(w / RW, h / RH); c2.offset.set((x0 + HX) / RW, y0 / RH); return c2; };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      matFrom(S.feature, { map: cut(bw.map), bump: cut(bw.bump), rough: cut(bw.rough) }));
    m.position.set(x0 + w / 2, y0 + h / 2, -HZ);
    m.receiveShadow = true; shell.add(m);
    return m;
  }
  bwPanel(-HX, 0, nx0 + HX, RH);
  bwPanel(nx1, 0, HX - nx1, RH);
  bwPanel(nx0, ny1, NICHE.w, RH - ny1);
  bwPanel(nx0, 0, NICHE.w, ny0);
  bw.map.dispose(); bw.bump.dispose(); bw.rough.dispose();   // only the clones are used

  /* niche cavity: lined recess + stone shelf + toiletries */
  const lining = () => new THREE.MeshStandardMaterial({ color: t.niche.lining, roughness: 0.6, metalness: 0.05, envMapIntensity: 0.7 });
  const nBack = new THREE.Mesh(new THREE.PlaneGeometry(NICHE.w, NICHE.h), lining());
  nBack.position.set(NICHE.x, NICHE.y, -HZ - NICHE.d); shell.add(nBack);
  const nTop = new THREE.Mesh(new THREE.PlaneGeometry(NICHE.w, NICHE.d), lining());
  nTop.rotation.x = Math.PI / 2; nTop.position.set(NICHE.x, ny1, -HZ - NICHE.d / 2); shell.add(nTop);
  const nBot = new THREE.Mesh(new THREE.PlaneGeometry(NICHE.w, NICHE.d), lining());
  nBot.rotation.x = -Math.PI / 2; nBot.position.set(NICHE.x, ny0, -HZ - NICHE.d / 2); shell.add(nBot);
  const nLft = new THREE.Mesh(new THREE.PlaneGeometry(NICHE.d, NICHE.h), lining());
  nLft.rotation.y = Math.PI / 2; nLft.position.set(nx0, NICHE.y, -HZ - NICHE.d / 2); shell.add(nLft);
  const nRgt = new THREE.Mesh(new THREE.PlaneGeometry(NICHE.d, NICHE.h), lining());
  nRgt.rotation.y = -Math.PI / 2; nRgt.position.set(nx1, NICHE.y, -HZ - NICHE.d / 2); shell.add(nRgt);
  [nBack, nTop, nBot, nLft, nRgt].forEach(m => (m.receiveShadow = true));
  const trimMat = new THREE.MeshStandardMaterial({ color: t.niche.trim, metalness: 0.85, roughness: 0.38, envMapIntensity: 1.1 });
  const mkTrim = (w, h, px, py) => { const b2 = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), trimMat); b2.position.set(px, py, -HZ + 0.002); shell.add(b2); };
  mkTrim(NICHE.w + 0.026, 0.014, NICHE.x, ny1); mkTrim(NICHE.w + 0.026, 0.014, NICHE.x, ny0);
  mkTrim(0.014, NICHE.h + 0.026, nx0, NICHE.y); mkTrim(0.014, NICHE.h + 0.026, nx1, NICHE.y);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(NICHE.w - 0.02, 0.014, NICHE.d - 0.03),
    new THREE.MeshStandardMaterial({ color: t.niche.shelf, roughness: 0.3, metalness: 0.08 }));
  shelf.position.set(NICHE.x, NICHE.y, -HZ - NICHE.d / 2); shelf.castShadow = shelf.receiveShadow = true; shell.add(shelf);
  const bottle = (rad, hgt, col, dx, dy) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, hgt, 22),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.05, envMapIntensity: 0.8 }));
    m.position.set(NICHE.x + dx, NICHE.y + hgt / 2 + 0.008 + dy, -HZ - NICHE.d / 2);
    m.castShadow = true; shell.add(m);
  };
  bottle(0.026, 0.13, 0x9fb8ad, -0.15, 0); bottle(0.021, 0.1, 0xd8cdb6, 0.12, 0); bottle(0.023, 0.115, 0xcabf9f, -0.03, 0);

  /* ambient occlusion: darker in every corner, along the floor line and under
     the ceiling — the single cheapest realism win in the whole scene */
  const A = t.ao;
  const wallAO = (w, rotY, px, pz) => {
    const p = aoPlane(w, RH, { bottom: A, left: A * 0.75, right: A * 0.75, top: A * 0.5 });
    p.rotation.y = rotY; p.position.set(px, RH / 2, pz); p.renderOrder = 2; shell.add(p);
  };
  wallAO(RW, 0, 0, -HZ + 0.008);
  wallAO(RD, Math.PI / 2, -HX + 0.008, 0);
  wallAO(RD, -Math.PI / 2, HX - 0.008, 0);
  const fao = aoPlane(RW, RD, { top: A, left: A * 0.85, right: A * 0.85, bottom: 0 });
  fao.rotation.x = -Math.PI / 2; fao.position.y = 0.022; fao.renderOrder = 2; shell.add(fao);
}

/* =============================================================================
   WALL-HUNG VANITY + VESSEL BASIN + 3D MIXER  (fixed furniture, not selectable)
   Floating off the floor, flush into the back-left corner — the detail that
   separates a showroom render from a box with a sink in it.
   ============================================================================= */
/* where a deck-mounted mixer stands on the vanity (filled in by buildCornerBasin) */
const COUNTER = { x: -1.06, y: 0.98, z: -1.39 };
/* The vanity ships with a mixer on it. Choosing one of your own replaces it —
   and that is true whether the one you chose stands on the deck or hangs on the
   WALL above the basin, which is what ST-WM-001 and ST-WM-002 do. Keyed to
   mount:"counter" alone, a wall mixer left the stock tap standing and the basin
   ended up with two. */
const isBasinMixer = (product, wall) => wall === "counter" || (product && product.catId === "basin-mixer");

function setStockMixer(on) {
  const m = cornerBasinUnit && cornerBasinUnit.getObjectByName("stockMixer");
  if (m) m.visible = on;
}
function buildCornerBasin(t) {
  const F = t.furn;
  const g = new THREE.Group();
  const cabW = 0.86, cabD = 0.5, cabH = 0.44, floatY = 0.5;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabD),
    new THREE.MeshStandardMaterial({ color: F.cab, roughness: 0.5, metalness: 0.08, envMapIntensity: 0.7 }));
  cab.position.y = floatY + cabH / 2; g.add(cab);
  /* recessed finger-pull shadow line under the drawer front */
  const pull = new THREE.Mesh(new THREE.BoxGeometry(cabW - 0.06, 0.014, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.9 }));
  pull.position.set(0, floatY + cabH - 0.05, cabD / 2 + 0.001); g.add(pull);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.04, 0.04, cabD + 0.04),
    new THREE.MeshStandardMaterial({ color: F.counter, roughness: 0.24, metalness: 0.08, envMapIntensity: 0.9 }));
  counter.position.y = floatY + cabH + 0.02; g.add(counter);
  const topY = floatY + cabH + 0.04;
  const bh = 0.14;
  const bowlMat = new THREE.MeshStandardMaterial({ color: F.bowl, roughness: 0.09, metalness: 0.02, envMapIntensity: 1.1 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.155, bh, 48), bowlMat);
  bowl.position.set(0, topY + bh / 2, 0.04); g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.184, 0.011, 12, 48), bowlMat);
  rim.rotation.x = Math.PI / 2; rim.position.set(0, topY + bh, 0.04); g.add(rim);
  const hollow = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.03, 48),
    new THREE.MeshStandardMaterial({ color: F.bowl, roughness: 0.18, metalness: 0.02 }));
  hollow.position.set(0, topY + bh - 0.015, 0.04); g.add(hollow);
  /* tall single-lever mixer behind the bowl — grouped + named so that picking a
     real basin mixer from the rail can stand in its place instead of doubling up */
  const stock = new THREE.Group(); stock.name = "stockMixer"; g.add(stock);
  const mm = (rough) => new THREE.MeshStandardMaterial({ color: F.mixer, metalness: 0.95, roughness: rough == null ? F.mixerRough : rough, envMapIntensity: 1.3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.041, 0.02, 32), mm());
  base.position.set(0, topY + 0.01, -0.15); stock.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.3, 28), mm());
  body.position.set(0, topY + 0.16, -0.15); stock.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.046, 0.17), mm());
  neck.position.set(0, topY + 0.298, -0.07); stock.add(neck);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.05, 20), mm());
  tip.position.set(0, topY + 0.278, 0.005); stock.add(tip);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.026), mm());
  lever.position.set(0.05, topY + 0.31, -0.15); lever.rotation.z = 0.2; stock.add(lever);
  g.position.set(-HX + cabW / 2 + 0.01, 0, -HZ + cabD / 2 + 0.01);
  COUNTER.x = g.position.x; COUNTER.y = topY; COUNTER.z = g.position.z - 0.15;   // the stock mixer's spot
  g.userData.basinUnit = true;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* Terry-cloth: a fine loop weave plus the woven bands a real towel has near each
   end. Used as both colour and bump so the pile catches the light. */
let _fabTex = null;
function fabricTexture() {
  if (_fabTex) return _fabTex;
  const S = 256, c = mkCanvas(S, S), x = c.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, S, S);
  for (let iy = 0; iy < S; iy += 5) for (let ix = 0; ix < S; ix += 5) {   // terry loops
    x.fillStyle = (ix + iy) % 10 === 0 ? "rgba(0,0,0,0.11)" : "rgba(255,255,255,0.55)";
    x.beginPath(); x.arc(ix + 2.5, iy + 2.5, 2, 0, 7); x.fill();
  }
  x.fillStyle = "rgba(0,0,0,0.09)";                                        // woven end bands
  x.fillRect(0, S * 0.14, S, S * 0.022); x.fillRect(0, S * 0.185, S, S * 0.012);
  x.fillRect(0, S * 0.80, S, S * 0.012); x.fillRect(0, S * 0.845, S, S * 0.022);
  grainOver(x, S, S, 0.3);          // grainOver takes the CONTEXT, not the canvas
  _fabTex = canvasTex(c, true);
  return _fabTex;
}
/* A towel folded over its rail: a rounded fold on top and two hanging faces that
   are gently waved, so it reads as cloth. A flat box just looked like a pale
   panel stuck to the wall. Built hanging DOWN from the origin (the rail). */
function buildTowel(hex, w, h) {
  const g = new THREE.Group();
  const tex = fabricTexture();
  const mat = new THREE.MeshStandardMaterial({
    color: hex, map: tex, bumpMap: tex, bumpScale: 0.0035,
    roughness: 0.97, metalness: 0, envMapIntensity: 0.25, side: THREE.DoubleSide,
  });
  const gap = 0.018;                                    // half the drape thickness
  const fold = new THREE.Mesh(new THREE.CylinderGeometry(gap, gap, w, 22, 1, true), mat);
  fold.rotation.z = Math.PI / 2; g.add(fold);           // lies along the rail
  [-1, 1].forEach(sign => {
    const geo = new THREE.PlaneGeometry(w, h, 18, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i);
      const t = (py + h / 2) / h;                       // 1 at the fold, 0 at the hem
      pos.setZ(i, sign * (gap + Math.sin(px / w * Math.PI * 4.5 + (sign > 0 ? 0 : 0.9)) * 0.009 * (1.15 - t)));
      if (t < 0.02) pos.setY(i, py + Math.sin(px / w * Math.PI * 4.5) * 0.008);   // soft hem
    }
    geo.computeVertexNormals();
    const face = new THREE.Mesh(geo, mat);
    face.position.y = -h / 2; g.add(face);
  });
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* a small potted plant — every one of the reference bathrooms has greenery, and
   nothing else so cheaply says "someone lives here" */
let _leafTex = null;
function leafTexture() {
  if (_leafTex) return _leafTex;
  const W = 128, H = 256, c = mkCanvas(W, H), x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#5c8a52"); g.addColorStop(0.5, "#416d3f"); g.addColorStop(1, "#2d5231");
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(W / 2, 4);
  x.quadraticCurveTo(W - 6, H * 0.44, W / 2, H - 4);
  x.quadraticCurveTo(6, H * 0.44, W / 2, 4);
  x.closePath(); x.fill();
  x.strokeStyle = "rgba(255,255,255,0.16)"; x.lineWidth = 3;
  x.beginPath(); x.moveTo(W / 2, 12); x.lineTo(W / 2, H - 12); x.stroke();
  _leafTex = canvasTex(c, true);
  _leafTex.wrapS = _leafTex.wrapT = THREE.ClampToEdgeWrapping;
  return _leafTex;
}
function buildPlant(x, y, z, scale) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.13, 28),
    new THREE.MeshStandardMaterial({ color: 0xcdc4b4, roughness: 0.8, metalness: 0.03, envMapIntensity: 0.6 }));
  pot.position.y = 0.065; pot.castShadow = pot.receiveShadow = true; g.add(pot);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.01, 24),
    new THREE.MeshStandardMaterial({ color: 0x38302a, roughness: 1 }));
  soil.position.y = 0.129; g.add(soil);
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTexture(), transparent: true, alphaTest: 0.42, side: THREE.DoubleSide,
    roughness: 0.62, metalness: 0, envMapIntensity: 0.5,
  });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.4, h = 0.17 + (i % 3) * 0.05;
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.5, h), leafMat);
    leaf.position.set(Math.cos(a) * 0.032, 0.132 + h * 0.42, Math.sin(a) * 0.032);
    leaf.rotation.x = 0.26 + (i % 4) * 0.13;
    leaf.rotation.y = -a;
    leaf.castShadow = false;
    g.add(leaf);
  }
  g.position.set(x, y, z); if (scale) g.scale.setScalar(scale);
  return g;
}

/* =============================================================================
   FIXED BATHROOM DETAILS — backlit mirror, wall-hung WC, towel rail, floor drain
   ============================================================================= */
function buildBathroomDetails(t) {
  const F = t.furn, L = t.light;
  const grp = new THREE.Group();

  /* BACKLIT MIRROR over the vanity: a halo of light behind the glass is the
     signature of every one of the reference bathrooms. */
  const haloC = mkCanvas(128, 160), hx = haloC.getContext("2d");
  const hg = hx.createRadialGradient(64, 80, 20, 64, 80, 78);
  hg.addColorStop(0, "rgba(255,240,215,0.85)");
  hg.addColorStop(0.62, "rgba(255,232,196,0.36)");
  hg.addColorStop(1, "rgba(255,226,186,0)");
  hx.fillStyle = hg; hx.fillRect(0, 0, 128, 160);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.24),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(haloC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.position.set(-1.08, 1.58, -HZ + 0.014); grp.add(halo);
  /* The mirror used to run 1.08 → 2.08, i.e. from just above the counter, which
     left no wall at all over the basin — and the range has two WALL-mounted basin
     mixers (ST-WM-001, ST-WM-002) that have to go exactly there. Placed, they
     rendered inside the mirror and you never saw them. It now starts at 1.37, a
     40 cm splash gap over the counter, which is where a mirror sits in any
     vanity detailed for a wall mixer. */
  const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.78, 0.026),
    new THREE.MeshStandardMaterial({ color: F.mirrorFrame, metalness: 0.55, roughness: 0.42, envMapIntensity: 1 }));
  mirrorFrame.position.set(-1.08, 1.76, -HZ + 0.026); grp.add(mirrorFrame);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x8b9096, metalness: 1, roughness: 0.06, envMapIntensity: 1.7 }));
  mirror.position.set(-1.08, 1.76, -HZ + 0.041); grp.add(mirror);

  /* WALL-HUNG WC on the right wall */
  const porcelain = new THREE.MeshStandardMaterial({ color: F.wc, roughness: 0.14, metalness: 0.02, envMapIntensity: 0.9 });
  const wcZ = 0.95;
  const backBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.4), porcelain);
  backBox.position.set(HX - 0.11, 0.4, wcZ); grp.add(backBox);
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.23, 36), porcelain);
  pan.scale.x = 1.55; pan.position.set(HX - 0.33, 0.38, wcZ); grp.add(pan);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.028, 36), porcelain);
  seat.scale.x = 1.55; seat.position.set(HX - 0.31, 0.508, wcZ); grp.add(seat);

  /* towel rail + towel on the left wall */
  const railMat = new THREE.MeshStandardMaterial({ color: F.rail, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.62, 16), railMat);
  bar.rotation.x = Math.PI / 2; bar.position.set(-HX + 0.075, 1.18, 0.55); grp.add(bar);
  [0.3, 0.8].forEach(z => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.075, 12), railMat);
    p.rotation.z = Math.PI / 2; p.position.set(-HX + 0.038, 1.18, z); grp.add(p);
  });
  const towel = buildTowel(F.towel, 0.30, 0.46);
  towel.position.set(-HX + 0.075, 1.18, 0.55);
  towel.rotation.y = Math.PI / 2;              // width runs along the rail, faces the room
  grp.add(towel);

  /* ---- the shower zone: fittings used to float on an undefined wall over an
     undefined floor. A shallow recessed tray in a wetter, darker tile — with
     the linear drain sitting IN it — tells you where the shower is. ---- */
  // It runs from the shower column on the back wall to the RIGHT wall, because
  // that is now where the body jets and spouts are — a corner enclosure. It has
  // an open edge on two sides only, so those are the only two that get a trim.
  const zoneX0 = -0.65, zoneD = 1.05, zoneZ = -HZ + zoneD / 2 + 0.02;
  const zoneW = HX - zoneX0, zoneCx = zoneX0 + zoneW / 2;
  const wetTile = new THREE.MeshStandardMaterial({
    color: F.wet || F.mat, roughness: 0.22, metalness: 0.1, envMapIntensity: 1.25,
  });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(zoneW, 0.018, zoneD), wetTile);
  tray.position.set(zoneCx, 0.009, zoneZ); tray.receiveShadow = true; grp.add(tray);
  // a thin metal edge where the tray meets the room floor
  const edgeMat = new THREE.MeshStandardMaterial({ color: F.drain, metalness: 0.85, roughness: 0.35, envMapIntensity: 1.2 });
  const eF = new THREE.Mesh(new THREE.BoxGeometry(zoneW, 0.02, 0.012), edgeMat);
  eF.position.set(zoneCx, 0.01, zoneZ + zoneD / 2); grp.add(eF);
  const eL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, zoneD), edgeMat);
  eL.position.set(zoneX0, 0.01, zoneZ); grp.add(eL);

  /* linear floor drain in the shower zone */
  const drain = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.008, 0.07),
    new THREE.MeshStandardMaterial({ color: F.drain, metalness: 0.85, roughness: 0.3, envMapIntensity: 1.2 }));
  drain.position.set(zoneCx, 0.021, -1.05); grp.add(drain);   // centred in the tray
  for (let i = -3; i <= 3; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x1d1c1a, roughness: 0.7 }));
    slot.position.set(zoneCx + i * 0.06, 0.027, -1.05); grp.add(slot);
  }

  /* ---- the small stuff that makes a render read as a lived-in room ----
     rolled towels + a dispenser on the counter, a potted plant, a bath mat. */
  const counterY = 0.98, vx = -1.06, vz = -1.24;          // vanity counter top / centre
  const towelRoll = (x, z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.15, 24),
      new THREE.MeshStandardMaterial({ color: F.towel, roughness: 0.98, metalness: 0 }));
    m.rotation.z = Math.PI / 2; m.position.set(x, counterY + 0.043, z); grp.add(m);
  };
  towelRoll(vx + 0.30, vz - 0.09); towelRoll(vx + 0.30, vz + 0.01);
  const disp = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.03, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: F.counter, roughness: 0.35, metalness: 0.05, envMapIntensity: 0.9 }));
  disp.position.set(vx + 0.29, counterY + 0.06, vz + 0.14); grp.add(disp);
  const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 14),
    new THREE.MeshStandardMaterial({ color: F.mixer, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2 }));
  pump.position.set(vx + 0.29, counterY + 0.14, vz + 0.14); grp.add(pump);
  grp.add(buildPlant(vx - 0.33, counterY, vz + 0.02, 1.0));

  /* bath mat in front of the vanity */
  const mat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.018, 0.54),
    new THREE.MeshStandardMaterial({ color: F.mat, roughness: 1, metalness: 0 }));
  mat.position.set(vx + 0.02, 0.008, vz + 0.66); grp.add(mat);

  grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return grp;
}

/* =============================================================================
   APPLY A THEME
   ============================================================================= */
function applyTheme(id, silent) {
  const t = THEMES[id] || THEMES.white;
  THEME = t;
  clearGroup(shell); clearGroup(lightRig);
  if (scene.environment) scene.environment.dispose();
  scene.environment = buildEnvMap(t.env);
  scene.background = new THREE.Color(t.bg);
  renderer.toneMappingExposure = t.exposure;
  buildLights(t);
  buildShell(t);
  cornerBasinUnit = buildCornerBasin(t);
  bathroomDetails = buildBathroomDetails(t);
  shell.add(bathroomDetails);
  const cap = t.diffEnv == null ? 0.4 : t.diffEnv;
  tameDiffuseEnv(shell, cap); tameDiffuseEnv(cornerBasinUnit, cap); tameDiffuseEnv(lightRig, cap);
  setBasin(basinVisible);
  document.querySelectorAll("#themeTabs [data-theme]").forEach(b => {
    const on = b.dataset.theme === t.id;
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
  });
  syncCeilTabs();
  try { localStorage.setItem(THEME_KEY, t.id); } catch (_) { /* storage blocked */ }
  if (!silent && typeof toast === "function") toast(t.label + " bathroom");
}
document.querySelectorAll("#themeTabs [data-theme]").forEach(b => {
  b.onclick = () => applyTheme(b.dataset.theme);
});

/* ---- ceiling colour ----------------------------------------------------- */
/* Repaint in place rather than rebuilding the shell: a rebuild re-generates
   every procedural wall texture, which stalls for a beat and throws away the
   env map — for a change of paint you should just see the paint change. */
function setCeiling(id, silent) {
  const c = ceilingById(id);
  ceilingChoice = c.id;
  try { localStorage.setItem(CEILING_KEY, c.id); } catch (_) { /* storage blocked */ }
  const CS = ceilingSurface(THEME);
  if (ceilMesh) { ceilMesh.material.color.setHex(CS.color); ceilMesh.material.roughness = CS.rough; }
  if (pelmetMesh) pelmetMesh.material.color.setHex(c.color == null ? THEME.furn.pelmet : c.color);
  syncCeilTabs();
  if (!silent && typeof toast === "function") {
    toast(c.color == null ? "Ceiling follows the room" : "Ceiling · " + c.name);
  }
}
/* the "Match the room" dot shows the colour it would actually give you */
function syncCeilTabs() {
  document.querySelectorAll("#ceilTabs [data-ceil]").forEach(b => {
    const on = b.dataset.ceil === ceilingChoice;
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
    if (b.dataset.ceil === "auto" && THEME) {
      const dot = b.querySelector("i");
      if (dot) dot.style.setProperty("--c", "#" + THEME.surfaces.ceiling.color.toString(16).padStart(6, "0"));
    }
  });
}
document.querySelectorAll("#ceilTabs [data-ceil]").forEach(b => {
  b.onclick = () => setCeiling(b.dataset.ceil);
});
(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (_) { saved = null; }
  applyTheme(THEME_ORDER.indexOf(saved) >= 0 ? saved : "white", true);
})();

/* =========================================================================
   PLACED PRODUCTS  (textured panels on walls / ceiling)
   ========================================================================= */
const placed = new Map();           // uid -> { mesh, product, finishId, wall, cfg }
const meshes = [];                  // for raycasting
let uidSeq = 1;

// math planes for drag, per wall (normal points INTO the room)
const WALLS = {
  back:    { plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), HZ), fix: "z", val: -HZ + OFF, rot: { x: 0, y: 0 } },
  left:    { plane: new THREE.Plane(new THREE.Vector3(1, 0, 0), HX), fix: "x", val: -HX + OFF, rot: { x: 0, y: Math.PI / 2 } },
  right:   { plane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), HX), fix: "x", val: HX - OFF, rot: { x: 0, y: -Math.PI / 2 } },
  // A ceiling fitting is FLUSH: its mount plane is the slab itself, not OFF below
  // it. The 2.5 cm standoff every wall gets to avoid z-fighting left overhead
  // plates hanging under the ceiling with daylight above them — from any eye-level
  // angle you saw the gap and the piece read as floating. Ceiling pieces instead
  // sit AT y = RH and bury their housing up into the slab (see placeProduct).
  ceiling: { plane: new THREE.Plane(new THREE.Vector3(0, -1, 0), RH), fix: "y", val: RH, rot: { x: Math.PI / 2, y: 0 } },
  // not a wall: deck-mounted mixers STAND on the vanity counter, facing the room
  counter: { plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), fix: "y", val: 0, rot: { x: 0, y: 0 } },
};

/* =============================================================================
   HOW LEVEL A PRODUCT HANGS IS MEASURED, NOT TYPED.

   Every product render in the range is a studio 3/4 shot, so the body in the
   photograph slopes — a wall spout by 22 degrees, a thermostatic bar by 6. Laid
   flat on the tiles that slope is what the client sees, and the piece reads as
   stuck on crooked. `roll` counter-rotates the cutout to cancel it.

   That number used to be typed in by eye, one SKU at a time, and by eye it was
   wrong: of the ten set that way, two had the wrong SIGN — which does not
   half-fix the tilt, it doubles it. The catalogue is 60-odd products and each
   one has three finishes shot separately, so eyeballing does not scale and
   never converges.

   So the app measures it. Fit the body's centreline through the artwork's own
   alpha channel by least squares and take that angle. Two details matter:

     - Fit the WHOLE silhouette, not just the slender part of it. Filtering to
       the thin columns to keep a flange or a lever out of the fit sounds right
       and renders wrong: on the plain wall spout it returned 17.9 deg where the
       piece needs 22.4, and it hung visibly downhill. The tapering body means
       the tube's own centreline is not the axis the eye levels against — the
       whole outline is. Checked on screen, piece by piece, at each value.
     - Only for pieces whose photograph is wider than it is tall. A tall trim
       plate has no horizontal body to level, and fitting one returns noise.

   Anything unmeasurable hangs straight, which is the safe failure. A `roll` in
   SKU3D still wins if a product ever genuinely needs a hand-set angle.
   ============================================================================= */
const _rollCache = new Map();
function measuredRoll(img, src) {
  if (_rollCache.has(src)) return _rollCache.get(src);
  let roll = 0;
  try {
    const W = 220, H = Math.max(8, Math.round(W * img.naturalHeight / img.naturalWidth));
    if (H / W <= 1.35) {
      const c = mkCanvas(W, H), x = c.getContext("2d");
      x.drawImage(img, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data;
      const col = [];
      for (let X = 0; X < W; X++) {
        let sum = 0, cnt = 0;
        for (let Y = 0; Y < H; Y++) if (d[(Y * W + X) * 4 + 3] > 128) { sum += Y; cnt++; }
        if (cnt > 1) col.push({ x: X, y: sum / cnt, n: cnt });
      }
      if (col.length > 24) {
        // trim the ends: the extreme columns are the nozzle tip and the outer
        // edge of the flange, both of which curve away from the body's axis
        const seg = col.slice(Math.floor(col.length * 0.10), Math.ceil(col.length * 0.90));
        const N = seg.length;
        let sx = 0, sy = 0, sxy = 0, sxx = 0;
        seg.forEach(q => { sx += q.x; sy += q.y; sxy += q.x * q.y; sxx += q.x * q.x; });
        const den = N * sxx - sx * sx;
        if (N > 8 && Math.abs(den) > 1e-6) {
          const a = Math.atan((N * sxy - sx * sy) / den);
          if (Math.abs(a) < 0.7) roll = a;     // past ~40° the fit has found something that is not the body
        }
      }
    }
  } catch (_) { roll = 0; }                    // unreadable pixels — hang it straight
  _rollCache.set(src, roll);
  return roll;
}
/* WHICH products get levelled at all. Opt-in, because "level" only means
   something for a piece with a horizontal body — a spout, a mixer, a control
   bar. It is meaningless or actively wrong elsewhere, and the audit caught both
   cases: an overhead plate seen from below is symmetric and measures 0 (no
   harm), but a WALL shower head carries its own arm in the photograph, and
   measuring that silhouette asked for -31 degrees, which would have hung the
   whole head and arm off at an angle. A handset is vertical and is skipped by
   the aspect test anyway.
   A hand-set `roll` in SKU3D still overrides, for a product that needs one. */
const LEVEL_CATS = new Set(["bath-spout", "basin-mixer", "thermostatic", "diverter",
                            "wall-tap", "health-faucet"]);
// body-jet is deliberately NOT levelled. By the rule above, `roll` is only
// meaningful for a piece with a horizontal body; a jet is a square plate with a
// nozzle on it, so the fit has no body to find and returned ~3 degrees off the
// escutcheon's corner. Four jets each tilted 3 degrees is exactly what reads as
// a grid that will not line up. They hang dead level.
const rollFor = (product, cfg, img, src) =>
  cfg.roll != null ? cfg.roll
                   : (LEVEL_CATS.has(product.catId) ? measuredRoll(img, src) : 0);

function finishTexture(path) {
  const t = texLoader.load(path);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso;
  return t;
}

/* The artwork a piece is actually mapped with — mirrored when the SKU asks for it.
   A three-quarter render has a handedness: the wall plate sits at one edge of the
   frame and the nozzle projects out of the other. On the RIGHT wall the frame's
   right edge is the room front (rot.y = -PI/2 sends local +x to world +z), so a
   jet shot from the plate's left ends up aimed at the back corner — the piece
   reads as spraying the tiles. Mirroring the MAP turns it round and leaves the
   geometry, the extrusion layers and the contact shadow untouched; the extrusion
   shares this same texture object, so the body follows the flip for free.
   finishTexture() builds a fresh texture per call, so this is never someone
   else's map being rewritten. */
function productTexture(path, cfg) {
  const t = finishTexture(path);
  if (cfg && cfg.flip) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
  return t;
}

/* THE ARTWORK A PIECE WEARS ON THE WALL, which is not always its catalogue shot.
   A body jet is photographed in three-quarter, and a jet is a flat plate on a
   flat wall: laid on the tile, that baked-in angle reads as four plates stuck on
   crooked, every one of them leaning the same way. It is the first thing anyone
   sees, and no amount of positioning fixes it, because the tilt is IN the photo.
   `faceOn` points at a copy of that same photograph with the plate's own
   perspective divided out — its front face warped back to the square it really
   is, by a homography measured off the render's own silhouette and bevel seam
   (assets/products/face/). Nothing is repainted, redrawn or substituted: it is
   the product's own pixels, seen square-on instead of from the corner. The rail,
   the swatches and the spec sheet keep the catalogue shot, because three-quarter
   is the right way to SHOW a product — it is only the wrong way to MOUNT one. */
const roomArt = (path, cfg) =>
  (cfg && cfg.faceOn && path) ? path.replace("assets/products/", "assets/products/face/") : path;

/* soft radial "contact shadow" so a mounted product grounds onto the wall
   instead of floating. Built once as a canvas texture, reused for every piece. */
let _shadowTex = null;
function shadowTexture() {
  if (_shadowTex) return _shadowTex;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.5, "rgba(0,0,0,0.24)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _shadowTex = new THREE.CanvasTexture(c);
  return _shadowTex;
}
/* the metal tone for a finish id — every product's own artwork carries its
   finish, but the parts we build (housings, arms, hoses, 3D models) need the hex */
function finishHex(fid, product) {
  const f = FINISHES[fid || (product && product.defaultFinish)];
  return parseInt(((f && f.tone) || "#c6a15b").replace("#", ""), 16);
}

/* a mesh in the chosen metal, tagged so a finish change recolours it */
function metalPart(geo, hex, rough) {
  const m = new THREE.Mesh(geo, metalMat(hex, rough));
  m.userData.metal = true;
  return m;
}

/* The escutcheon behind a SWINGING fitting — a spout, tap or handset.
   Those pieces can't have a sunk body: stepBillboards pivots them at their
   anchor to keep them facing you, and a body 5 cm deep would swing its back
   corner clean out of the wall. What survives the swing is a boss on the pivot
   axis itself, which the rotation only turns about — so this is what bridges the
   2.5 cm standoff for them, sitting behind the fitting's own flange the way a
   real wall union does. */
function wallBoss(hex, width, cfg, height) {
  const r = Math.max(0.022, width * 0.11), h = WALL_SINK + 0.006;
  const b = metalPart(new THREE.CylinderGeometry(r, r * 1.05, h, 24), hex, 0.3);
  b.rotation.x = Math.PI / 2;
  b.position.z = (0.006 - WALL_SINK) / 2;
  // A spout's union is at the middle of its artwork, so the default is the
  // origin. A body jet's is not: its render sets the escutcheon off to one side
  // with the nozzle projecting from the other, so a boss at the frame centre
  // bridges thin air and leaves the plate itself floating on the standoff.
  // bossX / bossY put it where the plate actually is, as a fraction of the
  // piece's own width and height (measured off each SKU's artwork).
  if (cfg && cfg.bossX) b.position.x = cfg.bossX * width;
  if (cfg && cfg.bossY) b.position.y = cfg.bossY * (height || width);
  b.name = "wallBoss";
  return b;
}

/* Give a cutout real thickness WITHOUT a box.
   The old approach put a rectangular slab behind the artwork, which broke two
   ways: its front face landed exactly on the artwork plane (z-fighting — the
   speckled checkerboard you could see across a diverter), and the slab filled
   the transparent parts of the image, so a hexagonal plate or a trim-plus-lever
   sat on a visible rectangle. Stacking alpha-tested copies of the artwork
   instead makes the body follow the product's OWN silhouette, and no two
   surfaces are ever coplanar. */
function extrudeCutout(mesh, map, w, h, depth, hex, faceZ) {
  const old = mesh.getObjectByName("extrude");
  if (old) { old.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); mesh.remove(old); }
  const g = new THREE.Group(); g.name = "extrude";
  // The "solid" is a stack of alpha-tested copies, so what matters is the SPACING
  // between them, not the count: 8 layers was fine over 2 cm and shows daylight
  // stripes over 8. Keep them ~4 mm apart however deep the body runs.
  const layers = Math.max(8, Math.ceil(depth / 0.004)), step = depth / layers;
  for (let i = 1; i <= layers; i++) {
    const shade = 1 - 0.55 * (i / layers);                 // deeper layers go darker
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
      map, alphaTest: 0.45, side: THREE.DoubleSide,
      color: new THREE.Color(hex).multiplyScalar(shade),
      metalness: 0.8, roughness: 0.38, envMapIntensity: 1.05,
    }));
    m.position.z = faceZ - i * step;
    m.userData.metal = true; m.userData.shade = shade;      // recolours with the finish
    g.add(m);
  }
  mesh.add(g);
}

/* attach (or refresh) a shadow plane as a CHILD of the product mesh, sitting
   just behind it toward the wall, so it follows every move / resize for free */
function addContactShadow(mesh, w, h) {
  const prev = mesh.getObjectByName("contactShadow");
  if (prev) { mesh.remove(prev); prev.geometry.dispose(); }
  const s = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.45, h * 1.25),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.5, depthWrite: false })
  );
  s.name = "contactShadow";
  // ON the wall face (the anchor is OFF in front of it), or the body we now
  // build down to the wall swallows the shadow whole
  s.position.set(0, -h * 0.025, -(OFF - 0.002));
  s.renderOrder = -1;
  mesh.add(s);
}

function setEmissive(obj, hex) {
  obj.traverse(o => { if (o.material && o.material.emissive) o.material.emissive.setHex(hex); });
}

/* NO selection glow. A soft warm plane behind the selected piece was meant to
   mark it, but behind a fitting it is a light source that isn't there: on the
   ceiling it turned an overhead shower into a light fitting, and on tile it put
   a halo around a tap that no bathroom would ever have. A product has to be
   shown as the product, so selection is now stated where it belongs — the tool
   card names the piece with its code, finish and size, and its tile in the
   product list is highlighted. Nothing is drawn behind the piece at all. */

/* bounding box of a placed piece in its OWN frame */
function localBox(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3(), tmp = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(tmp.multiplyMatrices(inv, o.matrixWorld)));
  });
  return box;
}
/* Coiled stainless-steel look for the flexible hose: one repeating rib "pitch"
   drawn as a rounded metallic highlight, tiled along the tube length. Used as
   both colour map (silver + dark grooves → reads as chrome, not a pale tube)
   and bump map (the grooves catch light). Cached — one canvas for all hoses. */
let _hoseTex = null;
function hoseTexture() {
  if (_hoseTex) return _hoseTex;
  const c = document.createElement("canvas"); c.width = 16; c.height = 4;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 16, 0);
  grad.addColorStop(0.00, "#3a3a3a");   // groove shadow between coils
  grad.addColorStop(0.18, "#8f8f8f");
  grad.addColorStop(0.50, "#fdfdfd");   // polished crest of the coil
  grad.addColorStop(0.82, "#8f8f8f");
  grad.addColorStop(1.00, "#3a3a3a");
  g.fillStyle = grad; g.fillRect(0, 0, 16, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  _hoseTex = t; return t;
}

/* Wall supply elbow + flexible hose for a wall-mounted hand shower.
   The product PNG is just the handset — on the wall it needs a pipe running
   from a wall outlet down to the handset, or it reads as floating. Sized from
   the placed image height (hh) so it scales with the resize control. Parts are
   flagged userData.metal so they recolour with the chosen finish. */
function handShowerRig(hex, width, hh) {
  const g = new THREE.Group();
  g.name = "hsRig";
  const r = Math.max(0.007, width * 0.055);          // hose radius, scales with the handset
  // wall outlet elbow — sits up and to the side of the handset, flat to the wall
  const ex = width * 0.60, ey = hh * 0.34;
  const fh = r * 1.2 + WALL_SINK;                    // reaches the wall, not the anchor
  const flange = metalPart(new THREE.CylinderGeometry(r * 2.2, r * 2.5, fh, 22), hex, 0.28);
  flange.rotation.x = Math.PI / 2; flange.position.set(ex, ey, r * 0.6 - WALL_SINK / 2); g.add(flange);
  const elbow = metalPart(new THREE.SphereGeometry(r * 1.5, 18, 14), hex, 0.2);
  elbow.position.set(ex, ey, r * 1.4); g.add(elbow);
  // flexible hose: curves from the elbow down and in to the base of the handle
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(ex, ey, r * 1.4),
    new THREE.Vector3(ex + width * 0.10, hh * 0.02, r * 3.0),
    new THREE.Vector3(width * 0.10, -hh * 0.42, r * 3.2),
    new THREE.Vector3(width * 0.01, -hh * 0.50, r * 1.6),
    new THREE.Vector3(0, -hh * 0.46, r * 0.8),
  ]);
  // coiled stainless-steel hose: ribbed metal texture along its length
  const tube = new THREE.TubeGeometry(curve, 96, r, 14, false);
  const coilTex = hoseTexture().clone(); coilTex.needsUpdate = true;
  const coils = Math.max(24, Math.round(curve.getLength() / (r * 0.85)));  // ~1 rib per hose-thickness
  coilTex.repeat.set(coils, 1);
  const hose = new THREE.Mesh(tube, new THREE.MeshStandardMaterial({
    color: hex, map: coilTex, bumpMap: coilTex, bumpScale: r * 0.5,
    metalness: 1.0, roughness: 0.22, envMapIntensity: 1.35,
  }));
  hose.userData.metal = true; g.add(hose);
  // polished couplings (nuts) at each end, like the reference hose
  const nut = (rad, len) => metalPart(new THREE.CylinderGeometry(rad, rad, len, 18), hex, 0.12);
  const topNut = nut(r * 1.35, r * 2.2);
  topNut.position.copy(curve.getPointAt(0.04));
  const topTan = curve.getTangentAt(0.04);
  topNut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), topTan.normalize());
  g.add(topNut);
  const botNut = nut(r * 1.45, r * 2.6);
  botNut.position.copy(curve.getPointAt(0.97));
  const botTan = curve.getTangentAt(0.97);
  botNut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), botTan.normalize());
  g.add(botNut);
  return g;
}

/* Wall flange + arm for a shower head that mounts on the WALL. The product
   artwork for these SKUs is the head ALONE (it screws onto an arm), so on its own
   it floats with its connector pointing at nothing. Built in the standee's local
   space: z=0 is the tiled wall, z=reach is the face of the head. Parts are
   flagged userData.metal so they recolour with the chosen finish. */
function showerArmRig(hex, width, hh, reach) {
  const g = new THREE.Group();
  g.name = "armRig";
  const r = Math.max(0.010, width * 0.07);
  const wallY = hh * 0.62, headY = hh * 0.40;      // arm leaves the wall above the head
  // the flange has to reach the wall, not the anchor 2.5 cm in front of it
  const fh = r * 1.2 + WALL_SINK;
  const flange = metalPart(new THREE.CylinderGeometry(r * 2.5, r * 2.8, fh, 26), hex, 0.3);
  flange.rotation.x = Math.PI / 2; flange.position.set(0, wallY, r * 0.6 - WALL_SINK / 2); g.add(flange);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, wallY, r * 0.4),
    new THREE.Vector3(0, wallY, reach * 0.44),
    new THREE.Vector3(0, wallY - (wallY - headY) * 0.6, reach * 0.8),
    new THREE.Vector3(0, headY, reach),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r, 16, false), metalMat(hex, 0.28));
  tube.userData.metal = true; g.add(tube);
  const nut = metalPart(new THREE.CylinderGeometry(r * 1.25, r * 1.25, r * 1.9, 18), hex, 0.14);
  nut.rotation.x = Math.PI / 2; nut.position.set(0, headY, reach - r * 1.1); g.add(nut);
  return g;
}

/* A body jet as REAL GEOMETRY rather than a cutout.
   Every jet render in the range is a 3/4 view — escutcheon set back and to one
   side, head turned toward the lens. On a wall that reads as a jet stuck on at an
   angle, and no amount of rolling, mirroring or billboarding fixes it, because the
   turn is baked into the photograph. A jet is two squares and a nozzle face, so
   building it costs almost nothing and it reads correctly from every angle.
   Parts carry userData.metal, so the finish swatches recolour them. */
/* The FINISHES tone is a swatch colour, not the product's colour: brushed gold is
   #c6a15b there, while the render is a far richer rose-gold. Painting geometry
   with the swatch makes it look cream. Average the artwork's own mid-tones
   instead — skipping shadow and blown highlight — and use that. */
const _avgCache = new Map();
function averageColor(path) {
  if (_avgCache.has(path)) return _avgCache.get(path);
  const pr = new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const S = 64, c = mkCanvas(S, S), x = c.getContext("2d");
      x.drawImage(img, 0, 0, S, S);
      const d = x.getImageData(0, 0, S, S).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (lum < 28 || lum > 246) continue;
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
      res(n ? new THREE.Color(r / n / 255, g / n / 255, b / n / 255) : null);
    };
    img.onerror = () => res(null);
    img.src = path;
  });
  _avgCache.set(path, pr);
  return pr;
}
/* repaint a procedural piece from its artwork, keeping each face's baked shade */
function tintFromArtwork(root, path) {
  if (!path) return;
  averageColor(path).then(col => {
    if (!col) return;
    root.traverse(o => {
      if (!o.userData.metal || !o.material) return;
      o.material.color.copy(col).multiplyScalar(o.userData.shade == null ? 1 : o.userData.shade);
    });
  });
}
let _nozzleTex = null;
function nozzleTexture(rows) {
  const key = "n" + rows;
  _nozzleTex = _nozzleTex || {};
  if (_nozzleTex[key]) return _nozzleTex[key];
  const S = 256, c = mkCanvas(S, S), x = c.getContext("2d");
  /* A spray face is a recessed plate, not a white square. Flat white it was the
     brightest thing on the piece, so the jet read as a blank tile with specks on
     it; a soft dish behind the nubs is what gives it a middle and an edge. */
  const dish = x.createRadialGradient(S * 0.42, S * 0.38, S * 0.06, S / 2, S / 2, S * 0.72);
  dish.addColorStop(0, "#ffffff"); dish.addColorStop(0.55, "#d2d2d4"); dish.addColorStop(1, "#8e8e92");
  x.fillStyle = dish; x.fillRect(0, 0, S, S);
  const pad = S * 0.14, step = (S - pad * 2) / (rows - 1), r = Math.max(2, step * 0.17);
  for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < rows; ix++) {
    const cx = pad + ix * step, cy = pad + iy * step;
    x.fillStyle = "rgba(0,0,0,0.72)";                      // the nub itself, sunk in
    x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    x.fillStyle = "rgba(255,255,255,0.55)";                // a lit rim, so each hole reads
    x.beginPath(); x.arc(cx - r * 0.25, cy - r * 0.3, r * 0.45, 0, 7); x.fill();
  }
  _nozzleTex[key] = canvasTex(c, true);
  return _nozzleTex[key];
}
/* A BODY JET, built as geometry.
   FOUR parts, because that is what one is: a plate screwed flat to the tile, a
   swivel neck, a nozzle head, and the spray face. Two things the first pass got
   wrong and this fixes:

   THE AIM. A body jet is a ball joint you point at your back. A head standing
   dead perpendicular to the tile is the one thing it never looks like — and with
   the head centred on its plate, square to the wall, the whole piece read as
   nested squares with no silhouette at all. `yaw` / `pitch` turn everything past
   the plate, and the caller works them out per jet so a set of four converges on
   whoever is standing in the enclosure.

   THE SEAT. `sink` runs the plate BACK through the anchor and into the wall. A
   piece is anchored OFF (2.5 cm) clear of its tiles, so without the overrun the
   jet stands on a cushion of air — the same bug the cutouts had, see WALL_SINK.
   Overshoot past the wall face is occluded by the wall, so it costs nothing. */
function buildBodyJet(hex, w, opts) {
  opts = opts || {};
  const round = !!opts.round, rows = opts.rows || 4;
  const sink = opts.sink || 0, yaw = opts.yaw || 0, pitch = opts.pitch || 0;
  const g = new THREE.Group();
  /* LIT metal, not a flat fill. Built out of unlit faces a jet is four shapes in
     one colour: no edge between plate and head, no highlight along the neck,
     nothing to say any of it stands off the wall — which is exactly how it read.
     It sits just off metalMat's mirror finish: rough enough that the finish's own
     hue carries instead of the white room washing a brushed gold to cream, but
     still env-lit enough to have highlights at all — a full metal with the
     environment turned down goes dead flat in the Black room, which is where the
     first pass's unlit fill fell apart worst. `userData.shade` tints each part
     and is what changeFinish re-applies on a swatch. */
  const part = (geo, shade, map) => {
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex).multiplyScalar(shade),
      map: map || null, metalness: 1.0, roughness: 0.26, envMapIntensity: 1.15,
    }));
    mesh.userData.metal = true;
    mesh.userData.shade = shade;
    return mesh;
  };
  /* Proportions are what make it read as a fitting rather than a tile: a THIN
     plate, a neck you can actually see, and a head narrower than the plate so
     there is a frame of tile-facing metal around it. The first pass had a head
     0.66 wide and 0.30 deep on a 0.09 plate — near enough the same square, near
     enough flush, so the whole jet flattened into concentric outlines. */
  // --- the plate: flat on the tile, tail buried in it ---
  const proud = w * 0.075;
  const plate = part(round ? new THREE.CylinderGeometry(w / 2, w / 2, proud + sink, 40)
                           : new THREE.BoxGeometry(w, w, proud + sink), 1.0);
  if (round) plate.rotation.x = Math.PI / 2;               // lie the disc against the wall
  plate.position.z = proud / 2 - sink / 2;                 // face at +proud, back at -sink
  g.add(plate);
  // --- the neck stands square on the plate; the BALL is at the top of it ---
  const neckR = w * 0.15, neckD = w * 0.14;
  const neck = part(new THREE.CylinderGeometry(neckR, neckR * 1.22, neckD, 24), 0.40);
  neck.rotation.x = Math.PI / 2;
  neck.position.z = proud + neckD / 2;
  g.add(neck);
  /* The head swivels about the BALL, not about the plate. Pivoting at the plate
     face turned the aim into a slide: the head is most of the piece's depth away
     from there, so a 20 deg turn walked it clean off the escutcheon and the jet
     looked knocked out of its socket rather than pointed. A real ball sits
     directly behind the head, so that is where this pivot goes — the head turns
     nearly on the spot and stays on its plate. */
  const aim = new THREE.Group();
  aim.position.z = proud + neckD;
  aim.rotation.set(pitch, yaw, 0);
  g.add(aim);
  const ball = part(new THREE.SphereGeometry(neckR * 1.05, 20, 14), 0.48);
  aim.add(ball);
  const headD = w * 0.32, headW = w * 0.54;
  const head = part(round ? new THREE.CylinderGeometry(headW / 2, headW / 2 * 0.94, headD, 36)
                          : new THREE.BoxGeometry(headW, headW, headD), 0.70);
  if (round) head.rotation.x = Math.PI / 2;
  head.position.z = headD / 2;
  aim.add(head);
  const face = part(round ? new THREE.CircleGeometry(headW / 2 * 0.88, 36)
                          : new THREE.PlaneGeometry(headW * 0.88, headW * 0.88), 0.92, nozzleTexture(rows));
  face.position.z = headD + 0.0012;
  aim.add(face);
  return g;
}



/* =========================================================================
   REAL 3D PRODUCT MODELS  (Stout factory OBJ exports)
   Replaces the flat photo cutouts with true 3D geometry the user can spin.
   The OBJs ship with broken Windows-path MTLs (C:/…jpg), so we DROP the
   material and apply the brand metal finish (chrome / gold / matt black …)
   lit by the scene env map — exactly how a polished fitting should read.
   Models are Blender exports (Y-up) with arbitrary origin + scale, so each
   is auto-ALIGNED on load: recentre → scale-to-real-size → orient to the
   wall → seat flush against it (no floating, no embedding).
   ========================================================================= */
const MODELS_BASE = "assets/models/";
// size = target real-world length (m) of the model's LARGEST dimension.
// rot  = optional extra [x,y,z] rad to correct a model's own facing.
/* REAL 3D MODELS — keyed by SKU, never by category.
   The 20 OBJs we were given are anonymous ("New folder (n)/Stout Model.obj"), and
   a category-keyed map meant every thermostatic panel rendered as the SAME block
   and each rain shower got an arbitrary plate — you never saw the piece you
   clicked. A model is now used ONLY where it has been visually confirmed to BE
   that SKU; every other product renders its own artwork, which is exact by
   definition. Confirmed against the product photography:
     m02  tall angular single-lever basin mixer   → ST-BM-001 Aria Tall Basin Mixer
     m15  plain square-section wall spout         → ST-PLAIN  Axis Plain Wall Spout
     mdiv tall plate + square knob + flat lever   → ST-D5017  Regale Concealed Diverter
     m13  square 4×4 protruding-nozzle body jet   → ST-BJ-02  Aqua Single-Flow Body Jet
   (The remaining OBJs — m03-m12, m14, m16-m19, m-bodyjet — are plates/panels we
   cannot tie to a specific SKU, so they are deliberately unused.) */
const MODEL_FOR_SKU = {
  "ST-BM-001": { url: "m02",  size: 0.34 },
  // ST-PLAIN (Axis Plain Wall Spout) USED to render from m15. It is the only
  // spout the range now offers, and the OBJ gave you a pale untextured block:
  // the mesh carries no finish detail, so lit by the room it washes out to
  // near-white whichever finish you pick, and a plain square spout has no
  // silhouette left to read once the surface is gone. Its own photograph is
  // exact in all three finishes. To go back to the mesh:
  //   "ST-PLAIN":  { url: "m15",  size: 0.26 },
  // ST-D5017 (Regale Concealed Diverter) USED to render from mdiv. Two problems:
  // the model is authored face-DOWN, so rot +90x stood it up showing its blank
  // back — it read as a plain gold plank on the wall. Even flipped to -90x the OBJ
  // is a low-detail proxy that renders as a pale slab with a barely-visible knob.
  // Its own photography shows the plate, square knob and lever exactly, so it now
  // renders its artwork like every other product. To go back to the mesh:
  //   "ST-D5017": { url: "mdiv", size: 0.36, rot: [-Math.PI / 2, 0, 0] },
  // ST-BJ-02 (Aqua Single-Flow Body Jet) USED to render from m13. Seen at its
  // real 14 cm on the wall it reads as a pale dumbbell — two square plates on a
  // short tube — because seatOnWall aligns the model by its bounding box, with no
  // idea which face is the mount, so the nozzle plate ends up half in the tiles
  // and the boss sticks into the room. Its own photograph is exact. To go back:
  //   "ST-BJ-02":  { url: "m13",  size: 0.14 },
};
const MODEL_WALL_YROT = { back: 0, left: Math.PI / 2, right: -Math.PI / 2, ceiling: 0, counter: 0 };

function showLoading(t) { const el = $("#loading"); if (el) { el.textContent = t; el.classList.remove("hide"); } }
function hideLoading() { const el = $("#loading"); if (el) el.classList.add("hide"); }

const _objLoader = new THREE.OBJLoader();
const _objCache = new Map();   // url -> Promise<THREE.Group (raw, normals ensured)>
function loadOBJ(url) {
  if (_objCache.has(url)) return _objCache.get(url);
  const p = new Promise((res, rej) => _objLoader.load(url, res, undefined, rej))
    .then(raw => {
      // some of these OBJs carry stray `l` polylines alongside the solids; left in
      // they draw a white wireframe ghost over the fitting
      raw.children.filter(c => c.isLine || c.isPoints).forEach(c => raw.remove(c));
      raw.traverse(o => { if (o.isMesh && !o.geometry.attributes.normal) o.geometry.computeVertexNormals(); });
      return raw;
    });
  _objCache.set(url, p);
  return p;
}
// the confirmed 3D model for this exact SKU, or null → render its own artwork
function specFor(product) { return MODEL_FOR_SKU[product.code] || null; }
// seat a model root flush against its wall using the FINAL oriented size
function seatOnWall(holder, wall, spot, sz) {
  const p = spot.clone(), m = 0.25;
  if (wall === "counter") { p.y = COUNTER.y + sz.y / 2; holder.position.copy(p); return; }
  if (wall === "ceiling") {
    p.x = clamp(p.x, -HX + m, HX - m); p.z = clamp(p.z, -HZ + m, HZ - m);
    p.y = WALLS.ceiling.val - sz.y / 2 + 0.012;             // flush: bite into the slab, no gap above
  } else if (wall === "left") {
    p.z = clamp(p.z, -HZ + m, HZ - m); p.y = clamp(p.y, 0.3, RH - 0.15);
    p.x = WALLS.left.val + sz.x / 2;
  } else if (wall === "right") {
    p.z = clamp(p.z, -HZ + m, HZ - m); p.y = clamp(p.y, 0.3, RH - 0.15);
    p.x = WALLS.right.val - sz.x / 2;
  } else {
    p.x = clamp(p.x, -HX + m, HX - m); p.y = clamp(p.y, 0.3, RH - 0.15);
    p.z = WALLS.back.val + sz.z / 2;                        // project into the room
  }
  holder.position.copy(p);
}
// a placed 3D-model root (Group). Loads async, then fills + aligns itself.
function build3DHolder(product, finishId, wall, spec, uid, onReady) {
  const holder = new THREE.Group();
  holder.userData.uid = uid;
  showLoading("Loading 3D model…");
  loadOBJ(MODELS_BASE + spec.url + ".obj").then(raw => {
    const model = raw.clone(true);
    const mat = metalMat(finishHex(finishId, product));
    model.traverse(o => { if (o.isMesh) { o.material = mat; o.userData.metal = true; o.castShadow = false; } });
    // normalise: recentre to origin + uniform scale so max dim === spec.size
    const b = new THREE.Box3().setFromObject(model);
    const s0 = b.getSize(new THREE.Vector3()), c0 = b.getCenter(new THREE.Vector3());
    model.position.sub(c0);
    const scaler = new THREE.Group(); scaler.add(model);
    scaler.scale.setScalar(spec.size / (Math.max(s0.x, s0.y, s0.z) || 1));
    if (spec.rot) scaler.rotation.set(spec.rot[0] || 0, spec.rot[1] || 0, spec.rot[2] || 0);
    const orient = new THREE.Group(); orient.add(scaler);
    orient.rotation.y = MODEL_WALL_YROT[wall] || 0;
    holder.add(orient);
    holder.updateMatrixWorld(true);
    const sz = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
    seatOnWall(holder, wall, defaultSpot(wall, skuCfg(product)), sz);
    if (selected === uid) setEmissive(holder, 0x2a2013);    // keep highlight if still selected
    hideLoading();
    if (onReady) onReady();
  }).catch(err => {
    // the OBJ is missing / unparseable — fall back to the product's own artwork so
    // the pick ALWAYS lands something visible in the room instead of an empty group
    console.error("3D model failed:", spec.url, err);
    hideLoading();
    if (onReady) onReady(err);
  });
  return holder;
}

function placeProduct(product, finishId, wall, frame) {
  const cfg = skuCfg(product);
  wall = wall || cfg.mount || "back";
  const w = WALLS[wall];
  /* ONE fitting per category — anchors are fixed, so a second one would stack
     invisibly on top of the first. Picking another design simply swaps it.
     A `solo` rail group is stricter, because a group can span two categories
     that are really one fitting: Diverters holds thermostatic panels AND
     diverter plates, but on the wall there is a single trim, in the middle of
     the jet grid, and both are anchored to it. So a pick from that list
     replaces whatever is already in the lane instead of joining it. Spouts is
     deliberately NOT solo — a bath spout and a basin mixer are two fittings on
     two different walls that happen to share a list. */
  const railGrp = RAIL_GROUPS.find(g => g.cats.includes(product.catId));
  const supersedes = railGrp && railGrp.solo
    ? r => railGrp.cats.includes(r.product.catId)
    : r => r.product.catId === product.catId;
  [...placed.values()].filter(supersedes).forEach(r => removeProduct(r.uid));
  const uid = "u" + (uidSeq++);
  // REAL 3D MODEL path: if this category has a factory OBJ, place true geometry
  // (auto-aligned + brand metal finish) instead of the flat photo cutout.
  const spec = specFor(product);
  // fired once the piece actually has geometry/artwork in it: pop it in and (when
  // the pick came from the product rail) fly the camera so it is unmistakably ON SCREEN
  const reveal = () => {
    const rec = placed.get(uid); if (!rec) return;
    popIn(rec.mesh);
    if (frame) frameProduct(rec);
  };
  if (spec) {
    const mesh = build3DHolder(product, finishId, wall, spec, uid, err => {
      if (err) cutoutFallback(placed.get(uid));   // OBJ missing → show the product artwork instead
      reveal();
    });
    mesh.rotation.set(0, 0, 0);
    room.add(mesh); meshes.push(mesh);
    placed.set(uid, { uid, mesh, product, finishId, wall, cfg, is3D: true });
    if (isBasinMixer(product, wall)) setStockMixer(false);
    selectProduct(uid);
    renderRail();
    saveDesign();
    return uid;
  }
  // Show the ACTUAL product image the user picked (real artwork in the chosen
  // finish) as a cutout standee facing the room — so it matches EXACTLY what was
  // selected (Cascada vs Lumina vs Aeon all look different), just like the 2D site.
  let is3D = false;
  const path = (product.images && product.images[finishId]) || (product.images && product.images[product.defaultFinish]);
  const art = roomArt(path, cfg);      // square-on copy for the wall; `path` stays the catalogue shot
  // UNLIT material: the product renders are already studio-lit photos — re-lighting
  // them with scene lights + ACES tone mapping washed them out to pale ghosts.
  // Basic + toneMapped:false shows the artwork exactly as shot (crisp, saturated).
  const mat = new THREE.MeshBasicMaterial({
    map: productTexture(art, cfg), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, toneMapped: false,
  });
  let width = cfg.width;
  let mesh;
  if (product.catId === "body-jet" && !cfg.single) {
    // REFERENCE-STYLE flanking SET: 4 body jets in two columns of two, one
    // selectable/removable unit. Positioned by the CAT3D anchor; the four
    // straddle it, at the two heights a jet is plumbed to.
    mesh = new THREE.Group();
    mesh.userData.uid = uid;
    const jetW = cfg.width;
    /* EQUAL PITCH. The four sit on the corners of a 0.64 m SQUARE — the same
       0.32 out from centre across as up — so the set reads as a square of four
       and not as two stacked pairs, and the gap a jet leaves for the trim in the
       middle is the same gap in both directions. 0.53 m of clear space either
       way: the widest panel in the range is 0.50 across and 0.50 tall, so even
       that one is framed by the jets rather than fouling them. */
    const SPREAD = 0.32, RISE = 0.32;
    const OFFS = [[-SPREAD, RISE], [-SPREAD, -RISE], [SPREAD, RISE], [SPREAD, -RISE]];
    if (cfg.jet3d) {
      // real geometry — see buildBodyJet for why the artwork cannot be used here
      const hex = finishHex(finishId, product);
      /* AIM. Four jets all firing square out of the tile is not an installation,
         so each is turned back towards the person standing in the enclosure:
         `ox` runs along the wall and `oy` up it, both from the set's own centre,
         so the sign of each offset IS the direction to turn — far column
         forward, near column back, top row down, bottom row up, onto mid-torso.
         But the angle here is a RENDER decision, not a plumbing one. At the true
         geometry (~22 deg yaw for a body 0.55 m off the wall) you are looking at
         the BACK of the near column's heads from every angle this room can be
         viewed from: no nozzle face, just a blank cup turned away beside its
         plate, which reads as a jet knocked out of its socket rather than one
         that is aimed. The convergence has to survive being seen from outside
         the shower, so it is cut to a hint of it — enough that the set is
         obviously toed-in when you look along the wall, not enough to hide a
         single nozzle face. */
      const AIM_YAW = 0.10, AIM_PITCH = 0.08;              // rad: ~6 deg / ~4.5 deg
      OFFS.forEach(([ox, oy]) => {
        const jm = buildBodyJet(hex, jetW, {
          round: cfg.jetShape === "round", rows: cfg.jetRows,
          sink: sinkFor(wall),                              // seat it IN the tile, not on it
          yaw: -(ox / SPREAD) * AIM_YAW,
          pitch: (oy / RISE) * AIM_PITCH,
        });
        jm.position.set(ox, oy, 0);
        jm.userData.jet = true;
        mesh.add(jm);
      });
      positionOnWall(mesh, wall, defaultSpot(wall, cfg));
      tintFromArtwork(mesh, path);
      mesh.userData.retint = p => tintFromArtwork(mesh, p);   // so a finish swap repaints
      is3D = true;                       // geometry, so recolour by traversal and never billboard
      setTimeout(reveal, 0);
    } else {
    OFFS.forEach(([ox, oy]) => {
      const jm = new THREE.Mesh(new THREE.PlaneGeometry(jetW, jetW), mat);
      jm.position.set(ox, oy, 0);
      jm.rotation.z = cfg.roll || 0;
      jm.userData.jet = true;
      mesh.add(jm);
    });
    const img = new Image();
    img.onload = () => {
      const ar = img.naturalHeight / img.naturalWidth || 1;
      const d = 0.016, hex = finishHex(finishId, product);
      const jetRoll = rollFor(product, cfg, img, art);
      mesh.children.slice().forEach(jm => {
        jm.rotation.z = jetRoll;                  // measured, not typed
        jm.geometry.dispose();
        jm.geometry = new THREE.PlaneGeometry(jetW, jetW * ar);
        jm.geometry.translate(0, 0, d);
        extrudeCutout(jm, mat.map, jetW, jetW * ar, d, hex, d);
        // pass cfg + the real height: without them wallBoss falls back to the frame
        // CENTRE, which for a jet bridges thin air and leaves the escutcheon
        // floating on the standoff — the misalignment you see across a set of four
        if (sinkFor(wall)) jm.add(wallBoss(hex, jetW, cfg, jetW * ar));
        addContactShadow(jm, jetW, jetW * ar);
      });
      positionOnWall(mesh, wall, defaultSpot(wall, cfg));
      reveal();
    };
    img.src = art;
    }
  } else {
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 1.4), mat);
    mesh.userData.uid = uid;
    const img = new Image();
    img.onload = () => {
      const ar = img.naturalHeight / img.naturalWidth || 1.4;
      // hang it level — measured off this very artwork, see measuredRoll
      mesh.rotation.z = rollFor(product, cfg, img, art);
      // A tall piece is sized by its height, not its width (see MAX_H). Done
      // here because it needs the real aspect of the loaded artwork — and done
      // by reassigning `width`, so every body, rim, arm, hose, housing and
      // shadow built below is measured from the corrected size.
      const mh = maxHeight(product, cfg);
      if (width * ar > mh) width = mh / ar;
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(width, width * ar);
      // dark backing rim: same cutout, tinted near-black, a touch behind — from an
      // angle you see a solid edge instead of a paper-thin invisible sliver
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(width, width * ar),
        new THREE.MeshBasicMaterial({ map: mesh.material.map, color: 0x3a352d, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide }));
      rim.name = "rim"; rim.position.z = -0.008; mesh.add(rim);
      if (cfg.shape === "head" && wall !== "ceiling") {
        // a wall head stands off the tiles on its arm — flat against them it reads
        // as a sticker, and its inlet connector points at nothing
        const reach = cfg.reach == null ? 0.26 : cfg.reach;
        mesh.geometry.translate(0, 0, reach);
        rim.position.z = reach - 0.008;
        const oldArm = mesh.getObjectByName("armRig"); if (oldArm) mesh.remove(oldArm);
        mesh.add(showerArmRig(finishHex(finishId, product), width, width * ar, reach));
      }
      if (product.catId === "hand-shower" || cfg.hose) {
        // handset PNG alone floats — add the wall outlet + hose that feeds it
        const old = mesh.getObjectByName("hsRig"); if (old) mesh.remove(old);
        mesh.add(handShowerRig(finishHex(finishId, product), width, width * ar));
      }
      if (wall === "counter") {
        mesh.geometry.translate(0, width * ar / 2, 0);   // stand it on the counter, don't bury it
        rim.position.z = -0.008;
      } else if (cfg.panel && wall !== "ceiling") {
        // a thermostatic panel / diverter trim / jet plate is a solid object on
        // the wall, not a sticker — give it a body that follows its own outline
        const d = Math.max(0.016, width * 0.05);
        mesh.geometry.translate(0, 0, d);
        mesh.remove(rim);                                   // the extrusion IS the rim now
        extrudeCutout(mesh, mesh.material.map, width, width * ar, d + sinkFor(wall), finishHex(finishId, product), d);
      }
      if (cfg.billboard) {
        // a spout or tap is a solid object seen from the side: without a body it
        // is a piece of foil the moment the room turns
        const d = 0.018;
        mesh.geometry.translate(0, 0, d);
        mesh.remove(rim);
        extrudeCutout(mesh, mesh.material.map, width, width * ar, d, finishHex(finishId, product), d);
        if (sinkFor(wall)) mesh.add(wallBoss(finishHex(finishId, product), width, cfg, width * ar));
        const rec0 = placed.get(uid); if (rec0) rec0.halfW = width / 2;
      }
      // grounding: without this every fitting reads as pasted onto the tile
      if (wall !== "ceiling" && wall !== "counter") addContactShadow(mesh, width, width * ar);
      if (wall === "ceiling" && cfg.shape === "head") {
        // a round head screws onto a drop pipe — hang it below the ceiling so it
        // reads as a shower head rather than a decal stuck to the slab. The pipe
        // runs UP THROUGH the slab and wears a canopy where it passes through, so
        // the drop is visibly fixed to the ceiling instead of stopping short of it.
        const drop = 0.20;
        mesh.geometry.translate(0, 0, drop);
        rim.position.z = drop - 0.008;
        const metal = metalMat(finishHex(finishId, product), 0.3);
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, drop + CEIL_EMBED, 16), metal);
        pipe.rotation.x = Math.PI / 2; pipe.position.z = (drop - CEIL_EMBED) / 2;
        pipe.name = "arm"; pipe.userData.metal = true; mesh.add(pipe);
        const canopy = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.042, width * 0.17), Math.max(0.046, width * 0.19), 0.026 + CEIL_EMBED, 24), metal);
        canopy.rotation.x = Math.PI / 2; canopy.position.z = (0.026 - CEIL_EMBED) / 2;
        canopy.name = "canopy"; canopy.userData.metal = true; mesh.add(canopy);
      } else if (wall === "ceiling") {
        // A flush overhead plate is cast INTO the ceiling: you see its underside
        // and a slim edge, never a gap above it. So the housing runs from the
        // plate face UP THROUGH the slab — the buried part (CEIL_EMBED) is what
        // guarantees contact at every size and camera angle, and the visible part
        // is only as deep as a real plate rim. It still follows the plate's own
        // outline (half the range is hexagonal, so a rectangular slab showed).
        const vis = Math.min(CEIL_RIM, width * 0.06);
        mesh.geometry.translate(0, 0, vis);       // product face sits at the rim underside
        mesh.remove(rim);
        extrudeCutout(mesh, mesh.material.map, width, width * ar, vis + CEIL_EMBED, finishHex(finishId, product), vis);
      }
      positionOnWall(mesh, wall, defaultSpot(wall, cfg));
      reveal();
    };
    img.onerror = () => reveal();
    img.src = art;
  }
  // `roll` counter-rotates a cutout in its own plane. The spout renders are shot
  // from above at a 3/4 angle, so laid flat on a wall the body slopes downhill and
  // the piece reads as if it were stuck on crooked next to the square-on plates.
  mesh.rotation.set(w.rot.x, w.rot.y, mesh.isGroup ? 0 : (cfg.roll || 0));
  positionOnWall(mesh, wall, defaultSpot(wall, cfg));
  room.add(mesh); meshes.push(mesh);
  // a jet SET is one record holding four separate fittings, so it swings per jet
  // rather than as a slab — stepBillboards needs to be told which it is
  const jetSet = product.catId === "body-jet" && !cfg.single;
  placed.set(uid, { uid, mesh, product, finishId, wall, cfg, is3D, jetSet,
                    halfW: jetSet ? cfg.width / 2 : undefined });
  if (isBasinMixer(product, wall)) setStockMixer(false);
  selectProduct(uid);
  renderRail();
  saveDesign();
  return uid;
}

function defaultSpot(wall, cfg) {
  if (wall === "counter") return new THREE.Vector3(COUNTER.x, COUNTER.y, COUNTER.z);
  if (wall === "ceiling") return new THREE.Vector3(0, WALLS.ceiling.val, cfg.z != null ? cfg.z : -0.5);
  if (wall === "left")  return new THREE.Vector3(WALLS.left.val, cfg.y != null ? cfg.y : 1.3, cfg.z != null ? cfg.z : 0);
  if (wall === "right") return new THREE.Vector3(WALLS.right.val, cfg.y != null ? cfg.y : 1.3, cfg.z != null ? cfg.z : 0);
  return new THREE.Vector3(cfg.x != null ? cfg.x : 0, cfg.y != null ? cfg.y : 1.3, WALLS.back.val);   // back
}

function positionOnWall(mesh, wall, pos) {
  const w = WALLS[wall];
  const p = pos.clone();
  if (wall === "counter") { mesh.position.copy(p); return; }
  // clamp inside the room with a small margin
  const m = 0.25;
  if (wall === "ceiling") { p.x = clamp(p.x, -HX + m, HX - m); p.z = clamp(p.z, -HZ + m, HZ - m); p.y = w.val; }
  else if (wall === "back") { p.x = clamp(p.x, -HX + m, HX - m); p.y = clamp(p.y, 0.3, RH - 0.15); p.z = w.val; }
  else { p.z = clamp(p.z, -HZ + m, HZ - m); p.y = clamp(p.y, 0.3, RH - 0.15); p.x = w.val; }
  mesh.position.copy(p);
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* =========================================================================
   "IT LANDED" FEEDBACK — a pick in the product rail must be impossible to miss
   ========================================================================= */
/* scale-pop so a freshly added fitting announces itself on the wall */
const pops = [];
function popIn(mesh) {
  const base = mesh.scale.x || 1;
  const i = pops.findIndex(p => p.mesh === mesh);
  if (i >= 0) pops.splice(i, 1);
  mesh.scale.setScalar(base * 0.55);
  pops.push({ mesh, base, t: 0 });
}
/* the pop temporarily overwrites mesh.scale — read/write the piece's REAL size
   through these so a +/- tap during the pop isn't thrown away when it settles */
function baseScale(mesh) { const p = pops.find(x => x.mesh === mesh); return p ? p.base : mesh.scale.x; }
function setBaseScale(mesh, v) {
  const p = pops.find(x => x.mesh === mesh);
  if (p) p.base = v; else mesh.scale.setScalar(v);
}
/* A spout, tap or handset is a SHAPE, and its render was shot from three
   quarters. Pinned flat to the tiles it turns into a sliver the moment you move
   off dead-on — which is what made every fitting read as a sticker. These pieces
   now pivot at their wall connection to keep facing you, within a swing small
   enough that they still read as mounted on that wall. Flat plates (rain heads,
   thermostatic panels, diverter trims, jet plates) stay flush: they really are
   flush, and they now have depth of their own. */
const BILLBOARD_SWING = 0.62;             // ±35°
/* how far this piece has to turn, from its own spot, to face the camera */
function swingFor(base, x, z) {
  let d = Math.atan2(camera.position.x - x, camera.position.z - z) - base;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return clamp(d, -BILLBOARD_SWING, BILLBOARD_SWING);
}
const _jetWP = new THREE.Vector3();
function stepBillboards() {
  placed.forEach(rec => {
    if (rec.is3D || !rec.cfg || !rec.cfg.billboard) return;
    const w = WALLS[rec.wall]; if (!w) return;
    const base = w.rot.y || 0;
    if (rec.jetSet) {
      // FOUR jets in one group. Swinging the group would rotate the whole grid
      // about its centre and carry two of the jets off the wall, so each one
      // pivots on its own union instead — the grid stays put, every nozzle turns.
      // Child rotation is relative to the group, which already carries `base`.
      rec.mesh.children.forEach(jm => {
        if (!jm.userData.jet) return;
        jm.getWorldPosition(_jetWP);
        const d = swingFor(base, _jetWP.x, _jetWP.z);
        jm.rotation.y = d;
        // a yawed plane pivots about its centre: stand it off by what the swing
        // needs so the back corner doesn't sink into the tiles (local +z is out
        // of the wall, whichever wall the set is on)
        jm.position.z = (rec.halfW || 0) * Math.abs(Math.sin(d));
      });
      return;
    }
    let d = Math.atan2(camera.position.x - rec.mesh.position.x,
                       camera.position.z - rec.mesh.position.z) - base;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    d = clamp(d, -BILLBOARD_SWING, BILLBOARD_SWING);
    rec.mesh.rotation.y = base + d;
    // A yawed plane pivots about its centre, so one half would swing back THROUGH
    // the tiles — which is what made a turned spout look half-buried and
    // half-floating. Stand it off by exactly the depth the swing needs.
    const off = (rec.halfW || 0) * Math.abs(Math.sin(d));
    if (rec.wall === "back") rec.mesh.position.z = w.val + off;
    else if (rec.wall === "left") rec.mesh.position.x = w.val + off;
    else if (rec.wall === "right") rec.mesh.position.x = w.val - off;
  });
}

function stepPops() {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.t = Math.min(1, p.t + 0.075);
    const e = 1 - Math.pow(1 - p.t, 3);                 // ease-out, slight overshoot
    const k = 0.55 + (1.06 - 0.55) * e - 0.06 * Math.sin(Math.PI * e) * (1 - e);
    p.mesh.scale.setScalar(p.base * Math.min(k, 1.06));
    if (p.t >= 1) { p.mesh.scale.setScalar(p.base); pops.splice(i, 1); }
  }
}

/* Fly the camera to a viewpoint that shows a just-added fitting IN ITS ROOM:
   the piece centred in frame, seen from a standing eye-level spot a couple of
   metres away — close enough to read, wide enough to keep the wall as context.
   The room is only 3 m deep, so the camera is placed by geometry (a spot that is
   always inside the walls) rather than by dollying blindly along a fixed vector. */
function frameProduct(rec) {
  rec.mesh.updateMatrixWorld(true);
  const box = localBox(rec.mesh).applyMatrix4(rec.mesh.matrixWorld);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(0.13, box.getBoundingSphere(new THREE.Sphere()).radius);
  // stand back far enough that every fitting reads at a similar on-screen size —
  // a 15 cm waste gets a close look, a 55 cm rain plate is seen with its wall
  const half = Math.tan(camera.fov * Math.PI / 360);
  // Scaling the standoff to the FITTING was the bug: a 22 cm valve pulled the
  // camera up against the tiles, so you got 1.7 m of blank wall with no floor,
  // ceiling or corner to place it against — you could not tell what you were
  // looking at. Take whichever is further: enough distance to read the piece, or
  // enough to keep most of the wall height in shot. The halo finds the piece.
  const MIN_FRAME_H = 2.25;                                  // metres of wall always in view
  const dist = clamp(Math.max(r / (half * 0.26), MIN_FRAME_H / (2 * half)), 1.8, 3.2);
  const tgt = c.clone();
  let pos;
  if (rec.wall === "ceiling") {
    // aim just under the head and drop the eye, so it reads against the ceiling
    // instead of being cropped off the top of the frame
    tgt.y = clamp(c.y - 0.35, 1.55, 2.20);
    pos = new THREE.Vector3(c.x + 0.30, 1.42, c.z + Math.max(2.0, dist));
  } else {
    tgt.y = c.y;
    const dir = { back:  new THREE.Vector3(0.24, 0.05, 0.97),
                  counter: new THREE.Vector3(0.30, 0.10, 0.95),
                  left:  new THREE.Vector3(0.97, 0.05, 0.24),
                  right: new THREE.Vector3(-0.97, 0.05, 0.24) }[rec.wall] ||
                new THREE.Vector3(0.24, 0.05, 0.97);
    pos = tgt.clone().add(dir.normalize().multiplyScalar(dist));
  }
  // aim a touch BELOW the piece so it sits above centre, clear of the floating
  // finish/size tool that docks over the bottom of the canvas
  tgt.y = Math.max(0.15, tgt.y - dist * half * 0.15);
  pos.y -= dist * half * 0.15;
  // keep the eye inside the room (the target — i.e. the framing — is unaffected)
  pos.x = clamp(pos.x, -HX + 0.30, HX - 0.30);
  pos.z = clamp(pos.z, -HZ + 0.30, HZ - 0.30);
  pos.y = clamp(pos.y, 0.90, RH - 0.30);
  // respect the orbit limits, or OrbitControls.update() would snap the camera
  // straight back out of the shot on the next frame
  const d = Math.max(0.6, pos.distanceTo(tgt));
  pos.y = clamp(pos.y, tgt.y + Math.cos(controls.maxPolarAngle) * d,
                       tgt.y + Math.cos(controls.minPolarAngle) * d);
  animateCam(pos, tgt);
}

/* If a product's 3D model can't be loaded, still put SOMETHING on the wall:
   the product's own cutout artwork, sized to the category width. */
function cutoutFallback(rec) {
  if (!rec) return;
  const p = rec.product;
  const path = (p.images && (p.images[rec.finishId] || p.images[p.defaultFinish]));
  if (!path) return;
  clearGroup(rec.mesh);
  const width = rec.cfg.width || 0.34;
  const mat = new THREE.MeshBasicMaterial({
    map: productTexture(roomArt(path, rec.cfg), rec.cfg), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 1.2), mat);
  if (rec.wall === "ceiling") plane.rotation.x = -Math.PI / 2;
  rec.mesh.add(plane);
  rec.mesh.rotation.set(0, MODEL_WALL_YROT[rec.wall] || 0, 0);
  rec.mesh.updateMatrixWorld(true);
  const sz = new THREE.Box3().setFromObject(rec.mesh).getSize(new THREE.Vector3());
  seatOnWall(rec.mesh, rec.wall, defaultSpot(rec.wall, rec.cfg), sz);
}

/* =========================================================================
   SELECTION + DRAG + TOOL
   ========================================================================= */
let selected = null;      // uid
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function setNDC(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}
function pickProduct(e) {
  setNDC(e); raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(meshes, true);   // recursive: 3D groups have child meshes
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && o.userData.uid == null) o = o.parent;         // walk up to the placed root
  return o ? o.userData.uid : null;
}

function selectProduct(uid) {
  selected = uid;
  meshes.forEach(m => setEmissive(m, 0x000000));
  const rec = placed.get(uid);
  if (rec) setEmissive(rec.mesh, 0x2a2013);
  renderTool();
}
function deselect() {
  selected = null; renderTool();
  meshes.forEach(m => setEmissive(m, 0x000000));
}

renderer.domElement.addEventListener("pointerdown", e => {
  const uid = pickProduct(e);
  if (uid) {
    // Positions are LOCKED — tapping a fitting selects it (finish / size / remove
    // tool) and flies the camera in to frame it, so you can inspect it up close.
    selectProduct(uid);
    const rec = placed.get(uid); if (rec) focusOn(rec.mesh);
  } else {
    deselect();
  }
});

/* selected-product floating tool */
function renderTool() {
  const tool = $("#tool");
  const rec = selected && placed.get(selected);
  if (!rec) {
    tool.hidden = true;
    document.body.classList.remove("has-tool");
    return;
  }
  tool.hidden = false;
  $("#toolName").innerHTML = `${rec.product.name}<em>${rec.product.code}` +
    `${rec.product.variant ? " · " + rec.product.variant : ""}</em>`;

  /* Preview the piece in the finish you are pointing at BEFORE you commit to it.
     A row of dots tells you nothing about how a finish reads on this particular
     product, and the piece itself is often small and far away in the room. */
  const row = $("#toolFinRow"), prev = $("#toolPreview");
  const showFinish = fid => {
    const f = FINISHES[fid] || {};
    const src = (rec.product.images && rec.product.images[fid]) || "";
    if (prev && src) prev.src = thumbOf(src);
    if (row) row.innerHTML = `<span class="lbl">Finish</span><span class="val">${f.name || ""}</span>`;
  };
  showFinish(rec.finishId);

  $("#toolFins").innerHTML = rec.product.finishes.map(fid =>
    `<button type="button" class="fin ${fid === rec.finishId ? "on" : ""}" style="background:${FINISHES[fid].swatch}"
      data-fin="${fid}" title="${FINISHES[fid].name}" aria-label="${rec.product.name} in ${FINISHES[fid].name}"
      aria-pressed="${fid === rec.finishId}"></button>`
  ).join("");
  $("#toolFins").querySelectorAll(".fin").forEach(el => {
    const fid = el.dataset.fin;
    el.onclick = () => changeFinish(rec.uid, fid);
    el.onpointerenter = () => showFinish(fid);
    el.onfocus = () => showFinish(fid);
  });
  // pointer (or focus) left the row — go back to what is actually on the piece
  $("#toolFins").onpointerleave = () => showFinish(rec.finishId);
  $("#toolFins").onfocusout = e => {
    if (!$("#toolFins").contains(e.relatedTarget)) showFinish(rec.finishId);
  };
  // on a phone the tool is docked across the bottom, so the toast has to clear it
  document.body.classList.add("has-tool");
  // read it now, not in a rAF — a backgrounded tab never runs the callback
  document.body.style.setProperty("--tool-h", tool.offsetHeight + "px");
}
$("#tool").querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
  const rec = selected && placed.get(selected); if (!rec) return;
  const a = b.dataset.a;
  if (a === "remove") { removeProduct(rec.uid); return; }
  const f = a === "bigger" ? 1.12 : 1 / 1.12;
  const next = baseScale(rec.mesh) * f;
  if (next < 0.6 || next > 1.8) return;   // keep sizing sensible — no vanishing / oversized fittings
  setBaseScale(rec.mesh, next);
  saveDesign();
});
function changeFinish(uid, fid) {
  const rec = placed.get(uid); if (!rec) return;
  rec.finishId = fid;
  sessionFinish = fid;
  if (rec.is3D) {
    const hex = finishHex(fid, rec.product);
    rec.mesh.traverse(o => {
      if (!o.userData.metal || !o.material) return;
      o.material.color.setHex(hex);
      if (o.userData.shade != null) o.material.color.multiplyScalar(o.userData.shade);
    });
    // procedural pieces take their colour from the artwork, not the swatch tone
    if (rec.mesh.userData.retint) rec.mesh.userData.retint(rec.product.images[fid]);
  } else {
    const path = rec.product.images[fid]; if (!path) return;
    // grouped body-jet set shares ONE material across its 4 jets; single products
    // carry their own material — handle both
    const targetMat = rec.mesh.material || (rec.mesh.children[0] && rec.mesh.children[0].material);
    if (!targetMat) return;
    const old = targetMat.map;
    const next = productTexture(roomArt(path, rec.cfg), rec.cfg);   // face-on art and the mirror both survive a finish swap
    targetMat.map = next;
    targetMat.needsUpdate = true;
    // everything that shares the artwork has to move to the new texture BEFORE
    // the old one is disposed, or it renders with a dead map. Traverse rather
    // than look up "rim"/"extrude" by name: getObjectByName returns the FIRST
    // match, and a jet SET has four extrusions — the other three kept pointing
    // at the texture we are about to dispose.
    rec.mesh.traverse(o => {
      if (o.material && o.material.map === old) { o.material.map = next; o.material.needsUpdate = true; }
    });
    if (old) old.dispose();
    const hex = finishHex(fid, rec.product);
    const housing = rec.mesh.getObjectByName("housing");
    if (housing) housing.material.color.setHex(hex);
    // recolour procedural metal parts (hose, arm, extrusion layers), keeping the
    // extrusion's depth shading
    rec.mesh.traverse(o => {
      if (!o.userData.metal || !o.material) return;
      o.material.color.setHex(hex);
      if (o.userData.shade) o.material.color.multiplyScalar(o.userData.shade);
    });
  }
  renderTool(); renderRail();
  saveDesign();
}
function removeProduct(uid) {
  const rec = placed.get(uid); if (!rec) return;
  if (isBasinMixer(rec.product, rec.wall)) setStockMixer(true);   // the vanity gets its own mixer back
  const pi = pops.findIndex(p => p.mesh === rec.mesh); if (pi >= 0) pops.splice(pi, 1);
  room.remove(rec.mesh);
  const i = meshes.indexOf(rec.mesh); if (i >= 0) meshes.splice(i, 1);
  rec.mesh.traverse(o => {
    // 3D-model geometry is SHARED with the load cache (clones reuse buffers) —
    // disposing it would corrupt the next placement of the same model.
    if (o.geometry && !rec.is3D) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  placed.delete(uid);
  if (selected === uid) deselect();
  renderRail();
  saveDesign();
}

/* =========================================================================
   PRODUCT RAIL (catalog)
   ========================================================================= */
let activeWall = "back";
function isPlaced(pid) { for (const r of placed.values()) if (r.product.id === pid) return true; return false; }

/* The rail shows FOUR groups only — showers, diverters, spouts and body jets.
   Everything else in the catalogue (basin mixers, hand showers, wall taps, health
   faucets, wastes) is still loaded and still places correctly, it is just not
   offered here. `cats` maps a group onto the underlying category ids, so the two
   diverter families read as one "Diverters" list while each product keeps its own
   catId — and therefore its own wall anchor. */
const RAIL_GROUPS = [
  // The client asked for FOUR groups, in this order, and only these. A previous
  // pass added Hand Showers, Taps & Valves and Wastes & Accessories so the other
  // 19 products had a way into the room — a fair engineering instinct, but not
  // what was asked for, so they are hidden again. They stay loaded, sized and
  // anchored: adding a group back here is all it takes.
  // solo: the two categories in this list are one fitting on the wall — see placeProduct
  { id: "diverters", name: "Diverters", cats: ["thermostatic", "diverter"], solo: true },
  { id: "bodyjets",  name: "Body Jets", cats: ["body-jet"] },
  { id: "showers",   name: "Showers",   cats: ["rain-shower"] },
  // basin-mixer rides with the spouts because two products literally named
  // "Axis Wall Spout" are filed there; without it this group shows ONE item and
  // those two disappear from the planner altogether.
  { id: "spouts",    name: "Spouts & Mixers", cats: ["bath-spout", "basin-mixer"] },
];
/* Auto-arrange builds a SHOWER SET, so it stays on the shower categories even
   though the list now offers the whole range — otherwise the demo would drop a
   waste and a bib tap into it and stop reading as one. */
const DEMO_CATS = ["rain-shower", "thermostatic", "diverter", "bath-spout", "body-jet"];
const RAIL_CATS = RAIL_GROUPS.reduce((a, g) => a.concat(g.cats), []);

/* The finish the visitor is designing in. Picking any swatch sets it, and every
   piece added afterwards arrives in that finish when it is available — a set of
   fittings that half-matches is the fastest way to make a room look cheap. */
let sessionFinish = null;

/* the finish a rail card is currently showing — follows the piece once it is in
   the room, otherwise whatever swatch was last clicked on the card */
const railFinish = new Map();
function cardFinish(p) {
  const rec = [...placed.values()].find(r => r.product.id === p.id);
  if (rec) return rec.finishId;
  const picked = railFinish.get(p.id);
  if (picked) return picked;
  if (sessionFinish && (p.finishes || []).includes(sessionFinish)) return sessionFinish;
  return p.defaultFinish;
}

/* rail thumbnails: 220px copies of the product renders. The full-size art is
   only fetched when a piece actually goes into the room. */
const thumbOf = path => path ? path.replace("assets/products/", "assets/products/thumb/") : "";

/* what the rail is currently filtered to */
const railQuery = { text: "" };

/* WHICH group is expanded. The rail is a single-open accordion: four lists all
   unfolded at once is a wall of product, and you lose the piece you were looking
   at. It has to be remembered here rather than read off the DOM, because every
   add re-renders the rail from scratch — which is what used to make picking a
   product collapse the group you were working in and leave the FIRST group
   (openByDefault, i === 0) expanded instead: the one list you weren't using. */
let openGroup = RAIL_GROUPS[0].id;
const groupOfCat = catId => (RAIL_GROUPS.find(g => g.cats.includes(catId)) || {}).id;

function railItems(group) {
  const items = group.cats.reduce((a, c) => a.concat(PRODUCTS[c] || []), []);
  const q = railQuery.text.trim().toLowerCase();
  return items.filter(p => {
    if (!q) return true;
    return (p.name + " " + p.code + " " + (p.variant || "")).toLowerCase().includes(q);
  });
}

/* The rail carries NO colour UI any more — no filter chips and no swatches on
   the cards. Colour is chosen on the piece itself, from the tool that appears
   when you select it, so the list stays about picking a design. */
function renderRail() {
  const acc = $("#catAccordion");
  let shown = 0, total = 0;
  RAIL_GROUPS.forEach(g => g.cats.forEach(c => (total += (PRODUCTS[c] || []).length)));

  acc.innerHTML = RAIL_GROUPS.map((g, i) => {
    const items = railItems(g);
    shown += items.length;
    if (!items.length) return "";
    // a search is the one case for opening everything: the lists are already
    // cut down to the matches, and hiding them behind a header hides the answer
    const openByDefault = railQuery.text ? true : g.id === openGroup;
    const cards = items.map(p => {
      const fin = cardFinish(p);
      const img = (p.images && (p.images[fin] || p.images[p.defaultFinish])) || "";
      return `<div class="pcard ${isPlaced(p.id) ? "placed" : ""}" data-prod="${p.id}" data-cat="${p.catId}">
        <button type="button" class="pc-main" data-add
                aria-label="Add ${p.name}, ${p.code}${isPlaced(p.id) ? ", already in the room" : ""}">
          <span class="pic"><img src="${thumbOf(img)}" loading="lazy" decoding="async" alt=""></span>
          <span class="nm">${p.name}</span>
          <span class="sub">${p.code}${p.variant ? " · " + p.variant : ""}</span>
        </button>
      </div>`;
    }).join("");
    return `<div class="cat-group ${openByDefault ? "open" : ""}" data-group="${g.id}">
      <button type="button" class="cat-title" data-toggle="${g.id}" aria-expanded="${openByDefault}">
        <span class="ic"><img src="${thumbOf((items[0].images && items[0].images[items[0].defaultFinish]) || "")}" alt=""></span>
        <b>${g.name}</b><span class="n">${items.length}</span><span class="chev" aria-hidden="true">▶</span>
      </button>
      <div class="cat-items">${cards}</div>
    </div>`;
  }).join("");

  if (!shown) {
    acc.innerHTML = `<p class="rail-empty">Nothing matches that.<br>Try a different word, or clear the finish filter.</p>`;
  }
  const count = $("#railCount");
  if (count) count.textContent = shown === total ? `${total} designs` : `${shown} of ${total}`;

  // toggled in the DOM rather than through a re-render, so opening a group
  // can't cost you your scroll position or reload every thumbnail
  const showOnly = id => {
    openGroup = id;
    acc.querySelectorAll(".cat-group").forEach(other => {
      const on = other.dataset.group === id;
      other.classList.toggle("open", on);
      const t = other.querySelector("[data-toggle]");
      if (t) t.setAttribute("aria-expanded", String(on));
    });
  };
  acc.querySelectorAll("[data-toggle]").forEach(b => b.onclick = () => {
    const g = b.closest(".cat-group");
    showOnly(g.classList.contains("open") ? null : g.dataset.group);   // tap the open one to close it
  });

  const productFor = card => (PRODUCTS[card.dataset.cat] || []).find(x => x.id === card.dataset.prod);
  const add = (p, fin) => {
    // Every category has ONE correct home (ceiling / back column / side wall) —
    // always mount there, regardless of which wall tab is active. Deterministic
    // placement: a spout can never end up on the wrong wall. placeProduct flies
    // the camera to frame the piece once its artwork is in (async).
    // the group you picked from is the group you are working in — hold it open
    // (placeProduct re-renders the rail, which reads openGroup back)
    const gid = groupOfCat(p.catId);
    if (gid) openGroup = gid;
    const replaced = [...placed.values()].find(r => r.product.catId === p.catId && r.product.id !== p.id);
    const undo = snapshot();
    placeProduct(p, fin, skuCfg(p).mount || "back", true);
    toast(replaced ? `${p.name} replaced ${replaced.product.name}` : `${p.name} added`,
          { label: "Undo", run: () => restore(undo) });
  };

  acc.querySelectorAll("[data-add]").forEach(btn => btn.onclick = () => {
    const card = btn.closest(".pcard"), p = productFor(card); if (!p) return;
    add(p, cardFinish(p));
  });
  describeRoom();
  if (typeof renderEmptyState === "function") renderEmptyState();
}

/* a plain-language description of the room for screen readers */
function describeRoom() {
  const el = $("#a11ySummary"); if (!el) return;
  const items = [...placed.values()];
  el.textContent = items.length
    ? `${items.length} fitting${items.length > 1 ? "s" : ""} in the room: ` +
      items.map(r => `${r.product.name} in ${(FINISHES[r.finishId] || {}).name || r.finishId}`).join(", ")
    : "The room is empty.";
}

/* ---- undo: snapshot / restore the whole placement set ------------------- */
function snapshot() {
  return [...placed.values()].map(r => ({
    pid: r.product.id, cat: r.product.catId, fin: r.finishId, wall: r.wall, scale: baseScale(r.mesh),
  }));
}
function restore(items) {
  [...placed.keys()].forEach(removeProduct);
  items.forEach(it => {
    const p = (PRODUCTS[it.cat] || []).find(x => x.id === it.pid); if (!p) return;
    const uid = placeProduct(p, it.fin, it.wall, false);
    const rec = placed.get(uid); if (rec && it.scale) setBaseScale(rec.mesh, it.scale);
  });
  deselect(); renderRail(); saveDesign();
}

/* =========================================================================
   TOP-BAR CONTROLS
   ========================================================================= */
$("#wallTabs").querySelectorAll("[data-wall]").forEach(b => b.onclick = () => {
  activeWall = b.dataset.wall;
  $("#wallTabs").querySelectorAll("button").forEach(x => {
    x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b));
  });
  faceWall(activeWall);
});
function faceWall(wall) {
  const targets = {
    back:  { pos: [0, 1.55, 2.3], tgt: [0, 1.35, -HZ] },
    left:  { pos: [0.75, 1.52, 0.70], tgt: [-HX, 1.34, 0.15] },
    right: { pos: [-0.55, 1.52, 0.30], tgt: [HX, 1.34, -0.55] },
  }[wall] || null;
  if (!targets) return;
  animateCam(new THREE.Vector3(...targets.pos), new THREE.Vector3(...targets.tgt));
}
/* ---- send the design on ------------------------------------------------
   No backend to post to yet, so this does what the 2D site does: opens the
   visitor's mail client with the design written out, and copies the same text
   to the clipboard so a lead is never lost when there is no mail client. */
const CONSULT_EMAIL = "skventuresdirect@gmail.com";
function designAsText() {
  const items = [...placed.values()];
  const lines = items.map((r, i) =>
    `${String(i + 1).padStart(2, "0")}. ${r.product.name}  (${r.product.code})  —  ` +
    `${(FINISHES[r.finishId] || {}).name || r.finishId}`);
  return [
    `My Stout bathroom design`,
    `Room finish: ${roomLabel()}`,
    ``,
    ...lines,
    ``,
    `Please send me availability and a quotation for supplying and installing these.`,
  ].join("\n");
}
if ($("#emailDesign")) $("#emailDesign").onclick = () => {
  if (!placed.size) { toast("Add a few products first"); return; }
  const body = designAsText();
  try { navigator.clipboard.writeText(body); } catch (_) { /* not permitted */ }
  const url = `mailto:${CONSULT_EMAIL}?subject=${encodeURIComponent("Stout bathroom design enquiry")}` +
              `&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  toast(`Copied — email us at ${CONSULT_EMAIL}`);
};

$("#resetView").onclick = () => {
  animateCam(heroPos(), heroTgt());
  // the hero view is not any one wall, so no wall tab should still read as active
  $("#wallTabs").querySelectorAll("button").forEach(b => {
    b.classList.remove("on"); b.setAttribute("aria-pressed", "false");
  });
};
$("#snapCol").onclick = () => autoArrange();

/* =========================================================================
   PDF SPEC SHEET — the client's chosen design as a shareable document.
   Contents: the 3D design snapshot + the list of selected fittings with
   their finish + Stout code. NO PRICING (ever) — pricing is the consultant's.
   ========================================================================= */
let toastEl = null, toastTimer = null;
function toast(msg, action) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.innerHTML = '<span></span>';
    document.body.appendChild(toastEl);
  }
  toastEl.firstChild.textContent = msg;
  const old = toastEl.querySelector("button"); if (old) old.remove();
  if (action) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = action.label;
    b.onclick = () => { action.run(); hideToast(); };
    toastEl.appendChild(b);
  }
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 5200 : 2400);
}
function hideToast() { if (toastEl) toastEl.classList.remove("show"); }

function categoryName(catId) {
  const c = (CATEGORIES || []).find(x => x.id === catId);
  return c ? c.name : catId;
}
/* hex → [r,g,b] for jsPDF fill colours */
function hex2rgb(h) {
  const n = parseInt(String(h).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function captureCanvas() {
  // preserveDrawingBuffer is on, but render once more so the buffer is fresh
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/jpeg", 0.92);
}
/* jsPDF needs pixels, and a transparent PNG would print on a black ground —
   composite each product render onto white first. */
function thumbDataURL(path, px) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = mkCanvas(px, px), x = c.getContext("2d");
      x.fillStyle = "#ffffff"; x.fillRect(0, 0, px, px);
      const r = Math.min(px / img.naturalWidth, px / img.naturalHeight) * 0.92;
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      x.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
      res(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => res(null);
    img.src = path;
  });
}

async function downloadSpecSheet() {
  if (!window.jspdf || !window.jspdf.jsPDF) { toast("PDF engine not loaded"); return; }
  const items = [...placed.values()];
  if (!items.length) { toast("Add a few products first, then download"); return; }

  // Fly to the hero view and give the animation a moment before we snapshot.
  animateCam(heroPos(), heroTgt());
  const prev = selected; deselect();
  toast("Building your spec sheet…");
  const thumbs = await Promise.all(items.map(rec => {
    const path = (rec.product.images && (rec.product.images[rec.finishId] || rec.product.images[rec.product.defaultFinish])) || "";
    return path ? thumbDataURL(thumbOf(path), 300) : Promise.resolve(null);
  }));
  setTimeout(() => {
    let img = null;
    try { img = captureCanvas(); } catch (e) { console.warn("capture failed", e); }
    if (prev) selectProduct(prev);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const PW = 210, PH = 297, M = 14;
    const GOLD = [198, 161, 91], INK = [28, 28, 30], MUTE = [120, 120, 124], LINE = [222, 218, 208];

    // ---- header band ----
    doc.setFillColor(15, 15, 17); doc.rect(0, 0, PW, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("STOUT", M, 15);
    doc.setTextColor(...GOLD); doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("SANITARYWARE", M + 27, 15);
    doc.setTextColor(210, 210, 214); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("Bathroom Design Specification", PW - M, 12, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(150, 150, 154);
    const when = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    doc.text(`${roomLabel()} bathroom  ·  ${when}`, PW - M, 18, { align: "right" });
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(0, 26, PW, 26);

    // ---- design snapshot ----
    let y = 26 + 8;
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Your Design", M, y); y += 4;
    if (img) {
      const cw = renderer.domElement.width, ch = renderer.domElement.height;
      const availW = PW - 2 * M;
      let iw = availW, ih = availW * (ch / cw);
      const maxH = 118;
      if (ih > maxH) { ih = maxH; iw = maxH * (cw / ch); }
      const ix = M + (availW - iw) / 2;
      doc.setFillColor(245, 243, 238); doc.roundedRect(M, y, availW, ih + 6, 2, 2, "F");
      doc.addImage(img, "JPEG", ix, y + 3, iw, ih, undefined, "FAST");
      y += ih + 6 + 8;
    } else { y += 6; }

    // ---- selected products ----
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Selected Products", M, y); y += 2;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, y + 1, PW - M, y + 1); y += 7;

    const rowH = 20, thumbMM = 15;
    items.forEach((rec, i) => {
      if (y + rowH > PH - 22) { doc.addPage(); y = M + 8; }
      const fin = FINISHES[rec.finishId] || {};
      const top = y - 5;
      // the product itself, so the sheet can be read without the app
      if (thumbs[i]) {
        doc.setFillColor(248, 246, 242); doc.roundedRect(M, top, thumbMM, thumbMM, 1.4, 1.4, "F");
        doc.addImage(thumbs[i], "JPEG", M + 0.6, top + 0.6, thumbMM - 1.2, thumbMM - 1.2, undefined, "FAST");
      }
      const tx = M + thumbMM + 5;
      doc.setTextColor(...GOLD); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text(String(i + 1).padStart(2, "0"), tx, y - 1.5);
      doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
      doc.text(rec.product.name || "Product", tx + 6, y - 1.5);
      doc.setTextColor(...MUTE); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      doc.text(`${categoryName(rec.product.catId)}   ·   Code ${rec.product.code || "—"}`, tx + 6, y + 3);
      if (rec.product.variant) {
        doc.setFontSize(7.8); doc.setTextColor(160, 158, 152);
        doc.text(rec.product.variant, tx + 6, y + 7.2);
      }
      // finish swatch + label (right aligned)
      const sw = hex2rgb(fin.tone || "#c9ced3");
      doc.setFillColor(...sw); doc.setDrawColor(200, 196, 186); doc.setLineWidth(0.2);
      doc.roundedRect(PW - M - 40, y - 4.4, 5.4, 5.4, 0.9, 0.9, "FD");
      doc.setTextColor(...INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      doc.text(fin.name || "—", PW - M - 32.5, y - 0.6);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, top + thumbMM + 2.5, PW - M, top + thumbMM + 2.5);
      y += rowH;
    });

    // ---- who Stout is, and what "we'll take it from here" covers ----
    if (y + 34 > PH - 24) { doc.addPage(); y = M + 8; }
    y += 4;
    doc.setFillColor(249, 247, 243); doc.roundedRect(M, y, PW - 2 * M, 28, 2, 2, "F");
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("About Stout", M + 6, y + 8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.6); doc.setTextColor(...MUTE);
    doc.text(doc.splitTextToSize(
      "Stout is a single point of contact for the whole bathroom. We manufacture and supply the " +
      "complete range of fittings shown here, and our own teams install them on site — so the pieces " +
      "you have chosen, the delivery and the fitting are all handled by us, with one warranty behind them.",
      PW - 2 * M - 12), M + 6, y + 14);
    y += 34;

    // ---- footer on every page ----
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, PH - 16, PW - M, PH - 16);
      doc.setTextColor(...MUTE); doc.setFont("helvetica", "normal"); doc.setFontSize(7.8);
      doc.text("Finishes shown are indicative. Your Stout consultant will confirm availability and quote for supply and installation.", M, PH - 11);
      doc.text("Stout Sanitaryware  ·  skventuresdirect@gmail.com", M, PH - 7);
      doc.text(`Page ${p} / ${pages}`, PW - M, PH - 7, { align: "right" });
    }

    doc.save("Stout-Bathroom-Design.pdf");
    toast("Spec sheet downloaded");
  }, 420);
}
$("#downloadPdf").onclick = downloadSpecSheet;

/* one of each of the four core categories, as a tidy shower column on the back wall */
function autoArrange() {
  // A cohesive shower wall for the demo. Picking "the first product in each
  // category, in the closest finish" used to land rose-gold panels beside a
  // chrome jet, because some SKUs only exist in one finish. So: choose the
  // FINISH FAMILY first, then take the best product in each category that can
  // actually wear it. A smaller matched set beats a complete mismatched one.
  const PREF = ["brushedGold", "gold", "chrome", "matteBlack", "roseGold"];
  const canWear = (cid, fin) => (PRODUCTS[cid] || []).some(p => (p.finishes || []).includes(fin));
  let best = null;
  PREF.forEach(fin => {
    const covered = DEMO_CATS.filter(cid => canWear(cid, fin)).length;
    if (!best || covered > best.covered) best = { fin, covered };
  });
  const fin = best ? best.fin : "chrome";
  sessionFinish = fin;

  const undo = snapshot();
  [...placed.values()].forEach(r => removeProduct(r.uid));
  const skipped = [];
  DEMO_CATS.forEach(cid => {
    const list = (PRODUCTS[cid] || []).filter(p => (p.finishes || []).includes(fin));
    if (!list.length) { if ((PRODUCTS[cid] || []).length) skipped.push(categoryName(cid)); return; }
    const p = list[0];
    placeProduct(p, fin, skuCfg(p).mount || "back");
  });
  deselect();
  renderRail();
  saveDesign();
  animateCam(heroPos(), heroTgt());
  const name = (FINISHES[fin] || {}).name || fin;
  toast(skipped.length ? `A ${name} shower wall — no ${skipped.join(" / ")} in ${name}`
                       : `A ${name} shower wall`, { label: "Undo", run: () => restore(undo) });
}

/* ---- persistence (survives refresh) + clear-all + removable vanity ------- */
const STORE_KEY = "stout.3d.v5";   // bumped: discard old demo layouts so the room starts CLEAN (user adds products fresh)
let restoring = false;
function saveDesign() {
  if (restoring) return;
  try {
    const items = [...placed.values()].map(r => ({ pid: r.product.id, cat: r.product.catId, fin: r.finishId, wall: r.wall, scale: baseScale(r.mesh) }));
    localStorage.setItem(STORE_KEY, JSON.stringify({ items, basin: basinVisible }));
  } catch (_) { /* storage blocked — ignore */ }
}
function loadDesign() {
  let d; try { d = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (_) { d = null; }
  if (!d || !Array.isArray(d.items)) return false;
  restoring = true;
  setBasin(d.basin !== false);
  d.items.forEach(it => {
    const list = PRODUCTS[it.cat]; if (!list) return;
    const p = list.find(x => x.id === it.pid); if (!p) return;
    const uid = placeProduct(p, FINISHES[it.fin] ? it.fin : p.defaultFinish, it.wall || skuCfg(p).mount || "back");
    const rec = placed.get(uid); if (rec && it.scale) rec.mesh.scale.setScalar(it.scale);
  });
  restoring = false;
  deselect();
  animateCam(heroPos(), heroTgt());
  return true;
}
function setBasin(show) {
  basinVisible = show;
  if (!cornerBasinUnit) return;
  if (show && !cornerBasinUnit.parent) shell.add(cornerBasinUnit);
  else if (!show && cornerBasinUnit.parent) shell.remove(cornerBasinUnit);
  const btn = $("#toggleBasin");
  if (btn) { btn.classList.toggle("on", show); btn.setAttribute("aria-pressed", show);
             btn.title = show ? "Hide the vanity" : "Show the vanity"; }
}
function clearAll() { [...placed.keys()].forEach(removeProduct); deselect(); saveDesign(); }
$("#clearAll").onclick = () => {
  if (!placed.size) { toast("The room is already empty"); return; }
  askConfirm(() => { const undo = snapshot(); clearAll(); toast("Room cleared", { label: "Undo", run: () => restore(undo) }); });
};

/* ---- confirm dialog ----------------------------------------------------- */
let confirmRun = null;
function askConfirm(run) {
  confirmRun = run;
  const m = $("#confirm"); if (!m) { run(); return; }
  m.hidden = false;
  $("#confirmYes").focus();
}
function closeConfirm() { const m = $("#confirm"); if (m) m.hidden = true; confirmRun = null; }
if ($("#confirmNo")) $("#confirmNo").onclick = closeConfirm;
if ($("#confirmYes")) $("#confirmYes").onclick = () => { const r = confirmRun; closeConfirm(); if (r) r(); };
if ($("#confirm")) $("#confirm").addEventListener("click", e => { if (e.target === $("#confirm")) closeConfirm(); });

/* ---- ··· menu ----------------------------------------------------------- */
(function initMenu() {
  const btn = $("#moreBtn"), menu = $("#moreMenu");
  if (!btn || !menu) return;
  const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  btn.onclick = e => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  };
  // delegated: controls MOVE into this menu on a phone, so per-button listeners
  // wired at boot would miss them
  menu.addEventListener("click", e => { if (e.target.closest("button")) close(); });
  document.addEventListener("click", e => { if (!menu.hidden && !menu.contains(e.target)) close(); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!menu.hidden) { close(); btn.focus(); }
    else if ($("#confirm") && !$("#confirm").hidden) closeConfirm();
    else if (selected) deselect();
  });
})();

/* ---- search + finish filter -------------------------------------------- */
(function initSearch() {
  const inp = $("#search"); if (!inp) return;
  let t = null;
  inp.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { railQuery.text = inp.value; renderRail(); }, 110);
  });
})();

/* ---- phone toolbar -----------------------------------------------------
   The bar measured 743px on a 375px screen, so Spec sheet — and the ··· menu
   itself — scrolled off the right edge with nothing to say they were there. On a
   phone the secondary controls MOVE into the menu (the same buttons, with the
   same handlers and state) and move back when there is room.               */
const TO_MENU = ["#wallTabs", "#ceilTabs", "#resetView", "#lookToggle", "#toggleBasin", "#downloadPdf"];
/* The ceiling swatches move at their OWN width, not the phone one: the bar is
   already ~1185px of controls, so a sixth item only fits on a genuinely wide
   window. Below this it rides in the ··· menu, where it is labelled and has all
   the room it needs. Keep in step with the #ceilGroup media query in the CSS. */
const CEIL_MQ = "(max-width:1420px)";
const menuMQ = sel => (sel === "#ceilTabs" ? CEIL_MQ : "(max-width:860px)");
const MENU_LABEL = { resetView: "Reset the view", lookToggle: "Cursor turn",
                     toggleBasin: "Show or hide the vanity", downloadPdf: "Download the spec sheet" };
let toolbarHome = null;
function syncToolbar() {
  const menu = $("#moreMenu"); if (!menu) return;
  if (!toolbarHome) {
    toolbarHome = new Map();
    TO_MENU.forEach(sel => {
      const el = $(sel); if (!el) return;
      toolbarHome.set(el, { parent: el.parentNode, next: el.nextSibling, text: el.textContent });   // text only used for the leaf buttons
    });
  }
  // insert in reverse so the declared order survives
  TO_MENU.slice().reverse().forEach(sel => {
    const el = $(sel); if (!el) return;
    const narrow = window.matchMedia(menuMQ(sel)).matches;
    const home = toolbarHome.get(el);
    if (narrow && el.parentNode !== menu) {
      if (MENU_LABEL[el.id]) el.textContent = MENU_LABEL[el.id];
      if (el.tagName === "BUTTON") el.setAttribute("role", "menuitem");
      el.classList.add("in-menu");
      menu.insertBefore(el, menu.firstChild);
    } else if (!narrow && el.parentNode === menu) {
      // ONLY the leaf buttons get relabelled — #wallTabs is a container, and
      // setting its textContent would delete the three buttons inside it
      if (MENU_LABEL[el.id]) el.textContent = home.text;
      el.removeAttribute("role");
      el.classList.remove("in-menu");
      home.parent.insertBefore(el, home.next);
    }
  });
  // A group whose controls have all moved into the menu is left empty — but it
  // still draws the divider line before it, so the phone bar showed two stray
  // separators with nothing between them.
  document.querySelectorAll(".topbar .group").forEach(g => {
    const live = [...g.children].some(c =>
      !c.classList.contains("glabel") && !c.hidden && c.id !== "moreMenu");
    g.classList.toggle("is-empty", !live);
  });
}
window.addEventListener("resize", syncToolbar);

/* ---- products sheet on a phone ----------------------------------------- */
(function initSheet() {
  const grip = $("#sheetGrip"), rail = $("#rail"); if (!grip || !rail) return;
  grip.onclick = () => {
    const open = !rail.classList.contains("open");
    rail.classList.toggle("open", open);
    document.body.classList.toggle("sheet-open", open);   // lifts the toast clear
    grip.setAttribute("aria-expanded", String(open));
    grip.querySelector("span").textContent = open ? "Close" : "Products";
  };
})();
$("#toggleBasin").onclick = () => { setBasin(!basinVisible); saveDesign(); };

/* smooth camera move */
let camAnim = null;
function animateCam(pos, tgt) {
  camAnim = { from: camera.position.clone(), to: pos, fromT: controls.target.clone(), toT: tgt, t: 0 };
}
/* Fly the camera to frame a tapped fitting up close (keeps the current viewing
   direction, just re-targets + dollies in) — so you can actually inspect the
   shower head / valves / spout instead of being stuck at room distance. */
function focusOn(mesh) {
  const p = mesh.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  animateCam(p.clone().add(dir.multiplyScalar(1.05)), p.clone());
}

/* =========================================================================
   CURSOR TURN — the room follows the pointer, no dragging needed.
   It is a gentle offset applied on top of whatever view you are currently in,
   so dragging, zooming, the wall tabs and the tap-to-inspect fly-in all keep
   working: while any of those are happening cursor-turn stands down, then
   re-bases itself around the new view. Direction matches a drag (move right →
   the room turns right). Mouse only — on touch there is no hover to read.
   ========================================================================= */
const LOOK_KEY = "stout.3d.look";
const look = {
  on: true,
  theta: 0, phi: 0,        // the view we are orbiting AROUND
  curX: 0, curY: 0,        // eased offset actually applied
  tgtX: 0, tgtY: 0,        // where the pointer wants it
  hold: 0,                 // frames to wait before re-basing
  RANGE_X: 0.5, RANGE_Y: 0.14,
};
let lookSuspended = false;
const _lookSph = new THREE.Spherical(), _lookOff = new THREE.Vector3();

function rebaseLook() {
  _lookOff.subVectors(camera.position, controls.target);
  _lookSph.setFromVector3(_lookOff);
  look.theta = _lookSph.theta; look.phi = _lookSph.phi;
  look.curX = look.curY = 0;
}
function updateLook() {
  if (!look.on || lookSuspended) return;
  if (look.hold > 0) { if (--look.hold === 0) rebaseLook(); return; }
  look.curX += (look.tgtX - look.curX) * 0.07;
  look.curY += (look.tgtY - look.curY) * 0.07;
  _lookOff.subVectors(camera.position, controls.target);
  _lookSph.setFromVector3(_lookOff);                 // keep the radius the wheel left us
  // swing less when you are zoomed right into a fitting, or it whips around
  const k = clamp(_lookSph.radius / 2.4, 0.3, 1);
  _lookSph.theta = clamp(look.theta + look.curX * k, controls.minAzimuthAngle, controls.maxAzimuthAngle);
  _lookSph.phi = clamp(look.phi + look.curY * k, controls.minPolarAngle, controls.maxPolarAngle);
  camera.position.copy(controls.target).add(_lookOff.setFromSpherical(_lookSph));
}
renderer.domElement.addEventListener("pointermove", e => {
  if (e.pointerType && e.pointerType !== "mouse") return;
  const r = renderer.domElement.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
  const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
  look.tgtX = -nx * look.RANGE_X;    // same direction as dragging
  look.tgtY = ny * look.RANGE_Y;
});
renderer.domElement.addEventListener("pointerleave", () => { look.tgtX = 0; look.tgtY = 0; });

/* hover: nothing in the 3D view used to look clickable — cursor + a soft lift */
let hovered = null;
renderer.domElement.addEventListener("pointermove", e => {
  const uid = pickProduct(e);
  if (uid === hovered) return;
  if (hovered && hovered !== selected) { const r = placed.get(hovered); if (r) setEmissive(r.mesh, 0x000000); }
  hovered = uid;
  if (hovered && hovered !== selected) { const r = placed.get(hovered); if (r) setEmissive(r.mesh, 0x140f08); }
  holder.classList.toggle("over-product", !!hovered);
});
controls.addEventListener("start", () => { lookSuspended = true; });
controls.addEventListener("end", () => { lookSuspended = false; look.hold = 20; });  // let the damping settle, then re-base

function setLook(on) {
  look.on = on;
  if (on) rebaseLook();
  const b = $("#lookToggle");
  if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
           b.title = on ? "Cursor turn is on — move the pointer to turn the room" : "Cursor turn is off"; }
  try { localStorage.setItem(LOOK_KEY, on ? "1" : "0"); } catch (_) { /* storage blocked */ }
}
if ($("#lookToggle")) $("#lookToggle").onclick = () => setLook(!look.on);
(function initLook() {
  let v = null; try { v = localStorage.getItem(LOOK_KEY); } catch (_) { v = null; }
  setLook(v !== "0");
})();

/* =========================================================================
   ROTATOR DOCK — turn / tilt / zoom from a fixed handle on the right.
   Dragging across the room works but competes with picking a fitting, and a
   touchpad gives you nothing to grab. Everything here drives the SAME orbit the
   mouse does, so the two never disagree: it reads the live camera, changes one
   spherical coordinate, and re-bases cursor-turn afterwards.
   ========================================================================= */
const _rotSph = new THREE.Spherical(), _rotOff = new THREE.Vector3();
function readOrbit() {
  _rotOff.subVectors(camera.position, controls.target);
  _rotSph.setFromVector3(_rotOff);
  return _rotSph;
}
function writeOrbit(sph) {
  sph.theta = clamp(sph.theta, controls.minAzimuthAngle, controls.maxAzimuthAngle);
  sph.phi = clamp(sph.phi, controls.minPolarAngle, controls.maxPolarAngle);
  sph.radius = clamp(sph.radius, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).add(_rotOff.setFromSpherical(sph));
  camAnim = null;                 // a manual nudge wins over any fly-in still running
  look.hold = 12;                 // let cursor-turn re-base around the new view
  paintDial(sph.theta);
}
/* the dial is a plan view: the dot is where you are standing, the square is the
   room. theta 0 = square on, +90° = hard right, -90° = hard left. */
function paintDial(theta) {
  const mark = document.getElementById("rotMark"), dial = $("#rotDial");
  if (!mark) return;
  const deg = THREE.MathUtils.radToDeg(theta);
  mark.setAttribute("transform", "rotate(" + (-deg) + " 50 50)");
  if (dial) dial.setAttribute("aria-valuenow", Math.round(deg));
}
(function wireRotator() {
  const dial = $("#rotDial");
  if (!dial) return;
  const STEP = THREE.MathUtils.degToRad(15);

  const angleFromEvent = e => {
    const r = dial.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 6) return null;        // dead zone at the centre
    return Math.atan2(dx, dy);                       // 0 = straight down = front on
  };
  let dragging = false;
  const drag = e => {
    const a = angleFromEvent(e); if (a == null) return;
    const sph = readOrbit(); sph.theta = a; writeOrbit(sph);
  };
  dial.addEventListener("pointerdown", e => {
    dragging = true; lookSuspended = true;
    dial.setPointerCapture(e.pointerId); drag(e); e.preventDefault();
  });
  dial.addEventListener("pointermove", e => { if (dragging) drag(e); });
  const stop = e => {
    if (!dragging) return;
    dragging = false; lookSuspended = false; look.hold = 12;
    try { dial.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  dial.addEventListener("pointerup", stop);
  dial.addEventListener("pointercancel", stop);
  dial.addEventListener("keydown", e => {
    const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    const sph = readOrbit(); sph.theta += d * STEP; writeOrbit(sph);
  });

  $("#rotator").querySelectorAll("[data-rot],[data-tilt],[data-zoom]").forEach(b => {
    b.onclick = () => {
      const sph = readOrbit();
      if (b.dataset.rot)  sph.theta += THREE.MathUtils.degToRad(+b.dataset.rot);
      if (b.dataset.tilt) sph.phi += (+b.dataset.tilt) * 0.06;
      if (b.dataset.zoom) sph.radius *= (+b.dataset.zoom > 0 ? 1.18 : 1 / 1.18);
      writeOrbit(sph);
    };
  });
  const centre = $("#rotCentre");
  if (centre) centre.onclick = () => {
    animateCam(heroPos(), heroTgt());
  };
  paintDial(readOrbit().theta);
})();

/* =========================================================================
   RENDER LOOP + RESIZE
   ========================================================================= */
function resize() {
  const w = holder.clientWidth, h = holder.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

let started = false;
function loop() {
  requestAnimationFrame(loop);
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + 0.06);
    const e = 1 - Math.pow(1 - camAnim.t, 3);
    camera.position.lerpVectors(camAnim.from, camAnim.to, e);
    controls.target.lerpVectors(camAnim.fromT, camAnim.toT, e);
    if (camAnim.t >= 1) { camAnim = null; look.hold = 4; }   // re-base cursor-turn on the new view
  } else {
    updateLook();
  }
  stepPops();
  stepBillboards();
  controls.update();
  paintDial(readOrbit().theta);   // dial follows drags, wall tabs and cursor-turn too
  renderer.render(scene, camera);
  if (!started) { started = true; $("#loading").classList.add("hide"); }
}

window.__STOUT3D = { scene, camera, controls, renderer, shell, lightRig, room, THEMES, applyTheme, animateCam };

/* ---- empty state: an invitation, not an instruction paragraph -----------
   NOT an auto-placed demo — products must never appear on their own when the
   site is opened (that was a specific complaint). This is a card that offers
   the first move and disappears the moment anything is in the room.        */
function renderEmptyState() {
  let el = $("#empty");
  if (placed.size) { if (el) el.remove(); return; }
  if (el) return;
  el = document.createElement("div");
  el.id = "empty"; el.className = "empty";
  el.innerHTML =
    '<p class="e-kicker">Start your bathroom</p>' +
    '<h2>Choose an overhead shower</h2>' +
    '<p class="e-body">Pick anything from the products list and it locks into its correct place. ' +
    'Tap it in the room to try it in another finish. Nothing is priced here — Stout supplies ' +
    'and installs the whole design, and your consultant quotes it.</p>' +
    '<div class="e-row">' +
      '<button type="button" data-e="first">Add a rain shower</button>' +
      '<button type="button" data-e="set">Auto-arrange a full set</button>' +
    '</div>';
  $(".stage3d").appendChild(el);
  el.querySelector('[data-e="first"]').onclick = () => {
    const list = PRODUCTS["rain-shower"] || []; const p = list[0]; if (!p) return;
    openGroup = groupOfCat(p.catId) || openGroup;   // same rule as picking from the rail
    placeProduct(p, cardFinish(p), skuCfg(p).mount || "back", true);
    toast(`${p.name} added`); renderRail();
  };
  el.querySelector('[data-e="set"]').onclick = () => autoArrange();
}

/* boot */
resize();
syncToolbar();
renderRail();
setBasin(true);   // vanity is part of the furnished room — shown by default
// ALWAYS open on a CLEAN furnished room: no demo auto-arrange AND no restore of a
// previous layout, so products never reappear on their own when the site is opened.
// The user adds fittings fresh each visit; the "Auto-arrange" button still drops
// the full demo shower set on demand, and "Clear" empties the room.
clearAll();       // wipe any stale saved layout so nothing is resurrected on open
loop();
console.log("%cStout 3D Planner — build 3d7 (themed rooms)", "color:#c6a15b;font-weight:bold");
})();
