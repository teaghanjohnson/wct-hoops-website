const Stripe = require("stripe");

// no api version passed on purpose, so stripe uses the account's default
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// must match slug() in shop-cart.js exactly
const slug = (t) =>
  String(t)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const keyFor = (sku, size) => `${slug(sku)}--${slug(size)}`;

const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

module.exports = { stripe, slug, keyFor, json };
