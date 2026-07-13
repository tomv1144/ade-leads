# Klarimo : landing page « Étude gratuite assurance emprunteur »

Landing page statique (HTML5 / CSS3 / JavaScript vanilla, zéro framework, zéro dépendance) optimisée pour un trafic Meta Ads, prête à déployer sur Netlify.

## Structure des fichiers

```
index.html                    Page principale (hero + formulaire + toutes les sections)
merci.html                    Page de remerciement (redirection après soumission)
mentions-legales.html         Mentions légales
politique-confidentialite.html Politique de confidentialité RGPD
css/style.css                 Toutes les feuilles de style (variables en tête de fichier)
js/script.js                  Logique du formulaire, validation, tracking des clics CTA
js/consent.js                 Bandeau cookies + chargement conditionnel de GTM/GA4/Pixel
netlify.toml                  Config Netlify (headers de sécurité, cache)
netlify/functions/capi-lead.js Squelette Meta Conversions API (à activer plus tard)
manifest.json, robots.txt, sitemap.xml   SEO / PWA
assets/favicon.svg            Favicon (monogramme K)
```

## À faire avant la mise en ligne (obligatoire)

Le contenu et le formulaire sont prêts. Les éléments suivants sont des **placeholders clairement identifiés** dans le code, recherchez-les avant de publier :

| Placeholder | Où le trouver | Ce qu'il faut mettre |
|---|---|---|
| `etude.klarimo.fr` | index.html, merci.html, mentions-legales.html, politique-confidentialite.html, robots.txt, sitemap.xml | Le vrai domaine ou sous-domaine de mise en ligne |
| `[Téléphone du cabinet]` | index.html, merci.html (header) | Numéro de téléphone réel |
| `GTM-XXXXXXX` | index.html, merci.html (appel `KlarimoConsent.init`) | Identifiant GTM réel |
| `G-XXXXXXXXXX` | idem | Identifiant GA4 réel |
| `0000000000000000` | idem | Meta Pixel ID réel |
| `[Forme juridique]`, `[montant]`, `[Adresse complète]`, `[Email de contact]` | footer de chaque page, mentions-legales.html | Informations légales réelles du cabinet |
| `[SIREN/SIRET]`, médiateur, etc. | mentions-legales.html | À compléter avec un professionnel du droit |
| `/assets/og-image.jpg` | index.html (Open Graph) | Ajouter une image 1200×630 (l'image n'existe pas encore, sans elle les aperçus de partage n'auront pas de visuel) |

Le numéro ORIAS (25009454) et le nom « Klarimo » sont déjà en place.

## Formulaire et Netlify Forms

Le formulaire est en 2 étapes (situation, puis coordonnées) pour maximiser le taux de complétion. Netlify détecte automatiquement le formulaire grâce à `data-netlify="true"` dans `index.html`, aucune configuration supplémentaire n'est nécessaire côté Netlify, mais pensez à activer les **notifications email** dans Site settings > Forms > Form notifications pour que le cabinet soit alerté à chaque nouvelle demande.

Les blocs « crédit n°2 à 5 » existent déjà dans le HTML (cachés/désactivés par défaut) : c'est nécessaire pour que Netlify les détecte au moment du build. Le JavaScript les active dynamiquement selon la réponse à « nombre de crédits ».

## Cookies et conformité RGPD/CNIL

GTM, GA4 et le Meta Pixel ne se chargent **qu'après consentement** de l'utilisateur (bandeau en bas de page, géré par `js/consent.js`). C'est une obligation légale en France pour tout traceur non essentiel. Si vous supprimez ce bandeau, vous n'êtes plus conforme : ne le faites pas sans solution de remplacement (bannière CMP tierce par exemple).

## Tracking et Conversions API

- `PageView` et `ViewContent` se déclenchent sur la page principale après consentement.
- `Lead` (Meta) et `generate_lead` (GA4) se déclenchent une seule fois, sur `merci.html`, pour éviter tout double comptage.
- `netlify/functions/capi-lead.js` est un squelette prêt à activer pour envoyer l'événement Lead aussi côté serveur (Conversions API), ce qui améliore la fiabilité de l'attribution. Instructions d'activation dans le fichier lui-même.

## Déploiement sur Netlify

1. Créer un nouveau site Netlify (glisser-déposer ce dossier, ou connecter un dépôt Git).
2. Aucune commande de build n'est nécessaire (`netlify.toml` le précise déjà).
3. Configurer le domaine personnalisé.
4. Activer les notifications de formulaire (voir ci-dessus).
5. Remplacer tous les placeholders du tableau ci-dessus.
6. Ajouter l'image `assets/og-image.jpg` (1200×630).

## A/B testing facile

Toutes les variables de design (couleurs, espacements, rayons) sont centralisées en haut de `css/style.css`. Pour tester une variante :
- Titre / sous-titre / texte des boutons : modifiables directement dans `index.html` (recherchez `<h1>`, `.hero-subtitle`, `data-cta`).
- Ordre des 4 cartes bénéfices : il suffit de réordonner les blocs `.benefit-card` dans le HTML.
- Chaque CTA porte un attribut `data-cta` (`hero`, `how-it-works`, `final`, `sticky`) suivi via l'événement `cta_click`, utile pour comparer leurs taux de clic respectifs dans GA4/GTM.

## Performance et accessibilité

- Aucune image lourde : uniquement des icônes SVG inline, pour un LCP rapide.
- Polices chargées avec `font-display: swap` et préconnexion.
- Formulaire entièrement accessible au clavier, erreurs annoncées via `aria-live`/`role="alert"`, contrastes conformes WCAG AA, focus visibles partout.
- FAQ en `<details>/<summary>` natif : zéro JavaScript nécessaire pour l'ouverture/fermeture, excellent pour Lighthouse et l'accessibilité.
