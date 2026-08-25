# Spécification — détail d’un Strong dans le viewer

## 1. Objet

Cette fiche décrit le panneau lexical qui s’ouvre à droite lorsqu’un utilisateur
clique sur un mot annoté dans la vue **Bibles** du viewer.

Le panneau ne provient pas d’une seule base. Il assemble :

1. l’annotation du mot dans la Bible sélectionnée ;
2. le lexique STEP français/anglais ;
3. les données morphologiques et les relations lexicales ;
4. les entités bibliques TIPNR ;
5. les ressources avancées LSJ/TFLSJ, si leur module est installé ;
6. la concordance de la traduction dans laquelle le mot a été cliqué.

## 2. Bases utilisées

| Alias fonctionnel                                | Fichier physique                                                                       |                   Obligatoire | Rôle                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------: | ------------------------------------------------------------------- |
| `LEXIQUE_STEP`, `LEXIQUE_FR`, `MORPHOLOGIE_STEP` | `outputs/releases/strong-lexicon-modular-v1-candidate/strong_lexicon.core.sqlite`      |                           oui | Identités STEP, définitions, traductions, morphologie et relations  |
| `DICTIONNAIRE_LSJ`                               | `outputs/releases/strong-lexicon-modular-v1-candidate/strong_lexicon.resources.sqlite` |                           non | Notices LSJ/TFLSJ anglaises et françaises                           |
| `ENTITES_TIPNR`                                  | `outputs/releases/strong-lexicon-modular-v1-candidate/bible_entities.sqlite`           | oui pour le contexte biblique | Personnes, lieux, groupes, relations et références                  |
| `BIBLE_<VERSION>`                                | `outputs/releases/bible-strong-production-v5/bibles/bible-<version>-strong.sqlite`     |   oui pour la Bible concernée | Texte, annotations Strong, concordance et éventuels lemmes français |

`LEXIQUE_STEP`, `LEXIQUE_FR` et `MORPHOLOGIE_STEP` sont aujourd’hui trois
alias d’affichage pour une seule SQLite physique : le module `core`.

## 3. Déclenchement et résolution du Strong

### 3.1 Données capturées au clic

Le clic est accepté sur un élément HTML `<w strong="…">`. Le viewer conserve :

- la forme visible du mot ;
- la référence biblique ;
- la version biblique ;
- les attributs `strong`, `estrong`, `dstrong` et `ustrong`.

Ces valeurs proviennent du texte de la Bible chargée depuis sa SQLite mobile.

### 3.2 Identité utilisée pour ouvrir la fiche

Les identités candidates sont classées dans cet ordre :

1. `dStrong` ;
2. `eStrong` ;
3. `Strong` classique.

Les doublons ayant la même base classique sont supprimés. `uStrong` est capturé
avec le mot, mais n’est pas proposé directement dans le sélecteur du panneau.
Lorsqu’il existe plusieurs identités distinctes, des boutons permettent de
changer de fiche.

Le client appelle :

```text
GET /api/lexicon/entry?strong=<code>&include=extended
```

Le serveur recherche ensuite l’entrée dans cet ordre :

1. `StepEntryIdentities.stepCode` ;
2. `StepEntries.uStrong` ;
3. `StepEntries.eStrong` ;
4. repli sur `StepEntries.language + baseCode` pour un Strong classique.

## 4. Contenu du panneau

### 4.1 En-tête contextuel

Affiché :

- version biblique ;
- référence du verset ;
- forme exacte cliquée dans la traduction ;
- type d’identité sélectionné (`dStrong`, `eStrong` ou `Strong`) ;
- code sélectionné ;
- sélecteurs FR/EN, debug et fermeture.

Source : mot `<w>` de la Bible sélectionnée. Ces informations ne viennent pas
du lexique central.

### 4.2 Mot et identité

| Information affichée | Source physique                      | Règle                                                  |
| -------------------- | ------------------------------------ | ------------------------------------------------------ |
| Code STEP            | `StepEntryIdentities.stepCode`       | Repli sur le premier code de `dStrong`, puis `eStrong` |
| Strong classique     | `StepEntries.eStrong`                | Affiché si différent du code STEP                      |
| Langue               | `StepEntries.language`               | `greek` ou `hebrew`                                    |
| Sens principal EN    | `StepEntries.gloss`                  | Utilisé en anglais et comme repli                      |
| Sens principal FR    | `LexiconTranslations.gloss`          | Repli sur le gloss anglais                             |
| Mot original         | `StepEntries.original`               | Grec, hébreu ou araméen                                |
| Translittération     | `StepEntries.classicTransliteration` | Repli sur `StepEntries.transliteration`                |
| Prononciation        | `StepEntries.pronunciation`          | Bloc masqué si vide                                    |

