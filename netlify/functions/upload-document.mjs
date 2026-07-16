// ============================================================================
// Klarimo : fonction Netlify qui reçoit un document (offre de prêt ou tableau
// d'amortissement) transmis via le parcours "transmission directe", et
// l'attache au bon enregistrement Airtable (champ "Documents transmis").
//
// Format moderne (.mjs, Request/Response natifs de la plateforme web) choisi
// spécifiquement pour cette fonction afin de pouvoir lire un envoi
// multipart/form-data via req.formData() sans dépendance supplémentaire
// (pas de busboy à installer). Les autres fonctions du site restent au
// format classique (exports.handler) : Netlify accepte les deux formats
// au sein d'un même projet, aucun changement nécessaire ailleurs.
//
// POUR ACTIVER : utilise le même jeton que airtable-lead.js
// (variable d'environnement AIRTABLE_TOKEN, déjà configurée si Airtable
// fonctionne déjà pour les leads).
//
// Limite : 5 Mo par fichier (alignée sur la limite de l'API Airtable
// d'upload direct en base64). Le site compresse déjà les photos côté
// navigateur pour rester sous ce seuil autant que possible (voir
// js/script.js, fonction compressImageFile).
//
// Ne bloque jamais le parcours utilisateur : le formulaire est déjà validé
// et le lead déjà enregistré dans Airtable au moment où cette fonction est
// appelée. Un échec ici (fichier trop lourd, Airtable indisponible...)
// n'efface jamais le lead ni ne casse la redirection vers merci.html.
// ============================================================================

const AIRTABLE_BASE_ID = "appBngDi0WIiKbQZc";
const AIRTABLE_ATTACHMENT_FIELD = "Documents transmis";
const MAX_BYTES = 5 * 1024 * 1024;

const CHAMP_LABELS = {
  doc_offre_pret: "Offre de pret",
  doc_tableau_amortissement: "Tableau amortissement",
};

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  if (!AIRTABLE_TOKEN) {
    return jsonResponse({ skipped: true, reason: "Airtable non configuré" });
  }

  try {
    const formData = await req.formData();
    const recordId = formData.get("recordId");
    const champ = formData.get("champ");
    const file = formData.get("file");

    if (!recordId || !file || typeof file === "string") {
      return jsonResponse({ ok: false, error: "recordId ou fichier manquant" });
    }

    if (file.size > MAX_BYTES) {
      return jsonResponse({ ok: false, error: "Fichier trop volumineux (> 5 Mo)" });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const label = CHAMP_LABELS[champ] || "Document";
    const filename = label + " - " + (file.name || "document");

    const response = await fetch(
      `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${recordId}/${encodeURIComponent(
        AIRTABLE_ATTACHMENT_FIELD
      )}/uploadAttachment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        },
        body: JSON.stringify({
          contentType: file.type || "application/octet-stream",
          file: base64,
          filename: filename,
        }),
      }
    );

    const result = await response.json();
    return jsonResponse({ ok: response.ok, result });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
};
