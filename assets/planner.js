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
/* THE VALVE LANE. Everything in a shower set lines up on one depth: the valve
   itself, the four jets that straddle it, the spout under it, the arm above it
   — and, since 2026-09-19 at the client's ask, the overhead plate too. It was a
   -0.25 typed into six separate rows, and the overhead was the one that had
   drifted: it sat at z -0.55 and, because the ceiling anchor ignored `x`
   entirely, at x 0 — the middle of the ROOM rather than over the shower. From
   the floor that put the rain head a long stride in front of the valve and well
   to its left, which is what the client drew a line between. One constant, so
   the lane cannot come apart a row at a time again. */
const VALVE_Z = -0.25;
/* and how far the overhead plate hangs OUT from the shower wall. You stand
   under the head facing the valve, so this is roughly shoulder-to-wall: 0.70 m
   off the tiles at x 1.492, which also keeps the 0.62 m plate (x 0.49 to 1.11)
   clear of both the wall and the two ceiling spots at x 0.82. */
const CEIL_OUT = 0.80;
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
  //    z -0.25   the valve lane, and the whole column that hangs off it: the
  //              thermostatic panel or diverter trim at hand height, the four
  //              jets framing it, and the filler spout below at y 0.78.
  //              Where your hand lands at the entry: thermostatic
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
  "rain-shower":  { mount: "ceiling", width: 0.62, z: VALVE_Z, x: CEIL_OUT },
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
  /* NO SWING, AND NO DE-SKEW. Both were attempts to get a three-quarter render
     to read square-on, and both cost more than they bought:

       `billboard: true` yawed each jet toward the camera. Four jets then held
       four DIFFERENT orientations, recomputed every frame from the eye position
       — a fixture inheriting the camera angle, which is not an installation.
       Off, permanently.

       `faceOn` swapped in a homography-rectified copy of the photograph. On a
       flat plate that is correct. On a PROTRUDING jet it is destruction: the
       escutcheon, the neck barrel and the proud spray head are warped into a
       flat square of nubs. The note on ST-BJ3F below already said no homography
       can do this — it was applied to its two twins anyway.

     A jet's designed pose lives in its photograph. Pinning the cutout flat and
     leaving the artwork alone is what preserves it: the plate sits flush on the
     tile, and the neck and head still project at the angle they were shot at,
     because that angle is in the pixels. All four jets are then identical, and
     nothing about them depends on where the camera is.

     Worth recording, because the swing was turned ON here for a while to answer
     the client's "not properly attached to the wall": it was not what fixed
     that. The BOSS was. BJ3F had no SKU entry at all, so its wall union went to
     the default — the centre of a three-quarter frame, which on that render is
     mid-barrel, thin air between plate and head. The jet was pegged to the tile
     through its own neck with the escutcheon floating clear. Put the boss back
     under the plate and the piece reads mounted with the swing OFF, which is
     the version to keep: same fix, and the four jets stop disagreeing with each
     other about where the camera is. */
  "body-jet":     { mount: "right", width: 0.15, z: VALVE_Z, y: 1.34, billboard: false },
  /* THE SPOUT SITS UNDER THE VALVE (asked for directly). It was on its own lane
     at z -0.72, a third of a metre behind the jets — read as a separate fitting
     on a separate part of the wall rather than the bottom of one column. On the
     valve lane it finishes the stack the way a shower wall is actually drawn:
     jets and trim above, filler below, all on the same centre line.
     y 0.78 is unchanged — filler height, and it is what keeps this clear of
     everything above it. The numbers, with the tallest artwork in each category:
     Measured on the wall (with a piece SELECTED the box is meaningless — its
     halo is ~1.9x the piece and inflates it):
       spout      y 0.693..0.863   filler height
       trim       y 0.969..1.317   ST-D5017, the range's tallest, lifted to 1.15
       jet grid   y 1.126..1.551   the trim sits inside it, which is the point
     — 10 cm of daylight under the trim. At the trim's old y 1.00 the spout's top
     edge and the trim's bottom edge met at 0.82, which is what the lift buys. */
  "bath-spout":   { mount: "right", width: 0.44, z: VALVE_Z, y: 0.78, billboard: true },
  /* THE VALVE IS ON THE RIGHT WALL, IN THE MIDDLE OF THE JET GRID. This is the
     client's own layout and it does not move: the diverter at the centre of the
     wall with the body jets straddling it, which is how their showers are
     specified. It shares the jets' anchor exactly (z -0.25, y 1.34).
     It was moved to the back wall once, on a misreading of "the diverter looks
     slant" — that slant is the RIGHT WALL being viewed along its length from the
     opening camera, which foreshortens any flat plate on it. The fitting is
     flush: its rotation measures exactly -90 against a wall at -90. Use the
     Right view tab to see the wall square-on. Do not "fix" it by moving it. */
  "thermostatic": { mount: "right", width: 0.50, z: VALVE_Z, y: 1.34, panel: true },
  /* The valve lane is a single POINT, not a column: z -0.25, y 1.34, the centre
     of the jet grid. Both trim types answer to it, because on the wall they ARE
     one fitting — picking a second one out of the Diverters list replaces the
     first rather than joining it (placeProduct, `solo`). It is clear of the
     spout, which owns z -0.94..-0.50 at 0.63..0.93, and of the jets, which own
     z ±0.32 from this centre. */
  "diverter":     { mount: "right", width: 0.18, z: VALVE_Z, y: 1.34, panel: true },
  "health-faucet":{ mount: "right", width: 0.20, y: 0.72, z: 0.52, billboard: true },  // shattaf beside the WC (wcZ 0.95)
  // --- the odds and ends the rail doesn't offer stay on the back wall, right
  //     end, clear of the niche (0.44–0.84) and of the vanity, which owns the left
  "wall-tap":     { mount: "back", width: 0.34, y: 0.42, x: 1.16, billboard: true },  // bucket tap, near the floor
  /* THE HANDSET GOES BESIDE THE VALVE, ON ITS RIGHT (2026-09-19, asked for
     directly). It was in the back wall's right corner, which read as a fitting
     parked on a different wall from the set it belongs to. This also puts it
     where the plumbing wanted it: a hand shower is fed off the diverter — off
     the button spout's own button when that is the pick, see feedsHandset — so
     it belongs on the wall the valve set is on.
     RIGHT is +z here. Standing in the room facing this wall, +z is to your
     right: the WC at z 0.95 appears at the right of the opening view, the
     corner with the back wall at -1.5 at the left. It was put on the LEFT
     first, at z -0.86, and that was wrong — the ask was the right-hand side.
     z 0.36 is that -0.86 mirrored about the valve centre (-0.25), so the
     handset stands off the trim by the same 0.61 m either way and the wall
     reads balanced whichever side it is on. Measured off the render square-on,
     not taken from the `width` fields — hide each piece, diff the frames for
     its true silhouette, and scale by projecting two known points on the wall.
     The four-jet set reaches z 0.143 on this side and the trim 0.082; the
     handset spans 0.226..0.450, so 83 mm of tile to the nearest jet and 144 mm
     to the trim. Nothing else is out there — the shattaf lane at z 0.52 belongs
     to health-faucet, which the rail does not offer, and the WC is floor-level
     furniture 0.7 m below this.
     y 1.10 puts the bracket at 1.06, which is where a handset holder is actually
     set. No swing: it hangs in a bracket, and a bracket does not follow the
     camera. */
  "hand-shower":  { mount: "right", width: 0.20, y: 1.10, z: 0.36, billboard: false },
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
  // A handset's artwork is taller than it is wide, so THIS is what sets its
  // size on the wall — its `width` never binds, and raising `width` alone does
  // nothing. 0.40 (was 0.34) is the client asking for "a bit big", 2026-09-19.
  // Measured on the wall, ST-HS3211 with its bracket and hose goes from
  // 209 x 541 mm to 245 x 637 — 18% up, which is the "bit". Still what a real
  // handset measures once the hose tail these renders include is counted
  // (25-30 cm of body).
  "bath-spout": 0.30, "hand-shower": 0.40, "health-faucet": 0.30,
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
  /* The seven overhead heads the July catalogue adds (p97-106). The five small
     round ABS ones and the oval are the same kind of fitting as ST-1027 and
     ST-1033 above — a head on a wall arm, not a ceiling plate — so they take
     the same treatment: back wall at 2.00 with a procedural arm, rather than
     the category's ceiling mount, which would hang a 130 mm ABS head off the
     slab on nothing. Their cutouts are head-only, which is what `shape: "head"`
     wants.
     The two SQUARE plates are the other kind and stay on the ceiling: ST-1029 is
     the brass plate the catalogue codes, and ST-SOH is the SS304 one, which
     ships in five sizes from 150 to 400 mm — 250 is the middle of that and what
     it is drawn at here. */
  "ST-1012": { width: 0.22, mount: "back", y: 2.00, shape: "head", reach: 0.28 },
  "ST-3014": { width: 0.22, mount: "back", y: 2.00, shape: "head", reach: 0.28 },
  "ST-3016": { width: 0.21, mount: "back", y: 2.00, shape: "head", reach: 0.28 },
  "ST-1023": { width: 0.21, mount: "back", y: 2.00, shape: "head", reach: 0.28 },
  "ST-1031": { width: 0.20, mount: "back", y: 2.00, shape: "head", reach: 0.28 },
  "ST-1022": { width: 0.24, mount: "back", y: 2.00, shape: "head", reach: 0.30 },
  "ST-1029": { width: 0.20 }, "ST-SOH": { width: 0.25 },
  // not a rain head at all — it is a handset, so it hangs on a wall outlet + hose
  "ST-OP1":  { width: 0.18, mount: "right", y: 0.75, z: 0.52, hose: true },   // beside the WC, where a jet spray actually goes
  /* --- HAND SHOWERS. Ten of the thirteen are photographed as a BARE handset:
     head, handle, threaded inlet, nothing else. Those get the bracket, wall
     outlet and hose built for them (handShowerRig) or they hang on the tile
     attached to nothing.
     These THREE do not. Their render is the whole set — slim wand, square wall
     bracket, supply elbow and the hose looping down off it — one photograph in
     three finishes. Given the rig as well they came out wearing two brackets
     and trailing two hoses, so `ownRig` says the artwork already carries its
     own and the builder stands down.
     They also cannot take the category's 0.30 m height cap, which is sized for
     a handset ALONE: measured off the silhouette this frame is the handset over
     f 0..0.60, the bracket at f 0.54 and the hose from f 0.60 to the bottom, so
     0.30 m of frame would be a 0.18 m wand. At maxH 0.40 the wand reads 0.24 m
     — its real length — and the bracket lands at y 1.084, which is bracket
     height. --- */
  "ST-1037": { maxH: 0.40, ownRig: true }, "ST-1038": { maxH: 0.40, ownRig: true },
  "ST-1039": { maxH: 0.40, ownRig: true },
  // --- thermostatic trims / panels ---
  /* WIDTHS ONLY — these three were the last of the hand-typed `roll` angles to
     go. A silhouette fit called the Grande 5.8 deg uphill and the cutout was
     counter-rotated to answer it: on a 56 cm bar beside vertical grout lines
     that is 6 cm of drop end to end, and it is the first thing you see. There
     was no tilt to correct. The bar is TAPERED, so the top and bottom edges of
     the frame disagree (-4.9 and -6.9) and their mean is not an axis, it is the
     taper. A rectangle with a dial and a row of buttons is already square in
     frame. Hangs as photographed, like everything else — see rollFor. */
  /* THE THREE WIDE BARS ARE DE-SKEWED, and unlike a jet they SHOULD be. These
     are flat plates: parallel to the wall in reality, so any slope in the
     picture is a fixture screwed on crooked. And the distortion is projective,
     not angular — measured off the renders, the top edge runs -4 deg, the bottom
     -6.5 deg, and the right side is 14% shorter than the left. No `roll` can fix
     that; turning the frame tips the plate's vertical edges over instead, which
     is why the roll this once carried was removed rather than retuned.
     tools_deskew.py maps each plate's own alpha quad onto an axis-aligned
     rectangle, so the long edge is horizontal, the taper is gone, and the panel
     reads as [ dial ][ key ][ key ][ key ]... square to the tile. */
  "ST-D5018": { width: 0.55, faceOn: true },
  "ST-D5019": { width: 0.52, faceOn: true },
  "ST-D5020": { width: 0.44, faceOn: true },
  /* THE SIX PANELS ADDED FROM THE JULY 2026 CATALOGUE. No `faceOn`, and that is
     measured rather than assumed: the three bars above are photographed off
     square — top edge -4.7 deg, bottom -6.5, right side 15% short — and these
     six are not. Their own alpha quads come back 0.00 / 0.00 with a taper of
     1.000 (MANFRA -0.7 at the top, and its bottom "corners" are the lever, not
     the plate). There is nothing for a homography to undo, so they hang as
     photographed like everything else.

     WIDTHS ARE MEASURED, because the catalogue prints no dimension for any
     diverter. The client's own room renders do the job: each puts the panel on
     a wall beside the CONCEALED body jets, which the catalogue does dimension
     at 130 x 120 mm, and ST-D5018-XGG has the 550 mm bar in frame with the same
     jets to prove the jet reads 130 there (99 px of bar = 550 mm, jets 22 px =
     122). Panel width is then its pixels over a jet's, times 130:
       VELTRO   ST-D5022-XG   72 px / 20 px -> 468 mm, frame aspect 2.06 v 2.07
       (no room render for D5021; same plate, one button row taller)
       ST-D5012-XG   54 px / 23.5 px -> 299 mm, aspect 1.35 v 1.25
       (D5011 is D5012's 4-function twin: 322x257 artwork against 320x256)
       MANFRA   ST-D5015-XG   26 px / 24 px -> 141 mm, aspect 0.32 v 0.33
     The frame aspect agreeing with the measured box to a few percent is the
     check that the right blob was measured. Tallest of the six is MANFRA at
     0.42 m, inside the 0.50 lane cap. */
  /* TWO MORE OFF-SQUARE PLATES, found by measuring every flat trim in the range
     rather than only the three bars above. ST-D5008's plate runs -7.3 deg along
     the top and -10.3 along the bottom with its right side 10% short; ST-D5014
     tapers 14% across three dials, which is what made the middle dial read
     bigger than the outer two. Both are rectangular plates whose controls sit
     inside the plate, so the alpha quad is the plate and the homography has
     something real to undo — checked against the original side by side before
     being turned on. The other plates the same measurement flagged (D5017,
     D5003, D5009, D5010, and round-plate AZBS) are deliberately left alone: a
     lever or knob that overhangs the plate puts a corner on the CONTROL, and
     rectifying to that warps a plate that was already square. */
  "ST-D5008": { faceOn: true }, "ST-D5014": { faceOn: true },
  "ST-D5021": { width: 0.47 }, "ST-D5022": { width: 0.47 },
  "ST-D5012": { width: 0.30 }, "ST-D5011": { width: 0.30 },
  "ST-D5015": { width: 0.14 }, "ST-D5016": { width: 0.14 },
  "ST-TX-01": { width: 0.22 },
  // 211x637 plates: a three-outlet column trim is ~0.16 wide, not 0.26. At 0.26
  // it wanted to be 0.79 m tall, which is what the old cap was there to stop —
  // and stopping it that way is what made it 12 cm wide. Right width, right cap.
  "ST-TD3":   { width: 0.16 }, "ST-TD4": { width: 0.16 },
  /* --- spouts + wall mixers: WIDTHS ONLY, and they must not be given a `roll`.
     A projecting spout is photographed with its plate square and its body
     running downhill across the frame — which is exactly how the client's own
     reference shot of this range sits on the wall. Rolling the frame to level
     that body is what cocks the plate. See rollFor for the argument. --- */
  "ST-PLAIN":  { width: 0.24 },   // body falls 22.3° across the frame: perspective, not tilt
  /* The shower arm is filed with the spouts (that is where the client wants it
     listed) but it is not plumbed like one, so it overrides the category's
     placement rather than standing at filler height.
     It went on the BACK wall first, at x 0 / y 2.05 — the wall-head spot — and
     the client's screenshot showed why that is wrong here: the back wall also
     carries the vanity and the mirror (COUNTER.x -1.06), and x 0 is half a
     metre off the mirror's edge, so a lone arm up there read as a spout stuck
     above the basin. The shower in this room is the RIGHT wall — jets, trim
     and filler all hang on the z -0.25 centre line of a corner enclosure over
     the tray — so the arm takes that same line, at the top of the stack:
     y 2.05, above the upper jet row (1.66) and under the slab (2.65), with
     0.169 m of height (0.40 x 711/301, inside the 0.30 cap). Read down the
     wall it is now arm, jets and trim, filler — the brochure column.
     Its render is a three-quarter shot like every other protruding fitting, so
     the arm reads as running ALONG the tile rather than out into the room. That
     is the artwork path's known limit and the reason the jets and the plain
     spout moved to real geometry; this SKU has no OBJ in the client's RAR yet,
     so it stays a photograph until one arrives. */
  "ST-SARM":   { width: 0.40, mount: "right", y: 2.05, z: VALVE_Z },
  /* The lever mixer and the diverter spout are both bath fillers and both take
     the category's own spot — right wall, filler height — so they need only a
     width. 0.26 is by analogy with ST-WM-002, whose render is framed the same
     way (plate at one edge, spout at the other, lever on top); the plain spout
     next door is wider at 0.24 because its frame is almost all spout.
     ST-BSDV wears ST-PLAIN's artwork (see catalog.js `art`), so it is sized
     like the piece it borrows from and will need re-measuring the day it gets
     renders of its own — it is a longer spout than the plain one. */
  "ST-2513":   { width: 0.26 },
  "ST-BSDV":   { width: 0.24 },
  // --- basin mixers. WM-001 and WM-002 are the WALL-mounted pair: both were
  //     filed as spouts and neither is one — see catalog.js. Like the spout
  //     above, they hang as photographed, on their plates. ---
  "ST-WM-001": { width: 0.28 },
  "ST-WM-002": { width: 0.26 },
  "ST-BM-001": { width: 0.16, mount: "counter" }, "ST-OB-D94": { width: 0.20, mount: "counter" },
  /* The MANFRA trio are DECK mixers — they stand on the basin like ST-BM-001,
     not on the wall like the WM pair — so they take `mount: "counter"` too.
     Widths come from the catalogue's own dimension, which for a deck mixer is
     its HEIGHT (178 mm, 290 mm, 290 mm), turned into a frame width by the
     cutout's aspect: 0.178 x 0.971, 0.290 x 0.622, 0.290 x 0.637. All three
     land at 0.29 m tall or less, inside the 0.34 basin-mixer cap. */
  "ST-MN-005": { width: 0.17, mount: "counter" },
  "ST-MN-006": { width: 0.18, mount: "counter" },
  "ST-MN-015": { width: 0.185, mount: "counter" },
  // wall taps + angle valves: low on the wall, where a bib tap actually goes
  "ST-SZ-01": { width: 0.20 }, "ST-SZ1": { width: 0.20 },
  "ST-MN-AC": { width: 0.12, y: 0.55 }, "ST-JF1": { width: 0.12, y: 0.55 },
  /* The July catalogue's taps and valves. The two-way taps are bib taps and sit
     where ST-SZ-01 does; the angle valves are the small bodies that feed a
     cistern or a health faucet, so they go higher up the wall at 0.55 like the
     two angle valves already here. The stop cock is dimensioned (200 mm, which
     is the plate-and-handle height, hence 0.20 x 0.669 across) and the wall
     outlet is not, so that one is sized off the handset hook it carries. */
  "MN-2W":  { width: 0.20 }, "ST-QB": { width: 0.20 },
  "MN-AC":  { width: 0.10, y: 0.55 }, "QB-AC": { width: 0.10, y: 0.55 },
  "ST-CSC": { width: 0.13, y: 0.55 }, "ST-CWO": { width: 0.11, y: 1.05 },
  /* Basin wastes and the trap. Both hang off the basin rather than the wall:
     the waste's 125 mm is its body length down the frame (0.125 x 0.609), and
     the trap is sized on its 12-inch pipe. */
  "ST-PUW": { width: 0.075 }, "ST-BTRAP": { width: 0.30 },
  /* Health faucets. Each is a handset about 200-230 mm long photographed
     upright, so the frame width is that length times a narrow aspect — which is
     why these numbers look small beside a tap's. They hang beside the WC on the
     category's own spot, like ST-OP1. */
  "ST-HFSEL": { width: 0.07 }, "ST-HFSQ": { width: 0.075 }, "ST-HFEST": { width: 0.056 },
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
     jets below can, and are.

     IT DOES CARRY THE ONE HAND-SET `roll` IN THE RANGE, and it is the exception
     that proves the rule in rollFor. The studio camera sat below this jet's
     axis, so the assembly runs 11 degrees UPHILL to the wall across the frame,
     and on the tiles that is four heads all leaning the same way — the client
     called it, and their own reference shot has these jets dead level.
     Rolling it costs nothing, which is the whole point: the datum here is a
     CIRCLE. A round flange has no square edge to be knocked off, so turning the
     frame cannot cock the plate against a grout line the way it would on the
     square-plated spout. Where a piece has a square plate, that plate wins and
     `roll` stays 0; where it has a round one, the axis is all there is to read,
     and this levels it. Measured off the disc centres, not eyeballed: nozzle
     face and wall flange, -10.8 deg, taken to -0.19 rad. */
  // round jet: the frame carries its body as well as its face. No swing, for the
  // reason in the body-jet note — but it KEEPS its roll. "A roll tips the
  // escutcheon over with it" is true of every other fitting in the range and not
  // of this one: a circle has no square edge to tip. See above.
  "ST-J06":   { width: 0.16, roll: -0.19, bossX: -0.15, bossY: 0.12 },
                                          // Plumbed as a flanking set of four, like every jet that is not a panel.
  // BJ-02 is photographed from the OTHER side: its plate already sits on the wall
  // side of the frame, so mirroring it would turn the nozzle back into the corner
  "ST-BJ-02": { width: 0.15, flip: false, bossX: -0.22, bossY: 0.07 },
  /* BJ3F ARRIVED WITH NO ENTRY AT ALL, which is why it hung worst of the lot: it
     took the category width and, more to the point, the DEFAULT BOSS. With no
     bossX/bossY the standoff goes to the frame centre — and on this render the
     frame centre is the middle of the barrel, thin air between the plate and the
     head. So the piece was pegged to the tile through its own neck and the
     escutcheon floated clear of the wall: "not properly attached" is exactly
     what it was. These two numbers put the standoff back under the plate.
     Measured off the silhouette, not guessed: the escutcheon owns x 0.10-0.45 of
     the frame and the head x 0.62-0.97, either side of the barrel's waist at
     0.50, and the plate's centre lands 0.23 of the width left of centre and
     0.05 of the height above it. Same reading gives the width: the plate is 315
     of 900 px, so a 52 mm escutcheon makes the whole cutout 0.15 — which is what
     BJ-02, its twin in this range, already measures.
     No `roll`. Its plate is SQUARE, so by the rule in rollFor the plate is the
     datum; the 10 deg its top and bottom edges run off is a SHEAR from the
     oblique camera, not a rotation, and turning the frame would only tip the
     plate's vertical edges over too. Nor `faceOn`: on a protruding jet a
     square-on plate means the head sits concentric ON it, and no homography can
     walk the head back over its own plate. That is why this one swings. */
  "ST-BJ3F":  { width: 0.15, flip: false, bossX: -0.23, bossY: 0.05 },
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
  // 677x900 artwork: the round plate fills the width and the lever hangs below
  // it, so 0.155 across puts a 150 mm escutcheon on the wall and 0.21 overall
  "ST-AZBS":  { width: 0.155 },
  "ST-D5001": { width: 0.16 }, "ST-D5002": { width: 0.15 }, "ST-D5003": { width: 0.17 },
  "ST-D5004": { width: 0.18 },
  /* NO per-SKU `y` on these. They used to carry 1.04 / 1.03, from when the trim
     lane was its own column down at y 1.06 and a tall plate had to hang from
     reach height rather than straddle it. The lane is now the CENTRE OF THE
     JET GRID (see CAT3D "diverter"), and those leftovers were pulling the two
     tallest 3-way plates 31 cm below it — the trim sitting level with the
     bottom pair of jets instead of in the middle of all four. Every trim takes
     the category anchor now, which is what puts it in the middle. */
  "ST-D5009": { width: 0.17 }, "ST-D5010": { width: 0.17 },
  /* THE TWO SQUARE JETS, BACK ON THEIR OWN RENDERS. `faceOn` is gone (see the
     body-jet note above for why a homography cannot rectify a protruding jet),
     which means the three things it stood in for have to be stated again:
       flip   — both are shot from the plate's right, so unmirrored the neck
                projects toward the back corner instead of into the room
       bossX/bossY — the escutcheon is NOT the centre of a three-quarter frame,
                it is off to one side and up; the wall union goes under the
                PLATE, not under the middle of the picture
       width  — 0.11 was the bare plate. The frame carries plate, neck and head,
                so the cutout that puts a 52 mm escutcheon on the wall is 0.15. */
  "ST-BJ21F": { width: 0.15, flip: true, bossX: -0.17, bossY: 0.09 },
  "ST-2FBJ":  { width: 0.15, flip: true, bossX: -0.23, bossY: 0.14 },
  /* The concealed jet is the one jet in the range that does NOT protrude: a
     recessed box behind a flat square flange, catalogued at 130 x 120 mm. So it
     wants none of the three corrections above — its frame IS the flange, shot
     square-on, and the wall union sits at the middle of the picture. Width is
     the flange's own 130 mm; it is not scaled up the way the protruding jets
     are, because there is no neck and head in the frame to make room for. */
  "ST-CBJ":   { width: 0.13 },
  // --- wastes + the re-filed square rain plate ---
  "ST-TXSQ-01": { width: 0.09 }, "ST-TSQ": { width: 0.09 }, "ST-SS304": { width: 0.50 },
  // --- concealed diverter: a tall trim plate (232x735 artwork), so it takes the
  //     diverter lane's height like the rest of them ---
  /* 235x744 — the tallest trim in the range. It renders 0.507 m on the wall
     (0.16 x the artwork's 3.17 aspect), NOT the 0.66 an earlier pass recorded:
     that number, and the 1.15 it produced, came from a box measured while the
     placement pop was still easing, which reports every piece at 55% of its
     real size. Corrected, y 1.15 hung the plate at 0.897..1.404 and the filler
     spout tops out at 0.907 — they overlapped by a centimetre.
     1.30 is where it actually belongs: 1.047..1.554, which is 14 cm of daylight
     above the spout and 5 cm below the upper jet row, and near enough the grid
     centre that it still reads as the trim inside the four. It cannot simply
     take the category's 1.34 — that puts its top at 1.594 against jets that
     start at 1.602, and 8 mm is not a gap you can see. */
  "ST-D5017": { width: 0.16 },   // also centres on the grid: at 0.51 m it is taller than the grid, so it overhangs evenly top and bottom
};
/* the config a product is actually placed with: category default + its own overrides */
const skuCfg = product => Object.assign({}, catCfg(product.catId), SKU3D[product.code] || {});

/* =========================================================================
   THREE.js SETUP
   ========================================================================= */
const holder = $("#canvasHolder");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0d0f);