### 4.3 Définition

En français :

1. `LexiconTranslations.meaningHtml` ;
2. sinon `LexiconTranslations.meaning` ;
3. sinon message « Aucune définition française disponible ».

En anglais :

1. `StepEntries.meaning` ;
2. sinon message « No English definition available ».

Le HTML est rendu comme contenu riche.

### 4.4 Contexte biblique

Ce bloc n’apparaît que lorsqu’une entité TIPNR correspond à l’entrée.

Ordre de correspondance :

1. égalité exacte entre `Entities.uStrong` et `StepEntries.uStrong` ;
2. sinon égalité avec `StepEntries.eStrong` ;
3. sinon même base Strong et même nom anglais que le gloss lexical.

Informations possibles :

- nom : `Entities.displayName` ou `EntityTranslations.displayName` ;
- identité : `description` ;
- résumé court : `shortDescription` ;
- synthèse biblique : `summaryHtml` ;
- résumé : `brief` ;
- article détaillé : `articleHtml` ;
- lieu : `EntityPlaces.openBibleName`, `area`, coordonnées et liens cartographiques ;
- relations : `EntityRelations`, enrichies avec le nom de l’entité cible ;
- références : `EntityRefs.refText`.

Limites d’affichage :

- 20 relations d’entités maximum ;
- 30 références visibles, puis un compteur `+N`.

### 4.5 Informations grammaticales

Le code brut vient de `StepEntries.morph`.

Le détail est recherché dans `MorphologyCodes` avec :

- `scope = lexical_brief` ;
- égalité sur `code` ou sur `normalizedCode`.

Le viewer affiche la première correspondance :

- `MorphologyCodeTranslations.meaning` en français, sinon `MorphologyCodes.meaning` ;
- `MorphologyCodeTranslations.description` en français, sinon
  `MorphologyCodes.description`.

La description est masquée lorsqu’elle est équivalente au sens après
normalisation.

### 4.6 Mots liés

Sources :

- relation : `LexiconRelations` ;
- type et labels : `RelationKinds` ;
- mot cible : `StepEntries` ;
- gloss français cible : `LexiconTranslations.gloss`.
- liste exhaustive STEP : `@StepRelatedNos2` dans les fichiers compilés
  `lexicon_greek.txt` et `lexicon_hebrew.txt`, épinglés au commit STEP enregistré
  dans `DictionaryMeta`.

La base conserve tous les faits relationnels, même lorsque plusieurs faits
portent sur la même cible :

- `same_estrong` : autre acception du même Strong étendu ;
- relations d’identité explicites (`meaning_of`, `form_of`, etc.) ;
- `step_related` : appartenance à la liste brute `@StepRelatedNos2` ;
- relations étymologiques héritées, avec résolution du Strong classique vers
  une identité STEP canonique lorsque c’est possible.

La contrainte d’unicité retire seulement les doublons strictement identiques.
Deux relations de types différents vers la même cible restent en SQLite parce
qu’elles expriment deux faits et deux provenances différents.

La présentation mobile est volontairement dédupliquée :

- `subentry` → **Autres sens**, dans la section **Sens** ;
- les cibles déjà présentées comme `subentry` sont retirées de **Mots liés** ;
- parmi plusieurs relations restantes vers la même cible, un label typé est
  préféré au label générique `mot lié STEP` ;
- `identity` → **Variantes et équivalents** ;
- `family` → **Même famille de mots**.

Ainsi, pour `H7225G`, `H7225H` reste présent en base sous
`step_related`, `has_meaning` et `same_estrong`, mais apparaît une seule fois
dans l’interface, sous **Autres sens**. Les 18 autres cibles STEP restent sous
**Mots liés**.

Pour chaque relation, le panneau affiche :

- gloss français ou anglais ;
- à défaut, translittération ou code cible ;
- label français ou anglais de la relation ;
- `toStepCode`, cliquable vers la fiche liée.

La limite est de 24 relations affichées par groupe après déduplication.

### 4.7 Pour aller plus loin

Bloc optionnel provenant de `strong_lexicon.resources.sqlite`.

Sources :

- anglais : `LexiconResources.contentHtml` ;
- français : `LexiconResourceTranslations.contentHtml`.

Le champ `contentText` n’existe plus dans le module allégé. Le serveur renvoie
une chaîne vide de compatibilité.

