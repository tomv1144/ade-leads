// ============================================================================
// Klarimo : fonction Netlify qui envoie un message de confirmation
// automatique (email + SMS) au lead juste après sa demande d'étude gratuite.
//
// Objectif : prévenir le lead qu'un appel arrive de la part de Tom (Klarimo),
// et lui donner le numéro à l'avance pour qu'il le reconnaisse et décroche.
// Réduit le taux de non-décroché lié à un appel "inconnu" non annoncé.
// Propose aussi un contact immédiat via WhatsApp (lien "click-to-chat" wa.me,
// aucune API nécessaire) pour les leads qui préfèrent écrire plutôt
// qu'attendre un appel.
//
// POUR ACTIVER CETTE FONCTION :
//   Email (via Resend, gratuit jusqu'à 3000 emails/mois) :
//     1. Créer un compte sur resend.com, vérifier un domaine d'envoi
//        (ou utiliser leur domaine de test en attendant).
//     2. Créer une clé API : resend.com/api-keys
//     3. Ajouter la variable d'environnement RESEND_API_KEY dans Netlify.
//     4. Ajouter la variable RESEND_FROM_EMAIL (ex: "Klarimo <contact@klarimo.fr>").
//
//   SMS (via Twilio) :
//     1. Créer un compte sur twilio.com, acheter un numéro d'envoi SMS.
//     2. Récupérer Account SID et Auth Token depuis le dashboard Twilio.
//     3. Ajouter les variables TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//        TWILIO_FROM_NUMBER (le numéro Twilio acheté, format +33...).
//
// Cette fonction est déjà appelée automatiquement depuis js/script.js au
// moment de la soumission réussie du formulaire.
//
// Ne bloque jamais le parcours utilisateur : si les variables sont absentes
// ou si l'envoi échoue, on répond simplement sans faire planter le formulaire.
// Email et SMS sont indépendants l'un de l'autre : l'échec de l'un n'empêche
// jamais l'envoi de l'autre.
// ============================================================================

const KLARIMO_PHONE_DISPLAY = "06 77 52 39 16";

// Lien WhatsApp "click-to-chat" : ouvre directement une conversation avec le
// numéro de Tom, message pré-rempli. Ne nécessite aucune inscription ni API
// (contrairement à WhatsApp Business API) : fonctionne dès aujourd'hui.
// Format attendu par wa.me : indicatif pays + numéro, sans "+" ni espaces.
const KLARIMO_WHATSAPP_MESSAGE =
  "Bonjour, je viens de faire une demande d'étude sur klarimo.fr, je souhaite échanger avec vous.";
const KLARIMO_WHATSAPP_LINK =
  "https://wa.me/33677523916?text=" + encodeURIComponent(KLARIMO_WHATSAPP_MESSAGE);

function buildEmailHtml(prenom, parcours) {
  const hello = prenom ? "Bonjour " + prenom + "," : "Bonjour,";
  const isDirect = parcours === "direct";

  const corps = isDirect
    ? "<p>Merci pour les informations et documents transmis concernant votre assurance emprunteur.</p>" +
      "<p><strong>Tom</strong>, votre conseiller dédié chez Klarimo, prépare votre devis personnalisé à partir " +
      "de ces éléments et revient vers vous par email très prochainement, sans appel nécessaire de votre part.</p>" +
      "<p>Une question en attendant, ou un document à compléter ? Vous pouvez le joindre directement sur WhatsApp :</p>"
    : "<p>Merci pour votre demande d'étude gratuite concernant votre assurance emprunteur.</p>" +
      "<p><strong>Tom</strong>, votre conseiller dédié chez Klarimo, va vous appeler très prochainement " +
      "depuis le <strong>" + KLARIMO_PHONE_DISPLAY + "</strong>. N'hésitez pas à enregistrer ce numéro " +
      "dès maintenant pour ne pas manquer l'appel.</p>" +
      "<p>Vous préférez échanger par écrit ? Vous pouvez aussi le contacter directement sur WhatsApp :</p>";

  return (
    "<div style=\"font-family:sans-serif;color:#202124;line-height:1.6;\">" +
    "<p>" + hello + "</p>" +
    corps +
    "<p><a href=\"" + KLARIMO_WHATSAPP_LINK + "\" " +
    "style=\"display:inline-block;background:#25D366;color:#fff;text-decoration:none;" +
    "padding:10px 18px;border-radius:6px;font-weight:600;\">Discuter sur WhatsApp</a></p>" +
    "<p>À très vite,<br>L'équipe Klarimo</p>" +
    "</div>"
  );
}

function buildSmsText(prenom, parcours) {
  const hello = prenom ? "Bonjour " + prenom + ", " : "Bonjour, ";
  const isDirect = parcours === "direct";

  if (isDirect) {
    return (
      hello +
      "merci pour les informations transmises à Klarimo ! Tom prépare votre devis et revient vers vous par email. " +
      "Une question ? Écrivez-lui sur WhatsApp : " + KLARIMO_WHATSAPP_LINK + " À bientôt !"
    );
  }

  return (
    hello +
    "merci pour votre demande d'étude gratuite Klarimo ! Tom va vous appeler très prochainement " +
    "au " + KLARIMO_PHONE_DISPLAY + " (enregistrez ce numéro). Vous préférez écrire ? " +
    KLARIMO_WHATSAPP_LINK + " À bientôt !"
  );
}

async function sendEmail(email, prenom, parcours) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !email) {
    return { skipped: true, reason: "Email non configuré ou absent" };
  }

  const subject =
    parcours === "direct"
      ? "Votre demande Klarimo - Devis en préparation"
      : "Votre demande d'étude Klarimo - Tom vous appelle bientôt";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: subject,
        html: buildEmailHtml(prenom, parcours),
      }),
    });
    const result = await response.json();
    return { ok: response.ok, result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function sendSms(telephone, prenom, parcours) {
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !telephone) {
    return { skipped: true, reason: "SMS non configuré ou numéro absent" };
  }

  // Convertit un numéro français local (06/07...) au format international E.164
  // attendu par Twilio (+336/+337...).
  let toNumber = telephone.replace(/[\s.\-]/g, "");
  if (toNumber.startsWith("0")) {
    toNumber = "+33" + toNumber.slice(1);
  }

  try {
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const body = new URLSearchParams({
      To: toNumber,
      From: TWILIO_FROM_NUMBER,
      Body: buildSmsText(prenom, parcours),
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: body.toString(),
      }
    );
    const result = await response.json();
    return { ok: response.ok, result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const payload = JSON.parse(event.body || "{}");
  const { prenom, email, telephone, parcours } = payload;

  // Email et SMS sont envoyés en parallèle et indépendamment : l'échec de
  // l'un n'empêche jamais l'envoi de l'autre. Le texte s'adapte au parcours
  // choisi (rappel classique ou transmission directe), voir buildEmailHtml
  // et buildSmsText.
  const [emailResult, smsResult] = await Promise.all([
    sendEmail(email, prenom, parcours),
    sendSms(telephone, prenom, parcours),
  ]);

  return { statusCode: 200, body: JSON.stringify({ email: emailResult, sms: smsResult }) };
};
