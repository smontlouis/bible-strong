# Récupération des commentaires Ellen White en français — 1er octobre 2026

## Conclusion

Les anciennes traductions françaises ont été récupérées depuis Firestore et une édition française de `egw-writings` est reconstruite : 34 227 paragraphes pour 21 674 versets, sans nouvelle traduction. La ressource et son catalogue sont publiés en production depuis le 1er octobre 2026. Les tests de lecture et de téléchargement chiffré passent.

## Pourquoi le français a disparu

L’ancien composant `Comment.tsx` lisait `commentaries-FR/{id}`. En l’absence de cache, il appelait DeepL puis enregistrait le résultat dans cette collection. Ce chemin a été retiré lors de la migration des commentaires vers les ressources, dans le commit `19617bad83d9dcf3ad8745b02862c226a0adad7b` du 31 août 2026.

Avant cette restauration, le [catalogue](../../packages/resource-catalog/src/commentaryCatalog.ts) déclarait uniquement `languages: ['en']` pour `egw-writings`. Le [générateur des publications](../../apps/resource-studio/src/packageCommentaryResourcePublications.ts), fonction `buildCanonicalEgwWritings`, fixait également la langue à `en`. Les traductions historiques ne sont donc plus consultées par ce lecteur.

Le SDA Bible Commentary (`sdabc`), qui possède une édition française et des compléments EGW, est une autre ressource : il ne remplace pas la collection EGW Writings.

## Mesures de la récupération

Lecture du projet `bible-strong-app`, sous-collections `verse-commentaries/{verse}/commentaries` filtrées par `type == egw_comment`, puis jointure exacte de `id` vers `commentaries-FR/{id}`.

| Mesure                                                     | Résultat |
| ---------------------------------------------------------- | -------: |
| Documents de versets inventoriés et parcourus              |   30 826 |
| Entrées EGW anglaises récupérées                           |  160 727 |
| Entrées avec un cache français non vide                    |   65 007 |
| Entrées sans cache français                                |   95 720 |
| Corps anglais distincts, hash HTML exact                   |   27 112 |
| Corps anglais distincts ayant au moins un cache français   |   17 941 |
| Paragraphes anglais uniques, identifiés par `data-para-id` |   47 303 |
| Paragraphes uniques avec au moins une variante française   |   34 228 |
| Couverture documentaire après déduplication par paragraphe |  72.36 % |
| Paragraphes historiques sans français récupéré             |   13 075 |
| Variantes françaises distinctes conservées                 |   52 924 |
| Paragraphes possédant plusieurs variantes françaises       |   11 970 |

La couverture de 72.36 % signifie qu’un texte existe dans le cache français ; elle ne constitue pas une certification de qualité linguistique. Les mêmes paragraphes apparaissent sous plusieurs versets et ont parfois été traduits plusieurs fois. Toutes les variantes sont conservées dans l’archive. La sélection de restauration est décrite ci-dessous.

Les marqueurs de paragraphe sont alignés entre anglais et français pour toutes les entrées traduites : aucune anomalie de séquence ou d’extraction détectée. Les hashes des 160 727 sources et des 65 007 traductions ont été vérifiés ; les identifiants d’entrée sont uniques.

La détection linguistique heuristique classe 64 525 entrées traduites comme françaises, 138 comme anglaises, 46 comme mixtes et 298 comme indéterminées. Huit entrées ont un texte normalisé identique à l’anglais. Ces indicateurs servent à cibler une revue ; ils ne suffisent pas à invalider automatiquement les textes courts ou les citations.

## Fichiers locaux

Dossier : `apps/resource-studio/workflows/commentaries/.local/egw-firestore-recovery-2026-10-01/` (ignoré par Git).

- `entries.jsonl` : export complet anglais/français, métadonnées originales, références, chemins Firestore, dates de la source et du cache français, hashes.
- `recovered-paragraphs.sqlite` : paragraphes anglais uniques, toutes les variantes françaises et associations historiques aux versets.
- `manifest.json` : inventaire, compteurs, détail par ouvrage et état des lectures.
- `audit.json` : déduplication et indicateurs de qualité.
- `missing-entries.json` : entrées sans traduction directe ; certaines sont récupérables par réutilisation d’un paragraphe traduit ailleurs.
- `alignment-issues.json` : liste vide après contrôle complet.
- `checksums.json` : taille et SHA-256 des quatre fichiers principaux.
- `recover.mjs`, `retry.mjs`, `audit.py` : scripts locaux de récupération et d’audit.

Tables SQLite : `source_paragraphs`, `french_variants`, `legacy_associations`, `metadata`. Les associations originales sont conservées ; elles ne remplacent pas automatiquement les portées éditoriales du nouvel index ECSI. Le HTML de l’archive conserve la source historique et doit être normalisé par le pipeline de publication avant affichage.