/* =============================================================================
   FRAMING FOR THE VIEWPORT IT ACTUALLY HAS
   -----------------------------------------------------------------------------
   A PerspectiveCamera's `fov` is its VERTICAL field, so a phone held upright
   does not show a taller slice of the room — it shows a much NARROWER one. At
   16:9 these 52 degrees are 82 degrees across; on a 375-wide phone, where the
   canvas is 375x760, they are 27. That is the whole of the mobile problem: the
   opening view has the valve panel, four jets, the filler spout and the
   overhead plate in it, and on a phone not one of them is on screen — you get
   blank tile and the drain.
   So the vertical field OPENS UP on a narrow viewport, by exactly enough to
   hold the horizontal field steady, and is capped where the wide-angle
   distortion would start to bend the room.
   ========================================================================== */
/* HOLD_ASPECT is where the widening STARTS, and it is deliberately not 16:9.
   Anchoring it at 16:9 widened a 1440x900 laptop too — the rail takes 288 px, so
   that stage is 1.37 across, and the opening view went from 52 degrees to 65.
   Nobody asked for the desktop framing to change. At 1.2 every normal window
   keeps the 52 degrees it was composed at, a square-ish window opens up a
   little, and a phone still runs into the cap below. */
const BASE_FOV = 52, HOLD_ASPECT = 1.2, MAX_FOV = 76;
const halfXAt = (fovDeg, aspect) => Math.tan(fovDeg * Math.PI / 360) * aspect;
const REF_HALF_X = halfXAt(BASE_FOV, HOLD_ASPECT);
const fovFor = aspect => aspect >= HOLD_ASPECT ? BASE_FOV
  : Math.min(MAX_FOV, 2 * Math.atan(REF_HALF_X / aspect) * 180 / Math.PI);
/* What the cap could NOT recover, as a multiplier on how far back the camera
   has to stand. It is never the whole answer: this room is 3 m square and the
   camera lives inside it, so there is a limit to standing back — past the wall
   you would be looking at the outside of a single-sided plane. Hence the
   portrait hero below as well. */
const widenPull = () => Math.min(1.6, Math.max(1, REF_HALF_X / halfXAt(camera.fov, camera.aspect)));

const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 100);
/* The opening / reset view. From the front-left corner looking into the back-right
   one, so the back wall AND the right wall are both in frame — body jets and
   spouts live on the right wall, and the old straight-on hero hid them. */
const HERO = { pos: [-1.25, 1.62, 1.35], tgt: [0.45, 1.22, -0.95] };
/* PORTRAIT HERO. The landscape one is composed for a wide frame: it stands a
   little inside the room and lets the width of the picture carry both walls.
   In a tall frame that same spot crops to one blank panel of tile, so this
   version backs into the front-left corner for every centimetre the room will
   give (the walls are at +/-1.5, so 1.40 is as far as it goes without the
   camera passing through one) and aims ACROSS at the valve column rather than
   down into the corner — a tall frame wants the wall, not the tray. Compared
   against three other compositions rendered at 375x812: aiming deeper into the
   corner clipped the jets off the right edge and spent a third of the picture
   on the floor; aiming further right lost the corner and cut the overhead
   plate. This one holds the panel, all four jets, the filler spout and the
   ceiling head at once. */
const HERO_TALL = { pos: [-1.35, 1.55, 1.35], tgt: [0.85, 1.45, -0.45] };
const heroOf = () => (camera.aspect < 1 ? HERO_TALL : HERO);
/* Has the client taken the camera over? Turning a phone re-frames to the other
   hero composition, and that must not happen under someone who has just spun
   the room to look at something. Any programmatic flight (animateCam) hands
   control back, so Reset and a fresh pick both clear it. Declared up here
   because animateCam and resize both touch it, and a `let` read before its
   declaration runs is a ReferenceError, not undefined. */
let userMovedCam = false;
const heroPos = () => new THREE.Vector3(...heroOf().pos);
const heroTgt = () => new THREE.Vector3(...heroOf().tgt);
camera.position.set(...HERO.pos);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
/* 2x on a desktop, 1.6x on a phone. The scene is real OBJ geometry under ACES
   with soft shadow maps, and a modern phone reports devicePixelRatio 3: at that
   ratio a 390-point screen renders 1170x2532, which is 3.0 megapixels of
   shading every frame on the smallest GPU that ever opens this. 1.6 is 1.9 Mpx
   on the same screen — still above the panel's own perceptual limit for edges
   this soft, and it is the difference between the room turning smoothly under a
   finger and the phone getting hot while it stutters. Desktop is untouched. */
/* 2x on a desktop, 1.6x on a phone. The scene is real OBJ geometry under ACES
   with soft shadow maps, and a modern phone reports devicePixelRatio 3: at that
   ratio a 390-point screen renders 1170x2532, which is 3.0 megapixels of
   shading every frame on the smallest GPU that ever opens this. 1.6 is 1.9 Mpx
   on the same screen — still above the panel's own perceptual limit for edges
   this soft, and it is the difference between the room turning smoothly under a
   finger and the phone getting hot while it stutters. Desktop is untouched.
   Applied in resize() as well as here, because a phone turned on its side is a
   new viewport and this used to be read once at load and never again. */
const pixelCap = () => Math.min(window.devicePixelRatio, innerWidth <= 820 ? 1.6 : 2);
renderer.setPixelRatio(pixelCap());
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
    bg: 0x121214, exposure: 0.94, art: 1.0,
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
    bg: 0x08080a, exposure: 1.0, art: 0.64,
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
    bg: 0x0e0f11, exposure: 0.96, art: 0.85,
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

/* THE ENVIRONMENT A FITTING REFLECTS. scene.environment is a soft three-stop
   gradient tuned so the ROOM's matte surfaces read right. Reflected in a mirror
   finish it is a featureless bright field, and chrome, gold and gun-metal all
   come out as the same pale block — exactly what the earlier OBJ pass was
   rejected for. Polished metal is read by what it reflects, so the fittings get
   a studio of their own: dark floor, a mid horizon broken by dark verticals, a
   bright ceiling with three soft-box strips. Built once; a theme only changes
   how strongly it comes through (fittingEnvI), the way the artwork is exposed
   for the room it hangs in. */
let _fitEnv = null;
function fittingEnv() {
  if (_fitEnv) return _fitEnv;
  const W = 256, H = 128, c = mkCanvas(W, H), x = c.getContext("2d");
  /* A LIT BATHROOM, NOT A PHOTO STUDIO. This used to fall to near-black below
     the horizon (#34353a to #121316) because it was written as a product-shoot
     surround. A fitting on a wall does not hang in a black studio: it hangs in
     this room, whose floor, tray and tiles are all near-white, and a mirror
     finish reflects mostly THAT. The dark half was being reflected straight
     back and the spout rendered at 0.55 brightness against the thermostatic
     panel's 0.91 — same finish, same room, one of them visibly grey. The
     gradient still falls from ceiling to floor, so a curved fitting still has
     somewhere to catch a highlight and reads as metal rather than as paint. */
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.00, "#f2f1ee"); g.addColorStop(0.30, "#dedcd8"); g.addColorStop(0.50, "#b4b3af");
  g.addColorStop(0.53, "#a3a29e"); g.addColorStop(1.00, "#8b8a87");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(255,255,255,0.96)";                       // soft-boxes overhead
  [[0.10, 0.10, 0.22, 0.13], [0.45, 0.06, 0.18, 0.12], [0.74, 0.12, 0.20, 0.11]]
    .forEach(([u, v, w, h]) => x.fillRect(u * W, v * H, w * W, h * H));
  /* The verticals are what give a reflection its shape — without them a mirror
     finish is a flat wash. Mid-grey now rather than near-black: dark enough to
     read as structure, not so dark that they drag the whole piece down. */
  x.fillStyle = "rgba(96,96,100,0.55)";
  [0.05, 0.33, 0.62, 0.88].forEach(u => x.fillRect(u * W, H * 0.30, W * 0.018, H * 0.30));
  /* CONTRAST, ABOUT THIS STUDIO'S OWN MEAN. Everything above is a gentle
     gradient, and after the PMREM blur a gentle gradient reflects almost the
     same radiance whichever way a face points: every modelled fitting came out
     FLAT. Measured on the plain spout in French Gold, the render spanned p05 187
     to p95 210 — 23 levels — where its own photograph spans 116 to 240. The
     median was right (188 against the photograph's 189); what was missing was
     modelling, so a cube button read as the same tone on all three of its faces
     and the piece looked painted rather than metal.
     Roughness is NOT the lever here: swept 0.10-0.42 the spread only moved 35 to
     23, because a soft gradient is soft at every sharpness. The environment is.
     So expand each pixel about the canvas mean and leave the mean alone, which
     widens the spread without moving the level the finishes are calibrated to —
     METAL_ENV_GAIN then carries the small correction for what the tone mapping
     does to the wider range. At 2.2 the spout reads p05 186 / p50 188 / p95 222.
     Raising this further keeps buying spread, but it costs saturation: the
     brighter a reflection, the whiter it is. 2.2 is where the spread is as wide
     as it goes with the median and the saturation both still on their marks. */
  const d = x.getImageData(0, 0, W, H); let mean = 0;
  for (let i = 0; i < W * H; i++) mean += d.data[i * 4] * 0.2126 + d.data[i * 4 + 1] * 0.7152 + d.data[i * 4 + 2] * 0.0722;
  mean /= W * H;
  for (let i = 0; i < W * H; i++)
    for (let ch = 0; ch < 3; ch++) {
      const v = d.data[i * 4 + ch];
      d.data[i * 4 + ch] = Math.max(0, Math.min(255, mean + STUDIO_CONTRAST * (v - mean)));
    }
  x.putImageData(d, 0, 0);
  const eq = canvasTex(c, false);
  eq.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  _fitEnv = pm.fromEquirectangular(eq).texture;
  eq.dispose(); pm.dispose();
  return _fitEnv;
}
const fittingEnvI = () => 0.50 + 0.40 * (THEME && THEME.art != null ? THEME.art : 1);
/* HOW POLISHED EACH FINISH IS — and a coloured PVD is a SATIN, not a mirror.
   A brushed metal and a matte black cannot share the roughness a chrome needs,
   or they read as chrome in another colour. But the coloured ones were set
   almost as sharp as chrome (rose gold 0.16), and at that sharpness a fitting
   stops showing its own colour and shows the ROOM instead: the plain spout in a
   Rose Gold room rendered as a near-white box beside a rose-gold panel, because
   a mirror in a white bathroom is white. That is physically honest and useless
   — the client picked a colour and the piece would not wear it.
   These are calibrated, not guessed. With the thermostatic panel's photograph
   as the reference (it renders at saturation 0.128), the spout was swept across
   metalness 0.12-1.0 and roughness 0.13-0.45: roughness is the lever, metalness
   barely moves it, and an effective 0.45 puts the spout at 0.128 exactly. The
   table is pre-multiplier, and metalMat scales it by 0.8.
   Chrome stays sharp. It IS a mirror, and its own photograph is a mirror too —
   it is the one finish the room's reflection belongs in. */
const FINISH_ROUGH = { chrome: 0.10, gold: 0.52, roseGold: 0.55, champagne: 0.50, brushedGold: 0.50,
                       brushedRoseGold: 0.50, gunGrey: 0.42, matteBlack: 0.60, brushedSteel: 0.46,
                       polishedGold: 0.46 };
const finishRough = fid => FINISH_ROUGH[fid] == null ? 0.20 : FINISH_ROUGH[fid];

/* THE COLOUR A MODELLED PIECE IS MADE OF — one per FINISH, not one per SKU.
   FINISHES[fid].tone is a UI swatch: it has to look right as a 22 px dot in the
   tool, and it was never matched to the photography. Tinting geometry with it
   put a hue-12 spout beside a hue-24 photographed panel in the same Rose Gold
   room.
   Tinting each model from its OWN artwork instead was worse, and it was my
   mistake: a body jet's render is mostly black spray face, so its average came
   out at #948176 while the spout's came out #cf9f86 — two modelled pieces, one
   finish, two different colours BY CONSTRUCTION. The client asked for the
   opposite of that.
   So the tone is measured once per finish off ST-PLAIN, which is the only SKU
   the folder ships in all eight and is a plain shape with no black face or
   printed dial to drag an average around. Every modelled piece in a finish now
   starts from the same colour, and that colour is the range's own. */
/* RE-MEASURED OFF THE PRINTED CATALOGUE (2026-09-19, asked for directly):
   "STOUT July 2026", W.E.O 1st July 2026, pages 121-122, PLAIN SPOUT. That is
   the same SKU this table was always measured on, and the catalogue shows it in
   seven finishes on two facing pages under ONE lighting setup — which is why it
   is the reference and a page of assorted products is not. Method unchanged
   from the note above: mask the product off the page ground, erode the mask 4px
   so the print halo cannot lift a dark finish, take the linear mean of the
   40-90% luminance band.
   BRUSHED GOLD IS NOT ON THOSE PAGES and is therefore NOT re-measured — it
   keeps its old value. The catalogue carries it on three other products and
   they do not agree with each other: transferred onto this page's lighting by
   the finishes they share, ST-WM-001 (p86) gives #ae9d6b and ST-MN-011 (p78)
   gives #d0c5ad, and on that second page brushed gold is within 8 of French
   gold, which it plainly is not. Ask for a brushed gold plain spout rather than
   splitting the difference. */
const METAL_TONE = {
  chrome: 0xd5d6d6, gunGrey: 0x8e8e8e, brushedGold: 0xa57c3f, champagne: 0xbeac93,
  gold: 0xe8d8b7, roseGold: 0xe0c0b1, brushedRoseGold: 0xdda78a,
  /* This table is the MEASUREMENT and nothing else — it is what the PDF swatch
     prints and what a colour is checked against. It is no longer what the
     shader is handed: that is METAL_BASE below, solved per finish so the wall
     shows these numbers. Matt black was once scaled down here (0x343434) to
     compensate for its diffuse lighting; that compensation now lives in its
     base like every other finish's, and the measured value stands. */
  matteBlack: 0x5f5f5f,
  polishedGold: 0xd8bd7c,          // measured with the rest — see catalog.js
};
/* WHAT THE SHADER IS HANDED SO THAT THE WALL SHOWS METAL_TONE.
   METAL_TONE is what the artwork measures, in sRGB, and that is the number the
   client compares against. It is NOT what a MeshStandardMaterial can be given:
   three r128 has no colour management, so Color.setHex() puts those sRGB bytes
   into the shader as LINEAR reflectance, which lifts every midtone and drains
   the saturation — the gold spout rendered #c0b9a3 (saturation 0.11) beside a
   card showing #d0bd8b (0.33); rose gold #beab9e for #c69c86; matt black came
   out #817e7a, a mid grey. On top of that the fitting environment is dimmer than
   the white sweep the photographs were shot against, so even a linearised base
   lands dark.
   Neither is corrected by hand. tools: place ST-PLAIN in the White room, mask
   its pixels, and iterate the base colour (and one shared env gain) until the
   on-wall MEDIAN equals the median of ST-PLAIN-<finish>.png for every finish at
   once — it converges to the artwork exactly, and the Grey and Black rooms then
   sit within a few percent, darker, which is what their exposure asks for.
   These are the solved values (linear bytes, for setHex). Re-solve them if the
   fitting env, the roughness table, the tone mapping or the exposure changes:
   they are a measurement of THIS pipeline, not a description of the metal. */
/* RE-SOLVED against the catalogue tones above (2026-09-19) by exactly the
   method this note describes: ST-PLAIN in the White room, its own pixels masked
   by raycast, the base stepped in linear light until the rendered 40-90 band
   equals METAL_TONE. Converged within 6 of 255 on every finish and within 2 on
   five of them: chrome #d6d7d7 for #d5d6d6, gunGrey #8e8d8d for #8e8e8e,
   champagne #bead94 for #beac93, gold #e6d7b8 for #e8d8b7, roseGold #debfb0 for
   #e0c0b1, brushedRoseGold #ddaa8f for #dda78a, matteBlack #61615f for #5f5f5f
   — which is why matt black's base did not move: it was already there.
   brushedGold is unsolved for the same reason its tone is unmeasured. */
const METAL_BASE = { chrome: 0xd9e4ef, gunGrey: 0x26272b, brushedGold: 0x6a3707, champagne: 0x6d4d2c, gold: 0xf4b357, polishedGold: 0xd88b26, roseGold: 0xc76b51, brushedRoseGold: 0xbc4422, matteBlack: 0x151617 };
/* How far fittingEnv's studio is pushed away from its own mean. See the note
   where it is applied: this is what stops every modelled fitting rendering flat. */
const STUDIO_CONTRAST = 2.2;
/* Re-solved with STUDIO_CONTRAST in place: the wider environment range loses a
   little more to the tone-mapping shoulder, so the gain carries the piece back
   to the level every finish was calibrated at. Measured, not guessed — the plain
   spout in French Gold sits at p50 188 either side of the change, which is the
   photograph's 189. Re-solve BOTH of these together if the environment, the
   roughness table or the exposure moves; neither means anything alone. */
const METAL_ENV_GAIN = 1.505;
/* the linear reflectance for an sRGB hex — the fallback path, for a finish
   without a solved base */
const srgbHexToLinear = hex => {
  const c = new THREE.Color(hex);
  const f = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return new THREE.Color(f(c.r), f(c.g), f(c.b)).getHex();
};
const metalHex = (fid, fallback) => METAL_BASE[fid] != null ? METAL_BASE[fid]
  : METAL_TONE[fid] != null ? srgbHexToLinear(METAL_TONE[fid]) : fallback;

/* NOT EVERY FINISH IS A METAL.
   Roughness was per-finish but metalness was 1.0 for all of them, and in a PBR
   metal there is no diffuse term at all — the surface is nothing but a mirror
   tinted by its base colour. That is right for chrome, for the golds, for gun
   grey: they ARE polished metal. It is wrong for matte black, which is a powder
   coat over the brass, a dielectric. Rendered at metalness 1 in the White room,
   a matte black jet had no colour of its own to show and reflected what was in
   front of it — warm beige marble — so the client picked black and got four tan
   squares on the wall. Nothing about the finish id, the swatch or the artwork
   was wrong; the surface model was.
   A coating gets its colour from diffuse, so it needs the metalness down. It
   also has to take LESS from the environment map: at low metalness the env acts
   as ambient light on that diffuse, and a black plate lit by a bright room
   ambient goes grey. */
const FINISH_METAL = { matteBlack: 0.10 };
const finishMetal = fid => FINISH_METAL[fid] == null ? 1.0 : FINISH_METAL[fid];
/* How much env a surface should take, given how metallic it is — CALIBRATED
   against the photographic products, because the two have to sit on one wall.
   A photographed fitting is unlit and prints at its studio brightness; a built
   one is lit by the room, and it was landing consistently darker: measured
   across six finishes, a body jet's metal came out 0.04 to 0.10 of value below
   the thermostatic panel beside it, which is what "different colours" looks
   like once the hue and saturation already agree.
   Swept on the Rose Gold pair: at 1.2x the gap more than halves (-0.066 to
   -0.039) while saturation lands within 0.002. The line is fitted through that
   and through matte black, which sits at metalness 0.10 and was running 0.035
   too BRIGHT, so the low end comes down as the high end goes up:
     f(1.0) = 1.25   polished metal, was 1.00
     f(0.1) = 0.36   a powder coat, was 0.41
   ROUGHNESS scales it too, because that lift is calibrated on the coloured
   satins and a MIRROR gathers the same environment far more sharply. Applied
   flat it sent the chrome spout 0.118 of value ABOVE the chrome panel — the
   same mismatch, in the other direction, on the one finish that had been fine.
   The second factor is fitted through two measured points rather than guessed,
   after a first attempt at 0.72 + 0.62r overshot the other way and left chrome
   0.10 BELOW its panel. Each finish was placed against the panel and read off
   the frame; solving for zero on both gives:
     roughness 0.08 (chrome)      -> 0.87
     roughness 0.44 (the satins)  -> 1.04                                    */
const envForMetal = (m, rough) => METAL_ENV_GAIN *
  fittingEnvI() * (0.26 + 0.99 * m) * (0.83 + 0.49 * (rough == null ? 0.45 : rough));

function metalMat(hex, rough, fid) {
  hex = metalHex(fid, hex);                 // the range's own colour, not the swatch
  const metal = fid == null ? 1.0 : finishMetal(fid);
  const rgh = rough == null ? 0.18 : rough * 0.8;
  const m = new THREE.MeshStandardMaterial({ color: hex, metalness: metal, roughness: rgh,
                                             envMap: fittingEnv(), envMapIntensity: envForMetal(metal, rgh) });
  m.userData.fittingEnv = true;
  m.userData.metalFinish = true;   // exposeArtwork keeps the calibrated env on a theme switch
  return m;
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

  /* NO TOWEL RAIL ON THE LEFT WALL. The client asked for it out (2026-09-16):
     it hung at eye height on the one clear wall, and this is a tool for showing
     Stout's fittings, not a dressed room — a towel is the kind of prop that
     reads as clutter the moment it is not what you came to look at. The rail
     went with it rather than staying behind: it existed only to hold that
     towel, and a bare bar on an otherwise empty wall is worse than either.
     buildTowel() and its terry-cloth texture are left in place, unused, the
     same way buildBodyJet sits behind `jet3d` — restoring this is a matter of
     putting the eleven lines back, not rebuilding the towel. The rolled towels
     on the vanity are a different prop and are untouched; the client did not
     ask about those. */

  /* ---- the shower zone: fittings used to float on an undefined wall over an
     undefined floor. A shallow recessed tray in a wetter, darker tile — with
     the linear drain sitting IN it — tells you where the shower is. ---- */
  // It runs from the shower column on the back wall to the RIGHT wall, because
  // that is now where the body jets and spouts are — a corner enclosure. It has
  // an open edge on two sides only, so those are the only two that get a trim.
  /* DEPTH FOLLOWS THE VALVE LANE, it is not a number of its own. The tray was
     built 1.05 m deep around jets that sat at z -0.96; the jets have since moved
     forward to the lane at VALVE_Z and the tray did not follow, so it ended at
     z -0.43 with the whole jet set standing in front of it. Putting the overhead
     plate on the lane too (2026-09-19) made that plainly wrong: the rain fell on
     dry floor. The front edge is now a stride clear of the lane, so the valve,
     the jets, the spout and the plate above them are all inside the wet zone. */
  const zoneX0 = -0.65, zoneFront = VALVE_Z + 0.32;
  const zoneD = zoneFront + HZ - 0.02, zoneZ = -HZ + zoneD / 2 + 0.02;
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
  drain.position.set(zoneCx, 0.021, zoneZ); grp.add(drain);   // centred in the tray, and now actually so
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
  // re-print, for the new room, every photograph already hanging in the old one.
  // Only here: applyTheme's other two callers are boot (nothing is placed yet,
  // and `placed` is not even declared) and restore (which places afterwards).
  b.onclick = () => { applyTheme(b.dataset.theme); exposeAllArtwork(); };
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
  back:    { plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), HZ), fix: "z", val: -HZ + OFF },
  left:    { plane: new THREE.Plane(new THREE.Vector3(1, 0, 0), HX), fix: "x", val: -HX + OFF },
  right:   { plane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), HX), fix: "x", val: HX - OFF },
  // A ceiling fitting is FLUSH: its mount plane is the slab itself, not OFF below
  // it. The 2.5 cm standoff every wall gets to avoid z-fighting left overhead
  // plates hanging under the ceiling with daylight above them — from any eye-level
  // angle you saw the gap and the piece read as floating. Ceiling pieces instead
  // sit AT y = RH and bury their housing up into the slab (see placeProduct).
  ceiling: { plane: new THREE.Plane(new THREE.Vector3(0, -1, 0), RH), fix: "y", val: RH },
  // not a wall: deck-mounted mixers STAND on the vanity counter, facing the room
  counter: { plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), fix: "y", val: 0 },
};

/* =============================================================================
   PRODUCT INSTALLATION SYSTEM
   -----------------------------------------------------------------------------
   ONE place decides how a fitting is installed. Nothing else in this file may
   write a rotation onto a placed product.

   THE PROBLEM THIS REPLACES. Orientation used to be a hand-typed Euler pair per
   wall, stored as data (WALLS[wall].rot = {x, y}) and applied with
   mesh.rotation.set(...). That had four failure modes:

     1. It only works for walls that are axis-aligned about Y. A wall at any
        other angle has no entry, so there is nothing to type.
     2. It was duplicated. MODEL_WALL_YROT held a second copy for the OBJ path
        and cutoutFallback() a third, and they could disagree.
     3. Position was the piece's ORIGIN snapped onto a pre-offset plane, or (on
        the OBJ path) its BOUNDING-BOX half-extent. Neither is where a fitting
        actually touches a wall, so every product type then compensated for the
        error separately.
     4. Nothing anywhere declared which way a product FACES, so "facing the
        room" was an accident of the artwork rather than a property of the piece.

   WHAT REPLACES IT. A surface is described the way architecture describes one:
   a point on it, and the direction it faces INTO the room. Everything else -
   in-plane up, in-plane right, and the rotation that carries a product from its
   own canonical axes onto that surface - is DERIVED, by quaternion, from the
   surface normal and the product's declared axes. Add a wall at 37 degrees and
   every fitting installs on it correctly with no new numbers.

   CANONICAL PRODUCT CONVENTION (all products, all render paths):
     +Y  up
     +Z  front / functional-outward  (the face that looks at the bather)
     -Z  mount   (the face that touches the wall)
     +X  the product's own right, seen from the front

   The derived basis reproduces every one of the old hand-typed Eulers exactly -
   back (0,0), left (0,+90), right (0,-90), ceiling (+90,0), counter (0,0) - so
   this is a refactor of how the numbers are ARRIVED AT, not a change to where
   anything currently sits.
   ============================================================================= */
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ROOM_FRONT = new THREE.Vector3(0, 0, 1);      // +Z is out of the room's mouth

/* THE ONE ROTATION FUNCTION.
   Carries the canonical convention above onto a pair of world directions:
   forward is where +Z must end up, up is where +Y must end up. Built as an
   orthonormal basis and returned as a quaternion - no Eulers, so no gimbal lock
   and no order-of-application surprises when a surface is not axis-aligned. */
function orientFrom(forward, up) {
  const z = forward.clone().normalize();
  let y = (up || WORLD_UP).clone().normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  if (x.lengthSq() < 1e-8) {
    // forward is parallel to up (a ceiling or floor fitting): world up cannot be
    // the in-plane up there, so take the room's depth axis instead
    y = Math.abs(z.y) > 0.9 ? ROOM_FRONT.clone() : WORLD_UP.clone();
    x.crossVectors(y, z);
  }
  x.normalize();
  y.crossVectors(z, x).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(x, y, z));
}

/* A mounting surface. normal points INTO the room, kind says what you can do on
   it. Nothing here is a rotation. */
