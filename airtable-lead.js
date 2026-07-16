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
//   3. Cette fonction est déjà appelée automatiquement depuis js/script.js
//      au moment de la soumission réussie du formulaire.
//
// Ne bloque jamais le parcours utilisateur : si le token est absent ou si
// l'appel échoue, on répond simplement sans faire planter le formulaire.
//
// IMPORTANT : la création de la fiche (informations du lead) et
// l'assignation automatique (pour la notification push) sont volontairement
// séparées en deux appels distincts. Si l'assignation échoue pour une
// raison quelconque (format refusé par l'API, droits insuffisants...),
// la fiche du lead est déjà enregistrée et reste intacte : on ne risque
// jamais de perdre un lead à cause de la fonctionnalité de notification.
// ============================================================================

const AIRTABLE_BASE_ID = "appBngDi0WIiKbQZc";
const AIRTABLE_TABLE_ID = "tbltHBTDycsMqatSc";
const NOTIFY_COLLABORATOR_EMAIL = "tom.vinet11@gmail.com";

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
  };

  // Retire les champs vides/undefined pour éviter les erreurs de type Airtable
  Object.keys(fields).forEach((key) => {
    if (fields[key] === "" || fields[key] === undefined) delete fields[key];
  });

  let createResult;
  try {
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

    createResult = await response.json();

    if (!response.ok) {
      // La création elle-même a échoué (token invalide, champ inconnu...) :
      // on renvoie l'erreur telle quelle pour pouvoir la diagnostiquer,
      // mais on ne tente pas l'assignation puisqu'il n'y a pas de fiche.
      return { statusCode: 200, body: JSON.stringify({ created: false, error: createResult }) };
    }
  } catch (error) {
    return { statusCode: 200, body: JSON.stringify({ created: false, error: error.message }) };
  }

  // La fiche est créée à ce stade : le lead est en sécurité dans Airtable,
  // quoi qu'il arrive ensuite. L'assignation qui suit est un bonus pour la
  // notification push, jamais un blocage.
  const newRecordId = createResult && createResult.records && createResult.records[0] && createResult.records[0].id;

  if (newRecordId) {
    try {
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        },
        body: JSON.stringify({
          records: [
            {
              id: newRecordId,
              fields: { "Assigné à": { email: NOTIFY_COLLABORATOR_EMAIL } },
            },
          ],
          typecast: true,
        }),
      });
    } catch (error) {
      /* silencieux : la notification est un bonus, jamais un blocage */
    }
  }

  return { statusCode: 200, body: JSON.stringify({ created: true, id: newRecordId }) };
};
