# Release Lexicon V3 anglaise `core-en`

Date de publication : 2026-07-13

## Résultat

La release anglaise est publiée dans un nouveau fichier distinct :

```text
data/dictionaries/strong_lexicon.en.core.production.sqlite
```

| Propriété                        |                                                             Valeur |
| -------------------------------- | -----------------------------------------------------------------: |
| Release                          |                                       `lexicon-v3-en-2026-07-13.1` |
| Profil                           |                                                          `core-en` |
| Entrées                          |                                                             22 717 |
| Glosses EN                       |                                                             22 717 |
| Meanings EN                      |                                                             22 717 |
| Champs EN `auto_validated`       |                                                             45 434 |
| Traductions ou statuts FR        |                                                                  0 |
| Carriers                         |                                                                  0 |
| Tables de ressources historiques |                                                                  0 |
| Violations FK                    |                                                                  0 |
| Intégrité SQLite                 |                                                               `ok` |
| SHA-256 du fichier               | `5d8e411e751e8a17e4e0ab850629f6932f329b8211766d2adefad50341d293f2` |
| Empreinte logique projetée       | `82ccd5e3859fd1057802de380280397525b006812fc9bd27b32e2519c14406a6` |
| Empreinte du snapshot de release | `7d643c0a9fa72fe7258071b23e363c651d0162517078f2d0901408cb599d8c17` |

La projection a utilisé `secure_delete`, un journal en mémoire et `VACUUM`.
Les traductions, les carriers et les ressources ne sont donc pas seulement
masqués : ils sont absents du profil et les tables de ressources ont été
retirées physiquement.

## Ce qui a été validé

Le contenu STEP reste la source primaire quand son rattachement exact est
prouvé. OpenScriptures, TIPNR, TAGNT et TAHOT servent de corroboration et de
contre-preuve. Une divergence ne déclenche jamais à elle seule une réécriture :
la sélection est liée aux identités STEP exactes, aux suffixes sensibles à la
casse, aux sources épinglées et aux décisions scellées.

Les 65 glosses hébreux restés ambigus après les portes génériques ont été relus
exhaustivement puis scellés :

| Décision                               | Nombre |
| -------------------------------------- | -----: |
| Conserver le gloss STEP                |     31 |
| Remplacer par une valeur source exacte |     30 |
| Reconstruction éditoriale bornée       |      4 |

Les 208 meanings hébreux résiduels ont fait l'objet de deux audits indépendants
et d'une adjudication finale exhaustive :

| Publication finale             | Nombre |
| ------------------------------ | -----: |
| Meaning STEP brut              |    132 |
| Section STEP spécifique        |     18 |
| Section legacy générale exacte |      1 |
| Companion exact                |     14 |
| Reconstruction éditoriale      |     43 |

Le registre canonique des meanings a pour digest
`f088e435398d2ee86b55d7a4fe65b5047596470125b6bfeebcec81fadd956c75`.
Toute dérive d'identité, de contenu, de corpus d'occurrences ou d'empreinte de
source fait échouer la publication en mode fermé.

Le symbole `§` n'a pas été supprimé comme un déchet. Il sépare la section STEP
spécifique du contexte legacy/général. Les 4 094 notices concernées conservent
leur HTML brut en provenance ; l'auditeur vérifie ensuite la section réellement
publiée, le contexte mis en quarantaine et l'assertion source exacte. Résultat :
4 094 notices auditées, 0 violation.

## Corrections d'identité hébraïque

Dix entrées ont reçu 13 corrections certaines de forme ou de translittération.
Le `eStrong`, le `dStrong`, le `uStrong` et la morphologie restent inchangés.

| Entrée   | Correction publiée                                              |
| -------- | --------------------------------------------------------------- |
| `H1276`  | `be.ri` → `be.rim`                                              |
| `H2050`  | `ha.tat` → `hut`                                                |
| `H2654B` | `ch.ph` → `cha.phats`                                           |
| `H2679`  | forme complète `חֲצִי הַמְּנֻחוֹת`; translittération corrigée   |
| `H2680`  | retrait du mot étranger à l'identité; translittération corrigée |
| `H3491`  | `ya.tur` → `ye.tur`                                             |
| `H4192`  | `mut` → `la.ben`                                                |
| `H4360`  | `mikh.lul` → `makh.lul`                                         |
| `H5718O` | `עֲדָיָ֫הוּ` / `a.da.yah` → `עֲדָיָא` / `a.da.ya`               |
| `H8530`  | `tal.piy.yah` → `tal.piy.yot`                                   |

Le registre runtime est scellé par le digest
`eebb9d84c63f12a9c637d6e13b7108fa67853ee14b7a7f131889dd8477074689`.
`H7156H` a été explicitement contrôlé et laissé inchangé : son apparent écart
est un sous-STEP valide, pas une incohérence à corriger.

## Contrôles de release

- Typecheck et tests : 293/293 réussis.
- File de revue EN : 0 entrée.
- Blockers et warnings ouverts : 0.
- Audit TBESH : 4 094/4 094, 0 violation.
- Plan de release `core-en` : 0 erreur.
- Candidate vérifiée contre le snapshot courant, puis promue et revérifiée.
- Comparaison exhaustive release → fichier projeté : 22 717/22 717 entrées,
  0 identité manquante ou différente, 0 contenu différent et 0 statut/hash de
  champ différent.
- Échantillon indépendant : 120/120 entrées et 240/240 champs réussis,
  couvrant 35 grecques, 35 hébraïques ordinaires, les 10 corrections
  d'identité, 40 cas stratifiés, 31 sous-STEP et les cinq classes de
  publication.
- Cas renforcés validés : `H0025`, `H0726`, `H3066G`, `H3189L`, `H5718O`,
  `H5886` et `H7156H`.

L'artefact de l'échantillon est
`/tmp/lexicon-v3-final-sample-120.json`, SHA-256
`d56bfab91d6e898ed95afd579fea8477e2d6107c154729de2cbb93561ac55787`.

Ces contrôles ne constituent pas une promesse abstraite de perfection
linguistique. Ils établissent qu'il ne reste aucun cas non résolu selon la
politique stricte, les sources et les corpus épinglés de cette release.

## Anciennes productions protégées

Les deux fichiers existants n'ont pas été écrasés. Leurs empreintes sont
identiques avant et après la projection :

| Fichier                                 | SHA-256 inchangé                                                   |
| --------------------------------------- | ------------------------------------------------------------------ |
| `strong_lexicon.core.production.sqlite` | `8931ebbaf47413189682bba2c0f010a7bbeed28bdfde0a25e720d90492c80232` |
| `strong_lexicon.full.production.sqlite` | `48a023568f83ebbc37de2e811dcefa54ba422f92d0cbb66c25f2b8245c79d9d8` |

## Suite française

Cette release ne contient ni génération française ni reprise automatique du
français historique. La prochaine tâche pourra partir du snapshot anglais
promu, construire des packets FR liés à son hash exact, comparer plusieurs
propositions et publier le français uniquement après ses propres portes de
validation.