const SURFACE_KIND = {
  back: "wall", left: "wall", right: "wall", ceiling: "ceiling", counter: "deck",
};
const SURFACE_NORMAL = {
  back:    [0, 0, 1],
  left:    [1, 0, 0],
  right:   [-1, 0, 0],
  ceiling: [0, -1, 0],
  counter: [0, 1, 0],
};
/* Each surface carries an explicit POINT ON IT. It used to be derived from the
   THREE.Plane in WALLS, and for the counter that plane is y = 0 — the FLOOR, not
   the deck — because nothing had ever projected onto it: the old seater
   hard-coded COUNTER.y in a `wall === "counter"` branch instead. A deck mixer
   seated against y = 0 lands on the floor tiles. Stating the point removes the
   whole class of problem. */
function surfaceOf(name) {
  const w = WALLS[name], n = SURFACE_NORMAL[name];
  if (!w || !n) return null;
  const point = {
    back:    new THREE.Vector3(0, 0, w.val),
    left:    new THREE.Vector3(w.val, 0, 0),
    right:   new THREE.Vector3(w.val, 0, 0),
    ceiling: new THREE.Vector3(0, w.val, 0),
    counter: new THREE.Vector3(COUNTER.x, COUNTER.y, COUNTER.z),
  }[name];
  const normal = new THREE.Vector3(n[0], n[1], n[2]);
  /* `point` is the ANCHOR plane — OFF (2.5 cm) clear of a wall, where a flat
     photograph hangs so it cannot z-fight the tiles. `tile` is the wall itself.
     Solid geometry seats on the tile: a spout's flange or a jet's escutcheon
     actually touching the wall is the whole point of having the geometry. */
  const tile = point.clone().addScaledVector(normal, -(SURFACE_KIND[name] === "wall" ? OFF : 0));
  return { name, kind: SURFACE_KIND[name], normal, point, tile, plane: w.plane, val: w.val };
}
/* A surface from a RAYCAST HIT instead of a named wall, so the same installer
   works for click-to-place on arbitrary geometry. normal must already be in
   world space and point away from the surface into the room. */
function surfaceFromHit(hit) {
  const n = hit.normal.clone().normalize();
  const kind = n.y > 0.7 ? "deck" : (n.y < -0.7 ? "ceiling" : "wall");
  return { name: hit.surfaceName || null, kind, normal: n, point: hit.position.clone() };
}

/* -----------------------------------------------------------------------------
   INSTALLATION RULES, BY PRODUCT CATEGORY
   What a category IS, architecturally. Not how it is drawn, and never inside a
   product card or a UI component.

     surface        which kind of surface it belongs on
     face           where its functional front points:
                      "outward"  along the surface normal, into the room
                      "roomward" horizontal, into the room (deck fittings, whose
                                 MOUNT face is down but whose front is not up)
     worldUp        keep +Y on world vertical, so the piece can never roll
     outlet         which way water actually leaves it - declared so it can be
                    validated and drawn in debug (see installDebug)
     mountPlane     which plane of the piece touches the surface:
                      "anchor" the piece is BUILT around local z = 0 (the cutout
                              and procedural paths do this, and deliberately run
                              their bodies back THROUGH it into the wall)
                      "boxMin" the back of the model's own bounding box (imported
                              geometry, whose origin is wherever it was exported)
   -------------------------------------------------------------------------- */
const INSTALL_RULES = {
  "bath-spout":    { surface: "wall",    face: "outward",  worldUp: true,  outlet: "down",    mountPlane: "anchor" },
  "wall-tap":      { surface: "wall",    face: "outward",  worldUp: true,  outlet: "down",    mountPlane: "anchor" },
  "thermostatic":  { surface: "wall",    face: "outward",  worldUp: true,  outlet: null,      mountPlane: "anchor" },
  "diverter":      { surface: "wall",    face: "outward",  worldUp: true,  outlet: null,      mountPlane: "anchor" },
  "body-jet":      { surface: "wall",    face: "outward",  worldUp: true,  outlet: "outward", mountPlane: "anchor" },
  "hand-shower":   { surface: "wall",    face: "outward",  worldUp: true,  outlet: "down",    mountPlane: "anchor" },
  "health-faucet": { surface: "wall",    face: "outward",  worldUp: true,  outlet: "down",    mountPlane: "anchor" },
  "rain-shower":   { surface: "ceiling", face: "outward",  worldUp: false, outlet: "down",    mountPlane: "anchor" },
  // a deck mixer's BASE is what sits on the surface, but its spout looks at the
  // room - the one category where mount face and front face are perpendicular
  "basin-mixer":   { surface: "deck",    face: "roomward", worldUp: false, outlet: "down",    mountPlane: "anchor" },
  "waste":         { surface: "wall",    face: "outward",  worldUp: true,  outlet: null,      mountPlane: "anchor" },
};
const DEFAULT_RULE = { surface: "wall", outlet: null, mountPlane: "anchor" };

/* HOW A SURFACE KIND IS BUILT ON. `face` and `worldUp` are properties of the
   SURFACE, not of the catalogue entry, so they are derived rather than typed:

     wall     front along the normal, +Y locked to world vertical
     ceiling  front along the normal (downward); world up cannot be in-plane
     deck     MOUNT face down onto the surface, front horizontal into the room

   This matters because a category is not always one mounting type. "basin-mixer"
   holds both wall-hung mixers (mounted on the tiles above the basin) and
   deck-mounted ones that stand on the counter — the same category, two different
   installations, told apart per SKU by `mount: "counter"`. A `face` typed once
   per category got one of the two wrong whichever value it held, and the sweep
   caught it: ST-WM-001 and ST-WM-002 are wall mixers being scored as deck ones.
   Derive it from the surface the product is actually on and the question
   disappears. */
const KIND_FACING = {
  wall:    { face: "outward",  worldUp: true },
  ceiling: { face: "outward",  worldUp: false },
  deck:    { face: "roomward", worldUp: false },
};
function ruleFor(product, wall) {
  const base = INSTALL_RULES[product && product.catId] || DEFAULT_RULE;
  // the surface it is really being installed on wins over the category default
  const kind = (wall && SURFACE_KIND[wall]) || base.surface || "wall";
  return Object.assign({}, base, KIND_FACING[kind] || KIND_FACING.wall, { kind });
}

/* The quaternion a product wears on a given surface. This is the ONLY place a
   placed product's orientation is decided. */
function installQuat(surface, rule, roll) {
  let forward, up;
  if (rule.face === "roomward") {
    // deck: mount face down onto the surface, front horizontal into the room
    up = surface.normal.clone();
    forward = ROOM_FRONT.clone();
  } else {
    forward = surface.normal.clone();
    up = rule.worldUp ? WORLD_UP.clone() : null;
  }
  const q = orientFrom(forward, up);
  /* roll is NOT an installation angle - it is the hand correction for a render
     that was shot off-square (see rollFor; nothing in the range sets one). It
     therefore turns the piece about its OWN forward axis, after installation,
     and is the one thing allowed to. */
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  return q;
}

/* SEAT IT. Move the root along the surface normal until the product's declared
   MOUNT PLANE lies on the surface - never using the bounding-box centre, and
   using the box only where a model has no anchor to declare (mountPlane
   "boxMin", for imported geometry whose origin is arbitrary).
   spot is where on the surface it goes; the normal component of spot is
   overwritten, because that is what this function is for. */
function seatOnSurface(root, surface, rule, spot, eps) {
  root.updateMatrixWorld(true);
  /* WHICH LOCAL AXIS TOUCHES THE SURFACE. For a wall or ceiling fitting the
     mount face is the back of the piece, local -Z. For a DECK fitting it is the
     bottom, local -Y: its base sits on the counter while its spout still looks
     at the room, which is the whole reason `face: "roomward"` exists. Assuming
     -Z for everything seated a basin mixer by the back of its box instead of by
     its footprint. */
  const onY = rule.face === "roomward";
  let along = 0;                     // distance from the origin to the mount plane
  if (rule.mountPlane === "boxMin") {
    const b = localBox(root);
    if (!b.isEmpty()) along = onY ? b.min.y : b.min.z;
  }
  const n = surface.normal;
  const target = spot.clone();
  // put it exactly on the surface plane first, whichever way the plane is given —
  // the tile itself for solid geometry (rule.onTile), the artwork anchor otherwise
  const ref = rule.onTile && surface.tile ? surface.tile : surface.point;
  const d = ref
    ? n.dot(target.clone().sub(ref))
    : n.dot(target) + (surface.plane ? surface.plane.constant : 0);
  target.addScaledVector(n, -d);
  target.addScaledVector(n, (eps || 0) - along);    // then the mount plane lands on it
  root.position.copy(target);
}

/* -----------------------------------------------------------------------------
   DEBUG MODE. installDebug(true) draws, for every placed fitting:
     RED    the surface normal it was installed against
     GREEN  the product's up axis
     BLUE   the product's forward / functional axis
     YELLOW the product's MOUNT normal (must oppose the surface normal)
     CYAN   its declared outlet direction
   plus the mount anchor (magenta), the product origin (white) and the oriented
   bounding box. Off by default; it adds nothing to the scene when off.
   From the console: installDebug(true) / installDebug(false)
   -------------------------------------------------------------------------- */
let INSTALL_DEBUG = false;
const DEBUG_NAME = "__installDebug";
function clearInstallDebug(rec) {
  const old = rec.mesh.getObjectByName(DEBUG_NAME);
  if (old) { rec.mesh.remove(old); disposeTree(old); }
}
function drawInstallDebug(rec) {
  clearInstallDebug(rec);
  if (!INSTALL_DEBUG) return;
  const g = new THREE.Group(); g.name = DEBUG_NAME;
  const L = 0.22;
  const arrow = (dir, hex) => g.add(new THREE.ArrowHelper(
    dir.clone().normalize(), new THREE.Vector3(), L, hex, L * 0.28, L * 0.14));
  // drawn in the product's OWN space, so they show the installed axes directly
  arrow(new THREE.Vector3(0, 0, 1), 0x2b7fff);        // forward = BLUE
  arrow(new THREE.Vector3(0, 1, 0), 0x22cc55);        // up      = GREEN
  const inv = rec.mesh.getWorldQuaternion(new THREE.Quaternion()).invert();
  const surf = rec.surface || surfaceOf(rec.wall);
  if (surf) arrow(surf.normal.clone().applyQuaternion(inv), 0xff3020);   // normal = RED
  arrow(new THREE.Vector3(0, 0, -1), 0xffd400);        // mount normal = YELLOW
  const rule = rec.rule || ruleFor(rec.product, rec.wall);
  if (rule.outlet === "down") arrow(WORLD_UP.clone().negate().applyQuaternion(inv), 0x00d5d5);   // outlet = CYAN
  else if (rule.outlet === "outward") arrow(new THREE.Vector3(0, 0, 1), 0x00d5d5);
  const dot = (v, hex, r) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8),
      new THREE.MeshBasicMaterial({ color: hex, depthTest: false }));
    m.position.copy(v); m.renderOrder = 999; g.add(m);
  };
  const b = localBox(rec.mesh);
  dot(new THREE.Vector3(), 0xffffff, 0.008);
  dot(new THREE.Vector3(0, 0, rule.mountPlane === "boxMin" && !b.isEmpty() ? b.min.z : 0), 0xff00ff, 0.010);
  if (!b.isEmpty()) {
    const box = new THREE.Box3Helper(b, 0x8888ff);
    box.material.depthTest = false; box.renderOrder = 998; g.add(box);
  }
  rec.mesh.add(g);
}
function installDebug(on) {
  INSTALL_DEBUG = !!on;
  placed.forEach(rec => drawInstallDebug(rec));
  return INSTALL_DEBUG ? "installation debug ON" : "installation debug off";
}
window.installDebug = installDebug;

/* VALIDATION. After orientation and seating, confirm the fitting actually meets
   its surface: the mount side touching it, the body outside it, no float and no
   burial. installDebug(true) plus this is what makes an orientation error
   obvious instead of a thing you squint at.
   From the console: validateInstall() */
function validateOne(rec) {
  const surf = rec.surface || surfaceOf(rec.wall);
  if (!surf) return { sku: rec.product.code, ok: true, note: "no surface" };
  rec.mesh.updateMatrixWorld(true);
  const b = localBox(rec.mesh);
  if (b.isEmpty()) return { sku: rec.product.code, ok: true, note: "no geometry yet" };
  // +Z is always the outward face by convention, so depth along the surface
  // normal is just the local Z extent
  const s = rec.mesh.scale.x || 1;
  // depth is measured along whichever local axis faces the surface (see seatOnSurface)
  const onY = (rec.rule || ruleFor(rec.product, rec.wall)).face === "roomward";
  // measured from the SURFACE. Artwork is anchored OFF clear of a wall, so its
  // local origin is not the tile; solid geometry (rec.onTile) is seated on it.
  const off = (surf.kind === "wall" && !rec.onTile) ? OFF : 0;
  const proud = (onY ? b.max.y : b.max.z) * s + off;
  const buried = -(onY ? b.min.y : b.min.z) * s - off;
  const ok = proud > 0.002 && buried > -0.003 && buried < 0.14;
  return { sku: rec.product.code, wall: rec.wall, proudM: +proud.toFixed(4),
           buriedM: +buried.toFixed(4), ok,
           note: ok ? "" : (proud <= 0.002 ? "nothing proud of the surface"
                          : buried <= -0.003 ? "floating off the surface" : "buried too deep") };
}
function validateInstallAll() {
  const out = [];
  placed.forEach(rec => out.push(validateOne(rec)));
  return out;
}
window.validateInstall = validateInstallAll;

/* DEV HOOK for the cross-wall tests. The UI installs a fitting on the wall its
   category belongs to, which is right for a client but means the "same spout on
   three different walls" check cannot be driven from the interface. This forces
   a SKU onto a named surface and reports what happened, so the installer can be
   exercised on every wall it claims to support.
     installTest("ST-PLAIN", "left")   -> { sku, wall, proudM, buriedM, ok }
   Console only; nothing in the app calls it. */
window.installTest = (code, wall, settleMs) => {
  // PRODUCTS is keyed by category, not a flat array
  const prod = Object.values(PRODUCTS).flat().find(x => x.code === code);
  if (!prod) return "no such SKU: " + code;
  const uid = placeProduct(prod, prod.defaultFinish, wall || null, false);
  const rec = placed.get(uid);
  if (!rec) return "placement failed";
  return new Promise(res => setTimeout(() => {
    const r = validateOne(rec);
    const q = rec.mesh.quaternion;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const surf = rec.surface || surfaceOf(rec.wall);
    /* A wall fitting must put +Z on the surface normal and +Y on world up. A
       DECK fitting must not: its front is horizontal and its UP is the normal,
       so it is scored against that instead — otherwise a correctly installed
       basin mixer reports as a failure. */
    const roomward = (rec.rule || ruleFor(rec.product, rec.wall)).face === "roomward";
    res(Object.assign(r, {
      facesCorrectly: +(roomward ? up.dot(surf.normal) : fwd.dot(surf.normal)).toFixed(6),
      uprightness: +(roomward ? up.dot(WORLD_UP) : up.dot(WORLD_UP)).toFixed(6),
      pos: [+rec.mesh.position.x.toFixed(3), +rec.mesh.position.y.toFixed(3), +rec.mesh.position.z.toFixed(3)],
    }));
  }, settleMs == null ? 900 : settleMs));
};

/* Sweep the WHOLE catalogue through the installer and report only what fails.
   `installSweep()` puts every SKU on its own category surface; pass a wall name
   to force every wall-mounted SKU onto that wall instead, which is how the
   "same product on every wall" requirement is actually checked at scale. */
/* NUMERICAL ASSERTIONS, not "visually close".
   Three things have to hold for every wall fitting, on every wall:

     dot(productUp,  WORLD_UP)      == 1   the piece cannot be tilted
     dot(productMount, -wallNormal) == 1   the backplate faces the wall
     child local quaternions UNCHANGED by placement

   The third is the one that catches the class of bug this was written for: a
   product's designed internal pose (a jet's neck and head angle) must survive
   installation untouched. The installer writes to the ProductRoot only, so a
   child that moves means something reached inside the model.
   From the console: assertInstall("ST-D5018") / assertInstall() for the lot. */
/* THE CHECKLIST, ON WHATEVER IS CURRENTLY ON THE WALL.
   Per fitting: is it upright, is its backplate on the wall, and — for a set —
   do all four members hold the SAME orientation (they must; nothing may be
   rotated individually). From the console: installReport() */
window.installReport = () => {
  const rows = [];
  placed.forEach(rec => {
    const surf = rec.surface || surfaceOf(rec.wall);
    if (!surf) return;
    const q = rec.mesh.quaternion;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const mount = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const row = {
      sku: rec.product.code, wall: rec.wall,
      upVsWorldUp: +up.dot(WORLD_UP).toFixed(6),
      mountVsWall: +mount.dot(surf.normal.clone().negate()).toFixed(6),
    };
    const members = rec.mesh.children.filter(c => c.userData.jet);
    if (members.length) {
      const q0 = members[0].quaternion;
      row.members = members.length;
      row.maxSpreadDeg = +(Math.max(...members.map(m => q0.angleTo(m.quaternion))) * 180 / Math.PI).toFixed(6);
    }
    rows.push(row);
  });
  return rows;
};
window.installClear = () => { [...placed.keys()].forEach(removeProduct); return "cleared"; };

window.assertInstall = async (code, walls) => {
  const all = Object.values(PRODUCTS).flat();
  const list = code ? all.filter(p => p.code === code) : all;
  const onWalls = walls || ["back", "left", "right"];
  const EPS = 1e-3;
  const fails = [];
  let checks = 0;
  for (const prod of list) {
    for (const wall of onWalls) {
      const surf = surfaceOf(wall);
      if (!surf || surf.kind !== "wall") continue;
      const uid = placeProduct(prod, prod.defaultFinish, wall, false);
      const rec = placed.get(uid);
      if (!rec) { fails.push(`${prod.code}@${wall}: not placed`); continue; }
      // child local poses BEFORE the artwork settles and re-runs the build
      const before = [];
      rec.mesh.traverse(o => { if (o !== rec.mesh) before.push([o, o.quaternion.clone()]); });
      await new Promise(r => setTimeout(r, 700));
      const q = rec.mesh.quaternion;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const mount = new THREE.Vector3(0, 0, -1).applyQuaternion(q);   // -Z is the mount face
      const dUp = up.dot(WORLD_UP);
      const dMount = mount.dot(surf.normal.clone().negate());
      checks += 2;
      if (Math.abs(dUp - 1) > EPS) fails.push(`${prod.code}@${wall}: TILTED, dot(up,WORLD_UP)=${dUp.toFixed(6)}`);
      if (Math.abs(dMount - 1) > EPS) fails.push(`${prod.code}@${wall}: backplate not on wall, dot(mount,-n)=${dMount.toFixed(6)}`);
      // and nothing reached inside the model
      for (const [o, q0] of before) {
        if (!o.parent) continue;                       // rebuilt/removed by the artwork pass
        checks++;
        const moved = q0.angleTo(o.quaternion);
        if (moved > 1e-6) fails.push(`${prod.code}@${wall}: child "${o.name || o.type}" ROTATED by placement, ${(moved * 180 / Math.PI).toFixed(3)} deg`);
      }
    }
  }
  return { checks, failures: fails.length, fails };
};

window.installSweep = async (wall, from, to, settleMs) => {
  const all = Object.values(PRODUCTS).flat();
  const slice = all.slice(from || 0, to == null ? all.length : to);
  const out = [];
  for (const p of slice) {
    const r = await window.installTest(p.code, wall || null, settleMs == null ? 200 : settleMs);
    out.push(Object.assign({ code: p.code, cat: p.catId }, r));
  }
  const bad = out.filter(r => !r.ok || Math.abs(r.facesCorrectly - 1) > 1e-6);
  return { tested: out.length, failures: bad.length, bad };
};

/* =============================================================================
   A WALL FITTING HANGS AS IT WAS PHOTOGRAPHED. THE PLATE IS THE DATUM.

   This used to do the opposite, and the client's own reference shot is what
   settled it. Every fitting in the range is a studio 3/4 render, so the BODY in
   the frame slopes — the plain wall spout by 22.3 degrees, the angle valve by
   35.9. That slope was read as a photographic defect to be cancelled: `roll`
   turned each cutout by the angle its own body measured, meaning to sit the
   body level on the tiles. It never even did that. The fit runs in IMAGE
   coordinates, where y counts DOWNWARD, and handed its answer straight to
   rotation.z, where y counts UP — so the correction arrived sign-reversed and
   drove the nose further down instead of lifting it. The spout hung at 44.7
   degrees, twice the slope of its own photograph.

   That is the wrong datum. On a projecting fitting the body's slope is not tilt,
   it is PERSPECTIVE — a spout pointing out of the wall MUST run downhill across
   the frame, and the client's photograph of these very fittings shows exactly
   that: escutcheon dead square to the tile joints, body falling away to the
   nozzle. The one part that is square in the render is the plate, and the plate
   is the part that touches the wall. Rotating the frame to level the body
   therefore takes the PLATE off square by that same 22 or 36 degrees, and a
   plate cocked against a grout line is the one thing that cannot be read as
   perspective. And fixing the sign would only have halved the damage: a spout
   whose plate is square AND whose body is level is a spout that projects
   nowhere.

   So the artwork hangs as shot, on its plate, and `roll` is now only a hand
   escape hatch — for a fitting whose datum is NOT a square plate. Exactly one
   in the range qualifies: ST-J06, the round body jet, whose flange is a circle.
   A circle has no square edge to knock off level, so there is nothing for a
   roll to spoil and the barrel's axis becomes the only thing left to read — see
   its note in SKU3D. That is the test for any new one. A square plate in the
   frame means no roll; a round plate means the axis is the datum.

   (Two things not to rebuild. The fit ran on whichever finish PNG happened to
   load, so it was per-FINISH: ST-WM-001 measured -19.2 deg on its gold render
   and 0.0 on champagne, and a fitting changed how it hung when you changed its
   colour. And body-jet, thermostatic and diverter had to be excluded by hand,
   one category at a time, because a flat plate shot square-on has no body to
   find and the fit returned noise — four jets each tilted three degrees is a
   grid that will not line up. That exclusion list was the shape of the answer:
   none of these wanted levelling.)
   ============================================================================= */
const rollFor = cfg => cfg.roll || 0;

function finishTexture(path, fid) {
  const t = texLoader.load(path, fid ? () => normaliseArtwork(t, fid) : undefined);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso;
  t.userData = t.userData || {};            // r128 textures have none of their own; the finish print rides here
  return t;
}

/* ONE FINISH, ONE COLOUR — ACROSS THE CLIENT'S OWN PHOTOGRAPHS.
   The renders were shot one product at a time, and the same finish does not
   come out of the studio at the same brightness twice. Measured on the metal
   of each render (linear mean of the 40th–90th luminance band, which skips the
   spray holes and the clipped speculars), Rose Gold is:
     ST-PLAIN spout       #ddac93   value 0.87
     ST-BJ21F body jet    #dbaf92   value 0.86
     ST-2FBJ  body jet    #a5836a   value 0.65   a third darker
     ST-CP25  thermostat  #ffcfb1   value 1.00   blown to white
   Same hue (20–25 deg), same saturation (0.31–0.36), a value range of 0.65 to
   1.00 — so a Rose Gold room held a salmon jet, a cream panel and a pink spout,
   and the client saw three colours. The pixels are not repainted; every
   artwork is PRINTED at the exposure that puts its metal on the finish's own
   colour, the way the room exposure already prints it for a dark wall. The
   reference is ST-PLAIN in each finish — the same photograph METAL_BASE is
   solved against — so a printed cutout and a built spout agree by construction.
   The tint rides on the texture, so the flat cutout, its relief upgrade and
   the extrusion behind it all carry it, and a theme switch recomputes from the
   authored levels rather than compounding. Clamped: a correction outside
   0.5–1.8x means the band caught something that is not metal (the blown
   thermostat renders need about 0.6).
   The target is what the WALL already shows for that finish: the same band
   statistic read off the calibrated ST-PLAIN spout in the White room. Metal on
   the wall bands brighter than its median (chrome most of all, being mostly
   highlight), so aiming the print at METAL_TONE's median left a chrome panel
   at #abaaa6 beside a #dddedd spout; aiming it at the spout's own band puts
   the two on one number by construction. Measured in the Rose Gold room, a
   printed thermostat bands at #cca68f beside a spout and jets at #c7a08b /
   #c89a82 — hue 21-22, saturation 0.30-0.35 — where before the print it stood
   at #facbac, a cream plate between two pink fittings.
   Re-read these off the spout whenever METAL_BASE is re-solved. */
/* BRUSHED GOLD WAS RE-MEASURED AGAINST THE NEW MANFRA RENDERS (2026-09-17) AND
   LEFT WHERE IT IS. Two products print it badly — the Manfra basin mixers band
   at #dcc9aa and #dec698, so far above the target that the tint clamps and
   cannot desaturate far enough — and the obvious reading is that the target is
   wrong. It is not. Measured across all 28 renders that offer the finish, the
   range agrees with itself to within a unit or two: ST-PLAIN #b58a49, ST-C1012
   #b68a48, ST-2FBJ #b58a48, and 25 of the 28 in that cluster, against this
   0xb08847. The Manfra pair are the outliers because they are photographed as a
   MIRROR-POLISHED gold rather than a brushed one — put them beside ST-PLAIN and
   it is the lighting that differs, not the metal. Moving the target onto them
   would break 25 products to flatter 2. It stays until the factory sends a
   brushed-gold render of the Manfra that is lit like the rest of the range. */
const ART_TONE = {   // sRGB band means of the built ST-PLAIN, White room
  /* Seven of these are now the catalogue's own numbers (see METAL_TONE): with
     METAL_BASE re-solved, the built spout bands AT its measured tone, so the
     print target and the metal target are one number per finish instead of two
     that had drifted apart. brushedGold keeps its separately measured value. */
  chrome: 0xd5d6d6, gunGrey: 0x8e8e8e, brushedGold: 0xb08847, champagne: 0xbeac93, gold: 0xe8d8b7,
  polishedGold: 0xd9bd74, roseGold: 0xe0c0b1, brushedRoseGold: 0xdda78a,
  /* matt black is a coat, not a mirror, and how bright it bands on the wall
     depends on the shape it is on (spout 0x62, jets 0x3e); the print aims at the
     measured coat colour and sits between them */
  matteBlack: 0x5f5f5f,
};
const srgbToLin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const artTone = fid => {
  const hex = ART_TONE[fid] != null ? ART_TONE[fid] : METAL_TONE[fid]; if (hex == null) return null;
  return [16, 8, 0].map(s => srgbToLin(((hex >> s) & 255) / 255));
};
/* THE PIXELS OF A RENDER, ONCE. 96x96 is plenty: the print is after one colour,
   not detail, and the whole catalogue is measured on load. */
