// POST /.netlify/functions/create-checkout-session
// Body: {items: [{price: "<lookup_key>", qty: 2}]} -> {url: "<Stripe Checkout URL>"}

const { stripe, json } = require("../lib/stripe");

const TEE_PAIR_DISCOUNT = 1000; // 2 tees = $50 instead of $60
const MAX_QTY_PER_ITEM = 10;

// TODO: replace with the client's real rates ( amounts are in cents, CAD).
const SHIPPING_OPTIONS = [
  {
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: "Pickup — North Vancouver, BC",
      fixed_amount: { amount: 0, currency: "cad" },
    },
  },
  {
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: "Shipping — Canada",
      fixed_amount: { amount: 1500, currency: "cad" },
    },
  },
  {
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: "Shipping — USA",
      fixed_amount: { amount: 2500, currency: "cad" },
    },
  },
];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST")
    return json(405, { error: "Method not allowed" });

  // read and clean the cart, never trust prices from the browser, only keys and quantities.
  let items;
  try {
    items = JSON.parse(event.body || "{}").items;
  } catch {
    return json(400, { error: "Invalid request." });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 50)
    return json(400, { error: "Your cart is empty." });

  const qtyByKey = new Map();
  for (const item of items) {
    const key = String(item.price || "");
    const qty = Math.floor(Number(item.qty));
    if (!/^[a-z0-9-]{1,200}$/.test(key) || !(qty >= 1))
      return json(400, { error: "Invalid item in cart." });
    qtyByKey.set(
      key,
      Math.min((qtyByKey.get(key) || 0) + qty, MAX_QTY_PER_ITEM),
    );
  }

  try {
    // look up the real prices in stripe (lookup_keys allows 10 per request).
    const keys = [...qtyByKey.keys()];
    const bykey = new Map();
    for (let i = 0; i < keys.length; i += 10) {
      const page = await stripe.prices.list({
        lookup_keys: keys.slice(i, i + 10),
        active: true,
        expand: ["data.product"],
      });
      page.data.forEach((p) => byKey.set(p.lookup_key, p));
    }
    // 3. check stock and build line items
    for (const [key, qty] of qtyByKey) {
      const price = byKey.get(key);
      if (!price || !price.product.active) {
        problems.push("An item in your cart is no longer available");
        continue;
      }
      const name = `${price.product.name} (${price.metadata.size || "One Size"})`;
      const stock = parseInt(price.metadata.stock, 10);
      if (!Number.isNaN(stock) && qty > stock) {
        problems.push(
          stock <= 0 ? `${name} is sold out` : `Only ${stock} left of ${name}`,
        );
        continue;
      }
      line_items.push({ price: price.id, quantity: qty });
      if (price.product.metadata.category === "tee") teeCount += qty;
    }
    if (problems.length) return json(409, { error: problems.join(". ") + "." });

    //  tee deal: $10 off for every 2 tees. A one-time coupon only this session can use.
    let discounts;
    const pairs = Math.floor(teeCount / 2);
    if (pairs > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: pairs * TEE_PAIR_DISCOUNT_CENTS,
        currency: "cad",
        duration: "once",
        max_redemptions: 1,
        name: "Tee deal: 2 for $50",
      });
      discounts = [{ coupon: coupon.id }];
    }

    // create the checkout session.
    const siteUrl = process.env.SITE_URL || process.env.URL; // netlify sets URL automatically
    const session = await stripe.checkout.sessions.create({
      // set in stripe checkout studio, use "hosted" instead if your stripe package is below v21.
      ui_mode: "hosted_page",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      allow_promotion_codes: false,
      submit_type: "auto",
      integration_identifier: "hosted_web_0002",
      origin_context: "web",

      mode: "payment",
      line_items,
      ...(discounts && { discounts }),
      shipping_address_collection: { allowed_countries: ["CA", "US"] },
      shipping_options: SHIPPING_OPTIONS,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60, // Stripe's minimum is 30 min
      success_url: `${siteUrl}/shop-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/shop.html`,
    });

    return json(200, { url: session.url });
  } catch (err) {
    console.error("checkout failed:", err.message);
    return json(500, {
      error:
        "Checkout couldn't start. Please try again or email rans@wcthoops.com.",
    });
  }
};
