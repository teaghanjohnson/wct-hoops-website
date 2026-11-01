// stock: the shop page calls this to find out which sizes are still in stock.
// it reads the stock number saved on each price in stripe.
// get /.netlify/functions/inventory
// returns { stock: { "<lookup_key>": count or null } } for every active price
// null means no stock is set on that price, so it never sells out

const { stripe, json } = require("../lib/stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  try {
    const stock = {};
    for await (const price of stripe.prices.list({ active: true, limit: 100 })) {
      if (!price.lookup_key) continue;
      const n = parseInt(price.metadata.stock, 10);
      stock[price.lookup_key] = Number.isNaN(n) ? null : n;
    }
    // short cache so a sold out item shows up within half a minute
    return json(200, { stock }, { "Cache-Control": "public, max-age=30" });
  } catch (err) {
    console.error("inventory failed:", err.message);
    return json(500, { error: "Could not load stock." });
  }
};