function artPixels(img) {
  const N = 96, c = mkCanvas(N, N), x = c.getContext("2d");
  x.drawImage(img, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data, px = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 250) px.push([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]);
  return px.length < 40 ? null : px;
}
const artLum = p => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
/* the linear mean of one luminance slice of those pixels */
function artBandMean(px, lo, hi) {
  const ls = px.map(artLum).sort((a, b) => a - b);
  const a = ls[Math.floor(ls.length * lo)], b = ls[Math.floor(ls.length * hi)];
  const sum = [0, 0, 0]; let n = 0;
  px.forEach(p => { const l = artLum(p); if (l >= a && l <= b) { n++; for (let k = 0; k < 3; k++) sum[k] += srgbToLin(p[k]); } });
  return n ? sum.map(v => v / n) : null;
}
/* WHICH SLICE IS THE METAL.
   The print assumes the band it measures IS the finish, and on a fitting that is
   all metal the 40-90% slice is. On one that is not, it is not: the ABS handsets
   are mostly a dark grey spray face, so the slice landed on the plastic and the
   correction then tried to make PLASTIC read as chrome. ST-1035 banded #616162
   against chrome's #d9dad9, every channel pinned at the 1.8 clamp, and what
   reached the wall was a uniformly brightened grey handset.
   So the slice is chosen per render rather than fixed: try three, keep the one
   whose correction needs the least clamping — the clamp is exactly the signal
   that the slice was not metal. Ties go to the LOWEST band, so every render that
   already prints correctly keeps the slice it has and nothing that works today
   moves. Measured over the 512 render/finish pairs in the catalogue: 41 improve,
   none degrade, mean error against the finish falls 2.7 -> 1.3 of 255. */
const ART_BANDS = [[0.40, 0.90], [0.60, 0.95], [0.78, 0.98]];
const overClamp = r => Math.max(0, Math.log(Math.max(r, 1e-6) / 1.8)) +
                       Math.max(0, Math.log(0.5 / Math.max(r, 1e-6)));
/* HOW FAR THE PRINT MAY MOVE A RENDER, and the two are not the same question.
   A single 0.5-1.8 clamp on each channel conflated them, and that is why the
   concealed body jet came out nearly black in a black room: its face is
   photographed inside a recess, so the render is genuinely dark, and the only
   way to lift it was a limit that ALSO had to be tight enough to stop the print
   inventing a hue. One number cannot do both jobs, so it did neither well —
   ST-CBJ's matt black reached the wall at #17181a where every other matt black
   fitting sits around #45.
   Split in two. BRIGHTNESS is the geometric mean of the three channels and may
   move a long way, because how a render is lit says nothing about the metal:
   0.40-3.2 covers a face in shadow and a blown highlight alike. COLOUR is what
   is left after that is divided out, and may move only 0.80-1.25 — enough to
   pull a cast out of a photograph, not enough to turn one metal into another.
   Over the catalogue's 512 render/finish pairs this takes the mean error from
   1.2 to 0.7 of 255, the worst from 53 to 29, and the count over 15 from 14 to
   10, with nothing made worse. */
const BRIGHT_LO = 0.40, BRIGHT_HI = 3.2, CHROMA_LO = 0.80, CHROMA_HI = 1.25;
function clampTint(raw) {
  const s = Math.cbrt(Math.max(raw[0] * raw[1] * raw[2], 1e-9));
  const b = Math.min(BRIGHT_HI, Math.max(BRIGHT_LO, s));
  return raw.map(r => b * Math.min(CHROMA_HI, Math.max(CHROMA_LO, r / s)));
}
function normaliseArtwork(tex, fid) {
  const target = artTone(fid), img = tex.image;
  if (!target || !img || !img.width) return;
  let px;
  try { px = artPixels(img); } catch (e) { return; }   // a cross-origin image cannot be read; leave it as shot
  if (!px) return;
  let best = null;
  for (const [lo, hi] of ART_BANDS) {
    const mean = artBandMean(px, lo, hi);
    if (!mean) continue;
    const raw = target.map((t, k) => t / Math.max(mean[k], 1e-3));
    const over = raw.reduce((a, r) => a + overClamp(r), 0);
    if (!best || over < best.over - 1e-9) best = { over, raw };
  }
  if (!best) return;
  tex.userData.tint = clampTint(best.raw);
  exposeAllArtwork();                       // every material wearing this texture re-prints
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
function productTexture(path, cfg, fid) {
  const t = finishTexture(path, fid);
  if (cfg && cfg.flip) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
  return t;
}

/* PRINT THE PHOTOGRAPH FOR THE ROOM IT IS HANGING IN.
   Product artwork renders UNLIT — MeshBasicMaterial, toneMapped off — because
   re-lighting a studio photograph with the room's own lights and pushing it
   through ACES turned every fitting into a pale ghost. That is the right call,
   but it has a cost: an unlit texture is the same brightness whatever room it
   is in. Every one of these renders was shot against a white sweep under studio
   light, so on the White marble it sits correctly and on the BLACK room it is a
   glowing white bar stuck to a near-black wall — the single loudest reason a
   dark scene reads as a collage instead of a photograph. Chrome makes it worse:
   real chrome in a black bathroom reflects the black bathroom.
   So each room states the exposure a product may print at, and the artwork's
   material is tinted by it. This is a camera decision, not a retouch: no pixel
   is repainted and no colour is invented, the same photograph is simply printed
   down for a darker room, exactly as a photographer would expose for it. The
   extruded body underneath is a lit MeshStandardMaterial and already responds
   to the room on its own, which is why only the face needs telling. */
const artExposure = () => (THEME && THEME.art != null ? THEME.art : 1);
/* Tag a material with the levels it was AUTHORED at, so exposing is idempotent:
   the room can be switched any number of times and the tint is always computed
   from the original, never compounded onto the last one. */
function artMaterial(mat, emissive) {
  mat.userData.artwork = { color: 1, emissive: emissive || 0 };
  return mat;
}
/* the print level for one artwork material: room exposure x the finish tint
   its texture carries (see artTone), from the authored level every time */
function exposeMaterial(m, e) {
  const a = m.userData.artwork, t = (m.map && m.map.userData && m.map.userData.tint) || [1, 1, 1];
  m.color.setRGB(a.color * e * t[0], a.color * e * t[1], a.color * e * t[2]);
}
function exposeArtwork(root) {
  const e = artExposure();
  root.traverse(o => {
    if (o.material && o.material.userData && o.material.userData.fittingEnv)
      o.material.envMapIntensity = o.material.userData.metalFinish
        ? envForMetal(o.material.metalness, o.material.roughness) : fittingEnvI();
    const a = o.material && o.material.userData && o.material.userData.artwork;
    if (!a) return;
    exposeMaterial(o.material, e);
    /* Emission is dimmed HARDER than the surface — e squared. A lit surface in
       a dark room goes dark because little light reaches it, and that is the
       first factor. Emission does not: it is the piece giving off light of its
       own, and a chrome plate does not glow. It is here at all only to keep the
       dial and buttons legible, so in a dark room it should retreat almost to
       nothing while the diffuse face carries the piece. */
    if (o.material.emissive) {
      // a relief's emission IS its print, so it takes the finish tint and the
      // plain room exposure like any cutout; a legibility glow dims by e squared
      const t = (o.material.map && o.material.map.userData && o.material.map.userData.tint) || [1, 1, 1];
      const ee = o.material.userData.relief ? a.emissive * e : a.emissive * e * e;
      o.material.emissive.setRGB(ee * t[0], ee * t[1], ee * t[2]);
    }
  });
}
/* every piece on the wall, re-printed for the room that just changed under it */
function exposeAllArtwork() { placed.forEach(rec => exposeArtwork(rec.mesh)); }

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
/* THE COLOUR ANY METAL WE BUILD IS MADE OF — and there is only one answer.
   This feeds every metal part the app creates that is not a loaded model: the
   extrusion behind a photographic cutout, the wall boss, the shower arm, the
   hand-shower bracket and hose, and the procedural round jet. All of those were
   taking FINISHES[fid].tone — the UI swatch — while loaded models had moved to
   METAL_TONE, the colour measured off the range's own renders. So a room could
   hold a jet built from one statement of Rose Gold beside a spout built from
   another, which is the mismatch the client kept seeing: it was never the
   finish that differed, it was which table the piece happened to read.
   METAL_TONE first, for everything. The swatch stays the fallback for anything
   it does not cover. */
function finishHex(fid, product) {
  const id = fid || (product && product.defaultFinish);
  if (METAL_BASE[id] != null) return METAL_BASE[id];
  if (METAL_TONE[id] != null) return srgbHexToLinear(METAL_TONE[id]);
  const f = FINISHES[id];
  return srgbHexToLinear(parseInt(((f && f.tone) || "#c6a15b").replace("#", ""), 16));
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
/* RELIEF ON A TRIM PLATE'S FACE.
   The client's reference shows the dial standing out of the plate and the
   buttons raised in their squares. Ours were printed flat, because the face is
   the product PHOTOGRAPH on an unlit material — exact colour, zero relief.

   Rebuilding each control as geometry was the obvious answer and the wrong one:
   it means finding the dial and the buttons in the picture, and a detector that
   finds five buttons out of six puts a chrome cylinder somewhere there isn't
   one. A control in the wrong place looks far worse than a flat one.

   So the relief comes from the photograph itself. The same image drives a bump
   map, and every dial, ring, knurl and plate edge catches light exactly where it
   sits in the render, because it IS the render. What it costs is that the face
   is now lit by the room, which is what washed these out to pale ghosts before —
   so the artwork is fed back in as an emissive map too, holding its own studio
   brightness while the bump does the shading. */
function reliefFace(mesh) {
  const flat = mesh.material;
  if (!flat || !flat.map) return;
  /* THE PRINT IS THE EMISSION; THE LIGHTS ONLY ADD THE SHEEN.
     This used to carry the photograph twice — as a lit diffuse map under the
     room's lights and, at 0.56, as emission to keep the dial legible — and the
     lit half then went through ACES. A Rose Gold panel whose render is blown to
     value 1.0 came out of that as #b6aaa0: red crushed hardest by the tone
     curve, saturation 0.12 against 0.30 on the spout beside it. A cream plate
     in a rose gold room, and no per-artwork print could reach it because the
     print sat under a lighting model.
     Now the diffuse is black, the emission IS the photograph (times the finish
     print and the room exposure, exactly as the flat cutouts are), and it is
     not tone mapped, so what the artwork says is what the wall shows. The bump
     and the specular are kept: over a black diffuse the lights and environment
     still catch the plate's edges and the dial's relief, which is the depth cue
     this material exists for — a sheen on the print, not a relighting of it. */
  mesh.material = new THREE.MeshStandardMaterial({
    map: flat.map, color: 0x000000,
    bumpMap: flat.map, bumpScale: 0.006,      // compared on screen at .0026/.006/.012
    emissiveMap: flat.map, emissive: new THREE.Color(0xffffff),
    transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, toneMapped: false,
    metalness: 0.22, roughness: 0.42, envMapIntensity: 0.55,
  });
  mesh.material.userData.relief = true;
  artMaterial(mesh.material, 1);
  mesh.material.userData.artwork.color = 0;   // authored black diffuse — the print is the emission
  exposeArtwork(mesh);
  flat.dispose();                       // the texture is shared and stays alive
}

function addContactShadow(mesh, w, h) {
  const prev = mesh.getObjectByName("contactShadow");
  if (prev) { mesh.remove(prev); prev.geometry.dispose(); }
  const s = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.5, h * 1.5),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.62, depthWrite: false })
  );
  s.name = "contactShadow";
  /* ON the wall face (the anchor is OFF in front of it), or the body we build
     down to the wall swallows the shadow whole. Offset DOWN and to the left,
     away from the key light at (1.4, 3.8, 3.4): a fitting that stands 5 cm off
     the tile throws its shadow to one side, and that offset is most of what
     tells the eye it is standing off at all. */
  s.position.set(-w * 0.045, -h * 0.10, -(OFF - 0.002));
  s.renderOrder = -1;
  mesh.add(s);
}

/* ---- SEATING A FLAT TRIM INTO THE WALL ----------------------------------
   A diverter plate sat on the tile with nothing between it and the grout, so it
   read as laid ON the wall rather than set INTO it. What fixes that is what
   you see on a real concealed valve:

   A CONTACT SEAM — the occlusion line where the plate meets the tile: tight
      and dark at the edge, gone within a couple of centimetres. The radial blob
      addContactShadow paints is right for a spout, which is a small shape
      throwing a shadow to one side, but under a big flat rectangle it reads as
      nothing at all. This is a ring, and it is drawn to the plate's own
      proportions so the border stays an even width all the way round.        */
let _seamTex = null;
/* The seam is cast by the PIECE'S OWN OUTLINE, not by its bounding box.
   It used to be a filled rectangle, which is right only while every trim in the
   range is a rectangle. The round concealed mixer is not: it is a disc with a
   lever hanging off it, and a rectangular seam drew a visible box of shadow on
   the tile around a round plate — a panel behind the fitting that is not there.
   Taking the silhouette from the artwork's alpha costs nothing and is right for
   every shape, the rectangles included: the bar trims come out exactly as they
   did, because their silhouette IS a rectangle. */
function seamTexture(img, mFrac, ar) {
  const key = (img.src || "") + "_" + mFrac.toFixed(3);
  _seamTex = _seamTex || {};
  if (_seamTex[key]) return _seamTex[key];
  // outer canvas covers plate + margin on every side, in the plate's proportions
  const outW = 1 + 2 * mFrac, outH = ar + 2 * mFrac;
  const W = 256, H = Math.max(24, Math.round(W * outH / outW));
  const ix = W * (mFrac / outW), iy = H * (mFrac / outH);
  const iw = W - ix * 2, ih = H - iy * 2;
  /* A flat BLACK stamp of the artwork's alpha. Drawing the photograph itself
     would work for the shadow but not for the punch-out below, which removes in
     proportion to what it draws and would leave a half-strength colour fringe
     wherever the render's edge is anti-aliased. */
  const mk = mkCanvas(Math.max(1, Math.round(iw)), Math.max(1, Math.round(ih)));
  const m = mk.getContext("2d");
  m.drawImage(img, 0, 0, mk.width, mk.height);
  m.globalCompositeOperation = "source-in";
  m.fillStyle = "#000"; m.fillRect(0, 0, mk.width, mk.height);
  const c = mkCanvas(W, H), x = c.getContext("2d");
  x.save();
  x.shadowColor = "rgba(0,0,0,0.9)";
  x.shadowBlur = Math.min(W, H) * 0.16;
  x.shadowOffsetY = 0;      // SYMMETRIC. Cast downward it read as a plate hung off-square.
  x.drawImage(mk, ix, iy, iw, ih);     // its SHADOW is the ring we want
  x.restore();
  x.globalCompositeOperation = "destination-out";
  x.drawImage(mk, ix, iy, iw, ih);     // the plate's own footprint stays clear
  x.globalCompositeOperation = "source-over";
  _seamTex[key] = canvasTex(c, false);
  return _seamTex[key];
}
function seatPanel(mesh, img, w, h) {
  ["trimFlange", "trimSeam"].forEach(n => {
    const prev = mesh.getObjectByName(n);
    if (prev) { mesh.remove(prev); if (prev.geometry) prev.geometry.dispose(); }
  });
  /* The collar is a fixed ~2 cm of metal, so it has to come off the plate's
     SMALLER side. Taken off the width it was 4.7 cm on a 0.55 m thermostatic
     bar — a border thicker than a third of the bar's own height, which reads
     as a picture frame rather than a backing collar. */
  const m = Math.max(0.006, Math.min(w, h) * 0.07);
  /* NO COLLAR. A darker copy of the plate a couple of centimetres bigger used to
     sit behind it here as a "mounting flange". On the wall it read as a second,
     dark plate the trim was hung on — and with the seam's shadow thrown
     downward, as a plate hung off-square: "not at 90 degrees to the wall". The
     trim is ONE plate on the tile; the seam alone says so. */
  // the seam on the tile, a little wider again than the collar
  const sm = m * 1.9;
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(w + 2 * sm, h + 2 * sm),
    new THREE.MeshBasicMaterial({
      map: seamTexture(img, sm / w, h / w), transparent: true, opacity: 0.55, depthWrite: false,
    }));
  seam.name = "trimSeam";
  seam.position.z = -(OFF - 0.002);
  seam.renderOrder = -1;
  mesh.add(seam);
}

/* SELECTION AND HOVER DO NOT TOUCH THE PIECE.
   They used to lay a warm brown emissive over it — 0x2a2013 selected, 0x140f08
   hovered. Emission is added ON TOP of the surface, so on chrome it is invisible
   and on MATTE BLACK it is the only thing you can see: rgb(42,32,19) over a black
   jet is a tan square. That is what the client hit — matte black jets rendering
   tan next to a correctly black panel, the panel being the one piece that
   happened not to be selected.
   A cue that changes the product's colour cannot live in a tool whose whole job
   is showing the client that colour, so it is gone, and nothing replaces it on
   the piece. This is the rule the selection glow was already removed under (see
   the note below): what is selected is stated by the tool card, which names the
   piece with its code and finish, and by its highlighted tile in the rail.
   setEmissive stays because the room's own fittings still use it. */
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
  // the debug helpers are not part of the product: measuring them made every
  // fitting report the arrow length (0.22 m) as its own depth the moment
  // installDebug(true) was on, which is exactly when you are reading the numbers
  const inDebug = o => { for (let n = o; n; n = n.parent) if (n.name === DEBUG_NAME) return true; return false; };
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    if (inDebug(o)) return;
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

/* WHERE THE HANDLE IS, measured off the artwork instead of typed per SKU.
   A bracket has to close around the handle, and the hose has to meet the butt of
   it — and the range is not framed consistently: some handsets are shot dead
   centre, the rail one carries its rail, the 3/4 ones sit off to one side. So
   the silhouette is read out of the alpha channel over a horizontal band, and
   the bracket and hose are built from that. Returns fractions of the artwork's
   width, cx relative to its centre, or null if the pixels cannot be read (in
   which case the caller falls back to the frame centre). */
let _silCanvas = null;
function silhouetteBand(img, f0, f1) {
  if (!img || !img.naturalWidth) return null;
  const W = 96, H = 192;
  _silCanvas = _silCanvas || mkCanvas(W, H);
  const x = _silCanvas.getContext("2d");
  x.clearRect(0, 0, W, H);
  x.drawImage(img, 0, 0, W, H);
  let d;
  try { d = x.getImageData(0, 0, W, H).data; } catch (_) { return null; }   // tainted canvas
  const y0 = Math.max(0, Math.floor(f0 * H)), y1 = Math.min(H - 1, Math.ceil(f1 * H));
  /* The widest CONTIGUOUS run in each row, not the row's outer extremes. A
     handset render can carry a second strand at the same height — a hose
     sweeping away, a rail — and measuring min-to-max across the row then puts
     the bracket in the gap between the two. */
  let cx = 0, hw = 0, rows = 0;
  for (let yy = y0; yy <= y1; yy++) {
    let bs = -1, be = -1, s0 = -1;
    for (let xx = 0; xx <= W; xx++) {
      const on = xx < W && d[(yy * W + xx) * 4 + 3] > 128;
      if (on && s0 < 0) s0 = xx;
      if (!on && s0 >= 0) {
        if (xx - s0 > be - bs) { bs = s0; be = xx; }
        s0 = -1;
      }
    }
    if (bs < 0) continue;
    cx += (bs + be) / 2; hw += (be - bs) / 2; rows++;
  }
  if (!rows) return null;
  return { cx: cx / rows / W - 0.5, halfW: hw / rows / W };
}

/* Wall supply elbow + flexible hose for a wall-mounted hand shower.
   The product PNG is just the handset — on the wall it needs a pipe running
   from a wall outlet down to the handset, or it reads as floating. Sized from
   the placed image height (hh) so it scales with the resize control. Parts are
   flagged userData.metal so they recolour with the chosen finish. */
