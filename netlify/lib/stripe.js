const Stripe = require("stripe");

//no api needed, using stripe secret key directly in serverless function
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Must match slug() in shop-cart exactly
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const keyFor = (sku, size) => `${slug(sku)}--${slug(size)}`;

const json = (statusCode, body, headers = {}) => ({
   statusCode,
   headers: {"Content-Type": "application/json", ...headers},
   body: JSON.stringify(body),
});

module.exports = {stripe, slug, keyFor, json};

