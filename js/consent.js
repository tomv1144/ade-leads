/* ============================================================================
   KLARIMO : consent.js
   Gestion minimale du consentement cookies (CNIL) : GTM / GA4 / Meta Pixel ne
   se chargent qu'après acceptation. Obligatoire en France pour tout traceur
   non strictement nécessaire au fonctionnement du site (le formulaire et sa
   soumission Netlify Forms ne sont pas concernés par ce bandeau).
   Choix mémorisé en localStorage, redemandé si absent.
============================================================================ */

(function () {
  "use strict";

  const CONSENT_KEY = "klarimo_cookie_consent"; // "accepted" | "declined"

  function getConsent() {
    try {
      return window.localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch (e) {
      /* stockage indisponible (navigation privée stricte) : le bandeau
         réapparaîtra à chaque visite, ce qui reste sans danger. */
    }
  }

  function injectScript(src, attrs) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    Object.keys(attrs || {}).forEach((k) => s.setAttribute(k, attrs[k]));
    document.head.appendChild(s);
    return s;
  }

  function initGTM(gtmId) {
    if (!gtmId) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    injectScript("https://www.googletagmanager.com/gtm.js?id=" + gtmId);

    const iframe = document.createElement("iframe");
    iframe.src = "https://www.googletagmanager.com/ns.html?id=" + gtmId;
    iframe.height = 0;
    iframe.width = 0;
    iframe.style.display = "none";
    iframe.style.visibility = "hidden";
    iframe.title = "gtm";
    const noscript = document.createElement("noscript");
    noscript.appendChild(iframe);
    document.body.appendChild(noscript);
  }

  function initGA4(ga4Id) {
    if (!ga4Id) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    injectScript("https://www.googletagmanager.com/gtag/js?id=" + ga4Id);
    window.gtag("js", new Date());
    window.gtag("config", ga4Id);
  }

  function initMetaPixel(pixelId, events) {
    if (!pixelId) return;
    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", pixelId);
    (events || ["PageView"]).forEach((eventName) => {
      if (eventName === "ViewContent") {
        window.fbq("track", "ViewContent", { content_name: "Etude gratuite assurance emprunteur" });
      } else {
        window.fbq("track", eventName);
      }
    });

    const img = document.createElement("img");
    img.height = 1;
    img.width = 1;
    img.style.display = "none";
    img.alt = "";
    img.src = "https://www.facebook.com/tr?id=" + pixelId + "&ev=PageView&noscript=1";
    const noscript = document.createElement("noscript");
    noscript.appendChild(img);
    document.body.appendChild(noscript);
  }

  function loadTrackers(config) {
    initGTM(config.gtmId);
    initGA4(config.ga4Id);
    initMetaPixel(config.pixelId, config.events);
    if (typeof config.onLoaded === "function") config.onLoaded();
  }

  function wireBanner(config) {
    const banner = document.getElementById("cookie-consent");
    if (!banner) return;
    const acceptBtn = document.getElementById("cookie-accept");
    const declineBtn = document.getElementById("cookie-decline");

    banner.hidden = false;

    if (acceptBtn) {
      acceptBtn.addEventListener("click", () => {
        setConsent("accepted");
        banner.hidden = true;
        loadTrackers(config);
      });
    }
    if (declineBtn) {
      declineBtn.addEventListener("click", () => {
        setConsent("declined");
        banner.hidden = true;
      });
    }
  }

  /* API publique : chaque page appelle KlarimoConsent.init({...}) avec ses
     propres identifiants et la liste d'événements à déclencher. */
  window.KlarimoConsent = {
    init: function (config) {
      const consent = getConsent();
      if (consent === "accepted") {
        loadTrackers(config);
      } else if (consent === "declined") {
        // Choix respecté : aucun traceur chargé.
      } else {
        wireBanner(config);
      }
    },
  };
})();