function handShowerRig(hex, width, hh, img) {
  const g = new THREE.Group();
  g.name = "hsRig";
  /* THE BRACKET IS THE POINT. Before this the rig was an elbow and a hose and
     nothing else, so the handset hung against bare tile with a pipe curling
     away behind it: no cradle, nothing holding it, and the hose left the frame
     near the HEAD rather than the butt of the handle. What a wall handset
     actually has is three things, and it needs all three to read as installed —
     a plate screwed to the tile, a cradle the handle drops into, and a hose
     from a supply elbow to the handle's inlet.
     Every position comes from the artwork's own silhouette (silhouetteBand), so
     the same code fits a centred handset, a 3/4 one and the rail one. */
  const grip = silhouetteBand(img, 0.55, 0.70) || { cx: 0, halfW: 0.10 };   // upper handle
  const butt = silhouetteBand(img, 0.92, 1.00) || { cx: grip.cx, halfW: grip.halfW };
  const gx = grip.cx * width, gw = Math.max(0.012, grip.halfW * width);
  const bx = butt.cx * width;
  const gy = hh * (0.5 - 0.625);                       // the cradle, level with the upper handle
  const r = Math.max(0.006, width * 0.05);             // hose radius, scales with the handset

  // the plate: a round escutcheon on the tile, wider than the handle so it reads
  // from the front, its tail buried so it meets the tile rather than the standoff
  const rp = gw + Math.max(0.016, width * 0.11);
  const plate = metalPart(new THREE.CylinderGeometry(rp, rp * 1.04, WALL_SINK + 0.007, 28), hex, 0.3);
  plate.rotation.x = Math.PI / 2;
  plate.position.set(gx, gy, (0.007 - WALL_SINK) / 2);
  g.add(plate);
  // the cradle: a collar round the handle. Its axis runs UP the handle, so what
  // you see either side of the handle's own silhouette is the ring's two flanks —
  // which is exactly how a handset in a holder reads.
  const collar = metalPart(new THREE.TorusGeometry(gw + 0.008, Math.max(0.004, width * 0.032), 12, 26), hex, 0.22);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(gx, gy, 0.006);
  g.add(collar);
  // a short neck from plate to collar, so the cradle stands off the tile
  const neck = metalPart(new THREE.CylinderGeometry(rp * 0.42, rp * 0.42, 0.026, 18), hex, 0.3);
  neck.rotation.x = Math.PI / 2;
  neck.position.set(gx, gy, 0.008);
  g.add(neck);

  // the supply elbow: BELOW the bracket and off to one side, where a handset
  // outlet is really set — the hose then hangs in front of the tile instead of
  // being threaded up behind the handset
  const side = grip.cx <= 0 ? 1 : -1;                  // away from whichever side the handle sits
  const ex = gx + side * (gw + rp * 1.35), ey = -hh * 0.16;
  const fh = r * 1.4 + WALL_SINK;
  const flange = metalPart(new THREE.CylinderGeometry(r * 2.0, r * 2.3, fh, 22), hex, 0.28);
  flange.rotation.x = Math.PI / 2;
  flange.position.set(ex, ey, r * 0.7 - WALL_SINK / 2);
  g.add(flange);
  const elbow = metalPart(new THREE.SphereGeometry(r * 1.45, 18, 14), hex, 0.2);
  elbow.position.set(ex, ey, r * 1.5);
  g.add(elbow);

  // the hose: out of the elbow, a loose loop hanging clear of the wall, and back
  // up into the butt of the handle. It ends where the handle ends, measured.
  /* A LOOSE LOOP, not a coil. A shower hose is about a metre and a half of
     braided steel: hung between an outlet and a handset a hand's width apart it
     falls well below both of them and stands off the tile as it goes. The first
     pass ran it straight from elbow to butt over a tenth of the handset's
     height, which at this scale is a telephone cord. It now drops most of the
     handset's length below the butt and swings out from the wall on the way. */
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(ex, ey, r * 1.5),
    new THREE.Vector3(ex + side * r * 2.2, ey - hh * 0.30, r * 4.4),
    new THREE.Vector3((bx + ex) / 2 + side * r * 1.8, -hh * 0.82, r * 5.0),
    new THREE.Vector3(bx - side * r * 0.4, -hh * 0.92, r * 4.2),
    new THREE.Vector3(bx, -hh * 0.62, r * 2.2),
    new THREE.Vector3(bx, -hh * 0.47, r * 0.9),
  ]);
  const tube = new THREE.TubeGeometry(curve, 96, r, 14, false);
  const coilTex = hoseTexture().clone(); coilTex.needsUpdate = true;
  /* One rib per hose-and-a-half, not per hose-thickness. At the old pitch the
     ribs were tighter than the tube is thick and the whole thing read as a
     coil spring rather than a braided hose. */
  const coils = Math.max(18, Math.round(curve.getLength() / (r * 2.6)));
  coilTex.repeat.set(coils, 1);
  const hose = new THREE.Mesh(tube, new THREE.MeshStandardMaterial({
    color: hex, map: coilTex, bumpMap: coilTex, bumpScale: r * 0.16,
    metalness: 1.0, roughness: 0.24, envMapIntensity: 1.25,
  }));
  hose.userData.metal = true; g.add(hose);
  // polished couplings at each end, like the reference hose
  const nut = (rad, len) => metalPart(new THREE.CylinderGeometry(rad, rad, len, 18), hex, 0.12);
  [[0.04, r * 1.3, r * 2.2], [0.97, r * 1.4, r * 2.6]].forEach(([t, rad, len]) => {
    const n = nut(rad, len);
    n.position.copy(curve.getPointAt(t));
    n.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(t).normalize());
    g.add(n);
  });
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
  /* The same surface as every other built metal in this finish — metalMat, so
     the calibrated base, the finish's roughness, its metalness and the env gain
     all arrive here too. This used to be its own MeshStandardMaterial at a fixed
     roughness 0.14 and the bare env intensity, so a round jet in Gold was a
     darker mirror beside a calibrated Gold spout. */
  const part = (geo, shade, map) => {
    const mat = metalMat(hex, opts.fid ? finishRough(opts.fid) : 0.175, opts.fid || null);
    mat.color.multiplyScalar(shade);
    if (map) mat.map = map;
    const mesh = new THREE.Mesh(geo, mat);
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
  const plateW = opts.plateW || w;                          // the real flange width, when the caller knows it
  const proud = plateW * 0.11;
  const plate = part(round ? new THREE.CylinderGeometry(plateW / 2, plateW / 2, proud + sink, 40)
                           : new THREE.BoxGeometry(plateW, plateW, proud + sink), 1.0);
  plate.name = "plate";
  if (round) plate.rotation.x = Math.PI / 2;               // lie the disc against the wall
  plate.position.z = proud / 2 - sink / 2;                 // face at +proud, back at -sink
  g.add(plate);
  // --- the neck stands square on the plate; the BALL is at the top of it ---
  const neckR = opts.neckR || w * 0.15, neckD = opts.neckD || w * 0.14;
  /* The shades below used to do the shading themselves — 0.62 on the neck, 0.68
     on the ball — from when this jet was built out of nearly unlit fill and
     needed the parts told apart by hand. They are lit by the room and its
     environment now, so those multipliers darkened a second time on top of real
     shading: the chrome round jet measured 0.10 of value below the chrome panel
     beside it while every other piece matched. Lifted to a light touch, which
     is all a form this simple needs to separate its parts. */
  const neck = part(new THREE.CylinderGeometry(neckR, neckR * 1.22, neckD, 24), 0.88);
  neck.name = "neck";
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
  const ball = part(new THREE.SphereGeometry(neckR * 1.05, 20, 14), 0.90);
  aim.add(ball);
  const headW = opts.headW || w * 0.54, headD = opts.headD || w * 0.32;
  const head = part(round ? new THREE.CylinderGeometry(headW / 2, headW / 2 * 0.94, headD, 36)
                          : new THREE.BoxGeometry(headW, headW, headD), 0.96);
  if (round) head.rotation.x = Math.PI / 2;
  head.position.z = headD / 2;
  head.name = "head";
  aim.add(head);
  // the spray face is drawn — unless the SKU's own photographed face goes on instead (applyDecals)
  if (opts.face !== false) {
    const face = part(round ? new THREE.CircleGeometry(headW / 2 * 0.88, 36)
                            : new THREE.PlaneGeometry(headW * 0.88, headW * 0.88), 0.92, nozzleTexture(rows));
    face.position.z = headD + 0.0012;
    aim.add(face);
  }
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
/* =============================================================================
   REAL GEOMETRY, FROM THE CLIENT'S OWN 3D FILES — keyed by SKU, never by category.
   -----------------------------------------------------------------------------
   Why: 43 of 44 SKUs were photographs, and a body jet, a spout or a wall mixer
   is photographed from three-quarters. Laid flat on the tile that angle is IN
   the pixels: four jets read as four plates stuck on crooked with their necks
   pointing along the wall, and the spout reads as lying sideways. No rotation,
   roll, mirror or homography can put a neck back in front of its plate — the
   only thing that fixes a protruding fitting is protruding geometry. The
   client's RAR ships exactly that for the pieces on this wall; tools_models.py
   exports them as named, web-weight meshes.

   Which model is which SKU was decided by LOOKING, against the photography:
     jet-sq       square plate, neck, square head, 20-nub spray face    ST-2FBJ (exact)
                  The same body carries the other square jets wearing THEIR
                  own face (`decal`): escutcheon / neck / head is one form
                  across the range, only the spray face differs.
     jet-panel    flush 16-jet plate with its rough-in box behind      ST-BJ-01
     spout-plain  plain square-section wall spout                      ST-PLAIN
     mixer-wall   plate + flat spout + square lever                    ST-WM-002
     mixer-deck   tall single-lever deck basin mixer                  ST-BM-001

   THE ENTRY IS THE WHOLE INSTALLATION CONTRACT for a model, so nothing about how
   it sits is guessed from a bounding box:
     axes    the model's OWN front and up, in its file coordinates. The installer
             maps them onto the canonical +Z front / +Y up, so a model authored
             lying on its back (front +Y) needs no hand-typed Euler.
     fit     { axis, size, object? }  the one dimension we know in metres — the
             escutcheon width, the spout length — measured after orientation, on
             the named part if given. Legacy `size` = largest extent.
     mount   { object }  the part whose BACK FACE touches the wall. Default is
             the whole model's back. jet-panel needs it: its box sits BEHIND the
             plate, inside the wall, and must not push the plate off the tile.
     hide    parts to drop (the 20-nub face, when a different face goes on).
     decal   { on }  lay this SKU's own spray face — assets/products/face/,
             cut square out of its photograph by tools_decal.py — on the front
             of the named part. The body is the client's geometry, the face is
             the client's render of this exact SKU; nothing is invented.
     set     "jets" — plumbed as the flanking set of four on JET_GRID.
     proc    a procedural body where no export exists (the one ROUND jet): built
             at real size from its render's proportions, then treated exactly
             like a loaded model.

   Every earlier attempt to use these OBJs failed for reasons that are now
   contract fields rather than model problems: seated by bounding-box centre
   (half the piece in the wall) → `mount`; scaled by the largest dimension of a
   model whose largest dimension was its rough-in box → `fit`; authored
   face-down → `axes`; a plain untextured block standing in for a SKU with a
   distinctive face → `decal`.
   ============================================================================= */
/* WHERE THE JETS IN A SET SIT, relative to the trim they straddle.
   FOUR is the flanking square the range is drawn in: 0.32 out from centre both
   across and up, so the set reads as a square rather than two stacked pairs and
   leaves the same gap for the trim in both directions.
   TWO is a column, asked for directly (2026-09-16): one jet directly ABOVE the
   trim and one directly BELOW it, on the trim's own centre line — so ox is 0
   for both and only the rise changes sign. Same rise as the four, so a client
   switching between them sees the jets stay where they were vertically and
   simply lose the outer pair. */
const JET_SPREAD = 0.32, JET_RISE = 0.32;
const JET_COUNTS = [2, 4];
const jetCountOf = n => (JET_COUNTS.includes(+n) ? +n : 4);
const jetOffsets = n => jetCountOf(n) === 2
  ? [[0, JET_RISE], [0, -JET_RISE]]
  : [[-JET_SPREAD, JET_RISE], [-JET_SPREAD, -JET_RISE], [JET_SPREAD, JET_RISE], [JET_SPREAD, -JET_RISE]];
const SQUARE_JET = { url: "jet-sq", axes: { front: [0, 0, 1], up: [0, 1, 0] },
                     fit: { axis: "x", size: 0.10, object: "plate" }, mount: { object: "plate" }, set: "jets" };
const MODEL_FOR_SKU = {
  "ST-BM-001": { url: "mixer-deck", axes: { front: [0, 0, 1], up: [0, 1, 0] }, fit: { axis: "y", size: 0.34 } },
  "ST-2FBJ":   Object.assign({}, SQUARE_JET),
  "ST-BJ21F":  Object.assign({}, SQUARE_JET, { hide: ["nubs"], decal: { on: "head" } }),
  "ST-BJ-02":  Object.assign({}, SQUARE_JET, { hide: ["nubs"], decal: { on: "head" } }),
  "ST-BJ3F":   Object.assign({}, SQUARE_JET, { hide: ["nubs"], decal: { on: "head" } }),
  // the round jet: no export in the RAR, so its body is built — flange, neck,
  // ball, head — at the proportions of its own render, and wears its own face
  "ST-J06":    { proc: "roundJet", mount: { object: "plate" }, decal: { on: "head" }, set: "jets" },
  "ST-BJ-01":  { url: "jet-panel", axes: { front: [0, 1, 0], up: [0, 0, -1] },
                 fit: { axis: "x", size: 0.22, object: "plate" }, mount: { object: "plate" } },
  "ST-PLAIN":  { url: "spout-plain", axes: { front: [0, 0, 1], up: [0, 1, 0] }, fit: { axis: "z", size: 0.22 } },
  /* THE BUTTON SPOUT IS THE PLAIN SPOUT WITH A BUTTON ON IT. Same 150 mm
     square-section body, same flange, same handset nub underneath — the client's
     two photographs differ only in the cube sitting on top — so it installs off
     the SAME export, through the same axes/fit/mount, and therefore at the same
     angle. It was missing from this table, so specFor() returned null and it fell
     back to its own photograph, which is shot three-quarter: on the wall that
     reads as a spout hanging at a different angle from the modelled one beside it
     (2026-09-16, asked for directly). The RAR carries no export with the button —
     folders 4-19 are rain plates, valve trims and a handset, and the button spout
     is only in the STEP files, which nothing here can read — so the button alone
     is built. `object: "body"` makes every measurement that positions the spout
     read the body and ignore the button, which is what keeps this identical to
     ST-PLAIN; add nothing here that can move the body or the two stop matching. */
  "ST-BUTTON": { url: "spout-plain", axes: { front: [0, 0, 1], up: [0, 1, 0] },
                 fit: { axis: "z", size: 0.22, object: "body" },
                 mount: { object: "body" }, addOn: "spoutButton" },
  "ST-WM-002": { url: "mixer-wall", axes: { front: [0, 0, 1], up: [0, 1, 0] },
                 fit: { axis: "x", size: 0.20, object: "plate" }, mount: { object: "plate" } },
};
/* MODEL_WALL_YROT is GONE. It was a second copy of the per-wall Euler table,
   for the OBJ path only, and a third copy lived in cutoutFallback. All three
   are replaced by installQuat, which derives the rotation from the surface
   normal. Do not reintroduce a per-wall rotation table. */

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

/* bbox of the meshes under `root` — only the part called `name` if given — in
   root's OWN frame, i.e. with root's scale and offset removed. Face decals are
   not part of the body and are skipped, so re-measuring after one is laid on
   gives the same answer. */
function partBox(root, name) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3(), tmp = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || o.name === "faceDecal" || o.name === "contactShadow") return;
    if (name && o.name !== name) return;
    o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox.clone().applyMatrix4(tmp.multiplyMatrices(inv, o.matrixWorld)));
  });
  return box;
}

/* ONE INSTALLED COPY of a model:
     ProductRoot(offset in the set) -> FitRoot(scale, seat) -> OrientationRoot(axes) -> Model
   The result stands with its MOUNT FACE on the local z = 0 plane (y = 0 for a
   deck fitting), centred on its mount part, at real size, front along +Z. The
   caller then only has to put local z = 0 on the tile. Nothing inside the model
   is rotated: the axes correction sits on the OrientationRoot and the model's
   own parts keep the pose they were exported with. */
function modelInstance(model, spec, hex, rule, rough, fid) {
  const hide = new Set(spec.hide || []);
  model.children.slice().forEach(c => { if (hide.has(c.name)) model.remove(c); });
  let mat = null;
  if (!spec.proc) {
    // the MTLs point at Windows paths — the brand metal in the chosen finish instead
    mat = metalMat(hex, rough, fid);
    // two-sided: one of these exports is an inside-out shell, and a culled body
    // is a spout floating over its own base. Back faces get their normal flipped.
    mat.side = THREE.DoubleSide;
    model.traverse(o => { if (o.isMesh) { o.material = mat; o.userData.metal = true; } });
  }
  /* NO cast shadows. Tried: the key light sits high on the room's right, so a
     jet on the right wall threw a metre-long smear of itself onto the LEFT wall
     and the spout a blur across the back wall — physically fair, visually a
     mess at this shadow-map resolution. The contact shadow below grounds each
     piece where it actually touches the tile, which is what the eye wants. */
  model.traverse(o => { if (o.isMesh) o.castShadow = false; });
  // 1. ORIENT — carry the file's own axes onto the canonical ones
  const ax = spec.axes || { front: [0, 0, 1], up: [0, 1, 0] };
  const orient = new THREE.Group(); orient.name = "OrientationRoot";
  orient.quaternion.copy(orientFrom(new THREE.Vector3(...ax.front), new THREE.Vector3(...ax.up)).invert());
  orient.add(model);
  // 2. FIT — the one dimension we know, measured after orientation
  const fit = new THREE.Group(); fit.name = "FitRoot"; fit.add(orient);
  let s = 1;
  if (spec.fit) {
    const ext = partBox(fit, spec.fit.object).getSize(new THREE.Vector3());
    s = spec.fit.size / (ext[spec.fit.axis] || 1);
  } else if (spec.size) {
    const ext = partBox(fit).getSize(new THREE.Vector3());
    s = spec.size / (Math.max(ext.x, ext.y, ext.z) || 1);
  }
  fit.scale.setScalar(s);
  // 3. SEAT — mount face on the origin plane, centred on the mount part
  const mb = partBox(fit, spec.mount && spec.mount.object);
  const c = mb.getCenter(new THREE.Vector3());
  const onY = rule.face === "roomward";
  fit.position.set(-c.x * s, (onY ? -mb.min.y : -c.y) * s, (onY ? -c.z : -mb.min.z) * s);
  const inst = new THREE.Group(); inst.name = "ProductRoot"; inst.add(fit);
  // 4. ADD ON — parts the export lacks, in real metres, on the seated body
  if (spec.addOn) addModelPart(inst, spec.addOn, mat || metalMat(hex, rough, fid));
  return inst;
}

/* The part's box over a SLICE of its length only.
   partBox measures a whole named part, and for this spout that part is the
   flange AND the tube: the flange is a fifth wider and a centimetre taller than
   the tube behind it. Anything sized or seated off the whole box therefore comes
   out too wide and floating in the air above the tube it is supposed to sit on,
   which is what the button did. This measures the section that is actually
   under the thing being added. Vertices, not bounding boxes, because a box is
   exactly the thing that cannot see a step in the profile. */
function partSlabBox(root, name, z0, z1) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || o.name === "faceDecal" || o.name === "contactShadow") return;
    if (name && o.name !== name) return;
    const pos = o.geometry.getAttribute("position"); if (!pos) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.z >= z0 && v.z <= z1) box.expandByPoint(v);
    }
  });
  return box;
}

/* GEOMETRY THE EXPORT DOES NOT CARRY, built in REAL METRES and added only once
   the body is already fitted and seated — so it cannot disturb either, and the
   piece it is added to installs exactly as the bare body would. The frame here
   is the canonical one modelInstance just established: the mount face on z = 0,
   the fitting running out to +z, up is +y, x centred on the mount part. */
function addModelPart(inst, kind, mat) {
  if (kind !== "spoutButton") throw new Error("unknown model part " + kind);
  /* ST-BUTTON's diverter button, off the client's photograph: a square button a
     little narrower than the spout it stands on, raised on a thin collar, set
     between the flange and the middle of the body. Proportions of the body
     rather than absolute millimetres, so the button follows if the spout is ever
     re-fitted to another length. */
  const b = partBox(inst, "body");
  const bl = b.max.z - b.min.z;
  const ALONG = 0.42;
  const z = b.min.z + bl * ALONG;
  /* THE BUTTON STANDS ON THE TUBE, NOT ON THE WHOLE BODY. Measured off the
     export: the wall flange is 1.29 units across and the tube behind it 0.86,
     and the flange's top sits 0.18 proud of the tube's — a fifth of the tube's
     own width. Sizing and seating the button off partBox("body") therefore made
     it wider than the spout and stood it a centimetre clear in the air, joined
     to nothing (2026-09-19, asked for directly: "the button should be joined
     with the spout"). Both numbers now come from the tube's own section at the
     station the button occupies. */
  const tube = partSlabBox(inst, "body", b.min.z + bl * 0.30, b.max.z);
  const tw = tube.isEmpty() ? (b.max.x - b.min.x) : (tube.max.x - tube.min.x);
  const CUBE = tw * 0.84, COLLAR = tw * 0.92, COLLAR_H = 0.005;
  const seatBox = partSlabBox(inst, "body", z - CUBE / 2, z + CUBE / 2);
  const top = seatBox.isEmpty() ? (tube.isEmpty() ? b.max.y : tube.max.y) : seatBox.max.y;
  const g = new THREE.Group(); g.name = "button";
  /* Both pieces run INTO the tube rather than resting on it: a collar half
     buried in the top face, and a cube whose base starts below the collar's.
     A joint you can see a line of daylight through is the fault being fixed. */
  const collar = new THREE.Mesh(new THREE.BoxGeometry(COLLAR, COLLAR_H * 2, COLLAR), mat);
  collar.position.set(0, top, z);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(CUBE, CUBE * 0.92, CUBE), mat);
  cube.position.set(0, top + COLLAR_H + CUBE * 0.46 - 0.002, z);
  [collar, cube].forEach(m => { m.castShadow = false; m.userData.metal = true; g.add(m); });
  inst.add(g);
  return g;
}

/* the procedural bodies — only where the RAR has no export for the form */
function buildProcBody(kind, hex, fid) {
  if (kind === "roundJet") {
    /* ST-J06, from its render: a 78 mm head on a 40 mm neck-and-ball off a
       62 mm round flange. The spray face is not drawn — the SKU's own is laid on. */
    return buildBodyJet(hex, 0.16, { round: true, face: false, plateW: 0.062, headW: 0.078,
                                     headD: 0.040, neckR: 0.013, neckD: 0.040, fid });
  }
  throw new Error("unknown procedural body " + kind);
}

/* THE SPRAY FACE OF THIS EXACT SKU, on the front of its head. The face is the
   product's own photograph, cut square (tools_decal.py) — a rosette, a 4x4 grid,
   three nozzles, a 25-hole disc — printed unlit like all artwork and exposed for
   the room. One texture is shared by the four members of a set. Re-run on a
   finish swap (holder.userData.reface). */
const faceArt = (product, fid) => {
  const p = (product.images && (product.images[fid] || product.images[product.defaultFinish])) || null;
  return p ? p.replace("assets/products/", "assets/products/face/") : null;
};
function applyDecals(holder, product, fid, spec) {
  if (!spec.decal) return;
  const path = faceArt(product, fid); if (!path) return;
  const old = [];
  holder.traverse(o => { if (o.name === "faceDecal") old.push(o); });
  const oldTex = old.length ? old[0].material.map : null;
  old.forEach(o => { o.parent.remove(o); o.geometry.dispose(); o.material.dispose(); });
  if (oldTex) oldTex.dispose();
  /* THE DECAL TAKES THE PRINT TOO — reversed 2026-09-19, on measurement.
     This used to pass no finish id, so finishTexture skipped normaliseArtwork.
     The reason given was the dancing jet: its rose gold face is a BLACK rounded
     square, the band the print measures contained no metal, and asked to make
     black read as rose gold the old single 0.5-1.8 clamp returned
     [1.50, 1.09, 0.87] — a flat peach square on a correct jet. That reasoning
     was sound and the clamp it was written against is gone: BRIGHT and CHROMA
     are separate now (0.40-3.2 and 0.80-1.25), and a chroma limited to +-25%
     cannot invent a hue out of black.
     What the print buys, measured as the jet's mean luminance minus the trim
     plate's in the same room, over the six finishes ST-D5018 actually offers:
       chrome +30 -> +14, gunGrey +23 -> +2, champagne +36 -> +5,
       brushedRoseGold +42 -> +5, roseGold -39 -> -34, matteBlack -34 -> -26.
     Every finish improves, none degrades, and the mean gap halves from 30 to
     14 of 255. A decal is the spray face of a fitting whose body this app has
     already coloured to the finish; printing it is what stops the face and the
     body being two statements of one metal.
     The black rose gold face is now handled where it belongs — the render is
     an outlier and tools_decal.py skips it; see the note beside its quad. */
  const tex = finishTexture(path, fid);
  holder.children.forEach(inst => {
    if (inst.name !== "ProductRoot" || !inst.getObjectByName(spec.decal.on)) return;
    const b = partBox(inst, spec.decal.on);
    const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: tex, transparent: true, alphaTest: 0.2, toneMapped: false, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    artMaterial(m.material); m.material.color.setScalar(artExposure());
    m.name = "faceDecal"; m.userData.own = true;          // ours to dispose, unlike the shared model geometry
    m.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.max.z + 0.0006);
    inst.add(m);
  });
}

/* a placed 3D root (Group). Loads async, then fills, orients and seats itself.
   ONE fitting, or the set of four for a jet SKU, all identical instances. */
function build3DHolder(product, finishId, wall, spec, uid, onReady, jets) {
  const holder = new THREE.Group();
  holder.userData.uid = uid;
  const cfg = skuCfg(product);
  const surf = surfaceOf(wall), rule = ruleFor(product, wall);
  const hex = finishHex(finishId, product);
  const set = spec.set === "jets" && !cfg.single;
  let source;
  if (spec.proc) source = Promise.resolve(null);
  else { showLoading("Loading 3D model…"); source = loadOBJ(MODELS_BASE + spec.url + ".obj"); }
  source.then(raw => {
    (set ? jetOffsets(jets) : [[0, 0]]).forEach(([ox, oy]) => {
      const body = spec.proc ? buildProcBody(spec.proc, hex, finishId) : raw.clone(true);
      const inst = modelInstance(body, spec, hex, rule, finishRough(finishId), finishId);
      inst.position.set(ox, oy, 0);
      inst.userData.jet = set;             // a member of a set — installReport checks the four agree
      // grounding: the soft occlusion where the mount part meets the tile
      if (rule.face !== "roomward") {
        const mb = partBox(inst, spec.mount && spec.mount.object), sz = mb.getSize(new THREE.Vector3());
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(sz.x * 1.7, sz.y * 1.7),
          new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.5, depthWrite: false }));
        sh.name = "contactShadow"; sh.userData.own = true; sh.renderOrder = -1;
        sh.position.set((mb.min.x + mb.max.x) / 2, (mb.min.y + mb.max.y) / 2, 0.0012);
        inst.add(sh);
      }
      holder.add(inst);
    });
    applyDecals(holder, product, finishId, spec);
    holder.userData.reface = fid => applyDecals(holder, product, fid, spec);
    /* NO per-SKU tint here. It was tried, and it is METAL_TONE's note that
       explains why it went: a jet's own render is mostly black face, so tinting
       each model from its own artwork gave two modelled pieces in one finish
       two different colours. The finish is the constant, not the SKU. */
    /* INSTALL: orient the ProductRoot from the surface normal, then put local
       z = 0 — where every instance's mount face already is — on the TILE, not on
       the artwork anchor 2.5 cm in front of it. */
    holder.quaternion.copy(installQuat(surf, rule, 0));
    seatOnSurface(holder, surf, { mountPlane: "anchor", onTile: true, face: rule.face },
                  defaultSpot(wall, cfg), 0.0015);
    holder.userData.anchorPos = holder.position.clone();

    hideLoading();
    if (onReady) onReady();
  }).catch(err => {
    // the OBJ is missing / unparseable — fall back to the product's own artwork so
    // the pick ALWAYS lands something visible in the room instead of an empty group
    console.error("3D model failed:", spec.url || spec.proc, err);
    hideLoading();
    if (onReady) onReady(err);
  });
  return holder;
}

/* `opts.jets` — how many jets a body-jet SET is plumbed as, 2 or 4. It is a
   property of this PLACEMENT rather than of the SKU: the same jet is sold either
   way, and the client chooses when they pick it. Anything that does not pass it
   (a saved design from before the choice existed, the auto-arrange, the install
   tests) gets the four the range is drawn in. */
function placeProduct(product, finishId, wall, frame, opts) {
  const cfg = skuCfg(product);
  wall = wall || cfg.mount || "back";
  const w = WALLS[wall];
  /* ONE fitting per category — anchors are fixed, so a second one would stack
     invisibly on top of the first. Picking another design simply swaps it.
     A `solo` rail group is stricter, because a group can span two categories
     that are really one fitting: Diverters holds thermostatic panels AND
     diverter plates, but on the wall there is a single trim, in the middle of
     the jet grid, and both are anchored to it. So a pick from that list
     replaces whatever is already in the lane instead of joining it. Showers and
     Body Jets are solo for the same reason. Spouts is deliberately NOT — a bath
     spout and a basin mixer are two fittings on two different walls that only
     happen to share a list. */
  const railGrp = RAIL_GROUPS.find(g => g.cats.includes(product.catId));
  const supersedes = railGrp && railGrp.solo
    ? r => railGrp.cats.includes(r.product.catId)
    : r => r.product.catId === product.catId;
  [...placed.values()].filter(supersedes).forEach(r => removeProduct(r.uid));
  const uid = "u" + (uidSeq++);
  // REAL 3D MODEL path: if this category has a factory OBJ, place true geometry
  // (auto-aligned + brand metal finish) instead of the flat photo cutout.
  const jets = jetCountOf(opts && opts.jets);
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
    }, jets);
    // build3DHolder installs the holder inside its async callback — do NOT reset
    // the rotation here, that used to fight it
    room.add(mesh); meshes.push(mesh);
    placed.set(uid, { uid, mesh, product, finishId, wall, cfg, is3D: true, onTile: true, jets,
                      jetSet: spec.set === "jets" && !cfg.single,
                      surface: surfaceOf(wall), rule: ruleFor(product, wall) });
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
    map: productTexture(art, cfg, finishId), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, toneMapped: false,
  });
  artMaterial(mat);                        // it is a photograph, so it prints for the room it hangs in
  mat.color.setScalar(artExposure());
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
       that one is framed by the jets rather than fouling them.
       A set of TWO is the same column without the outer pair — see jetOffsets,
       which both render paths share so the two can never drift apart. */
    const SPREAD = JET_SPREAD, RISE = JET_RISE;
    const OFFS = jetOffsets(jets);
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
          round: cfg.jetShape === "round", rows: cfg.jetRows, fid: finishId,
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
      /* A JET'S OWN POSE IS NEVER TOUCHED. This used to assign
         `jm.rotation.z = jetRoll` on every child — and with no jet in the range
         carrying a roll, that was writing 0 onto each one, i.e. flattening
         whatever pose the child had. The installer orients the ProductRoot and
         nothing else; a child is only written to if a SKU deliberately asks for
         a roll, which none currently does. */
      const jetRoll = rollFor(cfg);
      mesh.children.slice().forEach(jm => {
        // ONLY the jets. The group can also hold the installation-debug helpers
        // (a Group, with no .geometry), and this loop used to assume every child
        // was a jet plane and threw on the first one that was not.
        if (!jm.userData.jet) return;
        if (jetRoll) jm.rotation.z = jetRoll;     // only if a SKU asked; never reset to 0
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
      /* Hangs as photographed: the plate is the datum, see rollFor. Re-installed
         WITH the roll rather than written onto rotation.z — a raw Euler write
         only happened to work here because the piece's other two Euler terms
         came from the quaternion, and it would have silently mis-installed on any
         wall that is not axis-aligned. installQuat applies the roll about the
         piece's OWN forward axis, which is what a photo tilt is. */
      mesh.quaternion.copy(installQuat(surface, rule, rollFor(cfg)));
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
      let gotDepth = false;                 // did ANY branch below give it a body?
      if (cfg.shape === "head" && wall !== "ceiling") {
        gotDepth = true;
        // a wall head stands off the tiles on its arm — flat against them it reads
        // as a sticker, and its inlet connector points at nothing
        const reach = cfg.reach == null ? 0.26 : cfg.reach;
        mesh.geometry.translate(0, 0, reach);
        rim.position.z = reach - 0.008;
        const oldArm = mesh.getObjectByName("armRig"); if (oldArm) mesh.remove(oldArm);
        mesh.add(showerArmRig(finishHex(finishId, product), width, width * ar, reach));
      }
      if ((product.catId === "hand-shower" || cfg.hose) && !cfg.ownRig) {
        // a BARE handset floats — build it the bracket, outlet and hose it needs.
        // `ownRig` marks the SKUs whose photograph already has all three.
        const old = mesh.getObjectByName("hsRig"); if (old) mesh.remove(old);
        mesh.add(handShowerRig(finishHex(finishId, product), width, width * ar, img));
      }
      if (wall === "counter") {
        gotDepth = true;
        mesh.geometry.translate(0, width * ar / 2, 0);   // stand it on the counter, don't bury it
        rim.position.z = -0.008;
      } else if (cfg.panel && wall !== "ceiling") {
        gotDepth = true;
        /* A thermostatic panel or diverter trim is a BLOCK on the wall, and the
           client's reference makes the point: you see the body standing off the
           tile, its end face catching the light, a shadow under it. At 5% of the
           width the body was 2.4 cm on a 55 cm panel — technically there, but
           read as a sticker at any normal viewing distance.
           A real concealed trim stands 3-5 cm proud: the cartridge is behind the
           wall, the plate and its controls are not. That is the figure to hit,
           and it is measured FROM THE TILE — but this offset is measured from
           the anchor, and the anchor already floats OFF (2.5 cm) clear of the
           wall. Asking for 4.75 cm here bought 7.7 cm of fitting standing off
           the tile, which is not a trim any more, it is a shelf. Subtract the
           standoff and ask for the real number. */
        /* 3-5 cm here was the whole trim standing off the tile like a shelf, and
           the client read it as a box that was not sitting flat. A concealed
           trim PLATE is 10-16 mm proud; the dial and buttons stand off the
           plate in the photograph, and reliefFace gives them their light. The
           face therefore sits at proud - OFF, BEHIND the artwork anchor — fine:
           the anchor is a z-fight standoff for flat photographs, not a datum,
           and the body below still runs back through the tile. */
        const proud = Math.min(0.016, Math.max(0.011, width * 0.028));
        const d = proud - OFF;
        mesh.geometry.translate(0, 0, d);
        mesh.remove(rim);                                   // the extrusion IS the rim now
        extrudeCutout(mesh, mesh.material.map, width, width * ar, d + sinkFor(wall), finishHex(finishId, product), d);
        reliefFace(mesh);                                   // dial and buttons catch the light
        // ...and let it into the wall instead of leaving it sitting on it
        // the loaded Image, not the texture: seamTexture reads pixels, and this is
        // the one copy of the artwork we know has finished decoding
        seatPanel(mesh, img, width, width * ar);
      }
      if (cfg.billboard) {
        gotDepth = true;
        // a spout or tap is a solid object seen from the side: without a body it
        // is a piece of foil the moment the room turns
        const d = 0.018;
        mesh.geometry.translate(0, 0, d);
        mesh.remove(rim);
        extrudeCutout(mesh, mesh.material.map, width, width * ar, d, finishHex(finishId, product), d);
        /* AND THE SAME LIGHT THE TRIM PLATE ALREADY GETS.
           A billboarded fitting kept a flat, unlit face while the trim beside it
           and every modelled jet were lit, so one finish reached the wall as
           three: measured in the Rose Gold room, the spout banded #c49a82
           against #c89e86 on the diverter and #c9a088 on the jets, and it was
           the spout that read pale. reliefFace does not relight the print — the
           emission IS the photograph, untone-mapped, so no pixel and no colour
           decision moves — it adds the bump and the sheen the others have. The
           same band after: #c69d85, which is ART_TONE.roseGold to within a unit,
           and saturation 0.329 against the jets' 0.326. Applies to every
           billboarded category: spouts, wall taps, health faucets, basin mixers. */
        reliefFace(mesh);
        if (sinkFor(wall)) mesh.add(wallBoss(finishHex(finishId, product), width, cfg, width * ar));
        const rec0 = placed.get(uid); if (rec0) rec0.halfW = width / 2;
      }
      /* NOTHING GAVE IT DEPTH. A wall cutout that none of the branches above
         extruded sits exactly on the anchor plane — and that plane is already
         OFF (2.5 cm) clear of the tile, so the piece is a photograph floating on
         the standoff with nothing bridging it. Its own validator says so:
         "nothing proud of the surface" (see validateOne).
         It is not a per-SKU slip. Any product whose category carries none of the
         depth flags lands here — the wall-mounted rain head whose artwork already
         includes its own arm, the wastes, and anything added later that nobody
         remembers to flag. So the FLOOR is handled once, here: its own thickness
         in front, and a boss on the mount axis bridging the standoff behind,
         which is the minimum a wall fitting needs to be installed rather than
         stuck on. */
      if (!gotDepth && wall !== "ceiling" && wall !== "counter") {
        const d = 0.014;
        mesh.geometry.translate(0, 0, d);
        mesh.remove(rim);
        extrudeCutout(mesh, mesh.material.map, width, width * ar, d + sinkFor(wall),
                      finishHex(finishId, product), d);
        if (sinkFor(wall)) mesh.add(wallBoss(finishHex(finishId, product), width, cfg, width * ar));
      }
      // grounding: without this every fitting reads as pasted onto the tile
      if (wall !== "ceiling" && wall !== "counter") addContactShadow(mesh, width, width * ar);
      if (wall === "ceiling" && cfg.shape === "head") {
        gotDepth = true;
        // a round head screws onto a drop pipe — hang it below the ceiling so it
        // reads as a shower head rather than a decal stuck to the slab. The pipe
        // runs UP THROUGH the slab and wears a canopy where it passes through, so
        // the drop is visibly fixed to the ceiling instead of stopping short of it.
        const drop = 0.20;
        mesh.geometry.translate(0, 0, drop);
        rim.position.z = drop - 0.008;
        const metal = metalMat(finishHex(finishId, product), 0.3, finishId);
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, drop + CEIL_EMBED, 16), metal);
        pipe.rotation.x = Math.PI / 2; pipe.position.z = (drop - CEIL_EMBED) / 2;
        pipe.name = "arm"; pipe.userData.metal = true; mesh.add(pipe);
        const canopy = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.042, width * 0.17), Math.max(0.046, width * 0.19), 0.026 + CEIL_EMBED, 24), metal);
        canopy.rotation.x = Math.PI / 2; canopy.position.z = (0.026 - CEIL_EMBED) / 2;
        canopy.name = "canopy"; canopy.userData.metal = true; mesh.add(canopy);
      } else if (wall === "ceiling") {
        gotDepth = true;
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
  /* INSTALL IT. One call, derived from the surface normal and the category's
     installation rule — see installQuat. `roll` would counter-rotate a cutout in
     its own plane; nothing in the range sets one (a 3/4 render hangs as shot,
     square on its plate), and a jet SET carries none of its own because each jet
     inside it is levelled individually. */
  const surface = surfaceOf(wall);
  const rule = ruleFor(product, wall);
  mesh.quaternion.copy(installQuat(surface, rule, mesh.isGroup ? 0 : (cfg.roll || 0)));
  positionOnWall(mesh, wall, defaultSpot(wall, cfg));
  room.add(mesh); meshes.push(mesh);
  // a jet SET is one record holding four separate fittings, so it swings per jet
  // rather than as a slab — stepBillboards needs to be told which it is
  const jetSet = product.catId === "body-jet" && !cfg.single;
  placed.set(uid, { uid, mesh, product, finishId, wall, cfg, is3D, jetSet, jets, surface, rule,
                    halfW: jetSet ? cfg.width / 2 : undefined });
  drawInstallDebug(placed.get(uid));
  if (isBasinMixer(product, wall)) setStockMixer(false);
  selectProduct(uid);
  renderRail();
  saveDesign();
  return uid;
}

