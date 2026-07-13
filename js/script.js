/* ============================================================================
   KLARIMO : script.js (vanilla JS, aucune dépendance)
   Sommaire :
   1. Utilitaires
   2. Blocs crédits dynamiques (nombre_credits)
   3. Navigation du formulaire en 2 étapes
   4. Validation instantanée
   5. Soumission Netlify Forms en AJAX + tracking
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
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: eventName }, params || {}));
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params || {});
    }
  }

  /* --------------------------------------------------------------------
     2. BLOCS CRÉDITS DYNAMIQUES
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
      pushEvent("form_step_2_view");
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
     5. SOUMISSION NETLIFY FORMS EN AJAX + TRACKING
  -------------------------------------------------------------------- */
  const form = $("#lead-form");
  const formErrorSummary = $("#form-error-summary");
  const formSuccess = $("#form-success");
  const submitBtn = $("#form-submit");

  function encode(data) {
    return Object.keys(data)
      .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
      .join("&");
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const fieldsToValidate = [prenomInput, nomInput, emailInput, telephoneInput, rgpdInput];
      const allValid = fieldsToValidate.every((input) => validateField(input));

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

      const formData = new FormData(form);
      const payload = {};
      formData.forEach((value, key) => {
        if (!(document.getElementById(key) && document.getElementById(key).disabled)) {
          payload[key] = value;
        }
      });

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode(payload),
      })
        .then(() => {
          form.hidden = true;
          formSuccess.hidden = false;

          // Conversions API (optionnel) : copie côté serveur de l'événement
          // "Lead", en plus du Pixel navigateur. N'échoue jamais le parcours
          // utilisateur.
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

          // CRM Airtable (optionnel) : copie chaque lead dans la base
          // "Leads Klarimo". N'échoue jamais le parcours utilisateur.
          fetch("/.netlify/functions/airtable-lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(function () {
            /* silencieux : le CRM est un bonus, jamais un blocage */
          });

          window.location.href = "/merci.html";
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
     est recalculée chaque année sur le capital réellement dû. Les vrais
     chiffres, personnalisés, ne sont donnés qu'après l'étude gratuite.
  -------------------------------------------------------------------- */
  const simCapitalInput = $("#sim-capital");
  const simDureeInput = $("#sim-duree");
  const simBtn = $("#sim-calculer");
  const simResultat = $("#sim-resultat");
  const simMontantBas = $("#sim-montant-bas");
  const simMontantHaut = $("#sim-montant-haut");

  const SIM_TAUX_BANCAIRE_BAS = 0.0035;
  const SIM_TAUX_BANCAIRE_HAUT = 0.0045;
  const SIM_TAUX_DELEGUE_BAS = 0.0015;
  const SIM_TAUX_DELEGUE_HAUT = 0.0025;
  const SIM_CAPITAL_MAX = 2000000;
  const SIM_DUREE_MAX = 35;

  function parseSimMontant(value) {
    return parseInt((value || "").replace(/[^0-9]/g, ""), 10) || 0;
  }

  function formatSimMontant(n) {
    return new Intl.NumberFormat("fr-FR").format(Math.round(n / 10) * 10);
  }

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

    const capitalMoyenDelegue = capital / 2;
    const coutBancaireBas = capital * SIM_TAUX_BANCAIRE_BAS * duree;
    const coutBancaireHaut = capital * SIM_TAUX_BANCAIRE_HAUT * duree;
    const coutDelegueBas = capitalMoyenDelegue * SIM_TAUX_DELEGUE_BAS * duree;
    const coutDelegueHaut = capitalMoyenDelegue * SIM_TAUX_DELEGUE_HAUT * duree;

    const economieBasse = Math.max(0, coutBancaireBas - coutDelegueHaut);
    const economieHaute = Math.max(0, coutBancaireHaut - coutDelegueBas);

    if (simMontantBas) simMontantBas.textContent = formatSimMontant(economieBasse);
    if (simMontantHaut) simMontantHaut.textContent = formatSimMontant(economieHaute);
    if (simResultat) simResultat.hidden = false;

    pushEvent("simulateur_calcul", { capital_restant: capital, duree_restante: duree });
  }

  if (simBtn) {
    simBtn.addEventListener("click", calculerSimulateur);
  }

  [simCapitalInput, simDureeInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid") === "true") clearError(input);
    });
  });

  /* --------------------------------------------------------------------
     7. CTA STICKY MOBILE
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

  $$("[data-cta]").forEach((cta) => {
    cta.addEventListener("click", () => {
      pushEvent("cta_click", { cta_location: cta.getAttribute("data-cta") });
    });
  });
})();


