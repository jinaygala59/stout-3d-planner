/* =============================================================================
   STOUT SANITARYWARE — PRODUCT CATALOG (REAL products)
   -----------------------------------------------------------------------------
   Products are the real Stout renders extracted from the supplied PSD files and
   cut out to transparent PNGs in assets/products/  (see tools/build_assets note).
   Only shower-area products are included (rain showers, diverters, thermostatic
   valves, bath spouts). Basin faucets / wastes were intentionally excluded.

   To add a product: drop its cutout PNGs in assets/products/ named
   <CODE>-<finishId>.png and add a row to RAW_PRODUCTS below. The UI adapts.
   ========================================================================== */

/* ---- FINISHES (metal tones) ---------------------------------------------- */
const FINISHES = {
  chrome:        { id: "chrome",        name: "Chrome",          swatch: "linear-gradient(135deg,#f4f6f8,#c2c8ce 45%,#8f979e 55%,#e8ebee)", tone: "#c9ced3" },
  brushedGold:   { id: "brushedGold",   name: "Brushed Gold",    swatch: "linear-gradient(135deg,#e7cd92,#c39b4e 55%,#a67c30)",             tone: "#c6a15b" },
  gold:          { id: "gold",          name: "Gold",            swatch: "linear-gradient(135deg,#f6de9b,#d4af37 52%,#a9832b)",             tone: "#d4af37" },
  matteBlack:    { id: "matteBlack",    name: "Matte Black",     swatch: "linear-gradient(135deg,#2b2b2e,#141416)",                        tone: "#1d1d20" },
  roseGold:      { id: "roseGold",      name: "Rose Gold",       swatch: "linear-gradient(135deg,#e6c1b6,#cf9184 55%,#b4756a)",             tone: "#cf9a8c" },
  // NOT IN THE CLIENT'S RANGE. The Drive folder's filenames use eight finish
  // codes — BG, BRG, BV, CP, FG, GG, MB, RG — and neither antique gold nor
  // brushed bronze is among them. No product offers either any more; these two
  // stay defined only because the legacy 2D scene data below still names them.
  // Do not put either on a product.
  antiqueGold:   { id: "antiqueGold",   name: "Antique Gold",    swatch: "linear-gradient(135deg,#cdb079,#a9863f 55%,#7f6229)",             tone: "#b08d57" },
  brushedBronze: { id: "brushedBronze", name: "Brushed Bronze",  swatch: "linear-gradient(135deg,#b79877,#8c6a4a 55%,#5f4630)",             tone: "#8c6a4a" },
  brushedSteel:  { id: "brushedSteel",  name: "Brushed Steel",   swatch: "linear-gradient(135deg,#eaeef1,#b9c0c6 50%,#8b9298,#e2e6e9)",     tone: "#b9c0c6" },
  white:         { id: "white",         name: "White",           swatch: "linear-gradient(135deg,#ffffff,#eef1f2 55%,#d9dde0)",             tone: "#f2f4f5" },
  // added with the 2026-09 Drive range — these are real finishes in the
  // photography (filename codes BRG / BV / GG) that had no entry here
  brushedRoseGold:{id: "brushedRoseGold",name: "Brushed Rose Gold",swatch: "linear-gradient(135deg,#f0cfc2,#d7a291 55%,#b87d6c)",            tone: "#d9a794" },
  champagne:     { id: "champagne",     name: "Champagne",       swatch: "linear-gradient(135deg,#eee0c2,#d8c69c 55%,#b8a377)",             tone: "#d8c69c" },
  gunGrey:       { id: "gunGrey",       name: "Gun Grey",        swatch: "linear-gradient(135deg,#d5d6d2,#a9aaa5 52%,#7d7e7a)",             tone: "#a9aaa5" },
};
const ALL_FINISHES = Object.keys(FINISHES);
const CORE_FINISHES = ["chrome", "brushedGold", "gold", "matteBlack"];
// preferred display order (also decides each product's default finish)
const FINISH_ORDER = ["chrome", "brushedSteel", "gunGrey", "brushedGold", "champagne", "gold", "roseGold", "brushedRoseGold", "matteBlack", "antiqueGold", "brushedBronze", "white"];