function defaultSpot(wall, cfg) {
  if (wall === "counter") return new THREE.Vector3(COUNTER.x, COUNTER.y, COUNTER.z);
  // x was pinned at 0 here, so a ceiling plate always hung in the middle of
  // the room however its row was written. Read it like every other wall does.
  if (wall === "ceiling") return new THREE.Vector3(cfg.x != null ? cfg.x : 0, WALLS.ceiling.val, cfg.z != null ? cfg.z : -0.5);
  if (wall === "left")  return new THREE.Vector3(WALLS.left.val, cfg.y != null ? cfg.y : 1.3, cfg.z != null ? cfg.z : 0);
  if (wall === "right") return new THREE.Vector3(WALLS.right.val, cfg.y != null ? cfg.y : 1.3, cfg.z != null ? cfg.z : 0);
  return new THREE.Vector3(cfg.x != null ? cfg.x : 0, cfg.y != null ? cfg.y : 1.3, WALLS.back.val);   // back
}

/* WHERE ON THE SURFACE. This is the in-plane half of installation: clamp the
   spot so a fitting cannot land outside the room, then let the normal component
   be decided by the mount plane.
   Products on the cutout and procedural paths are BUILT around local z = 0 —
   they deliberately run their bodies back through it into the tile — so their
   mount plane IS the origin, and seating them means putting the origin on the
   surface. WALLS[wall].val already carries the OFF standoff that keeps artwork
   off the tile, so that is the plane they land on. */
