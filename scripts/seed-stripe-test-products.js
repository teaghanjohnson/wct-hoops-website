// creates every shop item in a stripe test account so you don't build each price by hand
// run with: npm run seed:test (reads STRIPE_SECRET_KEY from .env)
// refuses to run with a live key

require("fs").existsSync(".env") && process.loadEnvFile?.(".env");
const Stripe = require("stripe");
const { keyFor } = require("../netlify/lib/stripe");

const key = process.env.STRIPE_SECRET_KEY || "";
if (!key.startsWith("sk_test_")) {
  console.error("Use a sk_test_ key. This script only runs against a Stripe test account.");
  process.exit(1);
}
const stripe = new Stripe(key);

// name must match data-name in site/shop.html exactly, dashes included
// price is in dollars. stock is per size: zero means sold out, and the counts are placeholders
// taken from what the shop page showed, so confirm the real numbers with the client
const CATALOG = [
  { name: "WCT Hoops Tee — Black", category: "tee", price: 30, sizes: { S: 0, M: 5, L: 5, XL: 5 } },
  { name: "WCT Hoops Tee — Heather Grey", category: "tee", price: 30, sizes: { S: 5, M: 5, L: 5, XL: 5 } },
  { name: "Alumni Tee — Black", category: "tee", price: 30, sizes: { S: 5, M: 5, L: 5, XL: 5 } },
  { name: "Class of 2026 Tee — Black", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 5, XL: 5 } },
  { name: "WCT Classic Camp Tee — Blue (Yr 2)", category: "tee", price: 30, sizes: { S: 5, M: 5, L: 5, XL: 5 } },
  { name: "College Style Tee — Navy", category: "tee", price: 30, sizes: { XS: 5, S: 5, M: 5, L: 5, XL: 5 } },
  { name: "College Style Tee — Olive", category: "tee", price: 30, sizes: { XS: 0, S: 5, M: 0, L: 5, XL: 5 } },
  { name: "College Style Tee — Purple", category: "tee", price: 30, sizes: { XS: 0, S: 5, M: 5, L: 5, XL: 5 } },
  { name: "College Style Tee — White", category: "tee", price: 30, sizes: { XS: 0, S: 5, M: 0, L: 5, XL: 5 } },
  { name: "Build While You Fly Tee — Black", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 5, XL: 5 } },
  { name: "Kente Logo Tee — Ash Grey", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 0, XL: 1 } },
  { name: "Kente Logo Tee — White", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 0, XL: 1 } },
  { name: "OG Logo Tee — Dreadlock Silhouette", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 1, XL: 0 } },
  { name: "WCT x BUBBLE24 Winter Camp Tee — Coach", category: "tee", price: 30, sizes: { S: 0, M: 0, L: 1, XL: 0 } },
  { name: "WCT x BUBBLE24 Winter Camp Tee — Simple Things", category: "tee", price: 30, sizes: { S: 1, M: 0, L: 0, XL: 0 } },
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
  for (const item of CATALOG) {
    const product = await stripe.products.create({
      name: item.name,
      metadata: { category: item.category },
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
  }
  console.log("Done. Check Product catalog in the Stripe dashboard (test mode).");
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
