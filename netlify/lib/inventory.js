// GET /.netlify/functions/inventory  ->  { stock: { "<lookup_key>": number | null } }
// null = no stock number set on that price, so it never sells out

const { stripe, json } = require("../lib/stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET")
    return json(405, { error: "Method not allowed" });
  try {
    const stock = {};
    for await (const price of stripe.prices.list({
      active: true,
      limit: 100,
    })) {
      if (!price.lookup_key) continue;
      const n = parseInt(price.metadata.stock, 10);
      stock[price.lookup_key] = Number.isNaN(n) ? null : n;
    }
    return json(200, { stock }, { "Cache-Control": "public, max-age=30" });
  } catch (err) {
    console.error("inventory failed:", err.message);
    return json(500, { error: "Could not load stock" });
  }
};