function positionOnWall(mesh, wall, pos) {
  const w = WALLS[wall];
  const p = pos.clone();
  if (wall === "counter") { mesh.position.copy(p); return; }
  const m = 0.25;                                    // keep it inside the room
  if (wall === "ceiling") { p.x = clamp(p.x, -HX + m, HX - m); p.z = clamp(p.z, -HZ + m, HZ - m); p.y = w.val; }
  else if (wall === "back") { p.x = clamp(p.x, -HX + m, HX - m); p.y = clamp(p.y, 0.3, RH - 0.15); p.z = w.val; }
  else { p.z = clamp(p.z, -HZ + m, HZ - m); p.y = clamp(p.y, 0.3, RH - 0.15); p.x = w.val; }
  mesh.position.copy(p);
  // remember the seated spot: stepBillboards stands a swinging piece off from
  // HERE along the normal, and needs the un-offset position to do it
  mesh.userData.anchorPos = p.clone();
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
/* The installed yaw of a surface, taken from its own normal rather than read out
   of a per-wall Euler table. atan2(n.x, n.z) is the angle whose +Z lands on that
   normal, which is exactly what installQuat produces for a wall — so the swing
   below is measured against the real installation, and a wall at any angle works. */
function surfaceYaw(surface) {
  return surface ? Math.atan2(surface.normal.x, surface.normal.z) : 0;
}
function stepBillboards() {
  placed.forEach(rec => {
    if (rec.is3D || !rec.cfg || !rec.cfg.billboard) return;
    const surf = rec.surface || surfaceOf(rec.wall); if (!surf) return;
    const w = WALLS[rec.wall];
    const base = surfaceYaw(surf);
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
    /* Swing it about the piece's OWN up axis, on top of its installation.
       `rotation.y = base + d` swung it about WORLD Y, which is the same thing
       only while every wall is vertical and axis-aligned — on a sloped or
       angled surface it would have peeled the piece off the wall. */
    rec.mesh.quaternion.copy(installQuat(surf, rec.rule || ruleFor(rec.product, rec.wall), rollFor(rec.cfg)))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), d));
    /* A yawed plane pivots about its centre, so one half would swing back
       THROUGH the tiles. Stand it off by exactly the depth the swing needs —
       ALONG THE SURFACE NORMAL, which used to be three per-wall special cases
       and now works for any normal. */
    const off = (rec.halfW || 0) * Math.abs(Math.sin(d));
    const seat = rec.mesh.userData.anchorPos;
    if (seat) rec.mesh.position.copy(seat).addScaledVector(surf.normal, off);
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
  /* On a phone held upright the binding constraint is WIDTH. `half` is the
     vertical half-field, and every distance below was derived from it, so on a
     0.49 aspect the piece was framed to fill the height and lost its sides.
     halfX is the same figure across the frame; taking whichever needs more
     distance means one expression covers a desktop and a phone. */
  const halfX = half * Math.min(1, camera.aspect);
  const dist = clamp(Math.max(r / (halfX * 0.26), MIN_FRAME_H / (2 * half)), 1.8, 3.6);
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
    map: productTexture(roomArt(path, rec.cfg), rec.cfg, rec.finishId), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, toneMapped: false,
  });
  artMaterial(mat);
  mat.color.setScalar(artExposure());
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 1.2), mat);
  rec.mesh.add(plane);
  // the same installer as everything else — this used to carry its own copy of
  // the per-wall Euler table and could disagree with the other two
  const surf = rec.surface || surfaceOf(rec.wall);
  rec.mesh.quaternion.copy(installQuat(surf, rec.rule || ruleFor(rec.product, rec.wall), 0));
  positionOnWall(rec.mesh, rec.wall, defaultSpot(rec.wall, rec.cfg));
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
  renderTool();
}
function deselect() {
  selected = null; renderTool();
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

  /* NO SWATCHES ONCE THE VALVE IS IN. The finish was committed to when the
     valve went on the wall — for the valve and for everything the valve feeds —
     so offering a row of alternatives here would be offering something the tool
     is about to refuse. Say what it is locked to, and say the way out — which is
     now the toolbar's Finish, changing the whole room at once, not Reset all. */
  const lock = lockedFinish();
  if (lock) {
    $("#toolFins").innerHTML =
      `<span class="fin-lock">Locked to <b>${finName(lock)}</b> by the ` +
      `${placedValve().product.name}. <button type="button" class="lnk" data-roomfin>Change the room's finish</button> ` +
      `to move every fitting together.</span>`;
    const go = $("#toolFins").querySelector("[data-roomfin]");
    if (go) go.onclick = openRoomFinish;
  } else
  $("#toolFins").innerHTML = rec.product.finishes.map(fid =>
    // a product referencing a finish the palette no longer defines must not take
    // the whole tool down — it renders as a plain chip and stays selectable
    `<button type="button" class="fin ${fid === rec.finishId ? "on" : ""}" style="background:${(FINISHES[fid] || {}).swatch || "#888"}"
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
/* `commit` is the valve setting the room's finish — the one caller allowed
   through the lock, because it is the thing that CREATES the lock. Every other
   route (a swatch, a restored design) is refused while a valve is on the wall. */
function changeFinish(uid, fid, commit) {
  const rec = placed.get(uid); if (!rec) return;
  const lock = lockedFinish();
  if (lock && !commit && fid !== lock) {
    toast(`The room is locked to ${finName(lock)} — clear it to change finish`);
    return;
  }
  if (!(rec.product.finishes || []).includes(fid)) return;   // no art, no finish
  rec.finishId = fid;
  sessionFinish = fid;
  if (rec.is3D) {
    const hex = metalHex(fid, finishHex(fid, rec.product));
    rec.mesh.traverse(o => {
      if (!o.userData.metal || !o.material) return;
      o.material.color.setHex(hex);
      if (o.userData.shade != null) o.material.color.multiplyScalar(o.userData.shade);
      if (o.material.userData.metalFinish) {
        // the SURFACE changes with the finish, not only its colour: swapping
        // chrome for matte black turns a mirror into a powder coat. Shaded
        // parts (a jet's neck, ball, head) are metalMat too and change with it.
        o.material.roughness = finishRough(fid) * 0.8;
        o.material.metalness = finishMetal(fid);
        o.material.envMapIntensity = envForMetal(o.material.metalness, o.material.roughness);
        o.material.needsUpdate = true;
      }
    });
    // procedural pieces take their colour from the artwork, not the swatch tone
    if (rec.mesh.userData.retint) rec.mesh.userData.retint(rec.product.images[fid]);
    if (rec.mesh.userData.reface) rec.mesh.userData.reface(fid);   // and the SKU's own spray face, in that finish
  } else {
    const path = rec.product.images[fid]; if (!path) return;
    // grouped body-jet set shares ONE material across its 4 jets; single products
    // carry their own material — handle both
    // a jet SET shares ONE material across its four planes; pick it off a JET,
    // not off children[0], which can be the installation-debug group
    const jetChild = rec.mesh.children && rec.mesh.children.find(c => c.userData.jet && c.material);
    const targetMat = rec.mesh.material || (jetChild && jetChild.material);
    if (!targetMat) return;
    const old = targetMat.map;
    const next = productTexture(roomArt(path, rec.cfg), rec.cfg, fid);   // face-on art, the mirror and the finish print all survive a swap
    targetMat.map = next;
    // a relief face drives its bump and emissive off the SAME image, and this
    // material is updated before the traverse below, so it would skip itself and
    // leave both pointing at a texture we are about to dispose
    if (targetMat.bumpMap === old) targetMat.bumpMap = next;
    if (targetMat.emissiveMap === old) targetMat.emissiveMap = next;
    targetMat.needsUpdate = true;
    // everything that shares the artwork has to move to the new texture BEFORE
    // the old one is disposed, or it renders with a dead map. Traverse rather
    // than look up "rim"/"extrude" by name: getObjectByName returns the FIRST
    // match, and a jet SET has four extrusions — the other three kept pointing
    // at the texture we are about to dispose.
    rec.mesh.traverse(o => {
      if (!o.material || o.material.map !== old) return;
      o.material.map = next;
      // a relief face drives its bump and emissive off the same image
      if (o.material.bumpMap === old) o.material.bumpMap = next;
      if (o.material.emissiveMap === old) o.material.emissiveMap = next;
      o.material.needsUpdate = true;
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
    if (o.geometry && (!rec.is3D || o.userData.own)) o.geometry.dispose();
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
/* A finish-card is "in the room" only when that SKU is there IN THAT COLOUR —
   the chrome spout on the wall must not light up the gold card. */
function isPlacedIn(pid, fid) {
  for (const r of placed.values()) if (r.product.id === pid && r.finishId === fid) return true;
  return false;
}

/* The rail shows FOUR groups only — showers, diverters, spouts and body jets.
   Everything else in the catalogue (basin mixers, hand showers, wall taps, health
   faucets, wastes) is still loaded and still places correctly, it is just not
   offered here. `cats` maps a group onto the underlying category ids, so the two
   diverter families read as one "Diverters" list while each product keeps its own
   catId — and therefore its own wall anchor. */
const RAIL_GROUPS = [
  // FIVE groups, and the client reads them as STEPS: diverter, then shower,
  // then body jets, then spout, then hand shower. `step` is the number the
  // header prints; the array order is the order on screen, and the two must
  // agree — the rail does not sort. Hand showers were folded into the spouts
  // list when they came back (2026-09-09) and were split out again at the
  // client's ask (2026-09-11): one spout sharing a header with thirteen
  // handsets read as a list of handsets with an oddity at the top.
  // Taps & Valves and Wastes stay hidden; they remain loaded, sized and
  // anchored, so adding a group back here is all it takes.
  /* `solo` — ONE of these on the wall at a time, whichever category the pick
     comes from: choosing a second supersedes the first. Three of the four lists
     are solo because each describes a single fitting. Diverters needs it most,
     spanning two categories that are one trim on the wall; Showers and Body
     Jets happen to be one category each today, so the per-category rule in
     placeProduct already gives the same answer — but that is a coincidence of
     how the catalogue is filed, not a promise. Say it here, and folding hand
     showers into Showers (or a jet panel into Body Jets) can't quietly leave
     two overhead heads or eight jets on the same wall. */
  { id: "diverters", step: 1, name: "Diverter",  cats: ["thermostatic", "diverter"], solo: true },
  /* CEILING PANELS ONLY. This started as "not the three wall-mounted heads"
     (meeting, 2026-09-09): ST-1017 / ST-1027 / ST-1033 are the rain-shower SKUs
     whose SKU3D entry moves them off the ceiling (mount: "back" — flat to the
     tile or on a built arm), so the rule read "everything not on the ceiling".
     WIDENED 2026-09-21, asked for directly off the rail: the eleven screw-on
     overhead HEADS go too, leaving the ST-C concealed panels as the whole step.
     They were ceiling-anchored and so passed the old rule, but a 150mm plate on
     a stepped hub or a swivel joint is a head you screw on to an arm, not a
     panel that drops into a false ceiling — eleven of them in front of twenty
     real panels read as the same product photographed eleven ways. So the test
     is now the FITTING, not its anchor: if a rain-shower SKU is not a concealed
     ceiling panel, it belongs in this list. ST-C1005 is the one head-shaped
     card that stays, because it is one — 550x500mm, three functions, three
     supply lines.
     Nothing is deleted. All fourteen keep their catalogue row, their category,
     their anchor and their artwork, same as the deck mixer under Spouts, and
     `offered` hides them from the auto-arrange as well as the rail — one line
     brings any of them back. A room SAVED with one still loads it: hiding is
     about what is OFFERED, not about emptying someone's bathroom (see OMITTED).
     Auto-arrange is untouched: it reads `offered` and already opened on the
     first ST-C panel, which sits above all eleven in the catalogue order. */
  { id: "showers",   step: 2, name: "Shower",    cats: ["rain-shower"], solo: true,
    omit: ["ST-1017", "ST-1027", "ST-1033",
           "ST-1030", "ST-1012", "ST-3014", "ST-3016", "ST-1023", "ST-1031",
           "ST-1022", "ST-1029", "ST-SOH", "ST-SS304", "ST-FDP"] },
  { id: "bodyjets",  step: 3, name: "Body Jet",  cats: ["body-jet"], solo: true },
  /* NO TAPS IN THE SPOUTS LIST (2026-09-09, asked for directly: "remove the
     spouts which are used for the taps"). A spout is an outlet; the moment a
     piece carries a lever it is a tap, and three of the things offered here
     were taps wearing the word "spout" in their name:
       ST-WM-001  twin levers, marked red and blue, on a backplate
       ST-WM-002  a single cube lever on a backplate
       ST-2513    a single-lever wall mixer, filed under bath-spout
     All three are BASIN taps — they anchor over the vanity, not on the shower
     wall — so a shower planner's spout step is the wrong list for them. The
     first two leave with their category: basin-mixer is off `cats` now, which
     takes the deck mixer ST-BM-001 with it and makes its old `omit` entry
     redundant. ST-2513 is a bath-spout by filing, so it needs the explicit one.
     Nothing is deleted. All four keep their catalogue row, their category,
     their anchor and their artwork, so a Basins group would list them again by
     naming the category — see the note on hidden groups above.
     ST-BSDV is out too, and for a different reason: it has no artwork of its
     own yet. Its row borrows ST-PLAIN's photograph (catalog.js `art`), so on
     the rail it sat next to the plain spout showing the same picture and read
     as a duplicate of it — the diverter handle that is the whole point of the
     SKU is not in the image. Listing it again is a one-word change the day its
     render arrives; until then a card that cannot show what it is does not
     belong in front of a client.
     ST-SARM goes too. It was put here because the client asked to see the
     shower arm with the spouts, and then asked for it to go: an arm is not a
     fitting you choose, it is the pipe a wall head screws onto, and its
     three-quarter render lies ALONG the tile rather than reaching into the
     room, so on the wall it read as a black bar with a lump in the middle.
     What is left is ONE spout — ST-PLAIN — which is what was asked for, and it
     now comes in all eight finishes rather than three (see catalog.js), so it
     can be placed in any room whatever the diverter locks the palette to. */
  /* `byFinish` — list one card PER COLOUR instead of one card with a hidden
     chooser. Asked for directly (2026-09-11: "i can only see 1 color in spout
     there are many colors, so add the colors as different products"). It earns
     its place here because the step holds a single SKU: one lonely card said
     "this is all Stout makes", when the truth is one spout in eight finishes.
     Adding the flag to another group is all it takes — it is deliberately NOT
     on the lists that already run to a dozen designs, where eight colours each
     would bury the shapes under a wall of near-identical thumbnails. */
  { id: "spouts",    step: 4, name: "Spout",      cats: ["bath-spout"], omit: ["ST-2513", "ST-BSDV", "ST-SARM"], byFinish: true },
  /* Its own step now. NOT `solo`, and neither is Spout: a spout and a handset
     are two fittings on two brackets, so choosing one must not supersede the
     other — the per-category rule in placeProduct already keeps each to one.
     The shattaf (health-faucet) is deliberately not here: it is a WC fitting,
     not a hand shower, and it was not asked for. */
  { id: "handshowers", step: 5, name: "Hand Shower", cats: ["hand-shower"] },
];
/* Auto-arrange builds a SHOWER SET, so it stays on the shower categories even
   though the list now offers the whole range — otherwise the demo would drop a
   waste and a bib tap into it and stop reading as one. */
const DEMO_CATS = ["rain-shower", "thermostatic", "diverter", "bath-spout", "body-jet"];
/* Auto-arrange picks ONE valve on purpose (see autoArrange). Listing both valve
   categories in DEMO_CATS and placing each in turn used to decide it by
   accident: the Diverter rail group is `solo` and spans both, so the second one
   placed superseded the first, and "diverter" sits after "thermostatic" here —
   every demo room ended up on ST-D5017, which feeds 2, while the demo itself
   puts 3 fittings on the wall. The room was over-subscribed before the client
   touched it, so the rail then refused the spout OR the hand shower, whichever
   they asked for second. */
const DEMO_VALVE_CATS = ["thermostatic", "diverter"];
const DEMO_OUTLET_CATS = DEMO_CATS.filter(c => !DEMO_VALVE_CATS.includes(c));
const RAIL_CATS = RAIL_GROUPS.reduce((a, g) => a.concat(g.cats), []);

/* =========================================================================
   THE VALVE DECIDES THE ROOM
   A concealed valve is not one more fitting in the list: it is the plumbing the
   rest of the room hangs off. Two real constraints follow from that, and the
   planner now enforces both instead of letting a client draw a bathroom no
   plumber can install.
     1. IT FEEDS A FIXED NUMBER OF OUTLETS. A three-function panel plumbs three
        things. So once a valve is on the wall, the room may hold that many
        fittings from the categories a valve actually feeds — and no more.
     2. IT SETS THE FINISH. A shower set is bought as a set; the valve is the
        piece you commit to first, and everything after it matches. So the
        finish is chosen BEFORE the valve is placed, and once it is placed it is
        locked — for the valve and for everything else. Clearing the room is the
        way back, which is also true on site.
   ========================================================================= */
const VALVE_CATS = new Set(["thermostatic", "diverter"]);
const isValve = p => VALVE_CATS.has(p.catId);
/* What a valve actually plumbs. A basin mixer is NOT on this list — it is fed
   off the basin's own stops, not off the shower valve, and counting it would
   spend an outlet the valve never had to give. */
const OUTLET_CATS = new Set(["rain-shower", "body-jet", "bath-spout", "hand-shower"]);
const placedValve = () => [...placed.values()].find(r => isValve(r.product)) || null;
/* WHAT EACH FITTING SPENDS. A shower head spends its function count — a
   3-function panel is three separate inlets, so it takes three of the valve's
   outlets, not one (the client's rule, 2026-09-12: the valve is a budget and
   the shower is priced by its functions). Everything else a valve feeds spends
   one. The four body jets are ONE: a jet set is fed from a single port, which
   is why they arrive as one selectable piece — counting them as four would
   make every valve in the range look two sizes too small. */
/* A SPOUT WITH A BUTTON IS ITSELF A DIVERTER. ST-BUTTON carries a button on top
   whose whole job is to send the flow on to a handset, so the hand shower hangs
   off the SPOUT, not off another of the valve's outlets — the pair spends one
   between them. Without this the client picks the button spout, the budget is
   spent, and the rail refuses the very handset the button exists to feed
   (2026-09-16, asked for directly). Flagged in the catalogue as `feedsHandset`
   rather than tested by code here, so the day another spout ships with a
   diverter button it inherits this by saying so in its row. */
/* Cost is a property of the ROOM, not of a fitting on its own: whether the
   handset is free depends on whether a button spout is in the set beside it.
   So price a whole set at once and derive the rest from that — a per-product
   cost plus deltas gets the swap wrong, and silently: trading the button spout
   back for the plain one has to make the handset start costing again, and if
   that is not recomputed the room quietly ends up over the valve's budget. */
const costOfSet = list => {
  const fed = list.some(x => x.feedsHandset);
  return list.reduce((n, x) => n + (!OUTLET_CATS.has(x.catId) ? 0
    : (x.catId === "hand-shower" && fed) ? 0
    : (x.functions || 1)), 0);
};
const roomSet = () => [...placed.values()].map(r => r.product);
/* what ONE fitting spends in the room as it stands — for the messages */
const outletCost = p => costOfSet(roomSet().filter(x => x.id !== p.id).concat(p))
                      - costOfSet(roomSet().filter(x => x.id !== p.id));
const outletsUsed = () => costOfSet(roomSet());
/* what the room would spend with THIS product in it — a swap inside a category
   hands the old piece's outlets back first, so a 2-function shower can be
   traded for a 3-function one on a valve with exactly one outlet to spare */
const outletsWith = p => costOfSet(roomSet().filter(x => x.catId !== p.catId).concat(p));
const outletCap = () => { const v = placedValve(); return v ? (v.product.outlets || 1) : Infinity; };
/* The finish the whole room is committed to, or null while there is no valve.
   THIS IS DELIBERATE AND IT HAS BEEN ASKED FOR TWICE. It was taken out on
   2026-09-17 ("I want all the colour options which were previously visible")
   and put back the same day, on the clearer statement of what was wanted:
   pick the diverter in matt black and every product is offered in matt black
   only, with no other swatch visible. Reset all is the way out. Do not remove
   it again without the client saying so in those terms. */
const lockedFinish = () => { const v = placedValve(); return v ? v.finishId : null; };
/* is anything from this category already in the room? A swap inside a category
   costs no outlet — the old piece comes off as the new one goes on. */
const catPlaced = cid => [...placed.values()].some(r => r.product.catId === cid);
const finName = fid => (FINISHES[fid] || {}).name || fid;

/* Why this product cannot be added right now — a sentence to show the client,
   or null when it can. Everything that refuses a product answers here, so the
   rail, the swatch tray and the add path can never disagree about it. */
function blockReason(p) {
  const lock = lockedFinish(), v = placedValve();
  /* A finish-card that is not the room's colour is not "unavailable" — the SKU
     is made in it, this room just isn't that colour. Say that, rather than the
     generic line below, which would read as a gap in the range. */
  if (p.finishOnly && lock && lock !== p.finishOnly) return `This room is ${finName(lock)}`;
  if (lock && !(p.finishes || []).includes(lock))
    return `Not made in ${finName(lock)}`;
  if (isValve(p) && v && p.outlets && p.outlets < outletsUsed())
    return `Feeds ${p.outlets}, the room uses ${outletsUsed()}`;
  if (OUTLET_CATS.has(p.catId) && outletsWith(p) > outletCap()) {
    const left = outletCap() - outletsUsed() + (catPlaced(p.catId) ? outletCost([...placed.values()].find(r => r.product.catId === p.catId).product) : 0);
    const need = outletCost(p);
    return `Needs ${need} outlet${need > 1 ? "s" : ""} — ${v ? v.product.name : "the valve"} has ${Math.max(0, left)} left`;
  }
  return null;
}
/* Could the room still match if the valve went in wearing THIS finish? Asked per
   swatch, because the answer differs per swatch: the valve sets the finish for
   everything, so a colour one of the pieces already on the wall is not made in
   would stand the room up in two finishes. */
const finishStrands = fid =>
  [...placed.values()].filter(r => !(r.product.finishes || []).includes(fid)).map(r => r.product.name);

/* the finishes a product may still be offered in, under whatever lock is on */
function finishesFor(p) {
  const lock = lockedFinish();
  if (!lock) return p.finishes || [];
  return (p.finishes || []).includes(lock) ? [lock] : [];
}

/* The finish the visitor is designing in. Picking any swatch sets it, and every
   piece added afterwards arrives in that finish when it is available — a set of
   fittings that half-matches is the fastest way to make a room look cheap. */
let sessionFinish = null;

/* the finish a rail card is currently showing — follows the piece once it is in
   the room, otherwise whatever swatch was last clicked on the card */
const railFinish = new Map();
function cardFinish(p) {
  if (p.finishOnly) return p.finishOnly;          // the card IS the colour
  const rec = [...placed.values()].find(r => r.product.id === p.id);
  if (rec) return rec.finishId;
  // a valve on the wall overrules the card, the session and the default: there
  // is one finish in this room now and it is not up for negotiation
  const lock = lockedFinish();
  if (lock && (p.finishes || []).includes(lock)) return lock;
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

/* Every SKU a rail group has asked to hide, in one set. `omit` lives on the
   group, but "is this product on offer?" gets asked from more than one place:
   the rail itself, and anything that PICKS a product for the client — the
   auto-arrange. The auto-arrange read PRODUCTS[cid] directly and took the
   first finish match, so hiding the wall shower heads from Step 2 did not stop
   it dropping one in: the client hides a product and the demo puts it back.
   Both paths go through offered() now. Saved designs deliberately do not — a
   hidden SKU already in someone's room still loads; hiding is about what is
   OFFERED, not about deleting what was chosen. */
const OMITTED = new Set(RAIL_GROUPS.reduce((a, g) => a.concat(g.omit || []), []));
const offered = cid => (PRODUCTS[cid] || []).filter(p => !OMITTED.has(p.code));

/* A finish-card is a shallow copy of the real product pinned to one colour. It
   is only ever a CARD: `productFor` maps it back to the catalogue row before
   anything is placed, so the room, the share link, undo and the PDF all still
   carry the real SKU and never see these. */
const FINISH_CARDS = new Map();          // card id -> real product
function finishCard(p, fid) {
  const id = p.id + "~" + fid;
  FINISH_CARDS.set(id, p);
  return { ...p, id, baseId: p.id, finishOnly: fid,
           finishes: [fid], defaultFinish: fid,
           variant: [p.variant, finName(fid)].filter(Boolean).join(" · ") };
}
/* everything a group can offer, before the search box narrows it */
function groupOffer(group) {
  const base = group.cats.reduce((a, c) => a.concat(offered(c)), []);
  if (!group.byFinish) return base;
  return base.reduce((a, p) => a.concat((p.finishes || [p.defaultFinish]).map(f => finishCard(p, f))), []);
}
function railItems(group) {
  const items = groupOffer(group);
  const q = railQuery.text.trim().toLowerCase();
  return items.filter(p => {
    if (!q) return true;
    return (p.name + " " + p.code + " " + (p.variant || "")).toLowerCase().includes(q);
  });
}

/* The rail carries NO colour UI any more — no filter chips and no swatches on
   the cards. Colour is chosen on the piece itself, from the tool that appears
   when you select it, so the list stays about picking a design. */
/* WHAT YOU HAVE CHOSEN, where you can see it.
   The lists open one at a time, so with four groups collapsed a customer had no
   way to review their own room without opening every group and hunting for the
   gold borders — and the only complete statement of the design was inside a
   downloaded PDF. This is that statement, in the rail: every piece, its finish,
   click to fly to it, × to take it out. */
function renderChosen() {
  const el = $("#chosen"); if (!el) return;
  const items = [...placed.values()];
  if (!items.length) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  el.innerHTML =
    `<div class="ch-head"><span>In your bathroom</span><span class="ch-n">${items.length}</span></div>` +
    items.map(r => {
      const f = FINISHES[r.finishId] || {};
      return `<div class="ch-row" data-uid="${r.uid}">
        <button type="button" class="ch-go" data-go
                aria-label="Show ${r.product.name} in the room">
          <i style="background:${f.swatch || "#888"}"></i>
          <span class="ch-nm">${r.product.name}${r.jetSet ? ` <em>&times;${jetCountOf(r.jets)}</em>` : ""}</span>
          <span class="ch-fin">${f.name || ""}</span>
        </button>
        <button type="button" class="ch-x" data-drop aria-label="Remove ${r.product.name}">×</button>
      </div>`;
    }).join("");
  el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => {
    const uid = b.closest(".ch-row").dataset.uid;
    const rec = placed.get(uid); if (!rec) return;
    selectProduct(uid); focusOn(rec.mesh);
  });
  el.querySelectorAll("[data-drop]").forEach(b => b.onclick = () => {
    const uid = b.closest(".ch-row").dataset.uid;
    const rec = placed.get(uid); if (!rec) return;
    const name = rec.product.name, undo = snapshot();
    removeProduct(uid);
    toast(`${name} removed`, { label: "Undo", run: () => restore(undo) });
  });
}

function renderRail() {
  const acc = $("#catAccordion");
  let shown = 0, total = 0;
  // count what the rail can actually OFFER — `omit` has to bite here too, or the
  // header advertises a design the list does not contain
  RAIL_GROUPS.forEach(g => (total += groupOffer(g).length));

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
      const why = blockReason(p);
      /* A VALVE IS NOT ADDED BY TAPPING IT. Its finish is the room's finish, so
         it is chosen before the piece goes on the wall, not corrected after:
         tapping the card opens its swatches and tapping a swatch is what places
         it. Every other product still adds on one tap — it inherits the lock. */
      const valve = isValve(p);
      const here = p.finishOnly ? isPlacedIn(p.baseId, p.finishOnly) : isPlaced(p.id);
      return `<div class="pcard ${here ? "placed" : ""}${why ? " blocked" : ""}" data-prod="${p.id}" data-cat="${p.catId}" data-fin="${fin}">
        <button type="button" class="pc-main" ${valve ? "data-arm" : "data-add"}${why ? " disabled" : ""}
                ${valve && !why ? 'aria-haspopup="dialog"' : ""}
                aria-label="${why ? p.name + ", unavailable: " + why
                              : (valve ? "Choose a finish for " : "Add ") + p.name + ", " + p.code
                                + (p.finishOnly ? " in " + finName(p.finishOnly) : "")
                                + (here ? ", already in the room" : "")}">
          <span class="pic"><img src="${thumbOf(img)}" loading="lazy" decoding="async" alt=""></span>
          <span class="nm">${p.name}</span>
          <span class="sub">${p.code}${p.variant ? " · " + p.variant : ""}</span>
          ${(p.outlets || p.functions) ? `<span class="fn">${p.outlets || p.functions} function${(p.outlets || p.functions) > 1 ? "s" : ""}</span>` : ""}
        </button>
        ${why ? `<span class="pc-why">${why}</span>` : ""}
      </div>`;
    }).join("");
    return `<div class="cat-group ${openByDefault ? "open" : ""}" data-group="${g.id}">
      <button type="button" class="cat-title" data-toggle="${g.id}" aria-expanded="${openByDefault}">
        <span class="ic"><img src="${thumbOf((items[0].images && items[0].images[items[0].defaultFinish]) || "")}" alt=""></span>
        <b>${g.step ? `<span class="step">Step ${g.step}</span>` : ""}${g.name}</b><span class="n">${items.length}</span><span class="chev" aria-hidden="true">▶</span>
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

  const productFor = card => FINISH_CARDS.get(card.dataset.prod)
    || (PRODUCTS[card.dataset.cat] || []).find(x => x.id === card.dataset.prod);
  const add = (p, fin, jets) => {
    // Every category has ONE correct home (ceiling / back column / side wall) —
    // always mount there, regardless of which wall tab is active. Deterministic
    // placement: a spout can never end up on the wrong wall. placeProduct flies
    // the camera to frame the piece once its artwork is in (async).
    const why = blockReason(p);
    if (why) { toast(`${p.name}: ${why.toLowerCase()}`); return; }
    const lock = lockedFinish();
    if (lock) fin = lock;                     // one finish in this room, no exceptions
    /* Placing the valve is the moment the room commits. Refuse a finish that
       would strand something already on the wall rather than placing it and
       leaving the client to notice their shower is a different colour. */
    const strands = isValve(p) && !lock ? finishStrands(fin) : [];
    if (strands.length) {
      toast(`${strands.join(" and ")} ${strands.length > 1 ? "are" : "is"} not made in ${finName(fin)}`);
      return;
    }
    /* THE STEP YOU JUST ANSWERED FOLDS AWAY. Picking a diverter used to leave
       its own list open under your finger — fourteen plates you have finished
       choosing between, pushing the three steps you have NOT done off the
       bottom of the rail. Closing it brings them up to meet you, which is the
       whole point of numbering them.
       It is set here rather than toggled in the DOM because placeProduct
       re-renders the rail immediately after and reads openGroup back; a class
       toggled on the old markup would be thrown away with it.
       Null, not the next step: `add` is also the SWAP path — a client changing
       their mind about a diverter they have already placed is not moving
       forward, and marching them on would take the list away mid-decision. */
    openGroup = null;
    const replaced = [...placed.values()].find(r => r.product.catId === p.catId && r.product.id !== p.id);
    const undo = snapshot();
    placeProduct(p, fin, skuCfg(p).mount || "back", true, { jets });
    // and bring the rest of the room to the finish the valve just set
    if (isValve(p)) [...placed.values()].forEach(r => {
      if (r.product.catId !== p.catId && r.finishId !== fin) changeFinish(r.uid, fin, true);
    });
    toast(replaced ? `${p.name} replaced ${replaced.product.name}`
                   : isValve(p) ? `${p.name} added — the room is now ${finName(fin)}, and feeds ${p.outlets || 1}`
                                : `${p.name} added`,
          { label: "Undo", run: () => restore(undo) });
  };

  /* A body jet is picked in two steps, because a set has a SHAPE as well as a
     finish: how many, and then — when the room has not already committed to one
     — which colour. The count is asked first: it is what the client came to the
     jets to decide, and asking it after the colour reads as an afterthought. */
  const addAsking = (p, fid) => asksJetCount(p) ? openJetCount(p, n => add(p, fid, n)) : add(p, fid);
  acc.querySelectorAll("[data-add]").forEach(btn => btn.onclick = () => {
    const card = btn.closest(".pcard"), p = productFor(card); if (!p) return;
    // the colour the card is SHOWING is the colour that goes on the wall —
    // read it off the card, because `p` is now the shared catalogue row
    addAsking(p, card.dataset.fin || cardFinish(p));
  });
  // a valve card opens the finish chooser; picking there is what places it
  acc.querySelectorAll("[data-arm]").forEach(btn => btn.onclick = () => {
    const card = btn.closest(".pcard"), p = productFor(card); if (!p) return;
    if (asksJetCount(p)) { openJetCount(p, n => openFinishPick(p, fid => add(p, fid, n))); return; }
    openFinishPick(p, fid => add(p, fid));
  });
  describeRoom();
  syncRoomFin();          // the toolbar's finish button follows the room
  renderChosen();
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
    jets: r.jets,
  }));
}
function restore(items) {
  [...placed.keys()].forEach(removeProduct);
  items.forEach(it => {
    const p = (PRODUCTS[it.cat] || []).find(x => x.id === it.pid); if (!p) return;
    const uid = placeProduct(p, it.fin, it.wall, false, { jets: it.jets });
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
    /* THE SHOWER, which is the one thing the three wall views never show: the
       overhead is on the CEILING and all three of those look level or slightly
       down. This one stands back at the room's open front and tilts up, so the
       overhead, the valve on the right wall and the jets are in one frame — the
       shower as a set rather than three separate fittings.
       It cannot simply point at the ceiling: OrbitControls clamps the polar
       angle (maxPolarAngle 0.62pi), so a camera more than ~21 degrees below its
       target is snapped back the moment update() runs. Target y 1.95 keeps the
       tilt at ~13 degrees and still carries the overhead near the top of frame,
       26 degrees of half-FOV above the look direction.
       IT FOLLOWS THE PLATE. The overhead used to hang at x 0, z -0.55 and this
       view was aimed there by hand; moving it onto the valve lane (CEIL_OUT,
       VALVE_Z) left the view pointing at bare ceiling with the shower off in
       the corner of frame. Written off the same two constants, so the camera
       cannot be left behind the next time the plate moves. */
    shower: { pos: [CEIL_OUT - 0.55, 1.42, 1.45], tgt: [CEIL_OUT - 0.18, 1.98, VALVE_Z - 0.35] },
  }[wall] || null;
  if (!targets) return;
  const tgt = new THREE.Vector3(...targets.tgt);
  /* These three viewpoints were framed on a desktop. On a narrow screen the
     same spot shows a third of the wall, so the eye backs off along its own
     view line by what the field-of-view cap could not recover (widenPull).
     Backing off is safe here in a way it is not for the hero: all three look in
     through the room's OPEN front, so there is no wall behind the camera to
     pass through. */
  const pos = tgt.clone().add(new THREE.Vector3(...targets.pos).sub(tgt).multiplyScalar(widenPull()));
  animateCam(pos, tgt);
}
/* =========================================================================
   SHARE A DESIGN AS A LINK
   -------------------------------------------------------------------------
   The single thing this tool was missing as a sales instrument: a customer who
   has spent ten minutes choosing finishes had no way to send that room to a
   spouse, an architect or the showroom — the PDF is a picture of a decision,
   not the decision itself. The whole design rides in the URL fragment, so it
   needs no backend and no database, and a consultant can reopen the customer's
   exact room by pasting the link.
   Format: #d=<theme>.<ceiling>.<vanity>~<code>:<finish>:<scale>~...
   ========================================================================= */
const productById = id => {
  for (const cat in PRODUCTS) { const p = PRODUCTS[cat].find(x => x.id === id); if (p) return p; }
  return null;
};
function designToHash() {
  const room = [THEME.id, ceilingChoice, basinVisible ? 1 : 0].join(".");
  /* The jet count is a fourth field, and only written when it is not the
     default four — so every link ever shared stays exactly as long as it was,
     and a three-field chunk still reads correctly (as four) both here and in
     anyone's older copy of the app. */
  const items = [...placed.values()].map(r => {
    const base = [r.product.id, r.finishId, (+baseScale(r.mesh)).toFixed(2)];
    if (r.jetSet && jetCountOf(r.jets) !== 4) base.push(String(jetCountOf(r.jets)));
    return base.join(":");
  });
  return "d=" + room + (items.length ? "~" + items.join("~") : "");
}
function shareURL() {
  return location.origin + location.pathname + "#" + designToHash();
}
/* Reopen a shared room. Returns true when it actually restored something, so
   boot can tell "someone sent me this design" apart from a plain visit — a
   plain visit still opens on a clean room, which is deliberate. */
function applyHash(raw) {
  const h = (raw || "").replace(/^#/, "");
  if (!h.startsWith("d=")) return false;
  const parts = h.slice(2).split("~");
  const [themeId, ceilId, basin] = (parts.shift() || "").split(".");
  if (themeId && THEMES[themeId]) applyTheme(themeId, true);
  if (ceilId && CEILINGS.some(c => c.id === ceilId)) setCeiling(ceilId, true);
  setBasin(basin !== "0");
  let n = 0;
  parts.filter(Boolean).forEach(chunk => {
    const [pid, fin, scale, jets] = chunk.split(":");
    const p = productById(pid); if (!p) return;
    const finish = (p.finishes || []).includes(fin) ? fin : p.defaultFinish;
    const uid = placeProduct(p, finish, skuCfg(p).mount || "back", false, { jets });
    const rec = placed.get(uid);
    const sc = parseFloat(scale);
    if (rec && sc > 0.3 && sc < 2) setBaseScale(rec.mesh, sc);
    n++;
  });
  if (n) { deselect(); renderRail(); saveDesign(); }
  return n > 0;
}
/* Keep the address bar in step, so the browser's own Copy Link and the back
   button both do something sensible. replaceState, not pushState: choosing a
   finish should not become a history entry to walk back through. */
function syncHash() {
  try { history.replaceState(null, "", "#" + designToHash()); } catch (_) { /* file:// */ }
}
function copyShareLink() {
  if (!placed.size) { toast("Add a few fittings first, then share the room"); return; }
  syncHash();
  const url = shareURL();
  // Tell the visitor straight away and treat the clipboard as best-effort. The
  // clipboard promise never settles at all when the document isn't focused, so
  // hanging the confirmation off it means a click that silently does nothing.
  toast("Link copied — it reopens this exact room", {
    label: "Email it", run: () => { window.location.href =
      `mailto:?subject=${encodeURIComponent("My Stout bathroom design")}` +
      `&body=${encodeURIComponent(designAsText() + "\n\n" + url)}`; },
  });
  const askInstead = () => { try { window.prompt("Copy this link:", url); } catch (_) { /* blocked */ } };
  try {
    const w = navigator.clipboard && navigator.clipboard.writeText(url);
    if (w && w.catch) w.catch(askInstead); else askInstead();
  } catch (_) { askInstead(); }
}
if ($("#shareDesign")) $("#shareDesign").onclick = copyShareLink;

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
    ``,
    `Reopen this exact room: ${shareURL()}`,
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
/* The sheet carries TWO angles, because one hero shot always hid half the
   decision: the right wall is where the body jets, spouts and valves live, and
   the overhead head is only legible looking UP at the ceiling slab.
   Both print at the same shape whatever the window is, hence the crop. */
const SHEET_ASPECT = 4 / 3;

/* Capture the live canvas from an arbitrary eye/target WITHOUT disturbing the
   user's view: the camera is moved, rendered and put back in one synchronous
   pass, so the orbit controls never see it and no frame is drawn in between.
   That also means the ceiling shot is free of controls.maxPolarAngle, which
   would otherwise refuse to look that far up. */
function captureFrom(pos, tgt, aspect) {
  const el = renderer.domElement;
  const savedPos = camera.position.clone(), savedTgt = controls.target.clone();
  const savedAnim = camAnim;
  camAnim = null;                          // an in-flight fly-to would fight us
  let url = null;
  try {
    camera.position.copy(pos);
    controls.target.copy(tgt);
    camera.lookAt(tgt);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    const sw = el.width, sh = el.height;
    let cw = sw, ch = Math.round(sw / aspect);
    if (ch > sh) { ch = sh; cw = Math.round(sh * aspect); }
    const c = mkCanvas(cw, ch);
    c.getContext("2d").drawImage(el, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, cw, ch);
    url = c.toDataURL("image/jpeg", 0.92);
  } catch (e) {
    console.warn("capture failed", e);
  } finally {
    camera.position.copy(savedPos);        // leave the room exactly as we found it
    controls.target.copy(savedTgt);
    camera.lookAt(savedTgt);
    camera.updateMatrixWorld();
    camAnim = savedAnim;
    renderer.render(scene, camera);
  }
  return url;
}

/* Angle 1 — the right wall, same eye the "Right" view button uses. */
function shotRightWall() {
  return captureFrom(new THREE.Vector3(-0.55, 1.52, 0.30),
                     new THREE.Vector3(HX, 1.34, -0.55), SHEET_ASPECT);
}

/* Angle 2 — stand back and below the ceiling head and look up, so it reads
   against the slab with the wall behind it for scale. Falls back to the middle
   of the shower zone when nothing is mounted overhead. */
function shotCeiling() {
  const rec = [...placed.values()].find(r => r.wall === "ceiling");
  let cx = 0, cz = -0.55, cy = RH - 0.12;
  if (rec) {
    const box = localBox(rec.mesh).applyMatrix4(rec.mesh.matrixWorld);
    if (!box.isEmpty()) {
      const c = box.getCenter(new THREE.Vector3());
      cx = c.x; cz = c.z; cy = c.y;
    }
  }
  /* Stand ~1.1 m off the head, below and in front. At fov 52 on a 4:3 crop that
     puts a 62 cm plate across about 40% of the frame — big enough to show the
     blades and the finish, with enough slab and wall left around it to say
     "this is the ceiling". The first pass stood 2.2 m back and the head was a
     speck in an empty grey field. */
  const pos = new THREE.Vector3(clamp(cx + 0.18, -HX + 0.35, HX - 0.35),
                                clamp(cy - 0.85, 0.95, RH - 0.35),
                                clamp(cz + 0.82, -HZ + 0.35, HZ - 0.35));
  return captureFrom(pos, new THREE.Vector3(cx, cy - 0.04, cz), SHEET_ASPECT);
}
/* jsPDF needs pixels, and a transparent PNG would print on a black ground —
   composite each product render onto white first. */
/* an image, as-is, as a JPEG data URL — for artwork that must not be re-framed */
function imageDataURL(path) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = mkCanvas(img.naturalWidth, img.naturalHeight);
      c.getContext("2d").drawImage(img, 0, 0);
      res(c.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = () => res(null);
    img.src = path;
  });
}
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

/* The About page's photograph — the client's own showroom, full-bleed across
   the top of page 1. jsPDF cannot crop, so the crop happens here: cover-fit
   the box, centred, and hand the PDF a JPEG that is already the right shape.
   Returns null if the file is not there, and page 1 then prints without it. */
