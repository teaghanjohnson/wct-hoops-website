# Stripe Integration TODO

This is the single list of what's left before the shop can take real payments.

## Values to Replace

The following values are placeholders and must be updated before going live.

**Files containing placeholders:**
- [netlify/functions/create-checkout-session.js](netlify/functions/create-checkout-session.js)
- [scripts/seed-stripe-products.js](scripts/seed-stripe-products.js)
- [.env.example](.env.example) (copy to `.env`)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| mode | `payment` | Keep `payment`. Merch is a one-time charge. Only use `subscription` for recurring billing. |
| success_url | `${SITE_URL}/shop-success.html?session_id={CHECKOUT_SESSION_ID}` | Already points at the real success page. Keep the `{CHECKOUT_SESSION_ID}` template. |
| cancel_url | `${SITE_URL}/shop.html` | Already points at the shop page. |
| line_items[].price | Looked up in Stripe by each size's lookup key | Create one Price per product size in the client's Stripe account (see "Inventory rules"). |
| SHIPPING_OPTIONS | Pickup $0, Canada $15, USA $25 | The client's real shipping rates (amounts are in cents, CAD). |
| CATALOG stock counts | Placeholder counts (5 where the page didn't say) | The client's real stock per size, or set them in the Stripe dashboard afterwards. |
| STRIPE_SECRET_KEY | `sk_test_...` | Your test key while building. The client's `sk_live_...` key in Netlify at launch. |
| STRIPE_WEBHOOK_SECRET | `whsec_...` | From `stripe listen` locally, then the signing secret of the live webhook endpoint. |

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [netlify/functions/create-checkout-session.js](netlify/functions/create-checkout-session.js)

| Parameter | Value |
|-----------|-------|
| ui_mode | `hosted_page` (needs the `stripe` package v21 or newer; package.json pins ^23. Use `hosted` on older versions.) |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | `false` |
| submit_type | `auto` |
| integration_identifier | `hosted_web_0002` |
| origin_context | `web` |

`payment_method_collection` is left out on purpose because mode is `payment`.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and add your `sk_test_` key.
3. `npm run seed:test` creates every shop item in your Stripe test account.
4. `npx netlify dev` runs the site and the functions at http://localhost:8888
5. In a second terminal, install the Stripe CLI and run
   `stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook`.
   Paste the `whsec_...` it prints into `.env` and restart `netlify dev`.

## New files

```
netlify.toml                                publish site/, functions from netlify/functions
netlify/lib/stripe.js                       shared Stripe client and lookup-key helper
netlify/functions/inventory.js              GET  stock for every size
netlify/functions/create-checkout-session.js POST cart -> Stripe Checkout URL
netlify/functions/stripe-webhook.js         POST from Stripe after payment, lowers stock
site/assets/js/shop-cart.js                 size buttons, sold out state, cart drawer
site/assets/css/shop-cart.css               cart and sold out styles
site/assets/js/clear-cart.js                empties the cart on the success page
site/shop-success.html                      order confirmed page
scripts/seed-stripe-products.js             creates the products and prices (test or live)
.env.example                                env var names
```

## How it works

1. `shop.html` loads stock from `/.netlify/functions/inventory`. Sizes at 0, or missing from Stripe, are greyed out. A card with every size gone shows "Sold Out".
2. Tapping a size adds it to the cart (saved in the browser). The cart won't go past the stock left.
3. Checkout sends only lookup keys and quantities to `create-checkout-session`. The server re-checks stock, uses Stripe's prices (never the browser's), adds a one-time coupon for the tee deal ($10 off per pair of tees) and returns the Stripe Checkout URL.
4. The customer pays on Stripe's page and lands on `shop-success.html`.
5. Stripe calls `stripe-webhook`, which lowers `stock` on each price bought. The payment is marked so a repeated event can't lower stock twice.

## Inventory rules

- Each product size is one Price. Lookup key: `<slug of data-name>--<slug of size>`, e.g. `wct-hoops-tee-black--xl`.
- Price metadata: `size` (e.g. `XL`) and `stock` (e.g. `5`). No `stock` means unlimited.
- Product metadata: `category` = `tee`, `crew` or `socks`. Only tees count toward the tee deal.
- Restock by editing a Price's `stock` metadata in the dashboard. The site updates within about 30 seconds.
- If a product is renamed in `shop.html`, its lookup keys change too, so rename it in Stripe the same way.
- Two people buying the very last unit at the same moment can both pay. Rare at this volume; refund the second order.

## Known limits

- Pickup customers are still asked for a shipping address, because Stripe collects it before the shipping choice.
- All three shipping options show for every country, so a US customer could pick the Canada rate. Use one rate for both, or split checkout by country later.

## Testing

- Card `4242 4242 4242 4242`, any future date, any CVC, any postal code.
- `4000 0000 0000 9995` tests a declined card.
- Buy the last unit of a size, refresh the shop, and confirm it shows as sold out.
- Add two tees and confirm the $10 tee deal shows on the Stripe page.

## Going live

1. Publish the site first so the product photos are online. Update the stock counts in `scripts/seed-stripe-products.js` to the real numbers, put the client's `sk_live_` key in `.env`, run `npm run seed:live` and type `yes`. Then put the `sk_test_` key back in `.env`.
2. In Netlify > Site configuration > Environment variables, set `STRIPE_SECRET_KEY` (live) and `STRIPE_WEBHOOK_SECRET`.
3. In Stripe > Developers > Webhooks, add `https://wcthoops.com/.netlify/functions/stripe-webhook` with the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
4. Deploy with `npx netlify deploy --prod` (drag-and-drop doesn't deploy functions).
5. Do one real purchase and refund it.

## Next steps

- Confirm shipping rates and the tee-deal rules with the client.
- Turn on email notifications for successful payments in Stripe so WCT knows when to ship.
- Orders are listed under Payments in the Stripe dashboard. That's the order log for now.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