/* ---- CATEGORIES ----------------------------------------------------------
   `anchor` = where a selected product composites onto the scene photo.
   Coordinates are FRACTIONS OF THE PHOTO (0..1), so they land on the same wall
   feature no matter the viewport size (app.js coverMap mirrors object-fit:cover):
     fx, fy = product CENTRE as a fraction of the photo (0=left/top, 1=right/bottom)
     fw     = product width as a fraction of the photo width
   One sensible default per product type (tuned to the shower-wall scenes); a
   scene may override via SCENES[].place using the same {fx,fy,fw} shape.
   -------------------------------------------------------------------------- */
// Fixed "shower column": overhead on top → thermostatic → concealed diverter
// → bath spout at the bottom, all centred (fx 0.50). Scenes may fine-tune via place.
const CATEGORIES = [
  { id: "rain-shower",  name: "Overhead / Rain Showers", icon: "rainshower", anchor: { fx: 0.50, fy: 0.13, fw: 0.16 } },
  { id: "thermostatic", name: "Thermostatic Diverters",  icon: "diverter",   anchor: { fx: 0.50, fy: 0.46, fw: 0.11 } },
  { id: "diverter",     name: "Concealed Diverters",     icon: "diverter",   anchor: { fx: 0.50, fy: 0.60, fw: 0.055 } },
  { id: "bath-spout",   name: "Bath Spouts",             icon: "spout",      anchor: { fx: 0.50, fy: 0.72, fw: 0.12 } },
  { id: "basin-mixer",  name: "Basin Mixers",            icon: "spout",      anchor: { fx: 0.55, fy: 0.70, fw: 0.12 } },
  { id: "hand-shower",  name: "Hand Showers",            icon: "spout",      anchor: { fx: 0.72, fy: 0.58, fw: 0.09 } },
  { id: "body-jet",     name: "Body Jets",               icon: "diverter",   anchor: { fx: 0.74, fy: 0.46, fw: 0.13 } },
  { id: "wall-tap",     name: "Wall Taps",               icon: "spout",      anchor: { fx: 0.62, fy: 0.55, fw: 0.11 } },
  { id: "health-faucet",name: "Health Faucets",          icon: "spout",      anchor: { fx: 0.30, fy: 0.60, fw: 0.09 } },
  { id: "waste",        name: "Basin Wastes",            icon: "spout",      anchor: { fx: 0.60, fy: 0.82, fw: 0.05 } },
];

/* ---- REAL PRODUCTS -------------------------------------------------------
   finishes list must match the PNG files present in assets/products/.
   -------------------------------------------------------------------------- */
/* NOTE (2026-09-02) — seven rows were re-filed because their artwork did not match
   the category/name they carried, so the planner mounted (and labelled) them as
   something they are not. Each was re-filed to match WHAT THE PRODUCT PHOTO SHOWS:
     ST-TSQ    was "Axis Square Wall Spout"  → photo is a pop-up waste
     ST-J06    was "Axis Angular Spout"      → photo is a round wall body jet
     ST-SZ1    was "Push-Click Pop-up Waste" → photo is a wall bib tap
     ST-SS304  was "Aqua Health Faucet"      → photo is a square overhead rain plate
     ST-MN-AC  was "Monaco Basin Mixer"      → photo is an angle valve / stop cock
     ST-JF1    was "Jazz Wall Bath Mixer"    → photo is a square-flange angle valve
     ST-OB-D94 was "Orbit Tall Basin Mixer"  → photo is a pull-out sink mixer
     ST-OP1    was "Cascada Compact Rain Head" → photo is a trigger jet-spray handset
   The names above are DESCRIPTIVE placeholders: either the name or the image file
   is wrong for these codes — confirm against the Stout price list and correct
   whichever is off. */
