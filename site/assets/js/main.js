// wct hoops site script
// handles the nav, hero video, contact form and the shop email links
(function () {
  "use strict";

  // start at the top of the page, or at the section in the link if there is one
  // (like contact.html#camps). some hosts swap the page without a real reload
  // so the browser never jumps to the section on its own, so we just do it ourselves
  // the css has smooth scrolling on, so these jumps are set to instant or you'd
  // see the page slide around. we also stop as soon as the visitor scrolls themselves
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
  var userMoved = false;
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) {
    window.addEventListener(ev, function () { userMoved = true; }, { once: true, passive: true });
  });
  function goToHashOrTop() {
    if (userMoved) return;
    if (window.location.hash) {
      var target = null;
      try { target = document.querySelector(window.location.hash); } catch (e) {}
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "instant" });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
  goToHashOrTop();
  window.addEventListener("load", goToHashOrTop);
  window.addEventListener("pageshow", goToHashOrTop);
  setTimeout(goToHashOrTop, 50);
  setTimeout(goToHashOrTop, 300);
  setTimeout(goToHashOrTop, 700);

  // back button for when a link drops you in the middle of another page
  // (like "view upcoming camps" going to contact.html#camps). we save where
  // you came from in sessionStorage so the button survives a refresh
  var PAGE_LABELS = {
    "index.html": "Home",
    "": "Home",
    "about.html": "The Roots",
    "coaches.html": "Coaches",
    "alumni.html": "The Proof",
    "contact.html": "Contact",
    "shop.html": "Shop"
  };
  function currentPageFile() {
    return location.pathname.split("/").pop() || "index.html";
  }
  // remember which page the link was clicked from
  document.querySelectorAll('a[href*="#"]').forEach(function (a) {
    var href = a.getAttribute("href") || "";
    var hashIdx = href.indexOf("#");
    if (hashIdx <= 0) return; // link on the same page, skip it
    var targetPage = href.slice(0, hashIdx);
    var targetHash = href.slice(hashIdx);
    if (!(targetPage in PAGE_LABELS)) return; // only our own pages
    a.addEventListener("click", function () {
      try {
        sessionStorage.setItem("wctBack:" + targetPage + targetHash, currentPageFile());
      } catch (e) {}
    });
  });
  // if we landed here from one of those links, show the back button
  (function showBackButton() {
    if (!window.location.hash) return;
    var key = "wctBack:" + currentPageFile() + window.location.hash;
    var fromPage;
    try { fromPage = sessionStorage.getItem(key); } catch (e) { fromPage = null; }
    if (!fromPage || !(fromPage in PAGE_LABELS)) return;
    var target = null;
    try { target = document.querySelector(window.location.hash); } catch (err) {}
    if (!target) return;
    var link = document.createElement("a");
    link.className = "section-back-link";
    link.href = fromPage;
    link.innerHTML = "&larr; Back to " + PAGE_LABELS[fromPage];
    var container = target.querySelector(":scope > .wrap") || target;
    container.insertAdjacentElement("afterbegin", link);
  })();

  // booking page: the training card buttons fill in the "what are you interested in"
  // dropdown before jumping down to the form. landing on contact.html#camps picks camps too
  var interestSelect = document.getElementById("f-interest");
  function pickInterest(value) {
    if (!interestSelect) return;
    for (var i = 0; i < interestSelect.options.length; i++) {
      if (interestSelect.options[i].text === value) { interestSelect.selectedIndex = i; return; }
    }
  }
  document.querySelectorAll("[data-interest]").forEach(function (btn) {
    btn.addEventListener("click", function () { pickInterest(btn.getAttribute("data-interest")); });
  });
  if (window.location.hash === "#camps") pickInterest("Camps");

  // mobile menu
  var burger = document.getElementById("burgerBtn");
  var menu = document.getElementById("mobileMenu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        menu.classList.remove("open");
      });
    });
  }

  // hero video: plays muted, pauses when you scroll past, has a sound button,
  // and fades the text once it starts playing
  var heroVideo = document.getElementById("heroVideo");
  var heroSection = document.querySelector(".hero");
  var heroContent = document.querySelector(".hero-content");
  var soundToggle = document.getElementById("heroSoundToggle");

  if (heroVideo && heroSection) {
    // fade the text a bit after the video starts so the video stands out.
    // hovering over it brings it back
    heroVideo.addEventListener("playing", function () {
      setTimeout(function () {
        if (heroContent) heroContent.classList.add("dimmed");
      }, 1600);
    }, { once: true });

    // pause the video (and sound) when you scroll away, play again when you come back
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              heroVideo.play().catch(function () {});
            } else {
              heroVideo.pause();
            }
          });
        },
        { threshold: 0.15 }
      );
      io.observe(heroSection);
    }

    // turned the volume down so unmuting isn't so loud
    heroVideo.volume = 0.45;

    if (soundToggle) {
      soundToggle.addEventListener("click", function () {
        heroVideo.muted = !heroVideo.muted;
        soundToggle.textContent = heroVideo.muted ? "🔇" : "🔊";
        soundToggle.setAttribute(
          "aria-label",
          heroVideo.muted ? "Unmute video" : "Mute video"
        );
      });
    }
  }

  // contact form: sends through netlify forms, shows our email if it fails
  document.querySelectorAll("form[data-ajax-form]").forEach(function (form) {
    var note = form.querySelector(".form-note");
    var btn = form.querySelector("button[type=submit]");
    function say(msg, isError) {
      if (!note) return;
      note.textContent = msg;
      note.classList.toggle("error", !!isError);
      note.classList.add("show");
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (btn) btn.disabled = true;
      say("Sending\u2026", false);
      var body = new URLSearchParams(new FormData(form)).toString();
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body
      })
        .then(function (r) {
          if (!r.ok) throw new Error("status " + r.status);
          say("Thanks \u2014 we'll be in touch within 24 hours.", false);
          form.reset();
        })
        .catch(function () {
          say("Sorry, that didn't send. Please email rans@wcthoops.com or call (604) 445-2890.", true);
        })
        .then(function () { if (btn) btn.disabled = false; });
    });
  });

  // shop: the email links on the shop page use this address.
  // change it here if we get a separate merch email
  var SHOP_EMAIL = "rans@wcthoops.com";
  var shopEmailLink = document.getElementById("shopEmailLink");
  if (shopEmailLink) {
    shopEmailLink.href = "mailto:" + SHOP_EMAIL;
    shopEmailLink.textContent = SHOP_EMAIL;
  }
  var shopInquiryBtn = document.getElementById("shopInquiryBtn");
  if (shopInquiryBtn) {
    shopInquiryBtn.href = "mailto:" + SHOP_EMAIL + "?subject=" + encodeURIComponent("WCT Merch Inquiry");
    shopInquiryBtn.innerHTML = "Email " + SHOP_EMAIL + " &rarr;";
  }

  // the "email your order" button opens an email with a little template to fill in
  var shopOrderBtn = document.getElementById("shopOrderBtn");
  if (shopOrderBtn) {
    var orderBody =
      "Hi WCT,\n\nI'd like to order:\n\n" +
      "Item: \nSizes and quantities (e.g. 2 Large, 1 Small): \n\n" +
      "Item: \nSizes and quantities: \n\n" +
      "Name:\nPickup (North Vancouver) or shipping (Canada/USA)?:\nShipping address (if shipping):\n\nThanks!";
    shopOrderBtn.href =
      "mailto:" + SHOP_EMAIL +
      "?subject=" + encodeURIComponent("WCT Merch Order") +
      "&body=" + encodeURIComponent(orderBody);
  }
})();