function coverDataURL(paths, wpx, hpx) {
  const list = Array.isArray(paths) ? paths.slice() : [paths];
  return new Promise(res => {
    const tryNext = () => {
      const path = list.shift();
      if (!path) return res(null);
      const img = new Image();
      img.onload = () => {
        const c = mkCanvas(wpx, hpx), x = c.getContext("2d");
        x.fillStyle = "#12100e"; x.fillRect(0, 0, wpx, hpx);
        const r = Math.max(wpx / img.naturalWidth, hpx / img.naturalHeight);
        const w = img.naturalWidth * r, h = img.naturalHeight * r;
        x.drawImage(img, (wpx - w) / 2, (hpx - h) / 2, w, h);
        res(c.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = tryNext;
      img.src = path;
    };
    tryNext();
  });
}

/* A STOUT catalogue number, or nothing.
   Several products in here carry a working id rather than a catalogue code —
   ST-PLAIN, ST-SARM, ST-BSDV, ST-BUTTON and the filename-derived ones — because
   the factory has not issued a number for that piece yet (the spouts, the shower
   arm and most body jets are printed in the catalogue with no code at all).
   Printing "ST-PLAIN" on a sheet a client hands to a fitter invents a part
   number; this prints the truth instead, and the consultant fills it in. */
const CODE_RE = /^ST-[A-Z]{0,2}\d{3,5}$/i;
function catalogCode(p) {
  const c = String((p && p.code) || "").trim();
  return CODE_RE.test(c) ? c : null;
}

async function downloadSpecSheet() {
  if (!window.jspdf || !window.jspdf.jsPDF) { toast("PDF engine not loaded"); return; }
  const items = [...placed.values()];
  if (!items.length) { toast("Add a few products first, then download"); return; }

  // No fly-to: captureFrom() borrows the camera and hands it straight back, so
  // the client's view is still where they left it when the download finishes.
  const prev = selected; deselect();
  toast("Building your PDF…");
  const [logo, showroom, ...thumbs] = await Promise.all([
    // the client's mark, pre-composited on the header band's own colour so it
    // prints identically whatever this jsPDF build does with PNG alpha
    imageDataURL("assets/brand/logo-pdf.jpg"),
    coverDataURL(["assets/brand/about-showroom.jpg", "assets/brand/about-showroom.png"], 1680, 704),
    ...items.map(rec => {
      const path = (rec.product.images && (rec.product.images[rec.finishId] || rec.product.images[rec.product.defaultFinish])) || "";
      return path ? thumbDataURL(thumbOf(path), 300) : Promise.resolve(null);
    }),
  ]);
  setTimeout(() => {
    const shots = [
      { url: shotRightWall(), label: "Right wall  ·  jets, spouts & valves" },
      { url: shotCeiling(),   label: "Ceiling  ·  overhead shower" },
    ].filter(s => s.url);
    if (prev) selectProduct(prev);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const PW = 210, PH = 297, M = 14;
    const GOLD = [198, 161, 91], INK = [28, 28, 30], MUTE = [120, 120, 124], LINE = [222, 218, 208];

    /* The dark lockup band, identical on both pages so the two read as one
       document. `right` is the small line set against the right margin. */
    /* THE BAND HOLDS THE MARK AND NOTHING ELSE (2026-09-21, asked for directly).
       It used to carry a lockup — mark plus "SANITARYWARE" in gold — and, on
       page 2, a right-aligned title and a room-and-date line. All of it is
       gone. The mark is the client's own artwork and it already says who this
       is from; the wordmark beside it said it twice, and the title and date
       said what the page below says anyway. With the word gone the mark is no
       longer half of a pair, so it centres on its own width rather than on the
       width of the pair. `right` and `sub` are still taken so the two callers
       need not change, and so it is one edit to put a line back if it is ever
       wanted again. */
    function brandBand(top, h, right, sub) {
      doc.setFillColor(15, 15, 17); doc.rect(0, top, PW, h, "F");
      const LH = Math.min(12, h - 8), LW = LH * (707 / 268);   // the lockup is 707x268
      if (logo) {
        doc.addImage(logo, "JPEG", (PW - LW) / 2, top + (h - LH) / 2, LW, LH, undefined, "FAST");
      } else {
        // no artwork loaded: the name, set as the mark would be, still alone
        doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
        doc.text("STOUT", PW / 2, top + h / 2 + 3, { align: "center" });
      }
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(0, top + h, PW, top + h);
    }

    /* ======================================================================
       PAGE 1 — ABOUT STOUT
       The showroom full-bleed across the top, then who Stout is, then the
       engineering the client never sees. No products, no prices.
       ====================================================================== */
    const PHOTO_H = showroom ? 88 : 0;
    if (showroom) doc.addImage(showroom, "JPEG", 0, 0, PW, PHOTO_H, undefined, "FAST");
    /* "INFINITE BATHING" used to sit in the right of this band. It went with the
       wordmark and the page-2 title for the same reason: the band holds the
       mark and nothing else. The line still closes the About copy below, where
       it reads as a sign-off rather than as a second logo. */
    brandBand(PHOTO_H, 24, null, null);

    let y = PHOTO_H + 24 + 16;
    doc.setTextColor(...GOLD); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("ABOUT STOUT", M, y, { charSpace: 1.6 });
    y += 9;
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text("More than a fitting. A statement of design.", M, y);
    y += 4;
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M, y, M + 26, y);
    y += 8;

    const ABOUT = [
      "At STOUT, we believe a bathroom is more than a functional space — it is an expression of architecture, lifestyle and individuality.",
      "Our journey is driven by a simple philosophy: create products that combine refined design, dependable performance and lasting craftsmanship.",
      "From thoughtfully engineered fittings to distinctive finishes and contemporary forms, every STOUT product is developed with attention to detail and an uncompromising focus on quality.",
      "We work closely with our partners, retailers, architects and designers to understand what modern spaces demand — and transform those insights into products that are elegant, practical and built for everyday living.",
      "STOUT is not about following trends. It is about creating designs that remain relevant.",
      "With a growing presence and a commitment to continuous innovation, we aspire to make every bathroom a more considered, sophisticated and personal space.",
    ];
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.6); doc.setTextColor(88, 88, 92);
    ABOUT.forEach(p => {
      const lines = doc.splitTextToSize(p, PW - 2 * M);
      doc.text(lines, M, y);
      y += lines.length * 4.7 + 2.6;
    });
    y += 2;
    doc.setTextColor(...GOLD); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("STOUT — Infinite Bathing.", M, y);

    /* The catalogue's own "Luxury engineered from within" spread, condensed:
       the parts that decide whether a mixer still feels right in ten years. */
    const ENG = [
      ["Vernet THQ36 thermostatic cartridge",
       "Ceramic-disc precision that holds the temperature you set through pressure changes, with a safety stop and a cartridge that services without dismantling the fitting."],
      ["Neoperl FSG D8 volume control",
       "Manual on/off with fine volume regulation — roughly 6 to 30 litres a minute at 3 bar — smooth to adjust at high and low pressure alike."],
      ["Neoperl FSG D8 HD bolt",
       "Heavy-duty, corrosion-resistant fastening with an anti-loosening thread, engineered for an exact, leak-free fit under vibration and pressure change."],
    ];
    const BOX_H = 44, boxY = PH - 24 - BOX_H;
    doc.setFillColor(249, 247, 243); doc.roundedRect(M, boxY, PW - 2 * M, BOX_H, 2, 2, "F");
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(M, boxY, M + 26, boxY);
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(9.4);
    doc.text("LUXURY ENGINEERED FROM WITHIN", M + 6, boxY + 9, { charSpace: 0.7 });
    const colW = (PW - 2 * M - 12 - 2 * 6) / 3;
    ENG.forEach(([title, body], i) => {
      const x = M + 6 + i * (colW + 6);
      doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(7.8);
      const tl = doc.splitTextToSize(title, colW);
      doc.text(tl, x, boxY + 17);
      doc.setTextColor(...MUTE); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text(doc.splitTextToSize(body, colW), x, boxY + 17 + tl.length * 3.4 + 2.2);
    });

    /* ======================================================================
       PAGE 2 — THE CLIENT'S OWN SELECTION
       ====================================================================== */
    doc.addPage();
    const when = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    brandBand(0, 26, "Bathroom Design Specification", `${roomLabel()} bathroom  ·  ${when}`);

    y = 26 + 8;
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Your Design", M, y); y += 4;
    /* A long selection needs the room below more than it needs a big render, so
       the two angles give height back once the list passes eight pieces. */
    const shrink = items.length > 8 ? 0.72 : 1;
    if (shots.length) {
      const availW = PW - 2 * M, gap = 6;
      const frameW = (shots.length > 1 ? (availW - gap) / 2 : availW * 0.64) * shrink;
      const imgW = frameW - 6, imgH = imgW / SHEET_ASPECT, frameH = imgH + 6;
      const x0 = M + (shots.length > 1 ? 0 : (availW - frameW) / 2);
      shots.forEach((s, i) => {
        const x = x0 + i * (frameW + gap);
        doc.setFillColor(245, 243, 238); doc.roundedRect(x, y, frameW, frameH, 2, 2, "F");
        doc.addImage(s.url, "JPEG", x + 3, y + 3, imgW, imgH, undefined, "FAST");
        doc.setTextColor(...MUTE); doc.setFont("helvetica", "normal"); doc.setFontSize(7.6);
        doc.text(s.label, x + frameW / 2, y + frameH + 4, { align: "center" });
      });
      y += frameH + 4 + 8;
    } else { y += 6; }

    // ---- selected products ----
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Selected Products", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTE);
    doc.text(`${items.length} ${items.length === 1 ? "piece" : "pieces"}`, PW - M, y, { align: "right" });
    y += 2;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, y + 1, PW - M, y + 1); y += 7;

    /* Rows close up rather than spill onto a third page: the sheet is meant to
       be two pages, About and this. Below 15 mm a 300 px thumbnail stops being
       readable, so at that point a further page is the honest answer. */
    const room = (PH - 26) - y;
    const rowH = Math.max(15, Math.min(24, room / items.length));
    const thumbMM = Math.min(18, rowH - 5);
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
      const code = catalogCode(rec.product);
      doc.setTextColor(...MUTE); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      doc.text(`${categoryName(rec.product.catId)}   ·   ${code ? "Code " + code : "Code on request"}`, tx + 6, y + 3);
      /* A set of two and a set of four are different fittings to buy and to
         plumb, so the sheet has to say which — it is the one line a fitter
         reads off this page. */
      const jetLine = rec.jetSet ? `set of ${jetCountOf(rec.jets)}` : "";
      const sub = [rec.product.variant, jetLine].filter(Boolean).join("  ·  ");
      if (sub && rowH >= 18) {
        doc.setFontSize(7.8); doc.setTextColor(160, 158, 152);
        doc.text(sub, tx + 6, y + 7.2);
      }
      /* The chip is the RANGE's colour, not the UI swatch. FINISHES[fid].tone
         has to read as a 22 px dot in the tool and was never matched to the
         photography — rose gold is #cf9a8c there against #d09f86 measured off
         the product renders, and gold is #d4af37 against #d6c28d. On screen
         that is a swatch; printed next to the finish's name on a specification
         the client hands to a fitter, it is a statement about the product. */
      const sw = hex2rgb(METAL_TONE[rec.finishId] != null
        ? "#" + METAL_TONE[rec.finishId].toString(16).padStart(6, "0")
        : (fin.tone || "#c9ced3"));
      doc.setFillColor(...sw); doc.setDrawColor(200, 196, 186); doc.setLineWidth(0.2);
      doc.roundedRect(PW - M - 40, y - 4.4, 5.4, 5.4, 0.9, 0.9, "FD");
      doc.setTextColor(...INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      doc.text(fin.name || "—", PW - M - 32.5, y - 0.6);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, top + thumbMM + 2.5, PW - M, top + thumbMM + 2.5);
      y += rowH;
    });

    // ---- footer on every page ----
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, PH - 16, PW - M, PH - 16);
      doc.setTextColor(...MUTE); doc.setFont("helvetica", "normal"); doc.setFontSize(7.8);
      // The disclaimer and the contact line were dropped at the client's ask
      // (2026-09-16). Page 1 already says the sheet is not a quotation and that
      // the consultant prices it, so repeating it under every page read as
      // small print on a document meant to look like a proposal. The page
      // number stays — it is the only thing a footer here has to do.
      doc.text(`Page ${p} / ${pages}`, PW - M, PH - 7, { align: "right" });
      // the sheet is a picture of a decision; this line makes it the decision —
      // whoever holds the paper can reopen the room and keep working on it
      if (p === 2) {
        doc.setFontSize(6.6); doc.setTextColor(150, 150, 154);
        // two lines of link, sitting clear of the footer rule at PH-16
        const ln = doc.splitTextToSize("Reopen this room: " + shareURL(), PW - 2 * M).slice(0, 2);
        doc.text(ln, M, PH - 18.5 - (ln.length - 1) * 2.8);
      }
    }

    doc.save("Stout-Bathroom-Design.pdf");
    toast("PDF downloaded");
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
  // brushedGold and gold came off the range (see catalog.js); a demo cannot
  // arrange a finish the picker no longer offers
  const PREF = ["champagne", "chrome", "matteBlack", "roseGold"];
  const canWear = (cid, fin) => offered(cid).some(p => (p.finishes || []).includes(fin));
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

  /* The valve decides how much of the range stays open, so choose it for the
     room the client might end up with, not just the one we are about to build:
     enough outlets for EVERY outlet category, so a hand shower is still on the
     table after the demo has placed the shower, the jets and the spout. Take
     the smallest valve that clears that bar — a 6-function panel where a
     4-function one does is a different product, not a safer default — and fall
     back to the most generous available when nothing clears it. */
  const valves = DEMO_VALVE_CATS
    .reduce((a, c) => a.concat(offered(c)), [])
    .filter(p => (p.finishes || []).includes(fin));
  /* What the demo will SPEND, not how many categories there are: the shower it
     is about to pick is priced by its functions (see outletCost), the rest are
     one each, and a hand shower is kept on the table with one more. */
  const firstIn = cid => offered(cid).filter(p => (p.finishes || []).includes(fin))[0];
  const need = DEMO_OUTLET_CATS.reduce((n, cid) => { const p = firstIn(cid); return n + (p ? outletCost(p) : 0); }, 0) + 1;
  const byOutlets = (a, b) => (a.outlets || 1) - (b.outlets || 1);
  const valve = valves.filter(p => (p.outlets || 1) >= need).sort(byOutlets)[0]
             || valves.sort(byOutlets).pop();
  if (valve) placeProduct(valve, fin, skuCfg(valve).mount || "back");
  else if (DEMO_VALVE_CATS.some(c => offered(c).length)) skipped.push("Diverter");

  DEMO_OUTLET_CATS.forEach(cid => {
    const list = offered(cid).filter(p => (p.finishes || []).includes(fin));
    if (!list.length) { if (offered(cid).length) skipped.push(categoryName(cid)); return; }
    // the first one the valve can still feed — a fallback valve may be smaller
    // than the one `need` asked for, and a shower it cannot plumb is not a demo
    const p = list.find(q => !blockReason(q)) || null;
    if (!p) { skipped.push(categoryName(cid)); return; }
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
  // the address bar is part of the design's state now: whatever the room holds,
  // the URL in the bar reopens exactly that
  if (typeof syncHash === "function" && !restoring) syncHash();
  if (restoring) return;
  try {
    const items = [...placed.values()].map(r => ({ pid: r.product.id, cat: r.product.catId, fin: r.finishId, wall: r.wall, scale: baseScale(r.mesh), jets: r.jets }));
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
    const uid = placeProduct(p, FINISHES[it.fin] ? it.fin : p.defaultFinish, it.wall || skuCfg(p).mount || "back", false, { jets: it.jets });
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
/* RESET ALL — the same thing the room needs after a finish is committed, so it
   is in the toolbar where it can be found, not only in the overflow menu.
   It used to be the ONLY way back out of the finish lock, which is why it is
   here at all. It no longer is: the Finish button beside it moves the whole room
   to another colour and keeps the layout, and this is now what it says on the
   tin — start the room again. */
if ($("#resetAll")) $("#resetAll").onclick = () => {
  if (!placed.size) { toast("The room is already empty"); return; }
  askConfirm(() => {
    const undo = snapshot(); clearAll();
    toast("Every fitting removed — the room is open again", { label: "Undo", run: () => restore(undo) });
  });
};
if ($("#clearAll")) $("#clearAll").onclick = () => {
  if (!placed.size) { toast("The room is already empty"); return; }
  askConfirm(() => { const undo = snapshot(); clearAll(); toast("Room cleared", { label: "Undo", run: () => restore(undo) }); });
};

/* ---- confirm dialog ----------------------------------------------------- */
/* THE FINISH CHOOSER.
   Big, and modal, because of what it decides: not this piece's colour but the
   colour of every fitting in the room. A row of 20 px dots on a rail card is
   the wrong size for that — you cannot tell Champagne from Brushed Rose Gold at
   20 px, and you certainly cannot tell what either does to THIS product. So the
   choice is made full size, with the piece itself shown in each finish. */
let finPickRun = null;
/* ONE TILE. The piece shown in the finish, its swatch, its name, and — when
   something already on the wall is not made in it — why it cannot be picked.
   Shared by the per-piece chooser and the room's own, so the two can never
   disagree about what a refused finish looks like. */
function finTile(p, fid, strands, label, on) {
  const src = thumbOf((p.images && p.images[fid]) || "");
  return `<button type="button" class="fin-tile${strands.length ? " no" : on ? " on" : ""}" data-fid="${fid}"
      ${strands.length ? "disabled" : ""}
      aria-label="${label}${strands.length ? ", unavailable" : ""}"${on ? ' aria-current="true"' : ""}>
      <span class="ft-pic"><img src="${src}" alt="" decoding="async"></span>
      <span class="ft-sw" style="background:${(FINISHES[fid] || {}).swatch || "#888"}"></span>
      <span class="ft-nm">${finName(fid)}</span>
      ${strands.length ? `<span class="ft-no">${strands.join(", ")} not made in it</span>` : ""}
    </button>`;
}
/* the grid's own wiring — whatever put the tiles there, a tile closes the modal
   and hands its finish to whoever asked */
function bindFinPick() {
  $("#finPickGrid").querySelectorAll("[data-fid]").forEach(b => b.onclick = () => {
    const fid = b.dataset.fid, r = finPickRun;
    closeFinishPick();
    if (r) r(fid);
  });
  $("#finPick").hidden = false;
  const first = $("#finPickGrid").querySelector("[data-fid]:not([disabled])");
  if (first) first.focus();
}
function openFinishPick(p, run) {
  const m = $("#finPick"); if (!m) { run(cardFinish(p)); return; }
  finPickRun = run;
  const fins = finishesFor(p);
  const lock = lockedFinish();
  $("#finPickTitle").textContent = `${p.name} — choose your finish`;
  $("#finPickBody").textContent = lock
    ? `The room is already in ${finName(lock)}, so that is the finish this goes in.`
    : `This is the finish the whole room is designed in — every fitting after it ` +
      `matches. It locks when the piece goes on the wall, and Finish in the toolbar ` +
      `moves the whole room to another one.`;
  // a finish nothing already on the wall can wear is shown, and shown as refused,
  // rather than quietly missing — the client should see why it is not an option
  $("#finPickGrid").innerHTML = fins.map(fid =>
    finTile(p, fid, lock ? [] : finishStrands(fid), `${p.name} in ${finName(fid)}`, false)).join("");
  bindFinPick();
}

/* =========================================================================
   THE ROOM'S FINISH, CHANGED AFTER THE FACT
   The valve locks the room to one finish, and until now Reset all was the only
   way out of it — which takes the layout with it. A client who has placed eight
   fittings and then wants to see the set in champagne was being asked to build
   the room again, and (asked for directly, 2026-09-21) that is the wrong price
   for changing your mind about a colour, least of all in the last minute before
   the PDF.
   THE LOCK IS NOT LIFTED, IT IS MOVED. Every piece changes together, so the room
   is still in exactly one finish afterwards — which is the rule the lock exists
   to keep (see lockedFinish, and do not weaken it: it has been asked for twice).
   ========================================================================= */
/* the finishes worth offering the room: every finish any placed piece is made
   in, in catalogue order — each product's own list is already sorted, so taking
   them first-seen keeps that order. The ones the whole room cannot wear come
   back from finishStrands and are shown refused, not hidden. */
function roomFinishes() {
  const out = [];
  [...placed.values()].forEach(r => (r.product.finishes || []).forEach(fid => {
    if (!out.includes(fid)) out.push(fid);
  }));
  return out;
}
/* Move every fitting to one finish. `commit` on each, because the valve's lock
   is what this is changing — the same door placeProduct uses when the valve
   first sets the room's colour. The valve goes first so no intermediate state
   has the room reading as locked to a finish nothing else is wearing yet. */
function refinishRoom(fid) {
  const items = [...placed.values()], v = placedValve();
  const order = v ? [v, ...items.filter(r => r !== v)] : items;
  const from = lockedFinish() || (items[0] && items[0].finishId);
  const moved = order.filter(r => r.finishId !== fid);
  if (!moved.length) return;
  const undo = snapshot();
  order.forEach(r => { if (r.finishId !== fid) changeFinish(r.uid, fid, true); });
  toast(`The room is now ${finName(fid)} — ${moved.length} fitting${moved.length > 1 ? "s" : ""} changed`,
        { label: "Undo", run: () => { restore(undo); sessionFinish = from; } });
}
/* The room chooser. Same modal as the per-piece one, because it is the same
   decision at a larger size — and the piece on the tiles is the valve, which is
   the piece whose finish the rest of the room was following anyway. */
function openRoomFinish() {
  const items = [...placed.values()];
  if (!items.length) { toast("Add a few fittings first, then pick their finish"); return; }
  const m = $("#finPick"); if (!m) return;
  const cur = lockedFinish() || items[0].finishId;
  const face = (placedValve() || items[0]).product;
  finPickRun = fid => refinishRoom(fid);
  $("#finPickTitle").textContent = "The room's finish";
  $("#finPickBody").textContent =
    `${items.length} fitting${items.length > 1 ? "s" : ""} in ${finName(cur)}. Picking another ` +
    `changes them all together — the layout stays exactly as it is, and Undo puts the colour back. ` +
    `A finish one of the pieces is not made in cannot be picked.`;
  $("#finPickGrid").innerHTML = roomFinishes().map(fid =>
    finTile(face, fid, finishStrands(fid), `The whole room in ${finName(fid)}`, fid === cur)).join("");
  bindFinPick();
  const on = $("#finPickGrid").querySelector(".fin-tile.on");
  if (on) on.focus();
}
/* the toolbar button wears the room's colour, and is not there to be pressed
   until there is a room to recolour */
function syncRoomFin() {
  const b = $("#roomFin"); if (!b) return;
  const items = [...placed.values()];
  b.hidden = !items.length;
  if (!items.length) return;
  const cur = lockedFinish() || items[0].finishId;
  b.querySelector("i").style.setProperty("--c", (FINISHES[cur] || {}).swatch || "#888");
  b.querySelector(".rf-nm").textContent = finName(cur);
  b.title = `The room is ${finName(cur)} — change the finish of every fitting`;
  b.setAttribute("aria-label", b.title);
}
function closeFinishPick() { const m = $("#finPick"); if (m) m.hidden = true; finPickRun = null; }

/* HOW MANY JETS. The same jet is sold as a pair or as a set of four, so this is
   the client's decision and not the SKU's — it is asked once, when the jet is
   picked, and it travels with the placement (the share link, the saved room and
   the spec sheet all carry it). A jet that is a single fitting — the 16-jet
   panel — never asks: there is nothing to count. */
let jetCountRun = null;
function openJetCount(p, run) {
  const m = $("#jetCount");
  if (!m) { run(4); return; }                      // no modal in this build: the range's default
  jetCountRun = run;
  $("#jetCountTitle").textContent = `${p.name} — how many?`;
  $("#jetCountGrid").innerHTML = JET_COUNTS.map(n => `
    <button type="button" class="fin-tile" data-jets="${n}"
      aria-label="${n} body jets, ${n === 2 ? "one above the trim and one below" : "two to each side of the trim"}">
      <span class="ft-nm">${n} jets</span>
      <span class="ft-no">${n === 2 ? "in a column, above and below the trim" : "flanking the trim, two each side"}</span>
    </button>`).join("");
  $("#jetCountGrid").querySelectorAll("[data-jets]").forEach(b => b.onclick = () => {
    const n = +b.dataset.jets, r = jetCountRun;
    closeJetCount();
    if (r) r(n);
  });
  m.hidden = false;
  const first = $("#jetCountGrid").querySelector("[data-jets]");
  if (first) first.focus();
}
function closeJetCount() { const m = $("#jetCount"); if (m) m.hidden = true; jetCountRun = null; }
if ($("#jetCountNo")) $("#jetCountNo").onclick = closeJetCount;
if ($("#jetCount")) $("#jetCount").onclick = e => { if (e.target === $("#jetCount")) closeJetCount(); };
/* a set of jets, or a single fitting that has nothing to count */
const asksJetCount = p => p && p.catId === "body-jet" && !skuCfg(p).single;
if ($("#roomFin")) $("#roomFin").onclick = openRoomFinish;
if ($("#finPickNo")) $("#finPickNo").onclick = closeFinishPick;
if ($("#finPick")) $("#finPick").onclick = e => { if (e.target === $("#finPick")) closeFinishPick(); };

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
    else if ($("#jetCount") && !$("#jetCount").hidden) closeJetCount();
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
/* 1500, not 1420. With the ceiling swatches in the bar it needs 1492 px, so
   between 1420 and 1492 the bar overflowed the window: "Spec sheet" and the ...
   button hung off the right edge with no way to scroll to them, and the whole
   document picked up 52 px of horizontal scroll. The swatches are 206 px, so
   moving them into the ... menu below 1500 leaves the bar fitting comfortably.
   Keep this in step with the same query in planner.css. */
const CEIL_MQ = "(max-width:1500px)";
const menuMQ = sel => (sel === "#ceilTabs" ? CEIL_MQ : "(max-width:860px)");
const MENU_LABEL = { resetView: "Reset the view", lookToggle: "Cursor turn",
                     toggleBasin: "Show or hide the vanity", downloadPdf: "Download the PDF" };
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
  userMovedCam = false;          // the app is driving again
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

/* hover: nothing in the 3D view looks clickable on its own, so the cursor says
   so. It used to tint the piece as well — see the note on setEmissive for why a
   cue that changes a fitting's colour has no place in a finish visualiser. */
let hovered = null;
renderer.domElement.addEventListener("pointermove", e => {
  const uid = pickProduct(e);
  if (uid === hovered) return;

  hovered = uid;

  holder.classList.toggle("over-product", !!hovered);
});
controls.addEventListener("start", () => { lookSuspended = true; userMovedCam = true; });
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
  if (!w || !h) return;                       // hidden tab / mid-rotation: don't divide by zero
  const wasTall = camera.aspect < 1;
  const cap = pixelCap();
  if (renderer.getPixelRatio() !== cap) renderer.setPixelRatio(cap);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = fovFor(camera.aspect);         // hold the horizontal field — see FRAMING above
  camera.updateProjectionMatrix();
  /* Turning the phone crosses between the two hero compositions, and the view
     it was left in belongs to the other one. Re-frame, but only when the
     ORIENTATION changed and only if the client has not taken over the camera
     themselves — otherwise every keyboard-open resize would yank the view. */
  if (wasTall !== (camera.aspect < 1) && !camAnim && !userMovedCam) {
    animateCam(heroPos(), heroTgt());
  }
}
window.addEventListener("resize", resize);
/* A window `resize` is not a reliable signal that the CANVAS changed size, and
   on a phone it is the canvas that moves: iOS Safari grows and shrinks the
   viewport as its address bar hides, and an orientation change can fire resize
   before the new layout has settled. Miss it and the drawing buffer keeps the
   old shape while CSS stretches it to the new box — measured here after a
   portrait-to-landscape flip, a 750x1520 buffer was being stretched across
   812x323. Watching the container itself catches every one of those, whatever
   caused it. */
if (typeof ResizeObserver === "function") new ResizeObserver(resize).observe(holder);

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

window.__STOUT3D = { scene, camera, controls, renderer, shell, lightRig, room, THEMES, applyTheme, animateCam,
                     placed, placeProduct, changeFinish, PRODUCTS, exposeAllArtwork };   // the last five are for console checks only

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
    '<h2>Step 1 — choose your diverter</h2>' +
    '<p class="e-body">The diverter comes first, because it decides the rest: tap one to pick ' +
    'its finish, and the whole room is designed in that finish. How many functions it has is how ' +
    'many fittings it can feed. Nothing is priced here — Stout supplies and installs the whole ' +
    'design, and your consultant quotes it.</p>' +
    '<div class="e-row">' +
      '<button type="button" data-e="first">Choose a diverter</button>' +
      '<button type="button" data-e="set">Auto-arrange a full set</button>' +
    '</div>';
  $(".stage3d").appendChild(el);
  el.querySelector('[data-e="first"]').onclick = () => {
    // Step 1 is a CHOICE, so this opens the Diverter list rather than placing
    // one for you — the old button dropped the first rain shower in, which
    // both skipped the client's step 1 and picked their product for them.
    openGroup = RAIL_GROUPS[0].id; renderRail();
    const first = $(".cat-group.open .pcard .pc-main");
    if (first) first.focus();
  };
  el.querySelector('[data-e="set"]').onclick = () => autoArrange();
}

/* boot */
resize();
/* The camera was constructed at the landscape hero, before the canvas had a
   size to be measured. resize() has just measured it and set the field of view
   for it, so put the eye where THIS viewport's composition wants it — snapped
   rather than flown, because nobody should watch the room swing into place on
   open. Without this a phone loaded the wide-frame viewpoint and showed blank
   tile until something happened to re-frame it. */
camera.position.copy(heroPos());
controls.target.copy(heroTgt());
controls.update();
syncToolbar();
renderRail();
setBasin(true);   // vanity is part of the furnished room — shown by default
// ALWAYS open on a CLEAN furnished room: no demo auto-arrange AND no restore of a
// previous layout, so products never reappear on their own when the site is opened.
// The user adds fittings fresh each visit; the "Auto-arrange" button still drops
// the full demo shower set on demand, and "Clear" empties the room.
// Read the incoming link BEFORE clearing: clearAll() saves, and saving rewrites
// the address bar from the room's current (empty) state — which would wipe the
// very design the visitor arrived on.
const sharedHash = location.hash;
clearAll();       // wipe any stale saved layout so nothing is resurrected on open
// …unless the visitor arrived on a shared link. That is somebody deliberately
// sending this room, which is the one case where products SHOULD be waiting.
if (applyHash(sharedHash)) {
  toast("Opened a shared design");
  animateCam(heroPos(), heroTgt());
}

loop();
console.log("%cStout 3D Planner — build 3d7 (themed rooms)", "color:#c6a15b;font-weight:bold");
})();
