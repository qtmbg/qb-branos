# BUILD-SPEC · template lisadoc
Spécification de construction d'un site de médecin spécialiste libéral.
Version 1.0 · 5 septembre 2026 · à donner telle quelle à un agent de développement.

> Ce fichier décrit **une structure**, jamais un contenu médical.
> Aucune valeur clinique, aucun délai, aucune phrase de page d'acte n'y figure.
> Le contenu vient de l'entretien avec le praticien et repart signé par lui.

---

## 01 · PRINCIPE

**Règle directrice, qui tranche tous les arbitrages :**
une page par question que se pose un patient, jamais une page par service que vend le cabinet.

**Trois règles dérivées :**
1. Le premier niveau de navigation porte le mot du patient, jamais celui du médecin.
2. La conversion arrive après l'information, jamais avant.
3. Tout contenu publié porte un auteur identifiable et une date de vérification.

**Interdits absolus, sur tout le site :**
- avis, notes, témoignages de patients, sous quelque forme que ce soit
- photographies avant/après, ou toute image suggérant un résultat garanti
- superlatif, promesse de résultat, comparaison avec un autre praticien
- publicité, référencement payant, mot-clé dans le nom de domaine
- cookie de traçage, script tiers, bandeau de consentement
- carrousel, fenêtre surgissante, discussion automatique, compte à rebours
- balisage `AggregateRating`, `Review`, ou `Offer` portant le prix d'un acte
- texte justifié, contenu accessible au seul survol

---

## 02 · ARBORESCENCE

### Système d'adresses
```
/                              accueil
/le-docteur/                   praticien
/le-cabinet/                   lieu, accès, équipe
/premiere-consultation/        parcours et délais
/honoraires/                   tarifs, conventionnement
/contact/                      rdv, plan, horaires
/[pole]/                       hub de pôle
/[pole]/[acte]/                page d'acte
/pathologies/[pathologie]/     page de pathologie   (palier Autorité)
/questions/                    index des questions
/questions/[question]/         question patient      (brique Q/R)
/mentions-legales/
/politique-de-confidentialite/
/accessibilite/
```

### Contraintes d'adresses
- minuscules, sans accent, séparateur trait d'union, barre oblique finale
- deux niveaux au maximum, jamais de date ni d'identifiant technique
- le segment porte le mot du patient, pas l'intitulé de la nomenclature
- toute adresse retirée reçoit une redirection permanente unique, jamais en chaîne

### Paliers
| Palier | Pages | Composition |
|---|---|---|
| Identité | 10 | socle 6 + 4 actes cœur, sans pôle |
| Visibilité | 34 | socle 6 + 4 pôles + 24 actes |
| Autorité | 82 | socle 6 + 4 pôles + 48 actes + pathologies + index questions |

---

## 03 · GABARITS

Douze types. Chaque type = sections ordonnées + budget de mots + composants appelés + balisage.

| # | Type | Mots | Sections | Composants |
|---|---|---|---|---|
| 01 | accueil | 700-900 | hero, pôles, praticien, parcours, contact | 01 02 04 16 17 20 |
| 02 | praticien | 700-1000 | identité, formation, parcours, orientations, consultation | 01-04 14 15 16 17 |
| 03 | cabinet | 400-600 | accès, transports, stationnement, équipe, horaires | 01-04 17 20 |
| 04 | pôle | 500-700 | intro, liste d'actes, quand consulter, contact | 01-04 07 19 17 |
| 05 | **acte** | 1100-1400 | **voir section 04** | 01-15 17 19 |
| 06 | pathologie | 900-1200 | définition, symptômes, examens, traitements, questions | 01-12 14 15 17 19 |
| 07 | parcours | 800-1000 | étapes numérotées, délais, documents | 01-04 09 13 17 |
| 08 | honoraires | 500-700 | conventionnement, actes, dépassements, remboursement, devis | 01-04 11 12 13 17 |
| 09 | question | 200-400 | question, réponse signée, acte lié | 01-04 10 15 19 |
| 10 | index questions | 300-500 | filtres par pôle, liste | 01-04 12 |
| 11 | contact | 300-500 | rdv, téléphone, plan, horaires | 01-04 17 20 |
| 12 | légale | libre | texte | 01 04 |

Budget de mots = cahier des charges de rédaction. Sous le plancher, la page ne répond pas.
Au-dessus du plafond, elle n'est plus lue sur téléphone.

---

## 04 · PAGE D'ACTE · les onze sections

Ordre strict, identique sur toutes les pages d'acte, sans exception.

