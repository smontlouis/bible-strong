# Reconstruction Strong masquée face à Concordance.bible

Outil rejouable de l'expérience du 1er octobre 2026 : reconstruire les Strong
d'une Bible annotée par Concordance.bible (SG21, puis NEG) sans jamais lire ses
annotations côté prédiction, puis mesurer l'accord. Le rapport est
[`docs/strong-concordance-reconstruction-2026-10-01.md`](../../docs/strong-concordance-reconstruction-2026-10-01.md).

Toutes les commandes se lancent depuis `apps/resource-studio`. Les sorties vont
sous `outputs/strong-concordance-night/` (ignoré par Git) et ne sont jamais
écrasées : une nouvelle exécution demande un nouveau chemin.

## Étapes et frontières

| Étape       | Commande                                | Lit                                                  | N'a jamais accès à            |
| ----------- | --------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| Plan figé   | `run.ts plan`                           | inventaire local, sélections passées                 | annotations cibles            |
| Acquisition | `run.ts acquire`, `seal-acquisition`    | pages publiques de chapitres                         | —                             |
| Prédiction  | `run.ts predict`                        | texte local exact, témoins autorisés, STEP, lexiques | cache Concordance, évaluateur |
| Gel         | `run.ts freeze`                         | empreintes du code et de la politique                | —                             |
| Évaluation  | `run.ts score`                          | prédictions scellées, cache Concordance              | —                             |
| Analyse     | `run.ts report`, `sample`, `provenance` | scores, échantillons, témoins                        | —                             |

`predict.ts` n'importe aucun module d'évaluation (`gold.ts`, `concordanceHtml.ts`,
`acquire.ts`, `score.ts`) ; un test vérifie ce graphe d'import et
`assertNoEvaluatorInput` refuse tout chemin du cache. Les prédictions sont
scellées par l'empreinte SHA-256 de leur JSON canonique ; l'évaluateur refuse
une prédiction dont l'empreinte ne correspond plus. Un test du réservé exige un
gel dont le code de prédiction, la politique et le code d'évaluation sont
identiques à ceux de l'exécution.

## Acquisition

```sh
yarn exec tsx scripts/strong-concordance-rebuild/run.ts acquire \
  --editions SG21,NEG --splits development,test --delay-ms 6000
yarn exec tsx scripts/strong-concordance-rebuild/run.ts seal-acquisition \
  --output outputs/strong-concordance-night/acquisition-seal-v1.json
```

Une requête séquentielle au plus toutes les 4 secondes (6 par défaut), sans
paramètre de requête ni authentification, conformément au `robots.txt`. Chaque
page conserve URL, dates, statut, en-têtes de cache, empreinte et comptage des
annotations réellement présentes. Une page déjà en cache n'est jamais
redemandée ; un cache altéré est refusé. Les mentions légales du site réservent
la réutilisation de ses données : le cache reste local et non publié.

## Prédiction, gel et évaluation

```sh
# Moteur initial (aucune option) et options expérimentales A, B, C, D
yarn exec tsx scripts/strong-concordance-rebuild/run.ts predict \
  --edition SG21 --scenario target-excluded --split development [--policy ABCD]
yarn exec tsx scripts/strong-concordance-rebuild/run.ts score \
  --run outputs/strong-concordance-night/predictions/<runId>
# Le réservé ne s'ouvre qu'avec un gel correspondant
yarn exec tsx scripts/strong-concordance-rebuild/run.ts freeze --policy ABC \
  --acquisition-seal outputs/strong-concordance-night/acquisition-seal-v1.json \
  --output outputs/strong-concordance-night/freeze-v1.json
yarn exec tsx scripts/strong-concordance-rebuild/run.ts score \
  --run outputs/strong-concordance-night/predictions/<test-runId> \
  --freeze outputs/strong-concordance-night/freeze-v1.json
```

Scénarios : `target-excluded` retire la cible si elle est un témoin et toujours
Darby et DarbyR ensemble ; `family-excluded` retire aussi toute la famille
éditoriale de la cible (Segond pour S21 et NEG). Dans cet outil, une prédiction
sans `--policy` rejoue le moteur initial, toutes options désactivées. Le
générateur canonique les applique en revanche par défaut depuis le 1er octobre
(`--engine-policy initial` pour s'en passer) :

- `A` `readingInvariantVariants` : une variante de lecture ne bloque plus une
  décision quand le mot appartient au texte de base et que toutes ses lectures
  gardent la même identité Strong ;
- `B` `singleCarrierPerSourceIdentity` : les identifiants alternatifs d'un même
  mot source ne créent pas deux porteurs ; est conservé celui dont l'identifiant
  est utilisé par les témoins du verset, puis le mieux étayé ;
- `C` `encliticHostTransfer` : un mot témoin peut porter l'hôte d'un enclitique
  soudé par trait d'union (« dit-il ») ;
- `D` `digitNumeralTransfer` : un numéral d'un mot peut correspondre au même
  nombre écrit en chiffres.

## Mesures

`score` produit les mesures porteur (Strong + portée exacte ou chevauchante,
comparables aux anciens canaris) et, pour SG21 et NEG, les mesures par
occurrence source : la position Concordance (numérotation BHS/NA) est le numéro
de mot STEP `#NN`. L'évaluateur classe chaque occurrence : porteur exact,
chevauchant, faux, occurrence répétée échangée, vide de référence reproduit ou
non, ancrage, abstention, silence de la référence, variante source. Les versets
non comparables (versification, texte divergent) sont comptés avec leur raison.
`sample` tire un échantillon déterministe et stratifié des désaccords de
développement pour une revue assistée, conservée hors Git.
