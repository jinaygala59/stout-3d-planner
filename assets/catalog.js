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
  /* STOUT'S OWN FINISH NAMES (2026-09-11, asked for directly).
     These are not ours to invent. The factory states them in its own document
     for the new tooling — ~/stout-3d-models/"Stout Product 3D files"/NEW PRODUCT
     3D FILES.docx lists, per part: CHROME, ROSE GOLD, MATT BLACK, BRUSHED
     BRONZE, FRENCH GOLD, BRUSHED ROSE GOLD, GUN METAL, GUN GREY.
     Tying that to the folder's filename codes pins every one. ST-1040 settles
     it: it ships in exactly seven codes (CP BV CP FG GG MB RG) and carries
     exactly seven finishes here, so the correspondence is forced —
       CP -> chrome            Chrome
       RG -> roseGold          Rose Gold
       MB -> matteBlack        MATT Black, not "Matte"
       BRG -> brushedRoseGold  Brushed Rose Gold
       GG -> gunGrey           Gun Grey
       FG -> gold              FRENCH Gold   <- was "Gold"
       BV -> champagne         BRUSHED BRONZE <- was "Champagne", which is not
                               a name the factory uses at all
     Only the display NAME changes. The ids stay as they are: they key the
     artwork filenames, the share link and every saved design, and renaming one
     would strand rooms people have already sent. */
  gold:          { id: "gold",          name: "French Gold",            swatch: "linear-gradient(135deg,#f6de9b,#d4af37 52%,#a9832b)",             tone: "#d4af37" },
  matteBlack:    { id: "matteBlack",    name: "Matt Black",     swatch: "linear-gradient(135deg,#2b2b2e,#141416)",                        tone: "#1d1d20" },
  roseGold:      { id: "roseGold",      name: "Rose Gold",       swatch: "linear-gradient(135deg,#e6c1b6,#cf9184 55%,#b4756a)",             tone: "#cf9a8c" },
  /* THIS TABLE IS THE CLIENT'S RANGE, AND ONLY IT (2026-09-05).
     The Drive folder names every file by finish code — BG, BRG, BV, CP, FG, GG,
     MB, RG (some carry a trailing G: BVG, CPG, MBG, QHG, RGG) — which is eight
     colours, the eight below. Four others used to be defined here and are now
     gone, because a swatch a client can pick and the factory cannot ship is
     worse than no swatch at all:
       antiqueGold, brushedBronze  no product offered either; only the dead 2D
                                   scene presets still named them
       white                       never on any product
       brushedSteel                a mislabel, not a finish — the three Senza
                                   hand showers carried it, and their renders
                                   are plainly brushed rose gold, gun grey and
                                   champagne. They now say so, and their artwork
                                   is filed under those names.
     Before adding a finish here, find its code in the Drive filenames. */
  // added with the 2026-09 Drive range — these are real finishes in the
  // photography (filename codes BRG / BV / GG) that had no entry here
  brushedRoseGold:{id: "brushedRoseGold",name: "Brushed Rose Gold",swatch: "linear-gradient(135deg,#f0cfc2,#d7a291 55%,#b87d6c)",            tone: "#d9a794" },
  champagne:     { id: "champagne",     name: "Brushed Bronze",       swatch: "linear-gradient(135deg,#eee0c2,#d8c69c 55%,#b8a377)",             tone: "#d8c69c" },
  gunGrey:       { id: "gunGrey",       name: "Gun Grey",        swatch: "linear-gradient(135deg,#d5d6d2,#a9aaa5 52%,#7d7e7a)",             tone: "#a9aaa5" },
  /* POLISHED GOLD (2026-09-08, asked for directly: "this is the colour in all
     the showers instead of that typical yellow").
     `gold` is the folder's FG render, and on the overhead showers it is the
     typical yellow: its value is blown to 1.0 with a specular range of 0.47,
     so it reads as flat pale lemon rather than metal. The range's real gold is
     the deep warm one in the client's own renders of ST-C1001/C1002/C1008/C1010
     — hue 42.7 deg, saturation 0.40, value 0.87, specular range 0.92 — and
     these three stops are that render's own 15th, 50th and 90th luminance
     percentiles, so the swatch is the photograph's colour and not a guess.
     Offered on the showers only: tools_finish.py builds each SKU's artwork from
     that SKU's own neutral render against a curve fitted to the reference, and
     the four SKUs above simply wear the client's file. */
  polishedGold:  { id: "polishedGold",  name: "Polished Gold",   swatch: "linear-gradient(135deg,#f9e4b1,#d8bd7c 52%,#ba9c53)",             tone: "#d8bd7c" },
};
const ALL_FINISHES = Object.keys(FINISHES);
const CORE_FINISHES = ["chrome", "brushedGold", "gold", "matteBlack"];
// preferred display order (also decides each product's default finish)
// polishedGold sits after gold deliberately: FINISH_ORDER also decides a
// product's DEFAULT finish (buildProducts sorts by it), and putting a new
// colour any earlier would silently re-default half the catalogue.
const FINISH_ORDER = ["chrome", "gunGrey", "brushedGold", "champagne", "gold", "polishedGold", "roseGold", "brushedRoseGold", "matteBlack"];

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
  { code: "ST-C1012", cat: "rain-shower", name: "Cascada Square Rain Shower",  finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"],                                   badge: "Signature", variant: "waterfall blades + LED strips", functions: 3 },
  { code: "ST-C1013", cat: "rain-shower", name: "Cascada Slim Rain Shower",    finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "hex plate · 6 jets", functions: 2 },
  { code: "ST-C1014", cat: "rain-shower", name: "Cascada Grande Rain Shower",  finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "hex plate · LED strips", functions: 2 },
  { code: "ST-C1015", cat: "rain-shower", name: "Cascada Maxima Rain Shower",  finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "hex plate · LED strips + 5 jets", functions: 3 },
  { code: "ST-C1016", cat: "rain-shower", name: "Lumina Rain Shower",          finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold"], variant: "square plate · plain", functions: 1 },
  { code: "ST-C1017", cat: "rain-shower", name: "Lumina Edge Rain Shower",     finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold"], variant: "square plate · centre slot", functions: 2 },
  { code: "ST-C1018", cat: "rain-shower", name: "Lumina Matrix Rain Shower",   finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold"], variant: "square plate · 4 jets", functions: 2 },
  { code: "ST-C1019", cat: "rain-shower", name: "Aeon Rain Shower",            finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], badge: "Bestseller", variant: "wide plate · plain, slim edge", functions: 1 },
  // Added from the Stout asset library (2026-07-10) — descriptive names, rename to real SKU names anytime
  { code: "ST-C1001", cat: "rain-shower", name: "Cascada Rainfall Panel",      finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "wide plate · LED strip", functions: 2 },
  { code: "ST-C1002", cat: "rain-shower", name: "Cascada Slimline Panel",      finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "wide plate · 4 jets", functions: 2 },
  { code: "ST-C1003", cat: "rain-shower", name: "Cascada Waterfall Panel",     finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "slim plate · LED strip", functions: 2 },
  { code: "ST-C1004", cat: "rain-shower", name: "Cascada Duo Rainfall Panel",  finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "slim plate · 2 jets", functions: 2 },
  { code: "ST-C1007", cat: "rain-shower", name: "Lumina Slim Panel",           finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold"], variant: "slim plate · LED strip + 4 jets", functions: 3 },
  { code: "ST-C1008", cat: "rain-shower", name: "Cascada Compact Panel",       finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "wide plate · LED strip + 4 jets", functions: 3 },
  { code: "ST-C1010", cat: "rain-shower", name: "Cascada Grande Panel",        finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "wide plate · plain", functions: 1 },
  { code: "ST-C1011", cat: "rain-shower", name: "Cascada Maxima Panel",        finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "waterfall blades + LED + centre jet", functions: 4 },

  // ---- Concealed Diverter (single-lever) ----
  /* "Regale Concealed Diverter" was ours. The catalogue calls it TWO WAY
     DIVERTER (July 2026 edition, p35), which is also what its two outlets say,
     so the catalogue's word wins. */
  { code: "ST-D5017", cat: "diverter",    name: "Two-Way Diverter",            finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"],                                          badge: "Signature", variant: "square plate · single lever", outlets: 2 },

  /* ---- Thermostatic diverter panels, the whole D-series ----
     Codes, names, function counts and finishes are the client's STOUT July 2026
     catalogue (W.E.O 1st July 2026), read off the page each product sits on.
     That edition is the 2026 one re-priced: same 115 codes, nothing added or
     withdrawn, so nothing here is a guess about what the range now contains.

     The SERIES is the catalogue's own, printed top-left of the spread — AXORA
     (p1-8), VELTRO (p9-16), MANFRA (p25-30). Pages 17-24 carry D5012 and D5011
     under no series at all, so those two get none: an invented family word is
     how the old names ("Regale Grande Thermostatic Panel") stopped matching
     anything the client could look up.

     `outlets` is the page's own "PUSH BUTTON for N outlets" / "Control Unit For
     N Outlets" line — the number the valve budget spends, not the number of
     buttons on the plate. */
  { code: "ST-D5018", cat: "thermostatic", name: "Axora 6-Function Thermostatic Diverter",  finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "Bestseller", variant: "push button · flow control · Vernet cartridge", outlets: 6 },
  { code: "ST-D5019", cat: "thermostatic", name: "Axora 4-Function Thermostatic Diverter",  finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], variant: "push button · flow control · Vernet cartridge", outlets: 4 },
  { code: "ST-D5020", cat: "thermostatic", name: "Axora 3-Function Thermostatic Diverter",  finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], variant: "push button · flow control · Vernet cartridge", outlets: 3 },
  /* New 2026-09-16, from the July catalogue. Artwork is the factory's own
     studio photography lifted from the page with its own soft mask (see
     tools_july.py) — not keyed, not recoloured, not derived from a donor
     finish. Each of the six is then colour-checked against the same finish
     elsewhere in the range: rose gold lands 22-33 deg of hue against the
     range's 22.5, brushed rose gold 17-25 against 23, brushed bronze 34-40
     against 37, and chrome / gun grey / matt black read neutral, which is what
     catches a column read in the wrong order. */
  { code: "ST-D5021", cat: "thermostatic", name: "Veltro 6-Function Thermostatic Diverter", finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "push button · flow control · Vernet cartridge", outlets: 6 },
  { code: "ST-D5022", cat: "thermostatic", name: "Veltro 4-Function Thermostatic Diverter", finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "push button · flow control · Vernet cartridge", outlets: 4 },
  { code: "ST-D5012", cat: "thermostatic", name: "6-Function Thermostatic Diverter",        finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "twin dial · 6 buttons · flow control", outlets: 6 },
  { code: "ST-D5011", cat: "thermostatic", name: "4-Function Thermostatic Diverter",        finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "twin dial · 4 buttons · flow control", outlets: 4 },
  /* MANFRA is a tall plate, not a wide one: a lever under a digital readout of
     temperature and shower time. Filed with the panels because that is what it
     is on the wall — the wall control — and it is sized off its own artwork. */
  { code: "ST-D5015", cat: "thermostatic", name: "Manfra 3-Function Lever Diverter",        finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "single lever · push button · digital display", outlets: 3 },
  { code: "ST-D5016", cat: "thermostatic", name: "Manfra 4-Function Lever Diverter",        finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "single lever · push button · digital display", outlets: 4 },

  // ---- Wall-mounted BASIN MIXERS ----
  // Both of these were called "Wall Spout" here and neither is one: look at the
  // artwork. WM-001 carries two levers on its backplate, marked red and blue;
  // WM-002 carries a single lever. A backplate with a handle on it is a basin
  // tap, so they are filed as basin mixers and go over the basin — not on the
  // shower wall with the diverters, where a spout belongs.
  /* And the catalogue agrees, which settles the name: p85-88 head both pages
     WALL MOUNTED BASIN MIXER, with sizes 247x100x70 mm and 230x100x190 mm. The
     finish lists were also short — two of eight and three of seven — because
     only the Drive's renders were here; the missing ones are now the factory's
     own page photographs. The champagne WM-001 that WAS here was a corrupt
     file (a 900x578 sheet of magenta and cyan blocks, live on the site) and is
     replaced by the catalogue's brushed bronze render. */
  { code: "ST-WM-001", cat: "basin-mixer", name: "Wall Mounted Basin Mixer",   finishes: ["chrome","gunGrey","brushedGold","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "Signature", variant: "247 x 100 x 70 mm · brass · twin lever" },
  { code: "ST-WM-002", cat: "basin-mixer", name: "Wall Mounted Basin Mixer",   finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], variant: "230 x 100 x 190 mm · brass · single lever" },

  /* ---- MANFRA deck basin mixers, new 2026-09-16 from the July catalogue ----
     The catalogue gives these a code PER FINISH rather than per model (p77-82):
     p77 is one mixer in rose gold, matt black and chrome as ST-MN-005 / 007 /
     009, and p78 is the SAME mixer in french gold, brushed bronze and brushed
     gold as ST-MN-011 / 001 / 003. Six codes, one fitting. Filed the way
     ST-1019 already is — one row under the first code, the rest recorded in
     `variant` where the spec sheet still prints them. */
  { code: "ST-MN-005", cat: "basin-mixer", name: "Manfra Basin Mixer",        finishes: ["chrome","brushedGold","champagne","gold","roseGold","matteBlack"], badge: "New", variant: "178 mm · brass · ST-MN-005/007/009/011/001/003" },
  { code: "ST-MN-006", cat: "basin-mixer", name: "Manfra Tall Basin Mixer",   finishes: ["chrome","brushedGold","champagne","gold","roseGold","matteBlack"], badge: "New", variant: "290 mm · brass · ST-MN-006/008/010/012/002/004" },
  { code: "ST-MN-015", cat: "basin-mixer", name: "Manfra High Pillar Tap",    finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "290 mm · brass · pillar cock · ST-MN-013..019" },

  // ---- Thermostatic Control Trim (square dial) ----
  // Withdrawn from the list at the client's request (2026-09-05). It is left here
  // rather than deleted so it can come back with one edit if the range changes.
  // Its finish, brushedSteel, has since gone too — it was never in the range.
  // { code: "ST-TX-01", cat: "thermostatic", name: "Regale Thermostatic Control Trim", finishes: ["brushedSteel"] },

  // ---- Basin Mixers (tall vessel, single-lever) ----
  { code: "ST-BM-001", cat: "basin-mixer", name: "Aria Tall Basin Mixer",      finishes: ["chrome","roseGold"], badge: "Signature" },

  // ---- Hand Showers (handsets) — added from the Stout asset library 2026-07-10 ----
  { code: "ST-HS3211", cat: "hand-shower", name: "Aria Multi-Spray Hand Shower", finishes: ["chrome"],                                              badge: "New" },
  /* From the Drive folder's PHS5380CP — the one handset in it that had never
     been imported (PSH5230 and psh3211 sit alongside it and are FIXED heads,
     not handsets, so they are not filed here). Chrome is the only finish the
     folder carries of it. */
  { code: "ST-HS5380", cat: "hand-shower", name: "Aria Slim Hand Shower",       finishes: ["chrome"], variant: "round face · slim handle" },
  { code: "ST-1040",   cat: "hand-shower", name: "Aeon Multi-Function Hand Shower", finishes: ["chrome","gunGrey","gold","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "Bestseller" },
  { code: "ST-1018",   cat: "hand-shower", name: "Axis Hand Shower",            finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"] },
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
  /* THE NAMES BELOW ARE THE CATALOGUE'S, not ours (STOUT July 2026, p111-119).
     None of these jets carries a CODE line anywhere in the catalogue — the
     pages give a name, a size, a flow, a material, the finishes and the price
     and nothing else — so every code here stays a PLACEHOLDER until the
     factory confirms it. What the catalogue DOES settle is which jet is which,
     and two were filed wrong:

       p119 heads DANCING FUNCTION BODY JET and carries a second product in
       front of it, captioned "3 Function Body Jet", chrome only. The jet with
       the black oval face is the DANCING one — that is what ST-BJ3F's render
       shows — and the round-headed chrome jet beside it is the 3-function,
       which is ST-J06. They were the other way round.

     Matched to the pages by photograph: the rosette face is HYDRIX (p111), the
     dimple grid seen from the left is DUAL FUNCTION, rain and mist (p115), the
     nub grid seen from the right is SINGLE FUNCTION, rain (p117). */
  { code: "ST-BJ3F",  cat: "body-jet",    name: "Dancing Function Body Jet",  finishes: ["roseGold"], badge: "New", variant: "50 x 50 mm · brass · dancing flow" },
  { code: "ST-BJ-02", cat: "body-jet",    name: "Single Function Body Jet",   finishes: ["gunGrey","brushedGold","roseGold","matteBlack"], variant: "50 x 50 mm · brass · rain" },
  /* New 2026-09-16. The catalogue's CONCEALED BODY JET (p113/114), 130 x 120 x
     70.5 mm — a recessed brass box behind a flat square flange, which is a
     different fitting from the 16-jet panel this app files under ST-BJ-01.
     Seven finishes, all of them the factory's own photograph off the page
     (tools_july.py). ST-CBJ is a PLACEHOLDER code: the page prints none.
     It hangs as artwork rather than geometry because there is no OBJ for it in
     the client's RAR — which costs nothing here, since a flush plate lies in
     the wall plane and its render is already square-on. */
  { code: "ST-CBJ",   cat: "body-jet",    name: "Concealed Body Jet",         finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "130 x 120 mm · brass · flush recessed" },
  { code: "ST-1030",  cat: "rain-shower", name: "Aqua Square Rain Shower",     finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], defaultFinish: "matteBlack", variant: "square plate · waterfall blades + jets", functions: 3 },   // filed as a body jet; its render is a full overhead plate

  // ---- Wall Taps (single-lever wall bib tap) ----
  { code: "ST-SZ-01", cat: "wall-tap",    name: "Senza Wall Bib Tap",          finishes: ["chrome","matteBlack"],                                  badge: "New" },

  /* ---- TAPS, VALVES AND OUTLETS, new 2026-09-16 from the July catalogue ----
     p127-136. The two-way taps and the angle valves DO carry codes; the stop
     cock and the wall outlet do not, so those two are placeholders — the
     catalogue prints a name, a size, a material, the finishes and the price on
     those pages and no CODE line at all, the same gap the spouts and body jets
     have. QB-AC's code comes off the page as "-QB-AC-RG" on p133 and "QB-AC-MB"
     on p134; the leading hyphen is the text extractor, not the code. */
  { code: "MN-2W",   cat: "wall-tap", name: "Manfra 2-Way Tap",          finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "brass · wall two-way" },
  { code: "ST-QB",   cat: "wall-tap", name: "Axis 2-Way Tap",            finishes: ["chrome","champagne","gold","roseGold","matteBlack"], badge: "New", variant: "brass · square plate · wall two-way" },
  { code: "MN-AC",   cat: "wall-tap", name: "Manfra Angle Valve",        finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "brass · round body" },
  { code: "QB-AC",   cat: "wall-tap", name: "Axis Angle Valve",          finishes: ["chrome","champagne","gold","roseGold","matteBlack"], badge: "New", variant: "brass · square body" },
  { code: "ST-CSC",  cat: "wall-tap", name: "Concealed Stop Cock",       finishes: ["chrome","champagne","gold","roseGold","matteBlack"], badge: "New", variant: "200 mm · brass · round plate · code not in the catalogue" },
  { code: "ST-CWO",  cat: "wall-tap", name: "Concealed Wall Out-let",    finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "brass · outlet elbow + handset hook · code not in the catalogue" },

  /* ---- WASTES AND TRAPS, new 2026-09-16 (p137-140) ----
     Neither page prints a code. Both are basin fittings rather than wall ones,
     which is why the range had none: the old ST-TSQ / ST-TXSQ-01 rows below
     were pulled for exactly that reason. They go in because the client asked
     for the whole catalogue, and they are honest about where they sit — the
     waste drops into the basin, the trap hangs under it. */
  { code: "ST-PUW",   cat: "waste", name: "Pop Up Waste Coupling",  finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "125 mm · brass · code not in the catalogue" },
  { code: "ST-BTRAP", cat: "waste", name: "Bottle Trap",            finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "brass · 12\" + 6\" SS pipe · code not in the catalogue" },

  /* ---- HEALTH FAUCETS, new 2026-09-16 (p143-147) ----
     Three models, none of them coded. Each finish is photographed twice on the
     page — a front view and a side view leaning together — and the cutout keeps
     the front one, which is the view down the spray face. p148 and p149 carry
     four and three more, all chrome, distinguishable only by their photographs
     and with no code, name or size to tell them apart; those are left out until
     the factory names them. */
  { code: "ST-HFSEL", cat: "health-faucet", name: "Selora Health Faucet", finishes: ["chrome","gunGrey","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "ABS · 1 m SS tube & hook · code not in the catalogue" },
  { code: "ST-HFSQ",  cat: "health-faucet", name: "Square Health Faucet", finishes: ["gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "brass · 1 m SS tube & brass hook · code not in the catalogue" },
  { code: "ST-HFEST", cat: "health-faucet", name: "Estonia Health Faucet", finishes: ["chrome","gold","matteBlack"], badge: "New", variant: "ABS · 1 m tube & ABS hook · code not in the catalogue" },

  // ---- Basin Wastes (square pop-up) ----
  // REMOVED (not a washroom fitting): basin pop-up waste — a part that sits inside the basin, not a wall fitting
  // { code: "ST-TXSQ-01", cat: "waste",     name: "Regale Square Pop-up Waste",  finishes: ["chrome","brushedGold","gold","roseGold","matteBlack","antiqueGold","brushedBronze"] },

  // ============ Added from the Stout asset library (2026-07-10) — descriptive placeholder names ============
  // fixed shower heads / arms
  /* ---- THE REST OF THE OVERHEAD SHOWERS, new 2026-09-16 (p97-106) ----
     Seven more heads sit on those grid pages beside the four already here, four
     to a page with a code under each and nothing but the photograph to tell
     them apart — the page heading is the only name any of them gets, "ABS OVER
     HEAD SHOWER" or "BRASS OVER HEAD SHOWER". So the codes are the catalogue's
     and the names describe what the render shows, the same way ST-1027 and
     ST-1033 beside them already do.
     ST-1029 is the one that turned out not to need a placeholder: p103/104 show
     a brass square plate in five finishes with no code, p105 prints ST-1029-CP
     under the same plate in chrome — same proportions, same 9x9 jet grid — so
     all six are filed under the code the catalogue does give. */
  { code: "ST-1012",  cat: "rain-shower",  name: "Aeon Multi-Jet Shower Head",  finishes: ["chrome"], badge: "New", variant: "ABS · round · stepped hub", functions: 1 },
  { code: "ST-3014",  cat: "rain-shower",  name: "Aeon Swivel Shower Head",     finishes: ["chrome"], badge: "New", variant: "ABS · round · swivel joint", functions: 1 },
  { code: "ST-3016",  cat: "rain-shower",  name: "Aeon Domed Shower Head",      finishes: ["chrome"], badge: "New", variant: "ABS · round · domed hub", functions: 1 },
  { code: "ST-1023",  cat: "rain-shower",  name: "Aria Fine-Spray Shower Head", finishes: ["chrome"], badge: "New", variant: "ABS · round · plain face", functions: 1 },
  { code: "ST-1031",  cat: "rain-shower",  name: "Aria Spiral-Jet Shower Head", finishes: ["chrome"], badge: "New", variant: "ABS · round · spiral jet pattern", functions: 1 },
  { code: "ST-1022",  cat: "rain-shower",  name: "Aqua Oval Shower Head",       finishes: ["chrome","matteBlack"], badge: "New", variant: "ABS · oval · slim arm", functions: 1 },
  { code: "ST-1029",  cat: "rain-shower",  name: "Aqua Square Shower Head",     finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "brass · square plate · 9 x 9 jets", functions: 1 },
  { code: "ST-SOH",   cat: "rain-shower",  name: "SS304 Square Shower Head",    finishes: ["gold","roseGold","matteBlack"], badge: "New", variant: "SS304 · 150-400 mm · code not in the catalogue", functions: 1 },
  { code: "ST-1017",  cat: "rain-shower",  name: "Regale Wall Shower Head",     finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], functions: 1 },
  { code: "ST-1027",  cat: "rain-shower",  name: "Aeon Round Shower Head",      finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], functions: 1 },
  { code: "ST-1033",  cat: "rain-shower",  name: "Aeon Slim Round Head",        finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], functions: 1 },
  { code: "ST-OP1",   cat: "health-faucet",name: "Cascada Jet Spray Health Faucet", finishes: ["chrome"] },   // artwork is chrome — the -brushedGold file was mislabelled
  // more hand showers
  { code: "ST-1034",  cat: "hand-shower",  name: "Aeon Round Hand Shower",      finishes: ["chrome"] },
  /* All three were filed as "brushed steel", which is not a colour the factory
     makes: the Drive ships them as ST-1037/1038/1039-N0000, with no finish code
     in the name, so the code IS the finish. Look at the three renders and they
     are brushed rose gold, gun grey and champagne — three finishes the client
     really does sell. Relabelled, and their artwork renamed to match. */
  { code: "ST-1037",  cat: "hand-shower",  name: "Senza Rail Hand Shower",      finishes: ["brushedRoseGold"] },
  { code: "ST-1038",  cat: "hand-shower",  name: "Senza Hand Shower",           finishes: ["gunGrey"] },
  { code: "ST-1039",  cat: "hand-shower",  name: "Senza Slim Hand Shower",      finishes: ["champagne"] },
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
  { code: "ST-J06",   cat: "body-jet",     name: "3-Function Body Jet",          finishes: ["chrome"], variant: "50 x 50 mm · brass · round head" },
  // the one genuine spout in the range: a spout and a flange, no handle on it
  /* THE RANGE'S ONE SPOUT, IN EVERY COLOUR (2026-09-09, asked for directly).
     The Drive folder ships this spout in three finishes — gun grey, champagne
     and brushed rose gold — and it is now the only spout the planner offers. In
     a room locked to any of the other five its card greyed out with "Not made
     in Matte Black" and the client could not place a spout at all.
     The five missing ones are built by tools_finish.py from this spout's OWN
     gun-grey render, against a curve fitted per finish off ST-2513, the
     single-lever wall mixer: same Axis family, same square section, same studio
     set-up, and the folder ships it in seven of the eight. Brushed gold comes
     off ST-WM-001, the twin-lever wall tap, for the same reason.
     Checked on this SKU rather than a stand-in: ST-2513 also carries the three
     finishes the spout really ships, and regenerating those from the gun-grey
     render reproduces the folder's own photographs to within 2.2 deg of hue and
     0.01 of saturation (`tools_finish.py --spout-check`). Replace any of the
     five the day the factory sends a real render of it. */
  { code: "ST-PLAIN", cat: "bath-spout",   name: "Axis Plain Wall Spout",       finishes: ["chrome","gunGrey","brushedGold","champagne","gold","roseGold","brushedRoseGold","matteBlack"] },
  /* 2026-09-08, off the client's own upload. The Drive folder has it as
     SHOWER_ARM in six finishes — BRG / BV / FG / GG / MB / RG — and NO chrome,
     so chrome is not listed: a swatch the factory has not shot is worse than
     none (see the FINISHES note). Filed as `bath-spout` because that is the
     category the Spouts list is built from and the client asked for it there;
     it is a shower arm, so it takes a per-SKU mount high on the back wall
     rather than the category's filler height (see SKU3D in planner.js).
     ST-SARM is a PLACEHOLDER code until the real catalogue number arrives. */
  { code: "ST-SARM",  cat: "bath-spout",   name: "Axis Square Shower Arm",      finishes: ["gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "wall arm \u00b7 square section" },
  /* 2026-09-08, the client's second upload. Identified as the Drive group
     "2513" — and the identification is NOT certain: groups "54" and "53" are
     the same family and one of them is arguably a closer body shape. "2513" is
     what ships because it is the only one of the three the factory has shot in
     more than one colour (seven finishes, no brushed gold), and the client's
     instruction was that these come in the whole range. If it turns out to be
     the wrong one, the fix is this line plus its import_map entry — nothing
     else references it. Code from the folder's own name, as ST-AZBS was. */
  { code: "ST-2513",  cat: "bath-spout",   name: "Axis Single-Lever Wall Mixer", finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "square plate \u00b7 lever \u00b7 hand-shower outlet" },
  /* PLACEHOLDER ARTWORK, at the client's instruction ("use the plain spout for
     now"). This is the square spout with the cube diverter handle from their
     third upload; nothing in the 184-group Drive library matches it, so it
     borrows ST-PLAIN's renders via `art` until its own arrive. Consequences to
     undo on that day: drop `art`, and extend `finishes` — the list here is
     ST-PLAIN's three, not this product's real range, because a borrowed photo
     can only be shown in the colours the stand-in was shot in. */
  { code: "ST-BSDV",  cat: "bath-spout",   name: "Axis Wall Spout with Diverter", art: "ST-PLAIN", finishes: ["gunGrey","champagne","brushedRoseGold"], badge: "New", variant: "square spout \u00b7 cube diverter handle \u00b7 artwork pending" },
  // health faucet (new category)
  /* "gold" is dropped: ST-SS304-gold.png is a flat neon yellow (hue 56), not a
     finish the factory makes — every real gold in the range sits at hue 30-44.
     It was the only artwork in the whole set like it. */
  /* NOT `gold`. That render measures hue 55 deg at saturation 0.55 — a neon
     lemon, not a metal — and the client has struck it once before ("this colour
     doesn't exist, remove it"); it came back with a later import. It is the
     Polished Gold below that this plate is actually offered in. */
  { code: "ST-SS304", cat: "rain-shower",  name: "Aqua Square Rain Plate",          finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], badge: "New", variant: "square plate · square nozzles", functions: 1 },
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
  { code: "ST-FDP", cat: "rain-shower", name: "Cascada Flow Rain Panel", finishes: ["chrome","gunGrey","brushedGold","champagne","gold","polishedGold","roseGold","brushedRoseGold","matteBlack"], variant: "wide plate · centre waterfall slot", functions: 1 },
  { code: "ST-CP25", cat: "thermostatic", name: "Regale Digital Thermostatic Panel", finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], variant: "digital · dial + 4 function keys", outlets: 4 },
  { code: "ST-MB2", cat: "thermostatic", name: "Regale Smart Control Panel", finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], variant: "digital · dial + 4 function keys", outlets: 4 },
  { code: "ST-CJ1", cat: "thermostatic", name: "Regale Touch Control Panel", finishes: ["chrome","gunGrey","champagne","roseGold","matteBlack"], variant: "digital · dial + 6 function keys", outlets: 6 },
  /* The round concealed mixer the client sent on 2026-09-08. Its renders are the
     only ones in the Drive with no SKU in the filename — 55__1_ / 55__2_ for the
     rose gold and gold, AZBS1 / AZBS2 for the chrome and matte black — so the
     code is taken from the folder's own name for it rather than invented.
     The client says it ships in the whole range; the folder holds four of the
     eight, and a finish is only listed here when there is a photograph of the
     product in it. The other four go in the day their renders arrive. */
  { code: "ST-AZBS", cat: "diverter", name: "Regale Round Concealed Mixer", finishes: ["chrome","matteBlack","roseGold","gold"], variant: "round plate · single lever", badge: "New", outlets: 1 },
  // REMOVED at the client's request (16 Sep) — the round single-lever trim is
  // out of the range as offered here. Commented rather than deleted: its
  // renders are still in assets/products, so restoring it is this one line.
  // { code: "ST-D5001", cat: "diverter", name: "Regale Round Concealed Diverter", finishes: ["chrome"], variant: "round plate · single lever", outlets: 3 },
  { code: "ST-D5002", cat: "diverter", name: "Regale Square Lever Diverter", finishes: ["chrome"], variant: "square plate · single lever", outlets: 3 },
  { code: "ST-D5003", cat: "diverter", name: "Regale 3-Way Concealed Diverter", finishes: ["chrome"], variant: "square plate · 3 buttons", outlets: 3 },
  { code: "ST-D5004", cat: "diverter", name: "Regale 6-Function Diverter Plate", finishes: ["chrome","roseGold","matteBlack"], variant: "tall plate · dial + 6 buttons", outlets: 6 },
  /* These two read "2-Way" and "3-Way" here and neither is. The July 2026
     catalogue heads p40 THREE FUNCTION THERMOSTATIC DIVERTER, "With Control
     Unit For 3 Outlets", and p39 FOUR FUNCTION, "With Control Unit For 4
     Outlets" — which is what `outlets` already said, so only the names were
     wrong. Taken from the page. */
  { code: "ST-D5009", cat: "diverter", name: "3-Function Concealed Thermostat", finishes: ["chrome","roseGold","matteBlack"], variant: "tall plate · 3 outlets", outlets: 3 },
  { code: "ST-D5010", cat: "diverter", name: "4-Function Concealed Thermostat", finishes: ["chrome","roseGold","matteBlack"], variant: "tall plate · 4 outlets · 2 together", outlets: 4 },
  { code: "ST-BJ21F", cat: "body-jet", name: "Hydrix Body Jet", finishes: ["brushedRoseGold","champagne","chrome","gunGrey","matteBlack","roseGold"], variant: "50 x 50 mm · brass · rain rosette" },
  /* The folder shot this one in three. The other five are generated from its own
     chrome render by tools_finish.py (`--sku ST-2FBJ --write`), each through the
     curve measured off a REAL client render of that finish — so the jet wears
     the same gold/champagne/gun-grey as every other product in the room rather
     than an approximation of it: median hue lands within 0.8 deg of the same
     finish on ST-1017 / ST-1027 / ST-1030 / ST-1033. */
  { code: "ST-2FBJ", cat: "body-jet", name: "Dual Function Body Jet", finishes: ["chrome","gunGrey","brushedGold","champagne","gold","roseGold","brushedRoseGold","matteBlack"], variant: "50 x 50 mm · brass · rain and mist" },
  /* ===== STOUT 2026 catalogue, second pass (2026-09-12) =====================
     Added from the client's own PDF, and only in the four steps the rail
     offers: ceiling showers, diverters, spouts and hand showers. Every other
     family in that document — basins, kitchen mixers, taps, wastes, health
     faucets — was left out on the client's instruction, and anything already
     in the range above was skipped rather than duplicated.
     Artwork is lifted from the PDF's own studio renders (pure black ground,
     keyed to alpha), so these wear the factory's photography, not a recolour.
     `functions` on a ceiling shower is the PDF's "Requires N Input Supply
     Lines"; `outlets` on a diverter is its "Control Unit For N Outlets" — NOT
     the "N Function Can Be Operated Simultaneously" line, which is a different
     number on the same page.
     ------------------------------------------------------------------------ */
  { code: "ST-C1005", cat: "rain-shower", name: "Cascada Wide Ceiling Shower",   finishes: ["chrome"], variant: "550x450mm · rainfall, waterfall & mist", functions: 3 },
  { code: "ST-C1006", cat: "rain-shower", name: "Lumina Compact Ceiling Shower", finishes: ["chrome"], variant: "380x250mm · LED · rainfall, waterfall & mist", functions: 3 },
  { code: "ST-C1009", cat: "rain-shower", name: "Lumina Grand Ceiling Shower",   finishes: ["chrome"], variant: "700x450mm · LED · needs an electric point", functions: 4 },
  { code: "ST-C1020", cat: "rain-shower", name: "Cascada Powder Rain Ceiling Shower", finishes: ["chrome","gunGrey","champagne","roseGold","brushedRoseGold","matteBlack"], variant: "650x380mm · rain, rain-column, mist & powder-rain", functions: 4, badge: "New" },

  { code: "ST-D5008", cat: "diverter", name: "Regale Flow Control Diverter", finishes: ["chrome","roseGold","matteBlack"], variant: "thermostatic & volume · 3 outlets together", outlets: 3 },
  { code: "ST-D5014", cat: "diverter", name: "Regale Progressive Diverter",  finishes: ["chrome"], variant: "single lever · progressive cartridge", outlets: 4 },

  /* The PDF prints no code for either spout — the page carries the finishes and
     nothing else — so this one is filed as ST-BUTTON beside ST-PLAIN, which is
     the name the range already uses for the plain one. Confirm the real code
     with the client before it reaches an order. */
  { code: "ST-BUTTON", cat: "bath-spout", name: "Axis Button Wall Spout", finishes: ["chrome","gunGrey","champagne","gold","roseGold","brushedRoseGold","matteBlack"], variant: "150mm · brass · cube button", feedsHandset: true },

  /* ST-1019 / ST-1020 / ST-1021 are ONE handset. The client's catalogue gives a
     separate code per finish rather than per model — the three renders are the
     same square brass handset on the same bracket — so it is one row here and
     the per-finish codes ride in `variant`, where the spec sheet still prints
     them for the consultant. */
  { code: "ST-1019", cat: "hand-shower", name: "Aria Brass Hand Shower", finishes: ["gold","roseGold","matteBlack"], variant: "brass · ST-1019 french gold / ST-1020 rose gold / ST-1021 matt black" },
  { code: "ST-1011", cat: "hand-shower", name: "Aria Round Hand Shower",        finishes: ["chrome"], variant: "ABS · 1.5m tube & hook" },
  { code: "ST-1024", cat: "hand-shower", name: "Aria Single-Spray Hand Shower", finishes: ["chrome"], variant: "ABS · 1.5m tube & hook" },
  { code: "ST-1032", cat: "hand-shower", name: "Aria Sector-Spray Hand Shower", finishes: ["chrome"], variant: "ABS · 1.5m tube & hook" },
  { code: "ST-3015", cat: "hand-shower", name: "Aria Wide-Grip Hand Shower",    finishes: ["chrome"], variant: "ABS · 1.5m tube & hook" },
  { code: "ST-3017", cat: "hand-shower", name: "Aria Ribbed Hand Shower",       finishes: ["chrome"], variant: "ABS · 1.5m tube & hook" },
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
    /* `art` lets a SKU wear ANOTHER SKU's renders. It exists for a product the
       client has named but whose photography has not arrived: the card, the
       code and the name are real and the picture is borrowed, which is honest
       as long as the entry says so. A product with its own renders never sets
       it. Note the finish list is then limited to what the BORROWED art has —
       there is no file to show for a finish the stand-in was not shot in. */
    finishes.forEach(f => (images[f] = `assets/products/${rp.art || rp.code}-${f}.webp`));
    byCat[rp.cat].push({
      id: rp.code,
      catId: rp.cat,
      code: rp.code,
      name: rp.name,
      icon: cat.icon,          // SVG fallback silhouette if an image is missing
      images,                  // { finishId: pngPath }
      img: images[finishes[0]],
      finishes,
      /* The finish a product opens in. Normally the first one in FINISH_ORDER,
         but a row may name its own: adding Polished Gold to the showers would
         otherwise have re-defaulted ST-1030, whose only real render is the matte
         black one and whose gold is derived from it. A default should be the
         finish the client's own photograph shows. */
      defaultFinish: (rp.defaultFinish && finishes.includes(rp.defaultFinish)) ? rp.defaultFinish : finishes[0],
      badge: rp.badge || null,
      variant: rp.variant || null,   // what tells near-identical plates apart
      /* HOW MANY OUTLETS THE VALVE FEEDS — counted off each SKU's own render,
         not off its name. It is what decides how many fittings the room may
         hold once this valve is on the wall: a 3-function panel plumbs three
         things, and a planner that lets you draw six is drawing a bathroom
         nobody can install. Only the two valve categories carry it. */
      outlets: rp.outlets || null,
      /* A spout whose button diverts the flow on to a handset. The pair then
         spends ONE of the valve's outlets between them, not two — see
         outletCost in planner.js. */
      feedsHandset: rp.feedsHandset || false,
      /* HOW MANY OUTLETS A SHOWER SPENDS. Counted off each render (2026-09-12):
         the rain field is one, each waterfall slot or blade family is one, a
         ring of jet or mist nozzles is one — every spray zone on a Stout panel
         is a separate inlet, so a 3-function head is three ports off the valve.
         Only rain-shower carries it; every other outlet fitting (jets, spout,
         hand shower) spends one. Two readings are recorded as judgement calls:
         the long bars on C1001 / C1003 are taken as waterfall (the Drive names
         the twin-bar panels 瀑布 ×2), and ST-FDP is 1 because its render shows
         a plain grid whatever its variant text says.

         SUPERSEDED IN PART, 2026-09-12: the client's STOUT 2026 catalogue PDF
         states the real number on every ceiling shower page — "Requires N Input
         Supply Lines", beside a "Functions:" list — and on every diverter page
         as "Control Unit For N Outlets". That is the manufacturer's own figure
         and it outranks anything counted off a render, so seven values were
         corrected against it: C1011 3->4, C1013 3->2, C1014 3->2, and the
         diverters D5001 2->3, D5002 2->3, D5009 2->3, D5010 3->4. It also
         settles the two judgement calls above — C1001 and C1003 are listed
         "Rainfall & Waterfall", so the long bar IS a waterfall, not an LED.
         Read the PDF before changing any number here; do not re-count pixels.
         Watch for one trap in it: a diverter page also carries "N Function Can
         Be Operated Simultaneously", which is NOT the outlet count (D5010 is a
         FOUR-outlet valve whose page says two can run at once). */
      functions: rp.functions || null,
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
    finish: ["brushedGold", "champagne", "gold"],          // was antiqueGold + brushedBronze: out of range
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
    finish: ["brushedGold", "champagne", "gold"],          // was brushedBronze + antiqueGold: out of range
    place: { "rain-shower": { fx: 0.47, fy: 0.11, fw: 0.13 }, "thermostatic": { fx: 0.47, fy: 0.33, fw: 0.10 }, "diverter": { fx: 0.47, fy: 0.55, fw: 0.05 }, "bath-spout": { fx: 0.47, fy: 0.78, fw: 0.11 } },
    palette: { wall: "#2a2320", wall2: "#171210", floor: "#33291f", accent: "#b98b4e", niche: "#3a3025", glass: "#3a352c", vein: "#4a3b2c", shadow: "rgba(0,0,0,.5)" } },
];

/* expose to app.js (classic scripts share global scope) */
window.STOUT = { FINISHES, ALL_FINISHES, CORE_FINISHES, CATEGORIES, PRODUCTS, SCENES };
