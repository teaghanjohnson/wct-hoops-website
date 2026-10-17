// wct shop cart: size chips add to the cart, stock comes from stripe, checkout goes to stripe
(function () {
  "use strict";

  var CART_KEY = "wctCart";
  var LOW_STOCK = 3; // show how many are left once a size gets this low
  var TEE_PAIR_DISCOUNT = 10; // display only, the server applies the real discount

  // must match slug() in netlify/lib/stripe.js exactly
  function slug(t) {
    return String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function keyFor(sku, size) { return slug(sku) + "--" + slug(size); }
  function money(n) { return "$" + n.toFixed(2); }

  var cart = load();
  var stock = {};

  function load() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; } }
  function save() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} }

  // cart button, drawer and toast
  var toggle = document.createElement("button");
  toggle.className = "cart-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-controls", "cartPanel");
  document.body.appendChild(toggle);

  var panel = document.createElement("aside");
  panel.className = "cart-panel";
  panel.id = "cartPanel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Your cart");
  panel.innerHTML =
    '<div class="cart-head"><h3>Your Cart</h3><button type="button" class="cart-close" aria-label="Close cart">&times;</button></div>' +
    '<div class="cart-lines"></div>' +
    '<div class="cart-foot">' +
      '<div class="cart-row"><span>Subtotal</span><span class="cart-subtotal"></span></div>' +
      '<div class="cart-row cart-deal" hidden><span>Tee deal</span><span class="cart-savings"></span></div>' +
      '<p class="cart-note">Shipping or free pickup is chosen at checkout.</p>' +
      '<p class="cart-error" role="alert"></p>' +
      '<button type="button" class="btn btn-solid cart-checkout">Checkout &rarr;</button>' +
    "</div>";
  document.body.appendChild(panel);

  var toast = document.createElement("div");
  toast.className = "cart-toast";
  toast.setAttribute("role", "status");
  document.body.appendChild(toast);

  var linesEl = panel.querySelector(".cart-lines");
  var errorEl = panel.querySelector(".cart-error");
  var checkoutBtn = panel.querySelector(".cart-checkout");

  function openCart(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    render();
  }
  toggle.addEventListener("click", function () { openCart(panel.hidden); });
  panel.querySelector(".cart-close").addEventListener("click", function () { openCart(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) openCart(false); });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }

  // turn each size chip into a button that adds that size to the cart
  var chips = [];
  document.querySelectorAll(".product-card").forEach(function (card) {
    var name = card.dataset.name;
    var sku = card.dataset.sku || name;
    card.querySelectorAll(".size-chip").forEach(function (span) {
      var size = span.dataset.size || span.textContent.replace(/\(\d+\s*left\)/i, "").trim();
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "size-chip";
      btn.textContent = size;
      btn.dataset.key = keyFor(sku, size);
      btn.dataset.size = size;
      btn.dataset.name = name;
      btn.dataset.price = card.dataset.price;
      btn.dataset.category = card.dataset.category;
      btn.disabled = true; // turned on once stock loads
      btn.setAttribute("aria-label", "Add " + name + ", size " + size + " to cart");
      btn.addEventListener("click", function () { add(btn); });
      span.replaceWith(btn);
      chips.push(btn);
    });
  });

  function available(key) { return Object.prototype.hasOwnProperty.call(stock, key); }
  function left(key) { return stock[key]; } // a count, or null when stock isn't tracked
  function inCart(key) {
    var l = cart.find(function (x) { return x.key === key; });
    return l ? l.qty : 0;
  }

  function paintChips() {
    chips.forEach(function (btn) {
      var key = btn.dataset.key;
      var n = left(key);
      var soldOut = !available(key) || n === 0;
      btn.disabled = soldOut;
      btn.classList.toggle("sold", soldOut);
      btn.textContent = btn.dataset.size + (!soldOut && n !== null && n <= LOW_STOCK ? " (" + n + " left)" : "");
      btn.setAttribute("aria-label", soldOut
        ? btn.dataset.name + ", size " + btn.dataset.size + ", sold out"
        : "Add " + btn.dataset.name + ", size " + btn.dataset.size + " to cart");
    });
    document.querySelectorAll(".product-card").forEach(function (card) {
      var all = card.querySelectorAll(".size-chip");
      var allSold = all.length > 0 && Array.prototype.every.call(all, function (b) { return b.disabled; });
      card.classList.toggle("is-sold-out", allSold);
    });
  }

  function add(btn) {
    var key = btn.dataset.key;
    var n = left(key);
    if (n !== null && inCart(key) >= n) {
      showToast("That's all we have in " + btn.dataset.size);
      return;
    }
    var line = cart.find(function (x) { return x.key === key; });
    if (line) line.qty += 1;
    else cart.push({
      key: key, name: btn.dataset.name, size: btn.dataset.size,
      price: Number(btn.dataset.price), category: btn.dataset.category, qty: 1,
    });
    save();
    render();
    showToast("Added " + btn.dataset.name + " (" + btn.dataset.size + ")");
  }

  function changeQty(key, delta) {
    var line = cart.find(function (x) { return x.key === key; });
    if (!line) return;
    var n = left(key);
    if (delta > 0 && n !== null && line.qty >= n) return;
    line.qty += delta;
    if (line.qty <= 0) cart = cart.filter(function (x) { return x.key !== key; });
    save();
    render();
  }

  function render() {
    var count = cart.reduce(function (s, l) { return s + l.qty; }, 0);
    toggle.textContent = "Cart (" + count + ")";
    toggle.hidden = count === 0 && panel.hidden;

    linesEl.innerHTML = "";
    if (!cart.length) linesEl.innerHTML = '<p class="cart-empty">Your cart is empty. Tap a size to add it.</p>';
    cart.forEach(function (l) {
      var row = document.createElement("div");
      row.className = "cart-line";
      row.innerHTML =
        '<div class="cart-line-info"><b></b><span></span></div>' +
        '<div class="cart-qty"><button type="button" aria-label="Remove one">&minus;</button>' +
        '<output></output><button type="button" aria-label="Add one">+</button></div>';
      row.querySelector("b").textContent = l.name;
      row.querySelector("span").textContent = l.size + " · " + money(l.price);
      row.querySelector("output").textContent = l.qty;
      var b = row.querySelectorAll("button");
      b[0].addEventListener("click", function () { changeQty(l.key, -1); });
      b[1].addEventListener("click", function () { changeQty(l.key, +1); });
      linesEl.appendChild(row);
    });

    var subtotal = cart.reduce(function (s, l) { return s + l.price * l.qty; }, 0);
    var tees = cart.reduce(function (s, l) { return s + (l.category === "tee" ? l.qty : 0); }, 0);
    var savings = Math.floor(tees / 2) * TEE_PAIR_DISCOUNT;
    panel.querySelector(".cart-subtotal").textContent = money(subtotal) + " CAD";
    panel.querySelector(".cart-deal").hidden = savings === 0;
    panel.querySelector(".cart-savings").textContent = "−" + money(savings);
    checkoutBtn.disabled = !cart.length;
  }

  checkoutBtn.addEventListener("click", function () {
    errorEl.textContent = "";
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Opening checkout…";
    fetch("/.netlify/functions/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map(function (l) { return { key: l.key, qty: l.qty }; }) }),
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, data: d }; });
      })
      .then(function (res) {
        if (res.ok && res.data.url) { window.location.href = res.data.url; return; }
        throw new Error(res.data.error || "Checkout couldn't start. Please try again.");
      })
      .catch(function (err) {
        errorEl.textContent = err.message;
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = "Checkout &rarr;";
        loadStock(); // something may have just sold out
      });
  });

  function loadStock() {
    return fetch("/.netlify/functions/inventory")
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (d) {
        stock = d.stock || {};
        // drop anything in a saved cart that's gone, and cap anything over the stock left
        cart = cart.filter(function (l) { return available(l.key) && left(l.key) !== 0; });
        cart.forEach(function (l) { var n = left(l.key); if (n !== null && l.qty > n) l.qty = n; });
        save();
        paintChips();
        render();
      })
      .catch(function () {
        showToast("Online checkout is down right now. Email rans@wcthoops.com to order.");
        chips.forEach(function (b) { b.disabled = true; });
      });
  }

  render();
  loadStock();
})();