Les erreurs réseau initiales ont été reprises. Deux lignes affectées par des écritures locales concurrentes ont été réparées par une nouvelle lecture de leurs deux passages, puis l’archive entière a été revalidée. Le script d’export sérialise désormais les écritures. Aucun échec de lecture ne subsiste. `PRAGMA integrity_check` sur la base SQLite : `ok`.

## Piste d’extension au corpus actuel (hors périmètre retenu)

1. Récupérer l’artefact canonique anglais actuel `egw-indexed-writings.json` (absent de ce checkout), puis faire correspondre les identifiants de paragraphes et vérifier le texte source. Le nouvel export utilise lui aussi les identifiants EGW : la correspondance est techniquement possible.
2. Réutiliser les traductions exactes, choisir ou harmoniser les variantes et traiter les alertes de qualité. Les métadonnées de certains textes historiques contiennent aussi des correspondances vers des paragraphes d’éditions françaises officielles ; cette piste n’a pas été auditée à l’échelle du corpus.
3. Calculer les absences sur le corpus actuel, puis compléter uniquement ce reliquat. Les 13 075 paragraphes manquants ci-dessus concernent l’ancien corpus : ils ne mesurent pas le travail restant pour le nouveau corpus, qui peut contenir davantage de paragraphes et des chapitres complets.
4. Adapter le générateur EGW à la langue française, ainsi que les titres, liens et métadonnées ; normaliser le HTML et conserver la provenance des traductions historiques.
5. Produire le bundle `egw-writings:fr` avec données canoniques et SQLite hors ligne, vérifier leur parité puis publier via le Resource service conformément à l’ADR-0023.

Aucune traduction payante, écriture Firebase, import de production ou activation de ressource n’a été effectué. L’application n’a pas été modifiée.

## Préparation commencée après la récupération

La copie SQLite anglaise actuellement référencée par le catalogue a été retrouvée sous
`apps/resource-studio/outputs/published-commentaries/sqlite/commentary-egw-writings-en.sqlite`.
Son SHA-256 correspond exactement au catalogue :
`69d23b47a0a0da9262efd6b2eb3a11dc77d923d70126ef3970ffc2cd3ea3ef6a`.
Sa révision est `egw-writings-en-d6a3c4a1fdfdba1b9eaa` et elle contient **83 277 paragraphes**.
Le JSON canonique trouvé sous `outputs/indexed-published-commentaries-v2/` porte une révision
plus ancienne : il n’a pas été pris pour la référence active.

Le nouvel outil `prepare-egw-french-recovery.mjs` a produit et vérifié un candidat local dans
`apps/resource-studio/workflows/commentaries/.local/egw-french-current-candidate/`.
Il préserve les **1 487 063 associations** paragraphes–versets de la révision anglaise actuelle.

| État dans la ressource actuelle                               | Paragraphes |
| ------------------------------------------------------------- | ----------: |
| Français récupéré ayant passé les contrôles automatiques      |  **10 083** |
| À examiner                                                    |       4 031 |
| Sans traduction récupérable par les correspondances vérifiées |      69 163 |
| Total                                                         |      83 277 |

Les 4 031 cas à examiner se répartissent en 1 969 textes anglais exactement identiques retrouvés
sous d’autres identifiants, 876 égalités entre variantes françaises, 751 différences de texte source,
296 différences de références bibliques, 137 alertes de qualité et deux différences de texte après
normalisation. Parmi les 69 163 tâches restantes, 3 318 ont une source historique correspondante sans
traduction et 65 845 n’ont pas de source historique correspondante à la fois par identifiant ou texte
complet. D’autres sources françaises n’ont pas encore été recherchées pour ces textes.

Les **20 569 titres distincts** de livres ou de sections sont préparés séparément pour localisation.
Le candidat conserve les traductions en HTML normalisé, les références OSIS et les hashes de leurs
sources ; il est explicitement marqué `publicationReady: false`. Les choix entre variantes par
fréquence ne constituent pas une revue humaine des traductions DeepL.

### Décision de périmètre

Les 72,36 % du premier audit et les 12,11 % récupérés automatiquement dans le nouveau corpus ne
mesurent pas la même chose. Le premier chiffre décrit la présence de français dans l’ancien fonds.
Le second exige une correspondance avec la collection publiée actuellement et le passage des contrôles
automatiques. Cette collection inclut notamment de nombreux volumes de _Letters and Manuscripts_.
Une part importante de l’ancien fonds n’est pas reprise telle quelle dans cette édition.

Deux travaux sont donc distincts :

1. Restaurer d’abord une édition française du fonds historique récupéré, en conservant son périmètre
   et sa provenance, puis l’enrichir progressivement. C’est la recommandation pour répondre aux utilisateurs
   qui ont perdu leurs anciens commentaires français.
2. Compléter l’intégralité des 83 277 paragraphes de l’actuelle ressource EGW Writings, ce qui nécessite
   une acquisition ou une traduction beaucoup plus vaste, en plus de la récupération historique.

Le responsable du projet a choisi la première option : restaurer uniquement le français historique, sans nouvelle traduction.


