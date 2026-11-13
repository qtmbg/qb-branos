/* fr · artifact.html
   Glossary and rules: docs/i18n/glossary-fr.md
   The page body is built by js/qb-artifact-renderer.js, whose strings are in
   shared.js along with the headings each agent writes into a livrable. */
QBI18N.add('fr', {
  "Artifact · BrandOS": "Livrable · BrandOS",

  /* Share actions */
  "Link copied": "Lien copié",
  "Copy failed": "Copie impossible",
  "Download starting…": "Le téléchargement démarre…",
  "Download unavailable": "Téléchargement indisponible",
  "Download failed": "Téléchargement impossible"
});

/* Exported text. The subject and body of the "email this" link.
   They never reach the DOM, so artifact.html asks QBI18N.text() for them. */
QBI18N.add('fr', {
  "Your BrandOS artifact": "Votre livrable BrandOS",
  "Read it here: {0}": "À lire ici : {0}"
});
