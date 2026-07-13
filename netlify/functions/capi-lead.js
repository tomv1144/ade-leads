// ============================================================================
// Klarimo : squelette de fonction Netlify pour la Meta Conversions API (CAPI)
//
// Objectif : envoyer l'événement "Lead" à Meta directement depuis le serveur,
// en complément du Meta Pixel côté navigateur (scripts/consent.js). Cela fiabilise
// l'attribution des campagnes face au blocage des cookies / bloqueurs de pub.
//
// CETTE FONCTION N'EST PAS ENCORE BRANCHÉE. Pour l'activer :
//   1. Créer un token d'accès Conversions API dans Meta Events Manager.
//   2. Ajouter la variable d'environnement META_CAPI_TOKEN et META_PIXEL_ID
//      dans Netlify (Site settings > Environment variables).
//   3. Appeler cette fonction (fetch('/.netlify/functions/capi-lead', {...}))
//      depuis scripts/script.js au moment de la soumission réussie du formulaire,
//      en lui passant email / téléphone (non hachés, le hachage est fait ici).
//
// Documentation Meta : https://developers.facebook.com/docs/marketing-api/conversions-api
// ============================================================================

const crypto = require("crypto");

function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const PIXEL_ID = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    // Configuration non prête : on ne bloque jamais le parcours utilisateur
    // pour un événement de tracking, on répond simplement que ce n'est pas configuré.
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: "CAPI non configurée" }) };
  }

  try {
    const { email, telephone, clientIp, clientUserAgent, eventSourceUrl } = JSON.parse(event.body || "{}");

    const payload = {
      data: [
        {
          event_name: "Lead",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: eventSourceUrl,
          user_data: {
            em: [sha256(email)].filter(Boolean),
            ph: [sha256(telephone ? telephone.replace(/\D/g, "") : "")].filter(Boolean),
            client_ip_address: clientIp,
            client_user_agent: clientUserAgent,
          },
        },
      ],
    };

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};