| # | Titre affiché | Rôle | Forme |
|---|---|---|---|
| 00 | En bref | bloc de réponse extractible, en tête | 5 faits : anesthésie, durée, hospitalisation, arrêt de travail, délai de résultat |
| 01 | Qu'est-ce que [acte] | définition, synonymes patients | 2 paragraphes |
| 02 | Est-ce pour vous | indications en situations vécues | liste à puces |
| 03 | Le mot du Dr [X] | **verbatim signé, tiré de l'entretien** | 3 à 5 phrases, bloc distinct, mention « entretien du [date] » |
| 04 | Comment ça se passe | avant / le jour / après | 3 sous-sections, chiffrées |
| 05 | Les suites | douleur, arrêt, sport, conduite, délais | liste à puces |
| 06 | Les résultats | factuel, sans image, sans promesse | 1 à 2 paragraphes |
| 07 | Risques et complications | information loyale | liste à puces, franche |
| 08 | Tarifs et prise en charge | conventionnement, base, dépassement, devis | tableau + paragraphe |
| 09 | Questions des patients | 4 au lancement, puis brique vivante | accordéon, chaque réponse datée et signée |
| 10 | Prendre rendez-vous | conversion | bloc final |

**Blocs périphériques obligatoires :**
- panneau latéral collant : rdv + téléphone + les 5 faits de la section 00
- encart réglementaire : risques, devis, délai de réflexion légal si applicable
- bloc sources : 2 à 4 renvois autorités sanitaires et sociétés savantes
- actes associés : 3 liens, choisis par proximité de décision
- lien vers `/premiere-consultation/` et `/honoraires/`
- ligne de vérification : « Contenu vérifié le [date] par le [Dr X] »

**Titres :**
- balise titre : `[Acte] à [Ville] · Dr [Nom], [spécialité]`
- H1 : surtitre `[ACTE] À [VILLE]` + phrase de bénéfice en clair
- description : une phrase factuelle, durée, anesthésie, cabinet. Aucune promesse.

---

## 05 · COMPOSANTS

Vingt briques. Aucune autre n'est créée sans décision explicite.

**Structure.** 01 en-tête · 02 menu des pôles · 03 fil d'Ariane · 04 pied de page · 05 panneau latéral collant
**Contenu.** 06 bloc en bref · 07 section de texte · 08 liste d'indications · 09 étapes · 10 citation du praticien · 11 tableau tarifs · 12 accordéon questions
**Confiance.** 13 encart réglementaire · 14 bloc sources · 15 ligne de vérification · 16 carte praticien
**Action.** 17 bloc rendez-vous · 18 formulaire question · 19 actes associés · 20 carte et accès

**Comportement mobile, spécifié une fois :**
- 05 devient une barre basse à deux actions : appeler, prendre rendez-vous
- 02 s'ouvre en pleine page
- 12 se replie entièrement
- 11 passe en liste
- tout le reste : conçu pour téléphone d'abord, élargi ensuite

**Composant 18, règles non négociables :**
1. avertissement d'urgence avant la saisie, avec redirection en cas de détection
2. le formulaire décourage le cas personnel, anonymise à la réception, ne conserve rien
3. une question n'apparaît qu'après réponse et validation
4. aucune notation des réponses
5. validation de conformité et de forme seulement, jamais du contenu médical

---

## 06 · MODÈLE DE DONNÉES

Un dossier par praticien. Format YAML, un fichier par entité.

### `praticien.yml`
```yaml
nom: ""
titre: ""            # Dr, Pr
rpps: ""
specialite: ""
diplomes: [{intitule, universite, annee}]
formations: [{intitule, organisme, annee}]
titres_hospitaliers: []
societes_savantes: []
langues: []
conventionnement: ""      # secteur 1 | secteur 2 | secteur 2 OPTAM | non conventionné
moyens_paiement: []
lieux: [{nom, adresse, code_postal, ville, horaires, acces, transports,
         stationnement, ascenseur, accessibilite_pmr}]
photo_portrait: ""
photos_cabinet: []
trois_sentiments: []      # direction visuelle, choisie pendant l'entretien
pourquoi_cette_specialite: ""   # verbatim entretien
ce_que_je_dis_toujours: ""      # verbatim entretien
```

### `actes/[slug].yml`
```yaml
slug: ""
nom_patient: ""        # le mot du patient → titre et adresse
nom_medical: ""        # la nomenclature
pole: ""
synonymes: []
niveau: ""             # ne_fait_pas | fait | veut_developper | coeur_expertise
definition: ""
indications: []
contre_indications: []
anesthesie: ""
duree: ""
hospitalisation: ""
preparation: []        # avant
deroule: []            # le jour
suites: []             # après
arret_travail: ""
reprise_sport: ""
conduite: ""
delai_resultat: ""
risques: []
prise_en_charge:
  conventionne: null
  base_remboursement: ""
  depassement: ""
  devis: true
  delai_legal: ""      # si applicable
questions: [{q, reponse, date, signe_par}]
verbatim_praticien: ""  # section 03, obligatoire
sources: [{libelle, url}]
actes_associes: []
verifie_le: ""
signe_par: ""
```

