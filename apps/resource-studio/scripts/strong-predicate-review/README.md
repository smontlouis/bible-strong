# Relations de prédicat et incertitudes du lecteur

La livraison retenue se trouve sous
`outputs/strong-predicate-review-2026-10-02/recheck`. Le dossier parent conserve
un essai retiré : son affichage était stable, mais 19 relations S21 perdaient un
complément. Les fichiers volumineux de cet essai sont compressés sans perte ;
leurs empreintes et les commandes de restauration figurent dans les manifests
`archived-*.json`. `recheck.py` lit aussi les prédictions archivées en gzip.

## Contrat

`refinePredicateRelations` reçoit une reconstruction déjà produite, son texte
et ses occurrences sources. Elle ne lit ni annotations cibles, ni réseau.
Elle reconnaît des constructions bornées avec copule ou verbe-support, sans
franchir de ponctuation forte ni prendre le mot d'une autre occurrence.

Une relation nouvelle conserve l'union des mots antérieurement établis et du
nouveau groupe. Son porteur d'affichage reste distinct : les choix existants
sont conservés, tandis qu'un nouveau porteur récupéré peut devenir une expression.
Un nom répété déjà attribué à une occurrence nominale ne suffit pas à établir
le porteur d'une autre occurrence verbale. Sans construction reconnue, la
récupération concernée devient incertaine, jamais un vide établi.

L'activation est explicite : `concordancePredicates: true`, avec le mode
`concordanceDisplay` voulu. Le flag et la version de politique sont présents
dans les empreintes et les options sauvegardées.

## Rejouer les expériences

Depuis `apps/resource-studio`, avec les artefacts historiques restaurés :

```sh
python3 scripts/strong-predicate-review/init.py \
  --root outputs/predicate-replay \
  --previous outputs/strong-witness-recovery-2026-10-02/final
python3 scripts/strong-predicate-review/run.py development --root outputs/predicate-replay
python3 scripts/strong-predicate-review/freeze.py --root outputs/predicate-replay
```

Pour reproduire exactement la sélection finale après l'essai retiré :

```sh
python3 scripts/strong-predicate-review/recheck.py \
  --root outputs/predicate-final-replay \
  --previous outputs/strong-predicate-review-2026-10-02
python3 scripts/strong-predicate-review/run.py development --root outputs/predicate-final-replay
python3 scripts/strong-predicate-review/freeze.py --root outputs/predicate-final-replay
```

Restaurer le cache `acquisition` de la livraison correspondante pour retrouver
les mêmes pages et empreintes. Puis, pour le dossier choisi :

```sh
python3 scripts/strong-witness-recovery/acquire.py --root outputs/predicate-final-replay
node --import tsx scripts/strong-witness-recovery/prepare.ts outputs/predicate-final-replay test
python3 scripts/strong-predicate-review/reserve.py --root outputs/predicate-final-replay
python3 scripts/strong-predicate-review/verify-integration.py --root outputs/predicate-final-replay
python3 scripts/strong-predicate-review/report-data.py --root outputs/predicate-final-replay
```

La réserve est choisie par chapitres avant consultation et ouverte après gel.
Les prédictions sont séparées des labels ; le rejeu masque les pages, les labels
et les scores. Les variantes testent la prudence nominale, les expressions,
leur combinaison et un affichage uniforme plus agressif. Les prédictions
d'ablation non retenues sont conservées en gzip pour limiter l'espace disque.

Les changements d'interface du visualiseur n'entrent pas dans le gel prédictif.
Les entrées, le moteur, les programmes prédictifs et l'évaluateur, eux, restent
vérifiés par empreinte. Toute évolution du moteur après consultation d'une
réserve impose de traiter celle-ci comme du développement.

## Générer et vérifier les deux candidates

```sh
python3 scripts/strong-predicate-review/prepare-full.py --root outputs/predicate-final-replay
python3 scripts/strong-candidates/run.py freeze --root outputs/predicate-final-replay/full
python3 scripts/strong-candidates/run.py generate --root outputs/predicate-final-replay/full
python3 scripts/strong-candidates/run.py verify --root outputs/predicate-final-replay/full
python3 scripts/strong-predicate-review/audit-full.py --root outputs/predicate-final-replay
```

Les textes et correspondances sont ceux de la livraison précédente, sans nouvelle
réparation textuelle. L'audit exige leur conservation, celle des identités source,
l'absence de modification lecteur sans trace et la conservation des compléments
des relations qui restent retenues. Les retraits deviennent explicitement incertains.

`resume-exports.ts` sert uniquement après une interruption de stockage survenue
après la transaction SQLite. Il exige une base intègre et complète, puis reconstitue
les exports auxiliaires depuis celle-ci sans recalculer les prédictions. Les
entrées copiées peuvent utiliser des clones APFS indépendants, à octets vérifiés.

## Visualiseur

Le préparateur habituel compile le JSONL lecteur et un index de revue séparé :

```sh
python3 scripts/strong-predicate-review/deliver.py --root outputs/predicate-final-replay
node --import tsx scripts/prepareStrongCandidateViewer.ts <delivery-manifest.json>
yarn viewer
```

Le scellement exige aussi le bilan des tests comparé à la référence,
`canary.json` et la compilation. Il refuse des empreintes prédictives modifiées,
une différence dans le rejeu aveugle ou la perte d'un complément antérieur.
Pour contrôler le serveur démarré :

```sh
python3 scripts/strong-predicate-review/verify-viewer.py --root outputs/predicate-final-replay
```

Ce contrôle compare les fichiers affichés à la livraison, recompte les états
des 62 338 versets et vérifie quatre cas par l'API locale. Il complète la revue
visuelle des modes Versets et Lecture.

L'index de revue conserve les états et motifs par occurrence source. L'API exige
la concordance de l'empreinte du lecteur **et** de celle du ledger annoncé dans
le manifeste de prévisualisation. Un index manquant, périmé ou corrompu est
signalé comme indisponible, jamais assimilé à zéro incertitude.

Les boutons « liens non résolus » fonctionnent en lecture continue et en mode
versets. Ils ouvrent les identifiants, le mot source et une explication française,
en distinguant l'incertitude des vides établis. Aucun de ces outils ne publie,
n'importe ni n'active une ressource en production.