const RAW_PRODUCTS = [
  // ---- Overhead / Rain Showers (C-series) ----
  { code: "ST-C1012", cat: "rain-shower", name: "Cascada Square Rain Shower",  finishes: ["gunGrey","brushedRoseGold"],                                   badge: "Signature", variant: "waterfall blades + LED strips" },
  { code: "ST-C1013", cat: "rain-shower", name: "Cascada Slim Rain Shower",    finishes: ["gunGrey","brushedRoseGold"], variant: "hex plate · 6 jets" },
  { code: "ST-C1014", cat: "rain-shower", name: "Cascada Grande Rain Shower",  finishes: ["gunGrey","brushedRoseGold"], variant: "hex plate · LED strips" },
  { code: "ST-C1015", cat: "rain-shower", name: "Cascada Maxima Rain Shower",  finishes: ["gunGrey","brushedRoseGold"], variant: "hex plate · LED strips + 5 jets" },
  { code: "ST-C1016", cat: "rain-shower", name: "Lumina Rain Shower",          finishes: ["chrome"], variant: "square plate · plain" },
  { code: "ST-C1017", cat: "rain-shower", name: "Lumina Edge Rain Shower",     finishes: ["chrome"], variant: "square plate · centre slot" },
  { code: "ST-C1018", cat: "rain-shower", name: "Lumina Matrix Rain Shower",   finishes: ["chrome"], variant: "square plate · 4 jets" },
  { code: "ST-C1019", cat: "rain-shower", name: "Aeon Rain Shower",            finishes: ["chrome","gunGrey","gold","roseGold","brushedRoseGold","matteBlack"], badge: "Bestseller", variant: "wide plate · plain, slim edge" },
  // Added from the Stout asset library (2026-07-10) — descriptive names, rename to real SKU names anytime
  { code: "ST-C1001", cat: "rain-shower", name: "Cascada Rainfall Panel",      finishes: ["gunGrey","gold","roseGold","brushedRoseGold","matteBlack"], variant: "wide plate · LED strip" },
  { code: "ST-C1002", cat: "rain-shower", name: "Cascada Slimline Panel",      finishes: ["gunGrey","gold","roseGold","brushedRoseGold","matteBlack"], variant: "wide plate · 4 jets" },
  { code: "ST-C1003", cat: "rain-shower", name: "Cascada Waterfall Panel",     finishes: ["chrome","gunGrey","gold","roseGold","brushedRoseGold","matteBlack"], variant: "slim plate · LED strip" },
  { code: "ST-C1004", cat: "rain-shower", name: "Cascada Duo Rainfall Panel",  finishes: ["chrome","gunGrey","gold","roseGold","brushedRoseGold","matteBlack"], variant: "slim plate · 2 jets" },
  { code: "ST-C1007", cat: "rain-shower", name: "Lumina Slim Panel",           finishes: ["chrome"], variant: "slim plate · LED strip + 4 jets" },
  { code: "ST-C1008", cat: "rain-shower", name: "Cascada Compact Panel",       finishes: ["gunGrey","gold","roseGold","brushedRoseGold","matteBlack"], variant: "wide plate · LED strip + 4 jets" },
  { code: "ST-C1010", cat: "rain-shower", name: "Cascada Grande Panel",        finishes: ["gunGrey","gold","roseGold","brushedRoseGold","matteBlack"], variant: "wide plate · plain" },
  { code: "ST-C1011", cat: "rain-shower", name: "Cascada Maxima Panel",        finishes: ["gunGrey","brushedRoseGold"], variant: "waterfall blades + LED + centre jet" },

  // ---- Concealed Diverter (single-lever) ----
  { code: "ST-D5017", cat: "diverter",    name: "Regale Concealed Diverter",   finishes: ["brushedRoseGold"],                                          badge: "Signature" },

  // ---- Thermostatic Diverter panels (D-series) ----
  { code: "ST-D5018", cat: "thermostatic", name: "Regale Grande Thermostatic Panel", finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "Bestseller" },
  { code: "ST-D5019", cat: "thermostatic", name: "Regale Thermostatic Panel",        finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"] },
  { code: "ST-D5020", cat: "thermostatic", name: "Regale Compact Thermostatic Panel",finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"] },

  // ---- Wall-mounted BASIN MIXERS ----
  // Both of these are called "Wall Spout" in the range and neither is one: look
  // at the artwork. WM-001 carries two levers on its backplate, marked red and
  // blue; WM-002 carries a single lever. A backplate with a handle on it is a
  // basin tap, so they are filed as basin mixers and go over the basin — not on
  // the shower wall with the diverters, where a spout belongs. The names are the
  // client's own catalogue names, so they stay as they are.
  { code: "ST-WM-001", cat: "basin-mixer", name: "Axis Wall Spout",            finishes: ["brushedGold","champagne"],                          badge: "Signature" },
  { code: "ST-WM-002", cat: "basin-mixer", name: "Axis Slim Wall Spout",       finishes: ["gunGrey","champagne","brushedRoseGold"] },

  // ---- Thermostatic Control Trim (square dial) ----
  { code: "ST-TX-01", cat: "thermostatic", name: "Regale Thermostatic Control Trim", finishes: ["brushedSteel"] },

  // ---- Basin Mixers (tall vessel, single-lever) ----
  { code: "ST-BM-001", cat: "basin-mixer", name: "Aria Tall Basin Mixer",      finishes: ["chrome","roseGold"], badge: "Signature" },

  // ---- Hand Showers (handsets) — added from the Stout asset library 2026-07-10 ----
  { code: "ST-HS3211", cat: "hand-shower", name: "Aria Multi-Spray Hand Shower", finishes: ["chrome"],                                              badge: "New" },
  { code: "ST-1040",   cat: "hand-shower", name: "Aeon Multi-Function Hand Shower", finishes: ["chrome","gunGrey","gold","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "Bestseller" },
  { code: "ST-1018",   cat: "hand-shower", name: "Axis Hand Shower",            finishes: ["chrome","gunGrey","champagne","brushedRoseGold"] },
  { code: "ST-1025",   cat: "hand-shower", name: "Cascada Slim Hand Shower",    finishes: ["chrome"] },
  { code: "ST-1026",   cat: "hand-shower", name: "Cascada Square Hand Shower",  finishes: ["chrome"] },
  { code: "ST-1028",   cat: "hand-shower", name: "Cascada Round Hand Shower",   finishes: ["chrome"] },
  { code: "ST-1035",   cat: "hand-shower", name: "Lumina Hand Shower",          finishes: ["chrome"] },
  { code: "ST-1036",   cat: "hand-shower", name: "Lumina Edge Hand Shower",     finishes: ["chrome"] },

  // ---- Body Jets ----
  // NOT IN THE CLIENT'S DRIVE FOLDER — no file in it names this SKU, so it
  // is not part of the range and must not be offered. Checked against all
  // 533 filenames. Restore the line if a render for it ever arrives.
  // { code: "ST-BJ-01", cat: "body-jet",    name: "Aqua 16-Jet Body Panel",      finishes: ["chrome"],                                               badge: "New" },
  // NOT IN THE CLIENT'S DRIVE FOLDER — no file in it names this SKU, so it
  // is not part of the range and must not be offered. Checked against all
  // 533 filenames. Restore the line if a render for it ever arrives.
  // { code: "ST-BJ-02", cat: "body-jet",    name: "Aqua Single-Flow Body Jet",   finishes: ["brushedGold"] },
  { code: "ST-1030",  cat: "rain-shower", name: "Aqua Square Rain Shower",     finishes: ["matteBlack"], variant: "square plate · waterfall blades + jets" },   // filed as a body jet; its render is a full overhead plate

  // ---- Wall Taps (single-lever wall bib tap) ----
  { code: "ST-SZ-01", cat: "wall-tap",    name: "Senza Wall Bib Tap",          finishes: ["chrome","matteBlack"],                                  badge: "New" },

  // ---- Basin Wastes (square pop-up) ----
  // REMOVED (not a washroom fitting): basin pop-up waste — a part that sits inside the basin, not a wall fitting
  // { code: "ST-TXSQ-01", cat: "waste",     name: "Regale Square Pop-up Waste",  finishes: ["chrome","brushedGold","gold","roseGold","matteBlack","antiqueGold","brushedBronze"] },

  // ============ Added from the Stout asset library (2026-07-10) — descriptive placeholder names ============
  // fixed shower heads / arms
  { code: "ST-1017",  cat: "rain-shower",  name: "Regale Wall Shower Head",     finishes: ["gold","roseGold","matteBlack"] },
  { code: "ST-1027",  cat: "rain-shower",  name: "Aeon Round Shower Head",      finishes: ["chrome"] },
  { code: "ST-1033",  cat: "rain-shower",  name: "Aeon Slim Round Head",        finishes: ["chrome"] },
  { code: "ST-OP1",   cat: "health-faucet",name: "Cascada Jet Spray Health Faucet", finishes: ["chrome"] },   // artwork is chrome — the -brushedGold file was mislabelled
  // more hand showers
  { code: "ST-1034",  cat: "hand-shower",  name: "Aeon Round Hand Shower",      finishes: ["chrome"] },
  { code: "ST-1037",  cat: "hand-shower",  name: "Senza Rail Hand Shower",      finishes: ["brushedSteel"] },
  { code: "ST-1038",  cat: "hand-shower",  name: "Senza Hand Shower",           finishes: ["brushedSteel"] },
  { code: "ST-1039",  cat: "hand-shower",  name: "Senza Slim Hand Shower",      finishes: ["brushedSteel"] },
  // basin mixers / taps
  // REMOVED (not a washroom fitting): angle valve — a concealed plumbing stopcock, not a visible fitting (it reads as a door handle in the rail)
  // { code: "ST-MN-AC", cat: "wall-tap",     name: "Monaco Angle Valve",          finishes: ["chrome","brushedGold","gold","roseGold","matteBlack","antiqueGold"], badge: "New" },
  // REMOVED (not a washroom fitting): pull-out KITCHEN sink mixer, not a bathroom product
  // { code: "ST-OB-D94",cat: "basin-mixer",  name: "Orbit Pull-out Sink Mixer",      finishes: ["chrome","matteBlack","brushedSteel"] },
  // REMOVED (not a washroom fitting): angle valve — same: plumbing hardware, nothing to place on a bathroom wall
  // { code: "ST-JF1",   cat: "wall-tap",     name: "Jazz Square Angle Valve",        finishes: ["chrome"] },
  // wall spouts
  // REMOVED (not a washroom fitting): basin pop-up waste — same
  // { code: "ST-TSQ",   cat: "waste",        name: "Axis Pop-up Waste",      finishes: ["chrome","brushedGold","gold","roseGold","matteBlack","antiqueGold","brushedBronze"] },
  { code: "ST-J06",   cat: "body-jet",     name: "Axis Round Body Jet",          finishes: ["chrome"] },
  // the one genuine spout in the range: a spout and a flange, no handle on it
  { code: "ST-PLAIN", cat: "bath-spout",   name: "Axis Plain Wall Spout",       finishes: ["gunGrey","champagne","brushedRoseGold"] },
  // health faucet (new category)
  /* "gold" is dropped: ST-SS304-gold.png is a flat neon yellow (hue 56), not a
     finish the factory makes — every real gold in the range sits at hue 30-44.
     It was the only artwork in the whole set like it. */
  { code: "ST-SS304", cat: "rain-shower",  name: "Aqua Square Rain Plate",          finishes: ["gold","roseGold","matteBlack"], badge: "New", variant: "square plate · square nozzles" },
  // waste
  { code: "ST-SZ1",   cat: "wall-tap",     name: "Senza Bib Tap",     finishes: ["chrome"] },
  // concealed thermostatic panels
  // NOT IN THE CLIENT'S DRIVE FOLDER — no file in it names this SKU, so it
  // is not part of the range and must not be offered. Checked against all
  // 533 filenames. Restore the line if a render for it ever arrives.
  // { code: "ST-TD3",   cat: "thermostatic", name: "Regale 3-Outlet Thermostat",  finishes: ["chrome"] },
  // NOT IN THE CLIENT'S DRIVE FOLDER — no file in it names this SKU, so it
  // is not part of the range and must not be offered. Checked against all
  // 533 filenames. Restore the line if a render for it ever arrives.
  // { code: "ST-TD4",   cat: "thermostatic", name: "Regale 4-Outlet Thermostat",  finishes: ["brushedBronze"] },

  /* ---- 2026-09 Drive range: showers, diverters, spouts and body jets, each
     with the full set of finishes from the factory photography ---- */
  { code: "ST-FDP", cat: "rain-shower", name: "Cascada Flow Rain Panel", finishes: ["chrome","gunGrey","champagne","brushedRoseGold","matteBlack"], variant: "wide plate · centre waterfall slot" },
  { code: "ST-CP25", cat: "thermostatic", name: "Regale Digital Thermostatic Panel", finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], variant: "digital · dial + 4 function keys" },
  { code: "ST-MB2", cat: "thermostatic", name: "Regale Smart Control Panel", finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], variant: "digital · dial + 6 function keys" },
  { code: "ST-CJ1", cat: "thermostatic", name: "Regale Touch Control Panel", finishes: ["chrome","gunGrey","champagne","roseGold","matteBlack"], variant: "digital · touch keys + temp dial" },
  { code: "ST-D5001", cat: "diverter", name: "Regale Round Concealed Diverter", finishes: ["chrome"], variant: "round plate · single lever" },
  { code: "ST-D5002", cat: "diverter", name: "Regale Square Lever Diverter", finishes: ["chrome"], variant: "square plate · single lever" },
  { code: "ST-D5003", cat: "diverter", name: "Regale 3-Way Concealed Diverter", finishes: ["chrome"], variant: "square plate · 3 buttons" },
  { code: "ST-D5004", cat: "diverter", name: "Regale 5-Button Diverter Plate", finishes: ["chrome","roseGold","matteBlack"], variant: "tall plate · dial + 5 buttons" },
  { code: "ST-D5009", cat: "diverter", name: "Regale 2-Way Concealed Thermostat", finishes: ["chrome","roseGold","matteBlack"], variant: "tall plate · 2 outlets" },
  { code: "ST-D5010", cat: "diverter", name: "Regale 3-Way Concealed Thermostat", finishes: ["chrome","gold","matteBlack"], variant: "tall plate · 3 outlets" },
  { code: "ST-BJ21F", cat: "body-jet", name: "Aqua Square Concealed Body Jet", finishes: ["brushedRoseGold","champagne","chrome","gunGrey","matteBlack","roseGold"], variant: "square escutcheon · single jet" },
  { code: "ST-2FBJ", cat: "body-jet", name: "Aqua Micro-Jet Body Spray", finishes: ["chrome","matteBlack","roseGold"], variant: "square plate · multi micro-jet" },
];

/* ---- build PRODUCTS map keyed by category -------------------------------- */
function buildProducts() {
  const byCat = {};
  CATEGORIES.forEach(c => (byCat[c.id] = []));
  RAW_PRODUCTS.forEach(rp => {
    const cat = CATEGORIES.find(c => c.id === rp.cat);
    const finishes = rp.finishes.slice().sort((a, b) => FINISH_ORDER.indexOf(a) - FINISH_ORDER.indexOf(b));
    const images = {};
    // WebP: the source renders are ~200-550 KB each as PNG-24 and 20-30 KB as
    // WebP at q0.9 — 23 MB down to 2.4 MB across the catalogue. The PNGs stay in
    // the repo as the masters; only the WebP copies ship.
    finishes.forEach(f => (images[f] = `assets/products/${rp.code}-${f}.webp`));
    byCat[rp.cat].push({
      id: rp.code,
      catId: rp.cat,
      code: rp.code,
      name: rp.name,
      icon: cat.icon,          // SVG fallback silhouette if an image is missing
      images,                  // { finishId: pngPath }
      img: images[finishes[0]],
      finishes,
      defaultFinish: finishes[0],
      badge: rp.badge || null,
      variant: rp.variant || null,   // what tells near-identical plates apart
    });
  });
  return byCat;
}
const PRODUCTS = buildProducts();

/* ---- BATHROOM SCENE PRESETS (6 luxurious tones) --------------------------
   `img`    = photorealistic backdrop (hyper-real photography, Unsplash — see
              assets/scenes/CREDITS.txt). Products composite on top at anchors.
   `palette`= colours still used for the scene-strip swatch + accent tinting.
   -------------------------------------------------------------------------- */
const SCENES = [
  { id: "alabaster", name: "Alabaster",        tone: "light", img: "assets/scenes/alabaster.jpg",  desc: "Calacatta marble & soft daylight", ar: 1.4995,
    finish: ["brushedGold", "gold", "chrome"],
    place: { "rain-shower": { fx: 0.50, fy: 0.13, fw: 0.16 }, "thermostatic": { fx: 0.50, fy: 0.46, fw: 0.11 }, "diverter": { fx: 0.50, fy: 0.60, fw: 0.055 }, "bath-spout": { fx: 0.50, fy: 0.72, fw: 0.12 } },
    palette: { wall: "#efe9e0", wall2: "#e4ddd1", floor: "#d9d1c4", accent: "#c6a15b", niche: "#f5f1ea", glass: "#eef1f2", vein: "#cdbfa8", shadow: "rgba(70,55,30,.18)" } },
  { id: "travertine", name: "Sunlit Travertine", tone: "light", img: "assets/scenes/travertine.jpg", desc: "Sunlit travertine & brushed brass", ar: 1.4995,
    finish: ["brushedGold", "antiqueGold", "brushedBronze", "gold"],
    place: { "rain-shower": { fx: 0.50, fy: 0.13, fw: 0.16 }, "thermostatic": { fx: 0.50, fy: 0.46, fw: 0.11 }, "diverter": { fx: 0.50, fy: 0.60, fw: 0.055 }, "bath-spout": { fx: 0.50, fy: 0.72, fw: 0.12 } },
    palette: { wall: "#e7dccb", wall2: "#dccbb2", floor: "#c9a877", accent: "#b98b4e", niche: "#efe7d8", glass: "#eaf0ee", vein: "#c4a983", shadow: "rgba(80,55,25,.2)" } },
  { id: "pearl", name: "Azure Marble",         tone: "light", img: "assets/scenes/pearl.jpg",      desc: "Blue-grey marble & warm brass", ar: 1.4995,
    finish: ["brushedGold", "gold", "chrome"],
    place: { "rain-shower": { fx: 0.50, fy: 0.13, fw: 0.16 }, "thermostatic": { fx: 0.50, fy: 0.46, fw: 0.11 }, "diverter": { fx: 0.50, fy: 0.60, fw: 0.055 }, "bath-spout": { fx: 0.50, fy: 0.72, fw: 0.12 } },
    palette: { wall: "#dbe4f0", wall2: "#c2d1e6", floor: "#b7c6de", accent: "#b98b4e", niche: "#e6ecf5", glass: "#e3ebf5", vein: "#aebfd8", shadow: "rgba(30,45,75,.2)" } },
  { id: "graphite", name: "Graphite Noir",     tone: "dark", img: "assets/scenes/graphite.jpg",    desc: "Black marble & brushed gold", ar: 1.4995,
    finish: ["gold", "brushedGold", "matteBlack"],
    place: { "rain-shower": { fx: 0.50, fy: 0.13, fw: 0.16 }, "thermostatic": { fx: 0.50, fy: 0.46, fw: 0.11 }, "diverter": { fx: 0.50, fy: 0.60, fw: 0.055 }, "bath-spout": { fx: 0.50, fy: 0.72, fw: 0.12 } },
    palette: { wall: "#26282c", wall2: "#141518", floor: "#2c2e33", accent: "#c6a15b", niche: "#303338", glass: "#3a4046", vein: "#3a3d42", shadow: "rgba(0,0,0,.5)" } },
  { id: "emerald", name: "Emerald Nocturne",   tone: "dark", img: "assets/scenes/emerald.jpg",     desc: "Forest-green marble & matte black", ar: 1.0,
    finish: ["gold", "brushedGold", "matteBlack"],
    place: { "rain-shower": { fx: 0.50, fy: 0.14, fw: 0.12 }, "thermostatic": { fx: 0.50, fy: 0.32, fw: 0.09 }, "diverter": { fx: 0.50, fy: 0.50, fw: 0.045 }, "bath-spout": { fx: 0.50, fy: 0.66, fw: 0.10 } },
    palette: { wall: "#173028", wall2: "#0d1a13", floor: "#1a2b22", accent: "#cbb06a", niche: "#243b33", glass: "#2c423b", vein: "#3c5b4d", shadow: "rgba(0,0,0,.5)" } },
  { id: "espresso", name: "Espresso Walnut",   tone: "dark", img: "assets/scenes/espresso.jpg",    desc: "Dark stone, walnut & warm bronze", ar: 1.4995,
    finish: ["brushedBronze", "antiqueGold", "brushedGold", "gold"],
    place: { "rain-shower": { fx: 0.47, fy: 0.11, fw: 0.13 }, "thermostatic": { fx: 0.47, fy: 0.33, fw: 0.10 }, "diverter": { fx: 0.47, fy: 0.55, fw: 0.05 }, "bath-spout": { fx: 0.47, fy: 0.78, fw: 0.11 } },
    palette: { wall: "#2a2320", wall2: "#171210", floor: "#33291f", accent: "#b98b4e", niche: "#3a3025", glass: "#3a352c", vein: "#4a3b2c", shadow: "rgba(0,0,0,.5)" } },
];

/* expose to app.js (classic scripts share global scope) */
window.STOUT = { FINISHES, ALL_FINISHES, CORE_FINISHES, CATEGORIES, PRODUCTS, SCENES };
