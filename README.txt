WCT Hoops website

WHAT'S WHERE
- site/                 the website itself (html, images, css, js). This is what Netlify publishes.
- netlify/functions/    server code for the shop: stock lookup, Stripe checkout, Stripe webhook.
- netlify/lib/          shared Stripe setup used by the functions.
- scripts/              one-time helper that creates the shop items in a Stripe test account.
- STRIPE_INTEGRATION_TODO.md   everything still to set up for payments.

TO PUBLISH
Drag-and-drop deploys no longer work, because the shop needs server functions.
From this folder in a terminal:
  npm install
  npx netlify login
  npx netlify link        (pick the WCT Hoops site, first time only)
  npx netlify deploy --prod
Or connect the site to its GitHub repo in Netlify so every push deploys on its own.

TO EDIT
- Text: the .html files in site/ (coaches.html, alumni.html, contact.html).
- Shop items, prices and stock: the Stripe dashboard (Product catalog). Each size is its own price.
  Change a size's "stock" metadata to restock it. 0 shows as sold out on the site.
- Photos: site/assets/img (keep the same file names, or update the name in the .html file)
- Colours and fonts: site/assets/css/style.css

KEYS
Stripe keys live in Netlify > Site configuration > Environment variables, never in the files.
For local testing they go in a .env file (see .env.example). Never commit .env.

SOCIAL: only Instagram is linked (https://www.instagram.com/wcthoops/). Search the .html files for instagram.com to change it.
The contact form only works on Netlify (turn on Forms > form detection, and add a notification email).
