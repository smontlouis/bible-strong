# Exemples de Strong par type d’entité biblique

## Résultat

L’interface affiche dix libellés : trois tirés de `category` (`person`, `place`, `group`) et
sept tirés de `type` lorsque la catégorie est autre (`Supernatural`, `Time`, `Musical`, `Other`,
`Title`, `Star`, `Language`). La sélection vient de
`src/features/lexique/StrongDetailUI.tsx:278-284` et les libellés français de
`i18n/locales/fr/translation.json:1237-1253`.

| Type affiché | Strong grec à examiner | Strong hébreu à examiner |
|---|---|---|
| Personne | `G4074G` — Pierre | `H1732` — David |
| Lieu | `G3478` — Nazareth | `H3389` — Jérusalem |
| Groupe | `G4658` — Scythes | `H0567` — Amoréens |
| Être surnaturel | `G0735` — Artemis | `H7854` — Satan |
| Temps | `G3904` — jour de la Préparation | `H7676` — Sabbat |
| Élément musical | `G5614` — Hosanna | `H5542` — Sela |
| Autre entité | `G2454` — judaïsme | `H3882` — Léviathan |
| Titre | `G4461` — Rabbi | `H2967` — Tarpélien |
| Astre | **Aucune entité grecque publiée** ; repli lexical : `G0792` — étoile | `H3598` — Pléiades |
| Langue | `G1673` — grec | `H0762` — araméen |

Chaque exemple sans mention de repli est un `Entities.uStrong` effectivement présent, possède
une traduction française et au moins une référence biblique dans l’artefact publié. `G0792`
existe dans le lexique principal (`StepEntryIdentities.stepCode`) mais n’a pas de fiche
`Entities` : il permet d’analyser le mot grec « étoile », pas de tester la carte d’entité Astre.

## Vérification reproductible

Le dépôt déclare l’artefact officiel des entités, son entrée SQLite et sa version de schéma dans
`src/helpers/strongLexiconPublications.ts:34-40`. La requête a été exécutée sur la copie primaire
installée et consommée par le simulateur :

```text
/Users/stephane/Library/Developer/CoreSimulator/Devices/
3A9C37C8-5921-4400-B7DC-87E3C28931CE/data/Containers/Data/Application/
E44FE2A2-EF63-40EF-A215-8B17C455FDCF/Documents/SQLite/shared/strong-lexicon/
bible_entities.production.sqlite
```

Son SHA-256 (`09734b19c41712338b0d37997ac5562d1835e3d306063ce48703e9f32f7b1011`)
est identique à celui de l’entrée extraite de l’artefact déclaré. La table a été interrogée ainsi :

```sql
WITH examples(type_label, language, uStrong) AS (
  VALUES
    ('Personne', 'G', 'G4074G'), ('Personne', 'H', 'H1732'),
    ('Lieu', 'G', 'G3478'), ('Lieu', 'H', 'H3389'),
    ('Groupe', 'G', 'G4658'), ('Groupe', 'H', 'H0567'),
    ('Être surnaturel', 'G', 'G0735'), ('Être surnaturel', 'H', 'H7854'),
    ('Temps', 'G', 'G3904'), ('Temps', 'H', 'H7676'),
    ('Élément musical', 'G', 'G5614'), ('Élément musical', 'H', 'H5542'),
    ('Autre entité', 'G', 'G2454'), ('Autre entité', 'H', 'H3882'),
    ('Titre', 'G', 'G4461'), ('Titre', 'H', 'H2967'),
    ('Astre', 'H', 'H3598'),
    ('Langue', 'G', 'G1673'), ('Langue', 'H', 'H0762')
),
ref_counts AS (
  SELECT entityId, count(*) AS refs FROM EntityRefs GROUP BY entityId
),
fr AS (
  SELECT entityId, displayName FROM EntityTranslations WHERE language = 'fr'
)
SELECT x.type_label, x.language, x.uStrong, e.category, e.type,
       coalesce(fr.displayName, e.displayName) AS name,
       coalesce(ref_counts.refs, 0) AS refs
FROM examples x
JOIN Entities e ON e.uStrong = x.uStrong
LEFT JOIN fr ON fr.entityId = e.id
LEFT JOIN ref_counts ON ref_counts.entityId = e.id;
```

L’absence grecque pour `Star` est vérifiée par :

```sql
SELECT count(*)
FROM Entities
WHERE type = 'Star' AND substr(uStrong, 1, 1) = 'G';
-- 0
```

Le repli `G0792` est vérifié dans l’artefact `core` déclaré à
`src/helpers/strongLexiconPublications.ts:18-24`, également depuis la copie installée voisine
`strong_lexicon.core.sqlite` :

```sql
SELECT i.stepCode, e.original, e.transliteration, e.gloss
FROM StepEntries e
JOIN StepEntryIdentities i ON i.stepEntryId = e.id
WHERE i.stepCode = 'G0792';
-- G0792 | ἀστήρ | astēr | star
```

## Limites et ambiguïtés

- `category` et `type` sont des `string`, pas des unions fermées
  (`src/features/resources/strongLexiconAccess.ts:47-68`) : la liste ci-dessus est celle que
  l’interface traduit explicitement, pas une garantie de fermeture du modèle.
- Les types SQLite `Male` et `Female` ne sont pas affichés séparément : toute entité de catégorie
  `person` porte le libellé « Personne » (`src/features/lexique/StrongDetailUI.tsx:279`).
- `Autre entité` est à la fois un libellé explicite pour `type = 'Other'` et le comportement visuel
  générique de la catégorie `other` (`src/features/lexique/strongEntityPresentation.ts:6-34`).
- La classification hébraïque `H2967` comme `Title` est éditorialement surprenante
  (« Tarpélien », décrit comme un groupe de fonctionnaires), mais c’est l’un des deux seuls
  enregistrements hébreux publiés pour ce type ; il est conservé ici sans le reclasser.
- Le fichier SQLite n’est pas versionné dans Git : le résultat reflète la copie primaire installée,
  identique octet pour octet à l’artefact officiel actuellement pointé par le code. La fiche de
  Pierre versionnée dans
  `src/features/lexique/prototypes/strong-detail/strong-detail.fixture.json:7-146` confirme
  indépendamment l’exemple `G4074G`.
