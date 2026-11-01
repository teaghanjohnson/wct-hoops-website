// payment received: stripe calls this on netlify's servers after a customer pays.
// it needs the webhook signing secret saved in netlify's environment variables.
// lowers the stock on each price that was bought

const { stripe } = require("../lib/stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  // signature check needs the exact raw body stripe sent
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64")
    : event.body;
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      raw,
      event.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.log("Webhook signature verification failed.", err.message);
    return { statusCode: 400, body: "Bad signature" };
  }

  try {
    const type = stripeEvent.type;
    if (
      type === "checkout.session.completed" ||
      type === "checkout.session.async_payment_succeeded"
    ) {
      const session = stripeEvent.data.object;
      if (session.payment_status === "paid") await reduceStock(session);
    }
    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("webhook handling failed:", err.message);
    return { statusCode: 500, body: "error" }; // stripe will retry
  }
};

async function reduceStock(session) {
  // stripe can send the same event more than once, so mark the payment once stock is updated
  const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
  if (pi.metadata.stock_reduced === "true") return;

  const items = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
  });
  for (const item of items.data) {
    const price = await stripe.prices.retrieve(item.price.id);
    const stock = parseInt(price.metadata.stock, 10);
    if (Number.isNaN(stock)) continue; // no stock tracking on this item
    const left = Math.max(stock - item.quantity, 0);
    await stripe.prices.update(price.id, { metadata: { stock: String(left) } });
    if (left === 0) console.log(`SOLD OUT: ${price.lookup_key}`);
  }

  await stripe.paymentIntents.update(pi.id, {
    metadata: { stock_reduced: "true" },
  });
}
