/* ============================================================================
   KLARIMO : script.js (vanilla JS, aucune dépendance)
   Sommaire :
   1. Utilitaires
   1b. Attribution des leads (UTM / fbclid)
   2. Blocs crédits dynamiques (nombre_credits)
   3. Navigation du formulaire en 2 étapes
   3b. Parcours détaillé (rappel vs transmission directe) + conditions
   4. Validation instantanée
   5. Soumission Netlify Forms en AJAX + tracking + upload documents
   6. Simulateur d'économie
   7. CTA sticky mobile (IntersectionObserver)
============================================================================ */

(function () {
  "use strict";

  /* --------------------------------------------------------------------
     1. UTILITAIRES
  -------------------------------------------------------------------- */
  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));

  function showError(input, message) {
    input.setAttribute("aria-invalid", "true");
    // L'élément d'erreur associé est retrouvé via aria-describedby, ce qui
    // garde le lien entre le champ et son message valide pour les lecteurs d'écran.
    const describedBy = input.getAttribute("aria-describedby");
    const errId = describedBy ? describedBy.split(" ").find((id) => id.indexOf("err-") === 0) : null;
    const target = errId ? document.getElementById(errId) : null;
    if (target) {
      target.textContent = message;
      target.hidden = false;
    }
  }

  function clearError(input) {
    input.removeAttribute("aria-invalid");
    const describedBy = input.getAttribute("aria-describedby");
    const errId = describedBy ? describedBy.split(" ").find((id) => id.indexOf("err-") === 0) : null;
    const target = errId ? document.getElementById(errId) : null;
    if (target) {
      target.textContent = "";
      target.hidden = true;
    }
  }

  function pushEvent(eventName, params) {
    // GTM / dataLayer
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: eventName }, params || {}));
    // GA4 direct (si gtag est chargé indépendamment de GTM)
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params || {});
    }
  }

  /* --------------------------------------------------------------------
     1b. ATTRIBUTION DES LEADS (UTM / fbclid)
     Capture les paramètres utm_* et fbclid présents dans l'URL au moment
     où le visiteur arrive (typiquement en cliquant sur une pub Meta), les
     mémorise dans localStorage (pour survivre à une navigation ou un
     retour ultérieur sur le site avant soumission du formulaire), et
     remplit le champ caché "source_lead" envoyé avec chaque lead. Ne
     bloque jamais rien : en l'absence de paramètres, le champ reste vide.
  -------------------------------------------------------------------- */
  const LEAD_SOURCE_STORAGE_KEY = "klarimo_lead_source";
  const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  function captureLeadSource() {
    try {
      const params = new URLSearchParams(window.location.search);
      const captured = {};
      let hasNew = false;

      UTM_KEYS.forEach((key) => {
        const value = params.get(key);
        if (value) {
          captured[key] = value;
          hasNew = true;
        }
      });

      const fbclid = params.get("fbclid");
      if (fbclid) {
        captured.fbclid = fbclid;
        hasNew = true;
      }

      if (hasNew) {
        localStorage.setItem(LEAD_SOURCE_STORAGE_KEY, JSON.stringify(captured));
      }

      const stored = localStorage.getItem(LEAD_SOURCE_STORAGE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored);
      const parts = [];
      if (data.utm_source) parts.push("source=" + data.utm_source);
      if (data.utm_medium) parts.push("medium=" + data.utm_medium);
      if (data.utm_campaign) parts.push("campagne=" + data.utm_campaign);
      if (data.utm_content) parts.push("contenu=" + data.utm_content);
      if (data.utm_term) parts.push("terme=" + data.utm_term);
      if (data.fbclid) parts.push("fbclid=" + data.fbclid);

      const sourceField = document.getElementById("source_lead");
      if (sourceField) sourceField.value = parts.join(" | ");
    } catch (e) {
      /* silencieux : l'attribution est un bonus, jamais un blocage du formulaire */
    }
  }

  captureLeadSource();

  /* --------------------------------------------------------------------
     2. BLOCS CRÉDITS DYNAMIQUES
     Les 5 blocs existent déjà dans le HTML statique (nécessaire pour que
     Netlify Forms détecte tous les champs au build). On affiche/active
     uniquement le nombre de blocs correspondant à la sélection.
  -------------------------------------------------------------------- */
  const nombreCreditsSelect = $("#nombre_credits");
  const creditBlocks = $$(".credit-block");

  function updateCreditBlocks() {
    const value = parseInt(nombreCreditsSelect.value, 10) || 0;
    creditBlocks.forEach((block) => {
      const index = parseInt(block.getAttribute("data-credit-index"), 10);
      const isVisible = index <= value;
      block.hidden = !isVisible;
      $$("input, select", block).forEach((field) => {
        field.disabled = !isVisible;
        if (isVisible) {
          field.required = true;
        } else {
          field.required = false;
          field.value = field.tagName === "SELECT" ? "" : "";
          clearError(field);
        }
      });
    });
  }

  if (nombreCreditsSelect) {
    nombreCreditsSelect.addEventListener("change", updateCreditBlocks);
    updateCreditBlocks();
  }

  /* --------------------------------------------------------------------
     3. NAVIGATION DU FORMULAIRE EN 2 ÉTAPES
  -------------------------------------------------------------------- */
  const step1 = $("#step-1");
  const step2 = $("#step-2");
  const progressSteps = $$(".progress-step");
  const progressLabel = $("#progress-label");
  const progressBar = $("#progress-bar");
  const btnNext = $("#step-1-next");
  const btnBack = $("#step-2-back");

  function goToStep(stepNumber) {
    if (stepNumber === 1) {
      step1.hidden = false;
      step2.hidden = true;
      progressSteps[0].classList.add("is-active");
      progressSteps[0].classList.remove("is-complete");
      progressSteps[1].classList.remove("is-active", "is-complete");
      progressLabel.textContent = "Étape 1 sur 2 : votre situation";
      progressBar.setAttribute("aria-valuenow", "1");
      step1.querySelector("select, input")?.focus();
    } else {
      step1.hidden = true;
      step2.hidden = false;
      progressSteps[0].classList.add("is-complete");
      progressSteps[0].classList.remove("is-active");
      progressSteps[1].classList.add("is-active");
      progressLabel.textContent = "Étape 2 sur 2 : comment vous joindre";
      progressBar.setAttribute("aria-valuenow", "2");
      step2.querySelector("input")?.focus();
      pushEvent("form_step_2_view"); // utile pour créer une audience Meta de retargeting "arrivé à l'étape 2"
    }
  }

  function validateStep1() {
    let valid = true;

    if (!nombreCreditsSelect.value) {
      showError(nombreCreditsSelect, "Merci de sélectionner le nombre de crédits.");
      valid = false;
    } else {
      clearError(nombreCreditsSelect);
    }

    const value = parseInt(nombreCreditsSelect.value, 10) || 0;
    for (let i = 1; i <= value; i++) {
      const capital = document.getElementById("capital_" + i);
      const type = document.getElementById("type_bien_" + i);
      if (capital) {
        const numeric = capital.value.replace(/[^0-9]/g, "");
        if (!numeric || parseInt(numeric, 10) <= 0) {
          showError(capital, "Merci d'indiquer un montant approximatif.");
          valid = false;
        } else {
          clearError(capital);
        }
      }
      if (type && !type.value) {
        showError(type, "Merci de sélectionner un type de bien.");
        valid = false;
      } else if (type) {
        clearError(type);
      }
    }
    return valid;
  }

  if (btnNext) {
    btnNext.addEventListener("click", function () {
      if (validateStep1()) {
        goToStep(2);
      } else {
        // ramène le focus au premier champ en erreur, évite au visiteur de devoir chercher
        const firstError = step1.querySelector('[aria-invalid="true"]');
        if (firstError) firstError.focus();
      }
    });
  }

  if (btnBack) {
    btnBack.addEventListener("click", function () {
      goToStep(1);
    });
  }

  /* --------------------------------------------------------------------
     3b. PARCOURS DÉTAILLÉ : "être rappelé" (par défaut) vs "transmettre
     directement mes informations et documents". Cette deuxième option
     répond aux prospects qui ne veulent ni appel ni visio, mais acceptent
     de tout transmettre par écrit pour recevoir un devis sans échange oral.

     Chaque sous-bloc conditionnel (fonctionnaire, TNS, régime matrimonial,
     PACS, co-emprunteur, et la même logique en cascade pour le
     co-emprunteur) suit le même principe que les blocs crédit : masqué =
     désactivé, pour ne jamais soumettre une valeur obsolète ou non
     pertinente. Activer un bloc parent réactive tous ses champs enfants
     en masse ; on ré-applique donc systématiquement les conditions
     imbriquées juste après, pour ne pas ré-afficher à tort un sous-bloc
     qui ne correspond plus à la sélection actuelle.
  -------------------------------------------------------------------- */
  function setBlockVisibility(blockEl, show) {
    if (!blockEl) return;
    blockEl.hidden = !show;
    $$("input, select, textarea", blockEl).forEach(function (field) {
      field.disabled = !show;
    });
  }

  const parcoursRadios = $$('input[name="parcours_souhaite"]');
  const blocParcoursRappel = $("#bloc-parcours-rappel");
  const blocParcoursDirect = $("#bloc-parcours-direct");

  const categoriePro = $("#categorie_pro");
  const blocCategorieFonctionnaire = $("#bloc-categorie-fonctionnaire");
  const blocTns = $("#bloc-tns");

  const situationFamiliale = $("#situation_familiale");
  const blocRegimeMatrimonial = $("#bloc-regime-matrimonial");
  const blocRegimePacs = $("#bloc-regime-pacs");

  const coEmprunteurPresent = $("#co_emprunteur_present");
  const blocCoEmprunteur = $("#bloc-co-emprunteur");

  const coCategoriePro = $("#co_categorie_pro");
  const blocCoCategorieFonctionnaire = $("#bloc-co-categorie-fonctionnaire");
  const blocCoTns = $("#bloc-co-tns");

  const coSituationFamiliale = $("#co_situation_familiale");
  const blocCoRegimeMatrimonial = $("#bloc-co-regime-matrimonial");
  const blocCoRegimePacs = $("#bloc-co-regime-pacs");

  function updateCategorieProVisibility() {
    if (!categoriePro) return;
    setBlockVisibility(blocCategorieFonctionnaire, categoriePro.value === "Fonctionnaire");
    setBlockVisibility(blocTns, categoriePro.value === "TNS");
  }

  function updateSituationFamilialeVisibility() {
    if (!situationFamiliale) return;
    setBlockVisibility(blocRegimeMatrimonial, situationFamiliale.value === "Marié(e)");
    setBlockVisibility(blocRegimePacs, situationFamiliale.value === "Pacsé(e)");
  }

  function updateCoCategorieProVisibility() {
    if (!coCategoriePro) return;
    setBlockVisibility(blocCoCategorieFonctionnaire, coCategoriePro.value === "Fonctionnaire");
    setBlockVisibility(blocCoTns, coCategoriePro.value === "TNS");
  }

  function updateCoSituationFamilialeVisibility() {
    if (!coSituationFamiliale) return;
    setBlockVisibility(blocCoRegimeMatrimonial, coSituationFamiliale.value === "Marié(e)");
    setBlockVisibility(blocCoRegimePacs, coSituationFamiliale.value === "Pacsé(e)");
  }

  function updateCoEmprunteurVisibility() {
    if (!coEmprunteurPresent) return;
    const show = coEmprunteurPresent.checked;
    setBlockVisibility(blocCoEmprunteur, show);
    if (show) {
      // Ré-applique les sous-conditions du bloc co-emprunteur, qui viennent
      // d'être réactivées en masse par setBlockVisibility ci-dessus.
      updateCoCategorieProVisibility();
      updateCoSituationFamilialeVisibility();
    }
  }

  function updateParcoursVisibility() {
    const selected = parcoursRadios.find(function (r) {
      return r.checked;
    });
    const isDirect = !!selected && selected.value === "direct";
    setBlockVisibility(blocParcoursRappel, !isDirect);
    setBlockVisibility(blocParcoursDirect, isDirect);
    if (isDirect) {
      // Même principe : on vient de tout réactiver en masse dans le bloc
      // détaillé, il faut donc ré-appliquer les conditions imbriquées.
      updateCategorieProVisibility();
      updateSituationFamilialeVisibility();
      updateCoEmprunteurVisibility();
    }
  }

  parcoursRadios.forEach(function (radio) {
    radio.addEventListener("change", updateParcoursVisibility);
  });
  updateParcoursVisibility();

  if (categoriePro) {
    categoriePro.addEventListener("change", updateCategorieProVisibility);
    updateCategorieProVisibility();
  }
  if (situationFamiliale) {
    situationFamiliale.addEventListener("change", updateSituationFamilialeVisibility);
    updateSituationFamilialeVisibility();
  }
  if (coEmprunteurPresent) {
    coEmprunteurPresent.addEventListener("change", updateCoEmprunteurVisibility);
    updateCoEmprunteurVisibility();
  }
  if (coCategoriePro) {
    coCategoriePro.addEventListener("change", updateCoCategorieProVisibility);
    updateCoCategorieProVisibility();
  }
  if (coSituationFamiliale) {
    coSituationFamiliale.addEventListener("change", updateCoSituationFamilialeVisibility);
    updateCoSituationFamilialeVisibility();
  }

  // Calcule un âge en années à partir d'une date de naissance (format
  // AAAA-MM-JJ renvoyé par un input type="date"). Évite de demander à la
  // fois la date de naissance et l'âge dans le formulaire.
  function computeAgeFromDateNaissance(dateStr) {
    if (!dateStr) return null;
    const birth = new Date(dateStr);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  // Validation du bloc détaillé : ne s'applique que si le parcours
  // "transmission directe" est sélectionné. Les champs masqués (via
  // .disabled, positionné par les fonctions de visibilité ci-dessus) sont
  // ignorés automatiquement : inutile de dupliquer les conditions ici.
  function validateDetailedPath() {
    const selected = parcoursRadios.find(function (r) {
      return r.checked;
    });
    if (!selected || selected.value !== "direct") return true;

    let valid = true;

    function req(input) {
      if (!input || input.disabled) return;
      if (!input.value || !input.value.trim()) {
        input.setAttribute("aria-invalid", "true");
        valid = false;
      } else {
        input.removeAttribute("aria-invalid");
      }
    }

    req($("#date_naissance"));
    req($("#lieu_naissance"));
    req($("#profession"));
    req($("#categorie_pro"));
    req($("#situation_familiale"));
    req($("#nicotine_24mois"));
    req($("#categorie_fonctionnaire"));
    req($("#siren"));
    req($("#code_ape"));
    req($("#regime_matrimonial"));
    req($("#regime_pacs"));
    req($("#km_professionnel"));
    req($("#profession_manuelle"));
    req($("#produits_dangereux"));
    req($("#activite_hauteur"));

    if (coEmprunteurPresent && coEmprunteurPresent.checked) {
      req($("#co_prenom"));
      req($("#co_nom"));
      req($("#co_date_naissance"));
      req($("#co_lieu_naissance"));
      req($("#co_profession"));
      req($("#co_categorie_pro"));
      req($("#co_situation_familiale"));
      req($("#co_nicotine_24mois"));
      req($("#co_categorie_fonctionnaire"));
      req($("#co_siren"));
      req($("#co_code_ape"));
      req($("#co_regime_matrimonial"));
      req($("#co_regime_pacs"));
      req($("#co_km_professionnel"));
      req($("#co_profession_manuelle"));
      req($("#co_produits_dangereux"));
      req($("#co_activite_hauteur"));
    }

    return valid;
  }

  // Compression légère des photos de documents avant envoi (les PDF sont
  // transmis tels quels : une compression fiable de PDF côté navigateur
  // demanderait une librairie dédiée, hors scope ici). Objectif : rester
  // sous la limite de 5 Mo par fichier de l'API Airtable, y compris pour
  // une photo prise directement au téléphone (souvent 8-10 Mo).
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

  function compressImageFile(file) {
    if (!/^image\//.test(file.type)) {
      return Promise.resolve(file);
    }
    return new Promise(function (resolve) {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = function (e) {
        img.onload = function () {
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            function (blob) {
              if (!blob || blob.size >= file.size) {
                resolve(file);
              } else {
                resolve(new File([blob], file.name, { type: "image/jpeg" }));
              }
            },
            "image/jpeg",
            0.75
          );
        };
        img.onerror = function () {
          resolve(file);
        };
        img.src = e.target.result;
      };
      reader.onerror = function () {
        resolve(file);
      };
      reader.readAsDataURL(file);
    });
  }

  // Chaque champ accepte désormais plusieurs fichiers (un tableau
  // d'amortissement par crédit, par exemple) : on compresse chaque fichier
  // sélectionné indépendamment, puis on reconstruit la liste de fichiers du
  // champ avec les versions compressées.
  function wireUploadCompression(inputId, errorId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("change", function () {
      const files = input.files ? Array.from(input.files) : [];
      if (!files.length) return;
      const errorEl = document.getElementById(errorId);
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = "";
      }
      Promise.all(files.map(compressImageFile)).then(function (finalFiles) {
        const tropLourd = finalFiles.find(function (f) {
          return f.size > MAX_UPLOAD_BYTES;
        });
        if (tropLourd) {
          if (errorEl) {
            errorEl.textContent =
              "« " + tropLourd.name + " » dépasse 5 Mo même après compression. Merci de le remplacer par un fichier plus léger, ou de nous le transmettre par WhatsApp/email.";
            errorEl.hidden = false;
          }
          input.value = "";
          return;
        }
        const dt = new DataTransfer();
        finalFiles.forEach(function (f) {
          dt.items.add(f);
        });
        input.files = dt.files;
      });
    });
  }

  wireUploadCompression("doc_offre_pret", "err-doc_offre_pret");
  wireUploadCompression("doc_tableau_amortissement", "err-doc_tableau_amortissement");
  wireUploadCompression("doc_assurance_emprunteur", "err-doc_assurance_emprunteur");

  /* --------------------------------------------------------------------
     4. VALIDATION INSTANTANÉE (étape 2)
  -------------------------------------------------------------------- */
  const prenomInput = $("#prenom");
  const nomInput = $("#nom");
  const telephoneInput = $("#telephone");
  const emailInput = $("#email");
  const rgpdInput = $("#rgpd");

  const PHONE_REGEX = /^(?:(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4})$/;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validateField(input) {
    if (!input) return true;
    const value = input.value.trim();

    if (input.required && !value) {
      showError(input, "Ce champ est obligatoire.");
      return false;
    }
    if (input === telephoneInput && value && !PHONE_REGEX.test(value.replace(/\s/g, " "))) {
      showError(input, "Merci de vérifier ce numéro de téléphone.");
      return false;
    }
    if (input === emailInput && value && !EMAIL_REGEX.test(value)) {
      showError(input, "Merci de vérifier cette adresse email.");
      return false;
    }
    if (input === rgpdInput && !input.checked) {
      showError(input, "Merci d'accepter cette condition pour continuer.");
      return false;
    }
    clearError(input);
    return true;
  }

  [prenomInput, nomInput, telephoneInput, emailInput, rgpdInput].forEach((input) => {
    if (!input) return;
    const eventName = input.type === "checkbox" ? "change" : "blur";
    input.addEventListener(eventName, () => validateField(input));
    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid") === "true") validateField(input);
    });
  });

  /* --------------------------------------------------------------------
     5. SOUMISSION NETLIFY FORMS EN AJAX + TRACKING + UPLOAD DOCUMENTS
  -------------------------------------------------------------------- */
  const form = $("#lead-form");
  const formErrorSummary = $("#form-error-summary");
  const formSuccess = $("#form-success");
  const submitBtn = $("#form-submit");
  const formSuccessMessage = $("#form-success-message");
  const uploadProgress = $("#upload-progress");
  const uploadProgressFill = $("#upload-progress-fill");
  const uploadProgressLabel = $("#upload-progress-label");

  function encode(data) {
    return Object.keys(data)
      .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
      .join("&");
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const fieldsToValidate = [prenomInput, nomInput, emailInput, telephoneInput, rgpdInput];
      const allValid = fieldsToValidate.every((input) => validateField(input)) && validateDetailedPath();

      if (!allValid) {
        formErrorSummary.textContent = "Merci de corriger les champs signalés ci-dessus avant de continuer.";
        formErrorSummary.hidden = false;
        const firstError = step2.querySelector('[aria-invalid="true"]');
        if (firstError) firstError.focus();
        return;
      }

      formErrorSummary.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = "Envoi en cours…";

      const selectedParcours = parcoursRadios.find(function (r) {
        return r.checked;
      });
      const parcoursValue = selectedParcours ? selectedParcours.value : "rappel";

      const formData = new FormData(form);
      const payload = {};
      formData.forEach(function (value, key) {
        // Les fichiers ne transitent jamais par ce payload urlencodé : ils
        // sont envoyés séparément vers upload-document.js une fois le lead
        // créé dans Airtable (voir plus bas).
        if (value instanceof File) return;
        if (!(document.getElementById(key) && document.getElementById(key).disabled)) {
          payload[key] = value;
        }
      });

      // Âge calculé côté client à partir de la date de naissance, pour ne
      // pas demander deux fois la même information au visiteur.
      if (payload.date_naissance) {
        const age = computeAgeFromDateNaissance(payload.date_naissance);
        if (age !== null) payload.age = String(age);
      }
      if (payload.co_date_naissance) {
        const coAge = computeAgeFromDateNaissance(payload.co_date_naissance);
        if (coAge !== null) payload.co_age = String(coAge);
      }

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode(payload),
      })
        .then(() => {
          // Le formulaire n'est plus masqué ici de façon inconditionnelle :
          // pour le parcours "transmission directe", le masquer avant la fin
          // de l'envoi des documents provoquait un effondrement brutal de la
          // mise en page (le formulaire détaillé est bien plus haut que le
          // message de succès), donnant l'impression de revenir en haut de
          // la page. Chaque parcours gère donc sa propre transition plus bas.

          // Mémorise le parcours choisi pour adapter le message affiché sur
          // la page de remerciement (pas d'appel promis dans le parcours
          // "transmission directe"). Lecture unique, voir merci.html.
          try {
            sessionStorage.setItem("klarimo_parcours", parcoursValue);
          } catch (e) {
            /* silencieux : purement cosmétique, jamais bloquant */
          }

          // Conversions API (optionnel) : copie côté serveur de l'événement
          // "Lead", en plus du Pixel navigateur. N'échoue jamais le parcours
          // utilisateur : si la fonction n'est pas configurée (variables
          // d'environnement absentes), netlify/functions/capi-lead.js répond
          // simplement "skipped" sans erreur. On n'attend pas sa réponse
          // avant de rediriger le visiteur.
          fetch("/.netlify/functions/capi-lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: payload.email,
              telephone: payload.telephone,
              clientUserAgent: navigator.userAgent,
              eventSourceUrl: window.location.href,
            }),
          }).catch(function () {
            /* silencieux : la Conversions API est un bonus, jamais un blocage */
          });

          // Message de confirmation (email + SMS) envoyé au lead. Le texte
          // s'adapte au parcours choisi (voir netlify/functions/lead-confirmation.js).
          // Comme la Conversions API, n'échoue jamais le parcours utilisateur
          // et n'a pas besoin d'être attendu avant de rediriger.
          fetch("/.netlify/functions/lead-confirmation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prenom: payload.prenom,
              email: payload.email,
              telephone: payload.telephone,
              parcours: parcoursValue,
            }),
          }).catch(function () {
            /* silencieux : la confirmation est un bonus, jamais un blocage */
          });

          // CRM Airtable : copie chaque lead dans la base "Leads Klarimo"
          // pour pouvoir suivre son statut (à contacter, contacté, RDV
          // posé, signé...) et le montant gagné. Si la variable
          // AIRTABLE_TOKEN n'est pas configurée côté Netlify,
          // netlify/functions/airtable-lead.js répond simplement "skipped"
          // sans erreur : ne bloque jamais le parcours utilisateur.
          //
          // IMPORTANT (correctif) : dans le parcours "transmission directe",
          // la redirection vers merci.html se faisait auparavant tout de
          // suite après avoir *lancé* la création de la fiche Airtable et
          // les envois de documents, sans attendre qu'ils se terminent.
          // Or la navigation vers une nouvelle page interrompt le contexte
          // JavaScript en cours : la suite de la chaîne (récupérer le
          // recordId, puis attacher chaque fichier) ne s'exécutait donc
          // souvent jamais, ce qui expliquait la perte silencieuse des
          // documents malgré une fiche parfois bien créée. On attend donc
          // maintenant explicitement la fin de cette chaîne (fiche +
          // documents) avant de rediriger, avec un garde-fou de 20 secondes
          // maximum pour ne jamais bloquer indéfiniment un visiteur en cas
          // de réseau lent ou de panne côté Airtable. Le parcours "rappel"
          // classique n'a pas de documents à attendre : il continue de
          // rediriger immédiatement, sans attente.
          if (parcoursValue === "direct") {
            // Barre de progression : une étape pour la création de la fiche,
            // puis une étape par fichier transmis. Le nombre total de
            // fichiers est connu dès maintenant (les inputs ne changent
            // plus une fois le formulaire soumis), ce qui permet d'afficher
            // une progression réaliste plutôt qu'un simple message d'attente.
            const fileInputsAEnvoyer = [
              { input: document.getElementById("doc_offre_pret"), champ: "doc_offre_pret" },
              {
                input: document.getElementById("doc_tableau_amortissement"),
                champ: "doc_tableau_amortissement",
              },
              {
                input: document.getElementById("doc_assurance_emprunteur"),
                champ: "doc_assurance_emprunteur",
              },
            ];
            let totalFichiers = 0;
            fileInputsAEnvoyer.forEach(function (item) {
              totalFichiers += item.input && item.input.files ? item.input.files.length : 0;
            });
            const totalEtapes = 1 + totalFichiers; // 1 = création de la fiche
            let etapesTerminees = 0;

            function majProgression() {
              const pourcentage = Math.round((etapesTerminees / totalEtapes) * 100);
              if (uploadProgressFill) uploadProgressFill.style.width = pourcentage + "%";
              if (uploadProgressLabel) {
                uploadProgressLabel.textContent =
                  totalFichiers > 0
                    ? "Envoi de votre dossier… " + etapesTerminees + " sur " + totalEtapes
                    : "Enregistrement de votre dossier…";
              }
            }

            function etapeTerminee() {
              etapesTerminees++;
              majProgression();
              submitBtn.textContent =
                totalFichiers > 0
                  ? "Envoi en cours… (" + etapesTerminees + "/" + totalEtapes + ")"
                  : "Envoi en cours…";
            }

            if (uploadProgress) uploadProgress.hidden = false;
            majProgression();

            const envoiFicheEtDocuments = fetch("/.netlify/functions/airtable-lead", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
              .then(function (res) {
                return res.json();
              })
              .then(function (data) {
                etapeTerminee();
                const recordId = data && data.recordId;
                if (!recordId) return null;

                // Chaque champ peut désormais contenir plusieurs fichiers
                // (plusieurs tableaux d'amortissement si plusieurs crédits) :
                // on envoie un appel séparé par fichier, chacun s'ajoutant au
                // champ Airtable correspondant (voir upload-document.mjs).
                const uploadsEnCours = [];
                fileInputsAEnvoyer.forEach(function (item) {
                  const files = item.input && item.input.files ? Array.from(item.input.files) : [];
                  files.forEach(function (file) {
                    const uploadData = new FormData();
                    uploadData.append("recordId", recordId);
                    uploadData.append("champ", item.champ);
                    uploadData.append("file", file);
                    uploadsEnCours.push(
                      fetch("/.netlify/functions/upload-document", {
                        method: "POST",
                        body: uploadData,
                      })
                        .catch(function () {
                          /* silencieux : l'échec d'un fichier isolé ne doit pas bloquer les autres */
                        })
                        .then(function (res) {
                          etapeTerminee();
                          return res;
                        })
                    );
                  });
                });

                return Promise.all(uploadsEnCours);
              })
              .catch(function () {
                /* silencieux : même en cas d'échec, on laisse le garde-fou
                   ci-dessous décider du moment de la redirection */
                etapesTerminees = totalEtapes;
                majProgression();
              });

            const gardeFou20s = new Promise(function (resolve) {
              setTimeout(resolve, 20000);
            });

            Promise.race([envoiFicheEtDocuments, gardeFou20s]).then(function () {
              // L'événement de conversion "Lead" est déclenché sur merci.html
              // (page de confirmation), pas ici : ça garantit qu'il ne se
              // déclenche que lorsque le visiteur a réellement vu la
              // confirmation. On bascule sur l'écran de succès juste avant
              // de rediriger : la transition n'est jamais visible puisque la
              // navigation suit immédiatement.
              form.hidden = true;
              formSuccess.hidden = false;
              window.location.href = "/merci.html";
            });
          } else {
            fetch("/.netlify/functions/airtable-lead", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }).catch(function () {
              /* silencieux : le CRM est un bonus, jamais un blocage */
            });

            form.hidden = true;
            formSuccess.hidden = false;
            window.location.href = "/merci.html";
          }
        })
        .catch(function () {
          formErrorSummary.textContent = "Une erreur est survenue lors de l'envoi. Merci de réessayer, ou de nous appeler directement.";
          formErrorSummary.hidden = false;
          submitBtn.disabled = false;
          submitBtn.textContent = "Vérifier mon assurance gratuitement";
        });
    });
  }

  /* --------------------------------------------------------------------
     6. SIMULATEUR D'ÉCONOMIE
     Estimation indicative et non contractuelle : compare un taux moyen
     bancaire (contrat groupe) à un taux moyen en délégation externe.
     Le coût bancaire est calculé sur le capital restant dû actuel,
     maintenu fixe sur la durée restante (les contrats groupe recalculent
     rarement à la baisse), tandis que le coût en délégation est calculé
     sur le capital moyen restant (capital / 2), car une délégation externe
     est recalculée chaque année sur le capital réellement dû. C'est cet
     écart de mode de calcul, en plus de l'écart de taux, qui explique
     l'essentiel de l'économie potentielle. Les vrais chiffres,
     personnalisés, ne sont donnés qu'après l'étude gratuite avec un
     conseiller.
  -------------------------------------------------------------------- */
  const simCapitalInput = $("#sim-capital");
  const simDureeInput = $("#sim-duree");
  const simBtn = $("#sim-calculer");
  const simResultat = $("#sim-resultat");
  const simMontantBas = $("#sim-montant-bas");
  const simMontantHaut = $("#sim-montant-haut");

  // Taux moyens observés sur le marché (contrat groupe bancaire vs
  // délégation externe individualisée). À ajuster si les conditions du
  // marché évoluent significativement.
  const SIM_TAUX_BANCAIRE_BAS = 0.0035; // 0,35 % par an
  const SIM_TAUX_BANCAIRE_HAUT = 0.0045; // 0,45 % par an
  const SIM_TAUX_DELEGUE_BAS = 0.0015; // 0,15 % par an
  const SIM_TAUX_DELEGUE_HAUT = 0.0025; // 0,25 % par an
  const SIM_CAPITAL_MAX = 2000000;
  const SIM_DUREE_MAX = 35;

  // Coefficient de prudence appliqué à l'ensemble de la fourchette : le
  // simulateur ne connaît ni l'âge, ni l'état de santé, ni la profession
  // du visiteur (des facteurs qui influencent fortement le tarif réel en
  // délégation). On préfère donc afficher une estimation volontairement
  // conservatrice plutôt que de risquer une déception lors de l'étude
  // personnalisée : mieux vaut annoncer moins et confirmer plus en RDV.
  const SIM_COEFFICIENT_PRUDENCE = 0.7;

  function parseSimMontant(value) {
    return parseInt((value || "").replace(/[^0-9]/g, ""), 10) || 0;
  }

  function formatSimMontant(n) {
    // Arrondi à la dizaine d'euros la plus proche pour ne pas donner une
    // fausse impression de précision sur une estimation indicative.
    return new Intl.NumberFormat("fr-FR").format(Math.round(n / 10) * 10);
  }

  function computeSimulateur(capital, duree) {
    // Coût bancaire : base fixe sur le capital restant dû actuel (les
    // contrats groupe ne recalculent quasiment jamais la prime à la baisse).
    // Coût en délégation : base sur le capital moyen restant (capital / 2),
    // approximation d'un recalcul annuel sur le capital réellement dû.
    const capitalMoyenDelegue = capital / 2;
    const coutBancaireBas = capital * SIM_TAUX_BANCAIRE_BAS * duree;
    const coutBancaireHaut = capital * SIM_TAUX_BANCAIRE_HAUT * duree;
    const coutDelegueBas = capitalMoyenDelegue * SIM_TAUX_DELEGUE_BAS * duree;
    const coutDelegueHaut = capitalMoyenDelegue * SIM_TAUX_DELEGUE_HAUT * duree;

    return {
      economieBasse: Math.max(0, (coutBancaireBas - coutDelegueHaut) * SIM_COEFFICIENT_PRUDENCE),
      economieHaute: Math.max(0, (coutBancaireHaut - coutDelegueBas) * SIM_COEFFICIENT_PRUDENCE),
    };
  }

  function afficherResultatSimulateur(capital, duree) {
    const { economieBasse, economieHaute } = computeSimulateur(capital, duree);
    if (simMontantBas) simMontantBas.textContent = formatSimMontant(economieBasse);
    if (simMontantHaut) simMontantHaut.textContent = formatSimMontant(economieHaute);
    if (simResultat) simResultat.hidden = false;
  }

  // Appelée par le bouton : valide et affiche les erreurs le cas échéant.
  function calculerSimulateur() {
    if (!simCapitalInput || !simDureeInput) return;

    const capital = parseSimMontant(simCapitalInput.value);
    const duree = parseSimMontant(simDureeInput.value);
    let valid = true;

    if (!capital || capital <= 0) {
      showError(simCapitalInput, "Merci d'indiquer un capital restant dû.");
      valid = false;
    } else if (capital > SIM_CAPITAL_MAX) {
      showError(simCapitalInput, "Merci de vérifier ce montant.");
      valid = false;
    } else {
      clearError(simCapitalInput);
    }

    if (!duree || duree <= 0) {
      showError(simDureeInput, "Merci d'indiquer la durée restante en années.");
      valid = false;
    } else if (duree > SIM_DUREE_MAX) {
      showError(simDureeInput, "Merci de vérifier cette durée.");
      valid = false;
    } else {
      clearError(simDureeInput);
    }

    if (!valid) {
      if (simResultat) simResultat.hidden = true;
      return;
    }

    afficherResultatSimulateur(capital, duree);

    // Utile pour mesurer l'engagement avec le simulateur, indépendamment
    // des soumissions du formulaire principal.
    pushEvent("simulateur_calcul", { capital_restant: capital, duree_restante: duree });
  }

  // Calcul en direct pendant la saisie : dès que les deux champs contiennent
  // une valeur plausible, le résultat s'affiche sans attendre de clic, sans
  // jamais afficher de message d'erreur (ceux-ci restent réservés au bouton,
  // pour ne pas interrompre la saisie en cours). Un léger débounce évite de
  // relancer le calcul à chaque frappe.
  let simLiveTimer = null;
  function tenterCalculEnDirect() {
    if (!simCapitalInput || !simDureeInput) return;
    clearTimeout(simLiveTimer);
    simLiveTimer = setTimeout(() => {
      const capital = parseSimMontant(simCapitalInput.value);
      const duree = parseSimMontant(simDureeInput.value);
      if (capital > 0 && capital <= SIM_CAPITAL_MAX && duree > 0 && duree <= SIM_DUREE_MAX) {
        afficherResultatSimulateur(capital, duree);
      }
    }, 350);
  }

  if (simBtn) {
    simBtn.addEventListener("click", calculerSimulateur);
  }

  [simCapitalInput, simDureeInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid") === "true") clearError(input);
      tenterCalculEnDirect();
    });
  });

  /* --------------------------------------------------------------------
     7. CTA STICKY MOBILE
     Apparaît uniquement une fois le formulaire du hero dépassé, pour ne
     jamais superposer deux CTA à l'écran en même temps.
  -------------------------------------------------------------------- */
  const stickyCta = $("#sticky-cta");
  const heroFormWrapper = $("#form-lead");

  if (stickyCta && heroFormWrapper && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          stickyCta.hidden = entry.isIntersecting;
        });
      },
      { threshold: 0 }
    );
    observer.observe(heroFormWrapper);
  }

  /* Tracking des clics CTA (utile pour comparer la performance de chaque
     emplacement de bouton en A/B testing). */
  $$("[data-cta]").forEach((cta) => {
    cta.addEventListener("click", () => {
      pushEvent("cta_click", { cta_location: cta.getAttribute("data-cta") });
    });
  });
})();