## Restauration du fonds historique préparée

Le script `restore-egw-french.mjs` reconstruit une édition française indépendante du corpus anglais
actuel, à partir de l’archive vérifiée. Il ne contacte aucun service de traduction ni Firebase.

- **34 227 paragraphes** français, **21 674 versets**, **342 213 associations** historiques.
- Une entrée sans corps de texte (`23.2918`) est exclue ; les courts extraits et citations existants sont conservés.
- La variante la plus fréquente dans l’ancien cache est retenue. Pour **2 987 égalités**, le hash départage
  les variantes de manière stable. Ce choix restaure un texte existant ; il n’est pas une révision éditoriale.
- Un paragraphe traduit est réutilisé sur tous ses rattachements historiques attestés, même lorsqu’un
  autre commentaire contenant ce paragraphe n’avait pas son propre cache français.
- Les titres d’ouvrages et sections restent dans leur langue d’origine. Les références EGW et liens vers
  le contexte original sont conservés. Les traductions historiques sont automatiques, issues de DeepL.
- **19 paragraphes** nécessitent un repli en texte échappé pour préserver leur prose lors du nettoyage HTML.
- **Zéro nouvelle traduction** et aucune extension aux paragraphes absents du fonds français.

Le corpus, la provenance par paragraphe et leurs hashes sont dans
`apps/resource-studio/workflows/commentaries/.local/egw-french-restoration/`.
Le bundle complet est dans
`apps/resource-studio/outputs/resource-publications/commentaries/egw-writings-fr/` : JSON canonique,
SQLite normalisé avec index de lecture, archive hors ligne et manifestes de provenance.
Sa révision est `egw-writings-fr-79738c095e74ca428cf2`.

Le catalogue local, son inventaire et ses identités requises incluent désormais `database:egw-writings:fr`.
Les **118 entrées préexistantes sont identiques**, y compris l’anglais. Le générateur général reconnaît
la source française restaurée ; une commande dédiée permet de ne reconstruire que ce bundle.

La validation du bundle par le Resource service et sa correspondance avec le catalogue complet (119 identités, une seule sélectionnée) ont réussi. Le texte des 34 227 paragraphes et les 21 674 listes de versets sont identiques avant et après la composition finale du HTML. Les tests du monorepo, les 96 tests de commentaires, les deux tests du convertisseur canonique, le contrôle TypeScript et les frontières du Resource service passent. La publication ciblée R2, l’import Neon et le déploiement du catalogue ont ensuite été effectués depuis `master` propre et synchronisé, avec verrou de publication et sauvegarde des états précédents.


### Bilan des contrôles locaux

- `yarn typecheck`, `yarn test`, `yarn format:check`, `yarn resources:architecture:check` : succès.
- Workflow commentaires : 96 tests réussis ; convertisseur canonique français : 2 tests réussis.
- Lint ciblé des fichiers TypeScript modifiés : succès. Lint site, API et World : succès.
- Le lint global initial a été interrompu car il parcourait les bundles générés dans
  `apps/expo/.scratch/`. Relancé avec `--ignore-pattern '.scratch/**'`, le lint Expo termine avec
  184 erreurs préexistantes dans des fichiers non modifiés : 183 dans le rapport Android généré
  `modules/bible-strong-archive/android/build/reports/tests/testDebugUnitTest/js/report.js`, et
  `Buffer` non déclaré dans `plugins/withBibleStrongArchiveKeys.js:24`. Ces fichiers n’ont pas été modifiés.
- Contrôle du texte final : les 34 227 corps français et les 21 674 listes de versets sont préservés.
- Validation Resource service du bundle et de sa concordance avec le catalogue : succès.

L’archive Firestore et les gros artefacts produits
sont ignorés par Git et doivent être conservés pour l’étape de publication.


## Publication du 1er octobre 2026

Le commit de restauration `504e90447` a été poussé sur `master`. Une seule identité a été publiée :
`commentary:egw-writings:fr` / `database:egw-writings:fr`. Les 118 entrées précédentes du catalogue et
les autres publications Neon sont inchangées.

- Révision active : `egw-writings-fr-79738c095e74ca428cf2`.
- Worker : `1806f47d-30e2-4acd-a13c-3dfd4c766850`.
- Archive chiffrée : 19 259 390 octets, SHA-256
  `bb06bf53cc39bbcb22416716071c41a8be69a559b27608005efb61e4ca4626be`.
- Santé du service et parité du catalogue : succès.
- Index de Genèse 1 : 162 sections françaises ; lecture d’une section à la révision exacte : succès.
- Téléchargement public de l’archive chiffrée, hash, déchiffrement et hash du SQLite : succès.
- Archive non chiffrée sans attestation : refus `401`, attendu.

Les fichiers de contrôle et l’état précédent sont conservés dans
`apps/resource-studio/outputs/egw-fr-publication/` (ignoré par Git).
La visibilité dans l’application nécessite aussi la distribution du code incluant la projection française.