### Règle de publication
`verifie_le` et `signe_par` vides ⇒ **la page ne se génère pas**.
Le contrôle est mécanique, pas humain.

### Origine des champs
- ~80 % pré-remplis avant l'entretien : nomenclature, structure, sources
- le praticien corrige
- `verbatim_praticien`, délais réels, contre-indications retenues : sa bouche uniquement

---

## 07 · BALISAGE

Un seul bloc `application/ld+json` par page, en `@graph`, avec identifiants réutilisables.

**Sur toutes les pages :** `WebSite` · `Physician` (`@id: #doc`) · `MedicalBusiness` (`@id: #cab`) · `BreadcrumbList`

| Type de page | Ajoute |
|---|---|
| praticien | `#doc` enrichi : `medicalSpecialty`, `alumniOf`, `hasCredential`, `memberOf`, `identifier` (RPPS) |
| cabinet | `#cab` enrichi : `address`, `geo`, `openingHoursSpecification`, `isAcceptingNewPatients`, `paymentAccepted` |
| pôle | `CollectionPage` + `ItemList` des actes |
| acte | `MedicalProcedure` (`bodyLocation`, `preparation`, `howPerformed`, `followup`, `performer` → `#doc`) + `FAQPage` |
| pathologie | `MedicalCondition` (`signOrSymptom`, `possibleTreatment` → acte) |
| parcours | `HowTo`, une étape par temps du parcours |
| question | `QAPage` + `author` → `#doc` + `dateModified` |

**Règle de probité :** on ne déclare que ce qui est visible sur la page.
**Jamais :** `AggregateRating`, `Review`, `Offer` avec prix d'acte, `upvoteCount`.
**Contrôle :** zéro erreur à l'outil de test, un seul bloc par page, aucun nœud orphelin, dates réelles.

---

## 08 · JETONS DE STYLE

*À compléter au premier site. Deux décisions ouvertes : palette et couple typographique.*

Forme attendue :
```
--encre       texte, traits
--papier      surface par défaut
--surface     blocs de preuve
--calme       fonds de section, décoration seulement
--accent      un seul par page : boutons, chiffre important
--secondaire  légendes, métadonnées
```
Trois sentiments choisis avec le praticien pendant l'entretien pilotent la palette et l'accent
typographique. La structure ne change jamais : *une structure éprouvée, un habillage qui vous ressemble.*

**Typographie :** une famille de titres, une famille de texte, chiffres tabulaires dans les tableaux.
Trois fichiers de police au maximum, hébergés sur le domaine.

---

## 09 · BUDGETS

### Performance, vérifiée à chaque livraison
| Mesure | Seuil |
|---|---|
| poids transféré, page d'acte | < 250 Ko |
| requêtes réseau | < 15 |
| domaines tiers | 0 |
| cookies | 0 |
| contenu interactif, mobile 4G | < 2 s |
| fichiers de police | ≤ 3 |
| images au premier écran | ≤ 1 |

### Accessibilité
| Mesure | Seuil |
|---|---|
| corps de texte, pages patient | ≥ 17 px |
| contraste, texte courant | ≥ 4,5 |
| contraste, grands titres | ≥ 3 |
| longueur de ligne | 60 à 75 signes |
| zone tactile | ≥ 44 × 44 px |
| navigation clavier | complète, focus visible |
| texte alternatif | sur chaque image porteuse de sens |

Un site qui dépasse un seuil ne part pas.

---

## 10 · CONTRÔLES DE LIVRAISON

À passer et à signer avant chaque mise en ligne.

- [ ] tous les seuils de la section 09 vérifiés, mobile et bureau
- [ ] balisage sans erreur, un seul bloc par page, aucun nœud orphelin
- [ ] chaque page d'acte porte ses onze sections, aucune vide
- [ ] chaque affirmation médicale signée et datée
- [ ] aucun avis, avant/après, superlatif, comparaison
- [ ] honoraires et dépassements écrits en clair
- [ ] anciennes adresses redirigées une à une, sans chaîne
- [ ] fiches externes mises en cohérence : Ordre, cartographie, agenda, clinique
- [ ] mesure des demandes de rendez-vous branchée et testée
- [ ] domaine et identifiants remis au praticien, par écrit

---

## Ce que la machine ne fait pas

**Confiable à une machine :** gabarits, balisage, maillage, variantes d'habillage, mise en forme des
fiches, première rédaction des sections 01, 02, 04, 05, 06 à partir des sources, contrôle des seuils.

**Jamais confiable à une machine :** l'entretien, le choix des verbatims, l'exactitude médicale,
les délais réels de la pratique, les contre-indications retenues, la décision de publier.

> Une machine met en forme. Un praticien engage sa responsabilité.
