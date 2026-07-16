// ============================================================================
// Klarimo : fonction Netlify qui envoie chaque nouveau lead dans Airtable
// (base "Leads Klarimo"), en complément de Netlify Forms.
//
// Objectif : avoir une vue "CRM" du lead (statut, montant gagné, notes) en
// plus de la simple liste brute de Netlify Forms. Gère aussi bien le
// parcours "rappel" classique (peu de champs) que le parcours "transmission
// directe" (état civil complet, profession, situation familiale, documents),
// voir js/script.js section 3b pour le détail des deux parcours.
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
//
// Le recordId de la fiche créée est renvoyé dans la réponse (champ
// "recordId") : le parcours "transmission directe" en a besoin côté
// navigateur pour pouvoir attacher ensuite les documents transmis (voir
// netlify/functions/upload-document.mjs).
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

// Consolide toutes les informations du co-emprunteur (si présent) en un seul
// bloc de texte lisible, plutôt que de dupliquer une quinzaine de champs
// Airtable. Le formulaire, lui, continue de poser chaque question
// individuellement pour une meilleure expérience de saisie.
function buildInfosCoEmprunteur(payload) {
  const present = payload.co_emprunteur_present === "oui";
  if (!present) return "";

  const lignes = [];
  const push = (label, value) => {
    if (value) lignes.push(label + " : " + value);
  };

  push("Prénom", payload.co_prenom);
  push("Nom", payload.co_nom);
  push("Date de naissance", payload.co_date_naissance);
  push("Âge", payload.co_age);
  push("Lieu de naissance", payload.co_lieu_naissance);
  push("Nationalité", payload.co_nationalite);
  push("Catégorie professionnelle", payload.co_categorie_pro);
  push("Catégorie fonctionnaire", payload.co_categorie_fonctionnaire);
  push("SIREN", payload.co_siren);
  push("Code APE", payload.co_code_ape);
  push("Situation familiale", payload.co_situation_familiale);
  push("Régime matrimonial", payload.co_regime_matrimonial);
  push("Régime du PACS", payload.co_regime_pacs);
  push("Nicotine (24 derniers mois)", payload.co_nicotine_24mois);
  push("Sport pratiqué", payload.co_sport_pratique);
  push("Licence sportive en club", payload.co_licence_club);
  push("Kilométrage professionnel annuel", payload.co_km_professionnel ? payload.co_km_professionnel + " km/an" : "");
  push("Profession manuelle", payload.co_profession_manuelle);
  push("Manipulation de produits dangereux", payload.co_produits_dangereux);
  push("Activité à plus de 15m de hauteur", payload.co_activite_hauteur);

  return lignes.join("\n");
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

  const parcoursChoisi = payload.parcours_souhaite === "direct" ? "Transmission directe" : "Rappel classique";

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
    "Parcours choisi": parcoursChoisi,

    // Champs du parcours "transmission directe" : simplement absents ou
    // vides pour un lead venu du parcours "rappel" classique, ce qui ne
    // pose aucun problème (retirés ci-dessous avant l'envoi à Airtable).
    "Date de naissance": payload.date_naissance || undefined,
    "Âge": payload.age ? parseInt(payload.age, 10) : undefined,
    "Lieu de naissance": payload.lieu_naissance || "",
    "Nationalité": payload.nationalite || "",
    "Catégorie professionnelle": payload.categorie_pro || undefined,
    "Catégorie fonctionnaire": payload.categorie_fonctionnaire || undefined,
    "SIREN": payload.siren || "",
    "Code APE": payload.code_ape || "",
    "Situation familiale": payload.situation_familiale || undefined,
    "Régime matrimonial": payload.regime_matrimonial || undefined,
    "Régime du PACS": payload.regime_pacs || undefined,
    "Nombre d'enfants": payload.nombre_enfants ? parseInt(payload.nombre_enfants, 10) : undefined,
    "Enfants à charge": payload.enfants_charge ? parseInt(payload.enfants_charge, 10) : undefined,
    "Nicotine (24 derniers mois)": payload.nicotine_24mois || undefined,
    "Sport pratiqué": payload.sport_pratique || "",
    "Licence sportive en club": payload.licence_club || undefined,
    "Kilométrage professionnel annuel (km)": payload.km_professionnel ? parseInt(payload.km_professionnel, 10) : undefined,
    "Profession manuelle": payload.profession_manuelle || undefined,
    "Manipulation produits dangereux": payload.produits_dangereux || undefined,
    "Activité en hauteur (+15m)": payload.activite_hauteur || undefined,
    "Co-emprunteur": payload.co_emprunteur_present === "oui",
    "Informations co-emprunteur": buildInfosCoEmprunteur(payload),
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

  return { statusCode: 200, body: JSON.stringify({ created: true, id: newRecordId, recordId: newRecordId }) };
};
