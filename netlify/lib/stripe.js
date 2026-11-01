// shared stripe setup used by the server functions.
// the secret key comes from netlify's environment variables (or .env when testing), never from this file
const Stripe = require("stripe");

// no api version passed on purpose, so stripe uses the account's default
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// turns a product name and size into the lookup key stripe uses, like wct hoops tee black plus xl.
// must match the slug function in the shop cart script (site/assets/js) exactly
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
