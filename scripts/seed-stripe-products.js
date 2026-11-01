// creates every shop item in stripe so nobody has to build each price by hand
//
// testing (sandbox):  npm run seed:test   needs a test secret key (sk_test_) in .env
// launch day (live):  npm run seed:live   needs the client's live secret key (sk_live_) in .env
//                     and asks you to type yes before it creates anything
//
// it is safe to run again: any product whose sizes already exist in stripe is skipped, not duplicated.
// each product gets its photo from the live website, using the photo on its card in site/shop.html.
// after a live run, put the test key back in .env so the live key is not left on the laptop.

require("fs").existsSync(".env") && process.loadEnvFile?.(".env");
const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const Stripe = require("stripe");
const { keyFor } = require("../netlify/lib/stripe");

const live = process.argv.includes("--live");
const key = process.env.STRIPE_SECRET_KEY || "";
const wanted = live ? "sk_live_" : "sk_test_";
if (!key.startsWith(wanted)) {
  console.error(
    live
      ? "The live run needs the client's live secret key (sk_live_...) in .env as STRIPE_SECRET_KEY."
      : "Use a sk_test_ key. For the client's live account, run npm run seed:live instead."
  );
  process.exit(1);
}
const stripe = new Stripe(key);

// photos: stripe shows them on the checkout page. they load from the live site, so the shop page
// (and its photos) must already be published there. change the address below if the domain changes
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL || "https://wcthoops.com";
const shopHtml = fs.readFileSync(path.join(__dirname, "..", "site", "shop.html"), "utf8");
const photoFor = (name) => {
  for (const card of shopHtml.split('<div class="product-card"').slice(1)) {
    const n = card.match(/data-name="([^"]+)"/);
    const img = card.match(/data-img="([^"]+)"/);
    if (n && img && n[1] === name) return `${IMAGE_BASE_URL}/${img[1]}`;
  }
  return null;
};

// each name must match the product name on its card in site/shop.html exactly, punctuation included
// price is in dollars. stock is per size: zero means sold out.
// the counts are placeholders taken from what the shop page showed. before the live run,
// change them to the client's real numbers so every size starts out correct
const CATALOG = [
  { name: "WCT Hoops Tee — Black", category: "tee", price: 30, sizes: { S: 0, M: 5, L: 5, XL: 5 } },
  { name: "WCT Hoops Tee — Heather Grey", category: "tee", price: 30, sizes: { S: 5, M: 5, L: 5, XL: 5 } },
  { name: "Alumni Tee — Black", category: "tee", price: 30, sizes: { S: 5, M: 5, L: 5, XL: 5 } },
  { name: "Class of 2026 Tee — Black", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 5, XL: 5 } },
  { name: "College Style Tee — Navy", category: "tee", price: 30, sizes: { XS: 5, S: 5, M: 5, L: 5, XL: 5 } },
  { name: "College Style Tee — Olive", category: "tee", price: 30, sizes: { XS: 0, S: 5, M: 0, L: 5, XL: 5 } },
  { name: "College Style Tee — Purple", category: "tee", price: 30, sizes: { XS: 0, S: 5, M: 5, L: 5, XL: 5 } },
  { name: "College Style Tee — White", category: "tee", price: 30, sizes: { XS: 0, S: 5, M: 0, L: 5, XL: 5 } },
  { name: "Build While You Fly Tee — Black", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 5, XL: 5 } },
  { name: "Kente Logo Tee — Ash Grey", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 0, XL: 1 } },
  { name: "Kente Logo Tee — White", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 0, XL: 1 } },
  { name: "OG Logo Tee — Dreadlock Silhouette", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 1, XL: 0 } },
  { name: "Fundys Over Everything Tee — Royal Blue", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 2, XL: 0 } },
  { name: "Simple Things At A High Level Tee — Yellow", category: "tee", price: 30, sizes: { S: 0, M: 1, L: 5, XL: 0 } },
  { name: "Esoteric 23.3.20 Tee — Yellow (Side Logo)", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 5, XL: 0 } },
  { name: "Esoteric 23.3.20 Tee — Yellow (Middle Logo)", category: "tee", price: 30, sizes: { S: 5, M: 5, L: 5, XL: 0 } },
  { name: "Esoteric 23.3.20 Tee — Purple (Middle Logo)", category: "tee", price: 30, sizes: { S: 0, M: 5, L: 5, XL: 0 } },
  { name: "Work Creates Transformation Crew Neck — Black", category: "crew", price: 50, sizes: { S: 0, M: 0, L: 5, XL: 5 } },
  { name: "Work Creates Transformation Crew Neck — Ash Grey", category: "crew", price: 50, sizes: { S: 0, M: 1, L: 0, XL: 0, "Youth XL": 1 } },
  { name: "WCT Logo Socks — Black", category: "socks", price: 20, sizes: { "One Size": 5 } },
];

(async () => {
  console.log(`Stripe account: ${live ? "LIVE (real money)" : "test sandbox"}`);
  console.log(`Products to create: ${CATALOG.length}`);

  // the live run stops here until you type yes
  if (live) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Create these products in the LIVE account? Type "yes" to continue: ');
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("Stopped. Nothing was created.");
      return;
    }
  }

  let created = 0;
  let skipped = 0;
  for (const item of CATALOG) {
    const keys = Object.keys(item.sizes).map((size) => keyFor(item.name, size));

    // skip a product that is already there, so a second run never makes duplicates
    const existing = await stripe.prices.list({ lookup_keys: keys.slice(0, 10), limit: 10 });
    if (existing.data.length > 0) {
      console.log(`skip  ${item.name} (already in stripe)`);
      skipped++;
      continue;
    }

    const photo = photoFor(item.name);
    if (!photo) console.log(`note  ${item.name} has no photo on its shop card`);
    const product = await stripe.products.create({
      name: item.name,
      metadata: { category: item.category },
      ...(photo ? { images: [photo] } : {}),
    });
    for (const [size, stock] of Object.entries(item.sizes)) {
      const lookup_key = keyFor(item.name, size);
      await stripe.prices.create({
        product: product.id,
        currency: "cad",
        unit_amount: Math.round(item.price * 100),
        nickname: `${item.name} — ${size}`,
        lookup_key,
        transfer_lookup_key: true,
        metadata: { size, stock: String(stock) },
      });
      console.log(`${lookup_key}  stock ${stock}`);
    }
    created++;
  }
  console.log(`Done. ${created} created, ${skipped} skipped. Check Product catalogue in the Stripe dashboard (${live ? "live" : "sandbox"}).`);
  if (live) console.log("Now put the sk_test_ key back in .env.");
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
