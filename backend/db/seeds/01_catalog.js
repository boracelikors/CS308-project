// SCRUM-21: deterministic development/test catalogue.
// ALL DATA HERE IS FICTIONAL DEMO DATA: serial numbers start with "DEMO-",
// distributors are invented, prices are not real retail offers.
//
// Safe to run repeatedly: rows are upserted by fixed ID, so a second run
// produces the same catalogue without duplicates. IDs 1-6 match the Sprint 1
// sample-products.json records (same names, prices and images).

const CATEGORIES = [
  { id: 1, name: "Speakers" },
  { id: 2, name: "Soundbars" },
  { id: 3, name: "Subwoofers" },
  { id: 4, name: "Microphones" },
  { id: 5, name: "Headphones" },
  { id: 6, name: "DJ Controllers" },
];

const DIST_A = "Anadolu Audio Distribution (fictional demo)";
const DIST_B = "Bosphorus Pro Sound Supply (fictional demo)";
const DIST_C = "Ege Studio Gear Imports (fictional demo)";

// Fixture notes (see DATABASE.md "Seed data"):
//   7  zero stock          8  one item left        10 fractional price
//   7 and 9 equal price    1  "beryllium" appears only in its description
const PRODUCTS = [
  // --- Sprint 1 products (IDs, names, prices and images unchanged) ---
  {
    id: 1, category_id: 1, name: "Reference Bookshelf Monitors (Pair)", model: "DB-RM2",
    serial_number: "DEMO-SPK-0001",
    description: "Hand-finished two-way bookshelf speakers with beryllium tweeters and a rigid aluminium cabinet for precise, uncoloured sound.",
    quantity_in_stock: 4, price: "89900.00", warranty_status: "3 years", distributor: DIST_A, image: "speaker.jpg",
  },
  {
    id: 2, category_id: 2, name: "Dolby Atmos 7.1.4 Soundbar", model: "DB-SB714",
    serial_number: "DEMO-SBR-0002",
    description: "Flagship soundbar with up-firing drivers, room calibration and HDMI eARC for immersive, cinema-grade audio at home.",
    quantity_in_stock: 6, price: "64900.00", warranty_status: "2 years", distributor: DIST_B, image: "soundbar.jpg",
  },
  {
    id: 3, category_id: 3, name: "12-Inch Sealed Reference Subwoofer", model: "DB-SUB12S",
    serial_number: "DEMO-SUB-0003",
    description: "Sealed-cabinet subwoofer with a 1000W amplifier and app-based room correction for deep, controlled bass.",
    quantity_in_stock: 5, price: "54900.00", warranty_status: "3 years", distributor: DIST_A, image: "subwoofer.jpg",
  },
  {
    id: 4, category_id: 4, name: "Large-Diaphragm Tube Condenser Microphone", model: "DB-MIC-T9",
    serial_number: "DEMO-MIC-0004",
    description: "Studio tube microphone with nine polar patterns and a dedicated power supply for warm, detailed vocal recordings.",
    quantity_in_stock: 8, price: "42900.00", warranty_status: "2 years", distributor: DIST_C, image: "microphone.jpg",
  },
  {
    id: 5, category_id: 5, name: "Planar Magnetic Open-Back Headphones", model: "DB-HP-PM1",
    serial_number: "DEMO-HPH-0005",
    description: "Audiophile open-back headphones with planar magnetic drivers, a wide soundstage and detachable balanced cables.",
    quantity_in_stock: 10, price: "49900.00", warranty_status: "2 years", distributor: DIST_C, image: "headphones.jpg",
  },
  {
    id: 6, category_id: 6, name: "4-Channel Professional DJ Controller", model: "DB-DJ4",
    serial_number: "DEMO-DJC-0006",
    description: "Club-standard 4-deck controller with high-resolution jog wheels, built-in effects and a professional audio interface.",
    quantity_in_stock: 3, price: "59900.00", warranty_status: "2 years", distributor: DIST_B, image: "dj-controller.jpg",
  },

  // --- Sprint 2 additions ---
  {
    id: 7, category_id: 2, name: "Compact Atmos 3.1.2 Soundbar", model: "DB-SB312",
    serial_number: "DEMO-SBR-0007",
    description: "Space-saving soundbar with a dedicated centre channel for clear dialogue and two up-firing drivers for height effects.",
    quantity_in_stock: 0, price: "24990.00", warranty_status: "2 years", distributor: DIST_B, image: "soundbar.jpg",
  },
  {
    id: 8, category_id: 1, name: "Three-Way Floorstanding Towers (Pair)", model: "DB-FT3",
    serial_number: "DEMO-SPK-0008",
    description: "Full-range tower speakers with dual 8-inch woofers and a ribbon tweeter, built for large listening rooms.",
    quantity_in_stock: 1, price: "149900.00", warranty_status: "5 years", distributor: DIST_A, image: "speaker.jpg",
  },
  {
    id: 9, category_id: 5, name: "Closed-Back Studio Reference Headphones", model: "DB-HP-CB7",
    serial_number: "DEMO-HPH-0009",
    description: "Isolating closed-back headphones with a flat response for tracking and mixing, plus a coiled studio cable.",
    quantity_in_stock: 12, price: "24990.00", warranty_status: "2 years", distributor: DIST_C, image: "headphones.jpg",
  },
  {
    id: 10, category_id: 3, name: "10-Inch Ported Subwoofer", model: "DB-SUB10P",
    serial_number: "DEMO-SUB-0010",
    description: "Front-ported subwoofer with a 400W amplifier, adjustable crossover and phase control for home theatre setups.",
    quantity_in_stock: 7, price: "18749.90", warranty_status: "2 years", distributor: DIST_A, image: "subwoofer.jpg",
  },
  {
    id: 11, category_id: 4, name: "Dynamic Broadcast Microphone", model: "DB-MIC-D7",
    serial_number: "DEMO-MIC-0011",
    description: "End-address dynamic microphone with an internal shock mount, made for podcasts, radio and streaming.",
    quantity_in_stock: 15, price: "9990.00", warranty_status: "2 years", distributor: DIST_C, image: "microphone.jpg",
  },
  {
    id: 12, category_id: 6, name: "Standalone All-in-One DJ System", model: "DB-DJX",
    serial_number: "DEMO-DJC-0012",
    description: "Four-deck standalone DJ system with a 10-inch touchscreen, Wi-Fi streaming and a built-in mixer; no laptop needed.",
    quantity_in_stock: 2, price: "119900.00", warranty_status: "2 years", distributor: DIST_B, image: "dj-controller.jpg",
  },
  {
    id: 13, category_id: 1, name: "Active Studio Monitors 8-Inch (Pair)", model: "DB-SM8",
    serial_number: "DEMO-SPK-0013",
    description: "Bi-amplified near-field monitors with room-placement switches and balanced XLR inputs for accurate mixing.",
    quantity_in_stock: 9, price: "37490.00", warranty_status: "3 years", distributor: DIST_C, image: "speaker.jpg",
  },
  {
    id: 14, category_id: 5, name: "Wireless Hi-Res Noise-Cancelling Headphones", model: "DB-HP-W2",
    serial_number: "DEMO-HPH-0014",
    description: "Over-ear wireless headphones with adaptive noise cancelling, LDAC hi-res streaming and 40 hours of battery life.",
    quantity_in_stock: 20, price: "17990.00", warranty_status: "2 years", distributor: DIST_B, image: "headphones.jpg",
  },
].map((p) => ({ currency: "TRY", ...p }));

exports.seed = async function (knex) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeds are for development and test databases only.");
  }
  await knex.transaction(async (trx) => {
    await trx("categories").insert(CATEGORIES).onConflict("id").merge();
    await trx("products").insert(PRODUCTS).onConflict("id").merge();
  });
};

exports.CATEGORIES = CATEGORIES;
exports.PRODUCTS = PRODUCTS;