Les notices `TFLSJ` sont présentées comme **Dictionnaire grec détaillé**. Les
autres sources sont présentées comme **Notice complémentaire**. Le viewer
affiche au maximum cinq ressources et ignore les notices sentinelles indiquant
explicitement que LSJ ne possède pas d’entrée.

### 4.8 Emplois dans la Bible

Ce bloc ne lit pas la base du lexique. Il interroge la SQLite de la traduction
dans laquelle le mot a été cliqué :

```text
GET /api/jsonl-bibles/concordance
GET /api/jsonl-bibles/lemma-stats
```

Tables :

- `StrongCodes` : identités normalisées ;
- `WordStrongCodes` : liaison mot ↔ identité ;
- `WordSpans` : position du mot dans le texte canonique ;
- `Verses` : texte et référence ;
- `FrenchLexemes` : lemme et catégorie grammaticale, lorsqu’ils existent.

Résolution de concordance :

- code suffixé : essai `dstrong`, puis `estrong` ;
- code non suffixé : `strong` classique ;
- essai du code demandé, puis de sa forme normalisée sur quatre chiffres.

Affiché :

- traduction concernée ;
- nombre total d’occurrences exactes ;
- code et type réellement trouvés ;
- vingt contextes par page ;
- mot surligné dans le verset ;
- lemmes français regroupés, si la Bible contient des affectations lexicales ;
- filtre facultatif par lemme.

La concordance suit donc la version cliquée : cliquer dans LSG interroge la
SQLite LSG, cliquer dans DBY interroge la SQLite DBY.

## 5. Mode debug

Le debug est activé par le bouton insecte, par `?debug=1`, ou par la préférence
locale `bible-strong:lexicon-debug`.

Il ajoute :

- une étiquette jaune sous les champs indiquant leur source logique ;
- les badges de langue des contenus ;
- le Strong utilisé pour faire correspondre une entité ;
- l’état « LSJ absent » lorsqu’une notice sentinelle existe.

Le debug ne charge pas une autre fiche lexicale : l’API `include=extended` est
déjà appelée en mode normal. Il change principalement ce qui est rendu.

### 5.1 Correspondance des alias debug avec le schéma actuel

| Étiquette debug                                 | Emplacement physique actuel                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `LEXIQUE_STEP.StepEntries.*`                    | `strong_lexicon.core.sqlite → StepEntries`                                     |
| `LEXIQUE_FR.LexiconTranslations.*`              | `strong_lexicon.core.sqlite → LexiconTranslations`                             |
| `MORPHOLOGIE_STEP.*`                            | `strong_lexicon.core.sqlite → MorphologyCodes` et `MorphologyCodeTranslations` |
| `LEXIQUE_STEP.LexiconRelations.toStepCode`      | `strong_lexicon.core.sqlite → LexiconRelations.toStepCode`                     |
| `LEXIQUE_STEP.LexiconRelations.labelFr/labelEn` | En réalité `strong_lexicon.core.sqlite → RelationKinds.labelFr/labelEn`        |
| `DICTIONNAIRE_LSJ.*`                            | `strong_lexicon.resources.sqlite`                                              |
| `ENTITES_TIPNR.*`                               | `bible_entities.sqlite`                                                        |
| `BIBLE_<VERSION>.*`                             | SQLite mobile de la Bible concernée                                            |

## 6. Données actuellement désactivées

`strong_lexicon.occurrences.production.sqlite` n’est pas utilisée par le
viewer : `LEXICON_OCCURRENCES_ENABLED` vaut `false`.

Le champ `occurrences` de `/api/lexicon/entry` vaut donc `null`. Le bloc
**Emplois dans la Bible** visible aujourd’hui est alimenté par la concordance
de chaque SQLite biblique, pas par cette ancienne base globale d’occurrences.

## 7. Contrat minimal pour reproduire la fiche

Une autre application doit :

1. conserver sur chaque mot les identités `strong`, `estrong` et `dstrong` ;
2. résoudre le code vers `StepEntryIdentities` et `StepEntries` ;
3. joindre la traduction française sur `stepEntryId + language='fr'` ;
4. joindre morphologie et relations dans le module core ;
5. charger les ressources seulement si le module optionnel possède la même
   `lexiconRevision` que le core ;
6. joindre les entités d’abord par `uStrong` exact ;
7. calculer la concordance dans la SQLite de la traduction active ;
8. appliquer les mêmes ordres de repli FR/EN ;
9. traiter l’absence des modules optionnels comme une liste vide, pas comme une
   erreur.
