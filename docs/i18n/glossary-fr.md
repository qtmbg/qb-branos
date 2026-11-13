# French edition · glossary and rules

The French edition is the same site, switched. One HTML file per page, one
dictionary per page, one runtime (`js/qb-i18n.js`). This file is the
reference for anyone writing or editing a dictionary.

## How a dictionary works

```js
/* fr · tools.html */
QBI18N.add('fr', {
  "Run the scan": "Lancer le scan",
  "Step {0} of {1}": "Étape {0} sur {1}",
  "Start @@ .final-cta h2": "Commencez à",
  "Signal Scan": true
});
```

- Files live in `js/i18n/fr/<slug>.js`. The slug is the page filename
  without `.html`; blog pages are `blog-<name>`; `predictive-panel..html`
  is `predictive-panel`.
- Three files load on a French page, in this order: `common.js` (chassis and
  names), `shared.js` (strings from the shared scripts), then the page file.
  A later file overrides an earlier one. Do not repeat a key that `common.js`
  already holds.
- **A key is one text node, exactly as the browser holds it**: entities
  decoded, runs of whitespace collapsed to one space, ends trimmed. Inline
  tags split a sentence into several nodes. `Idea in, <em>brand out</em>`
  is two keys: `"Idea in,"` and `"brand out"`. Write each French fragment so
  the sentence reads right once they sit side by side again.
- In React (JSX), `<p>Step {n} of {total}</p>` is four nodes: `"Step"`,
  the number, `"of"`, the number. A template literal
  `` `Step ${n} of ${total}` `` is one node, matched by the pattern key
  `"Step {0} of {1}"`. Placeholders may move in the value.
- `"text @@ selector"` applies only inside that CSS selector. Use it when a
  short fragment needs two renderings on one page.
- `true` means the string stays as written. Use it for names, units, codes.
  It still counts as covered in the audit.
- Attributes translated: `placeholder`, `title`, `aria-label`, `alt`,
  `data-label`, `data-tooltip`, `data-tip`, button `value`, and the
  description, Open Graph and Twitter meta tags. The `<title>` text too.
- `alert()`, `confirm()`, `prompt()` and canvas text go through the same
  dictionary.
- `QBI18N.include('fr', 'sensescape')` pulls another page's dictionary in.
  A PDF view uses it to show the labels of the tool that produced it.
- `QBI18N.css('fr', '…')` adds CSS that is live only in French, for the few
  places where the French line needs another measure. Sizes come from the
  `--step-*` and `--space-*` tokens, never a literal.
- The runtime never changes data. Values saved to the Brand Profile, sent to
  a model or used as lookup keys stay in English; only what is painted
  changes. So a label that is also a stored value needs an entry on every
  page that shows it.

## Tools

```
node tests/i18n/i18n-audit.mjs --collect <page.html>   strings painted on load with no entry
node scripts/i18n/extract.mjs <page.html>              strings in the source with no entry
node tests/i18n/i18n-audit.mjs <page.html>             pass or fail, both languages
```

The extractor over-reports. Class names, ids and keys are noise. Everything a
visitor can read is yours: questions, options, results, buttons, errors,
loading lines, empty states, tooltips, PDF labels, share text.

## Voice in French

The Voice Codex applies in French exactly as in English. A thoughtful
founder speaking, not a company.

- **Vouvoiement.** The reader is "vous", always. Brand MRI already ships
  this way.
- Short sentences. Fragments with periods are welcome: « Trois étapes.
  C'est tout. »
- No em dash in page text. Use a period, a comma or two sentences. The one
  exception is the title tag on the homepage, as in English.
- No exclamation points.
- Sentence case. French capitalises the first word and proper nouns, nothing
  else. A label that is upper case in English stays upper case, with its
  accents: « GRATUIT À VIE ».
- Banned, as their English twins are: vraiment, très, juste, littéralement,
  afin de, au final, booster, débloquer, libérer le potentiel, sans effort,
  sans friction, fluide (as a selling word), de pointe, révolutionnaire,
  propulsé par l'IA, robuste, tirer parti de, parcours (for a user path),
  passer au niveau supérieur, se démarquer de la concurrence.
- Typography: typographic apostrophe ’. Guillemets « » with a no-break
  space inside. A no-break space before `:`, `;`, `?`. Prices as `97 $`,
  `97 $ par mois`. Percentages as `80 %`.
- Translate what is there. Do not add a claim, a number, a benefit or a
  testimonial. Do not soften a limit or a price.
- Keep it as short as the English where it sits in a button, a nav item, a
  tag or a table header.

## Names that stay in English

Written exactly like this, never translated, never recased:

BrandOS · Quantum Branding · by Quantum Branding (the lockup line) ·
The Collapse · Observe, Collapse, Build, Hold (the four movements, as names) ·
Signal Scan · Brand Soul Map · Archetype Compass · The Profiles · War Table ·
War Room · Sensescape · Visual DNA · Voice Guide · Predictive Panel ·
Brand MRI · Atelier · Starter · QBP · Quantum Brand Profile (the full name
behind QBP) · Soul Map · Codex · Entangled Time · the four persona names
(Blank Slate, Doubter, Player, Multi-Brand) · The Guide · the featured-by list.

**Testimonials stay verbatim, in English.** They are real people's words.
The name and the quote take `true`; the role under the name is translated.

The twelve archetype names stay in English when they are names
(« The Sage »). Their descriptions are translated.

## Fixed renderings

| English | French |
|---|---|
| Brand Profile | Profil de marque |
| brand operating system | système d’exploitation de marque |
| Idea in, brand out | Une idée entre, une marque sort |
| From idea to orbit. | De l’idée à l’orbite. |
| founder | fondateur |
| the practice (Quantum Branding) | le cabinet |
| movement (of The Collapse) | mouvement |
| agent | agent |
| tool | outil |
| free | gratuit |
| Free forever | Gratuit à vie |
| No credit card | Sans carte bancaire |
| Sign in / Sign out | Connexion / Déconnexion |
| Start free | Démarrer gratuitement |
| Pricing | Tarifs |
| Account | Compte |
| Archive | Archives |
| Foundation | Fondation |
| Brand document | Document de marque |
| insight | constat |
| archetype | archétype |
| positioning | positionnement |
| brand voice | voix de marque |
| tagline | signature |
| audience | audience |
| Loading… | Chargement… |
| Something went wrong. | Une erreur est survenue. |
| Try again | Réessayer |
| Save | Enregistrer |
| Copy / Copied | Copier / Copié |
| Download | Télécharger |
| Back / Next / Continue | Retour / Suivant / Continuer |
| Step | Étape |
| Results | Résultats |
| Approve | Valider |
| Revise / Revision | Réviser / Révision |
| artifact | livrable (never « artefact ») |
| Sensory World | Monde sensoriel |
| Visual Language | Langage visuel |
| Strategic Position | Position stratégique |
| Discovery (phase label) | Découverte |
| upgrade | passer à Starter |
| Manifesto Line | Phrase manifeste |
| Voice Notes | Notes sur la voix |
| The Spark | L’Étincelle |
| Brand Core | Cœur de marque |
| Core motivation / Core fear | Motivation profonde / Peur profonde |
| Binding constraint | Contrainte limitante |
| NOW / NEXT / LATER / PARK | MAINTENANT / ENSUITE / PLUS TARD / EN RÉSERVE |
| Content Repurposing Engine | Moteur de déclinaison de contenu |
| repurpose | décliner, déclinaison |
| journey (a buyer's) | cheminement (« parcours » is banned) |
| approval loop round | Tour |
| Marketing deck | Deck marketing |
| We hit a snag. | Un accroc est survenu. |
| Overall | Global |
| Door 01: I have an idea | Porte 01 : J’ai une idée |
| Door 02: Something feels off | Porte 02 : Quelque chose cloche |
| Door 03: Competition coming fast | Porte 03 : La concurrence arrive vite |
| Door 04: I build for clients | Porte 04 : Je construis pour des clients |

Banner, verbatim in French: « Signal Scan est en ligne. Diagnostic de marque
gratuit. 5 minutes pour votre premier constat. Lancez le vôtre → »

Footer line: « BrandOS est un produit de Quantum Branding, le cabinet
indépendant fondé par Nizzar Ben Chekroune. »

## Keeping it consistent

```
node scripts/i18n/consistency.mjs      strings rendered two ways, and voice breaches
python3 scripts/i18n/set-value.py "<key>" "<french>" file.js ...   settle one term
```

Some strings differ on purpose: "Light" is « Clair » for a colour and
« Léger » for a weight. A product term never should.

## What a dictionary cannot reach

- JSON downloads. They are data, and their keys stay in English.
- Text packs (.txt, .md), clipboard copies and email links ARE translated,
  line by line: the whole line first (exact or pattern key), then a
  `Label: value` line or a marked-up heading by its label. A line with no
  entry is left exactly as written. Their entries sit at the end of the
  page dictionary under "Exported text". Checked by
  `node tests/i18n/exports.mjs`.
- Text the model writes. The server tells the model to answer in French
  (`agents/lang.js`), and to return fixed labels in English so the
  interface can match and translate them.
- What the founder typed. It is never read or changed.

## Colour

French reverses the pair. Where English sets ink on cream, French sets cream
on ink. The swap is one token block in `js/qb-i18n.js`; no page carries its
own French colours. Illustrations keep their cream card.
