// ============================================================================
// Klarimo : fonction Netlify qui envoie chaque nouveau lead dans Airtable
// (base "Leads Klarimo"), en complément de Netlify Forms.
//
// Objectif : avoir une vue "CRM" du lead (statut, montant gagné, notes) en
// plus de la simple liste brute de Netlify Forms.
//
// POUR ACTIVER CETTE FONCTION :
//   1. Créer un token d'accès personnel Airtable : airtable.com/create/tokens
//      (scopes nécessaires : data.records:write, sur la base "Leads Klarimo").
//   2. Ajouter la variable d'environnement AIRTABLE_TOKEN dans Netlify
//      (Project configuration > Environment variables).
//   3. Cette fonction est déjà appelée automatiquement depuis scripts/script.js
//      au moment de la soumission réussie du formulaire.
//
// Ne bloque jamais le parcours utilisateur : si le token est absent ou si
// l'appel échoue, on répond simplement sans faire planter le formulaire.
// ============================================================================

const AIRTABLE_BASE_ID = "appBngDi0WIiKbQZc";
const AIRTABLE_TABLE_ID = "tbltHBTDycsMqatSc";

function buildDetailCredits(payload) {
  const lines = [];
  for (let i = 1; i <= 5; i++) {
    const capital = payload["capital_restant_du_" + i];
    const type = payload["type_bien_" + i];
    if (capital || type) {
      lines.push("Crédit " + i + " : " + (capital || "?") + " € restant dû, bien : " + (type || "non précisé"));
    }
  }
  return lines.join("\n");
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

  if (!AIRTABLE_TOKEN) {
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: "Airtable non configuré" }) };
  }

  try {
    const payload = JSON.parse(event.body || "{}");

    const fields = {
      "Prénom": payload.prenom || "",
      "Nom": payload.nom || "",
      "Email": payload.email || "",
      "Téléphone": payload.telephone || "",
      "Créneau de rappel souhaité": payload.creneau_rappel || "",
      "Nombre de crédits": payload.nombre_credits ? parseInt(payload.nombre_credits, 10) : undefined,
      "Détail des crédits": buildDetailCredits(payload),
      "Source du lead": payload.source_lead || "",
      "Statut": "À contacter",
      "Date de réception": new Date().toISOString(),
      // Assignation automatique : déclenche la notification push native
      // Airtable sur le téléphone (l'app Airtable notifie nativement quand
      // un collaborateur est assigné à une fiche, contrairement à une simple
      // création de fiche qui ne notifie personne par défaut).
      "Assigné à": { email: "tom.vinet11@gmail.com" },
    };

    // Retire les champs vides/undefined pour éviter les erreurs de type Airtable
    Object.keys(fields).forEach((key) => {
      if (fields[key] === "" || fields[key] === undefined) delete fields[key];
    });

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        },
        body: JSON.stringify({
          records: [{ fields }],
          typecast: true,
        }),
      }
    );

    const result = await response.json();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};