# Goal: produire le lexique Strong FR V2 strict, fidèle à STEP

Construire une nouvelle version française du lexique Strong STEP qui ne résume pas les notices anglaises. Contrairement à la première version FR simplifiée, cette V2 doit préserver toute la structure documentaire de STEP: HTML, emphases, listes, subdivisions, références bibliques, variantes, notes et renvois.

## État de départ

La V1 simplifiée est conservée et ne doit pas être écrasée sans décision explicite:

- DB snapshot: `data/dictionaries/snapshots/strong_lexicon_with_fr_simplified_2026-06-21.sqlite`
- JSONL snapshot: `outputs/lexicon-fr/snapshots/strong_lexicon_fr_simplified_2026-06-21.final.jsonl`

La V1 est utile comme fallback court, mais elle n'est pas assez fidèle pour devenir le dictionnaire principal riche, car certaines entrées longues comme `G3056` ont été condensées et ont perdu les références bibliques détaillées.

## Objectif V2

Produire un fichier final strict couvrant les 22 717 entrées STEP:

- traduction française fidèle;
- pas de résumé;
- conservation des références bibliques;
- conservation de la structure HTML;
- conservation des listes et subdivisions;
- conservation des emphases;
- conservation des termes grecs/hébreux utiles;
- conservation des Strong et renvois présents dans la source;
- validation automatique stricte;
- review Gemini uniquement pour les entrées suspectes;
- import DB seulement après validation explicite.

## Architecture recommandée

Pipeline principal:

```txt
STEP EN HTML
  -> protection refs / Strong / grec-hebreu
  -> DeepL HTML translation
  -> restauration tokens
  -> validation deterministe
  -> Gemini post-review uniquement si failed/suspicious
  -> human review residual
  -> final JSONL
  -> import DB apres validation explicite
```

## Pourquoi DeepL + Gemini

DeepL est recommandé pour le premier passage:

- meilleur comportement de traduction stricte;
- conserve bien le HTML avec `tag_handling=html`;
- moins de tendance à résumer;
- rapide;
- coût prévisible;
- très bon résultat sur le pilot avec références protégées.

Gemini est recommandé pour la review/correction:

- meilleur raisonnement;
- peut corriger les artefacts DeepL;
- peut expliquer les cas ambigus;
- utile pour les entrées longues, théologiques ou suspectes;
- ne doit pas être utilisé aveuglément sur toutes les entrées si DeepL + validations suffisent.

## Résultat du pilot DeepL

Script:

```bash
npm run benchmark:deepl:strict-fr
```

Artifacts:

- `scripts/benchmarkDeepLStrictFr.ts`
- `outputs/lexicon-fr/deepl-strict-pilot.json`
- `reports/deepl-strict-fr-pilot.md`
- `reports/strict-fr-translation-apple-vs-gemini.md`

Résultats observés:

- `G3056`: 98 références source, 98 références traduites, 0 manquante.
- `G0026`: 6 références source, 6 références traduites, 0 manquante.
- `G5485`: 26 références source, 26 références traduites, 0 manquante.
- HTML globalement conservé.
- Les sous-entrées courtes hébraïques restent structurées.

Limite observée:

- DeepL peut créer de petits artefacts autour de tokens protégés ou de mots comme `only`.
- Exemple observé sur `G0026`: `(Jas.4:4 only)` a produit une formulation maladroite autour de `Jas.4:4 ement`.
- Ces cas doivent être détectés par validation puis corrigés par Gemini ou review humaine.

## Statut d'implémentation actuel

Générateur V2 créé:

```bash
npm run generate:lexicon:fr:v2:deepl
```

Artifacts du générateur:

- `scripts/generateLexiconFrV2DeepL.ts`
- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.deepl.candidates.jsonl`
- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.review-needed.json`
- `reports/lexicon-fr-v2-deepl-production.md`

Pilot sentinelle:

```bash
npm run generate:lexicon:fr:v2:deepl -- --strongs G3056,G0026,G5485,H3068,H7225
```

Résultat: `8/8 accepted`, `0 review_needed`.

Pilot difficile 50:

```bash
npm run generate:lexicon:fr:v2:deepl -- --pilot difficult --limit 50
```

Résultat: `50/50 accepted`, `0 review_needed`.

Correction ajoutée après pilot:

- whitelist HTML alignée sur les balises STEP réelles (`re`, `note`, `author`, `date`, `ref`, etc.);
- détection élargie des références bibliques STEP, y compris formes comme `Rut.2:19`, `3Ki.11:33`, `1Ch.22:12`, `Wis.5:22`;
- correction de l'ambiguïté `Job.42:8, 3Ki.11:33`, où `, 3Ki` ne doit pas être pris pour un verset `,3`;
- support de production par batch: `--all --limit N --offset N`, `--min-id`, `--max-id`.
- support de production sûre par budget: `--max-source-chars`, `--max-estimated-chars`;
- support de simulation sans API: `--dry-run`;
- support de revalidation sans API: `--revalidate-only`;
- comparaison de références plus robuste pour les listes abrégées (`Act.19:24, 38`, `1Pe.1:3, 1:21`);
- l'HTML déséquilibré n'est bloquant que si la source STEP était équilibrée, afin de ne pas bloquer sur des tags orphelins déjà présents dans STEP.

Production complète réalisée:

```bash
npm run generate:lexicon:fr:v2:deepl -- --all --resume --max-source-chars 100000
npm run generate:lexicon:fr:v2:deepl -- --all --resume --max-source-chars 500000
npm run generate:lexicon:fr:v2:deepl -- --all --resume --max-source-chars 1000000
npm run generate:lexicon:fr:v2:deepl -- --all --resume --max-source-chars 800000
npm run generate:lexicon:fr:v2:deepl -- --all --resume
npm run generate:lexicon:fr:v2:deepl -- --revalidate-only
```

État final après revalidation:

- records JSONL: `22 717`;
- ids uniques: `22 717`;
- accepted: `22 717`;
- review_needed: `0`;
- grec: `11 035`;
- hébreu: `11 682`;
- source chars stockés dans les records: `5 496 683`;
- translated chars stockés dans les records: `6 039 819`;
- corrections manuelles totales: `22`;
- anomalies produit automatiques restantes: `0`;
- usage DeepL visible en fin de production: `4 224 376` caractères sur la fenêtre courante.

Artifacts finaux:

- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.final.jsonl`
- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.final-review-needed.json`
- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.final-rejected.json`
- `reports/lexicon-fr-v2-final-quality.md`
- `reports/lexicon-fr-v2-final-samples.md`
- `reports/lexicon-fr-v2-product-review.md`
- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.product-review.json`
- `data/dictionaries/strong_lexicon.sqlite`

Les 5 corrections manuelles ont été faites uniquement après échec du validateur et sont tracées par `translation.reviewEngine = "manual-strict-fix"`:

- `G2588`: restauration des références et de la structure longue.
- `G2699`: restauration du marqueur `2.`.
- `G4715`: correction de `grecMat.17:27` en `Mat.17:27`.
- `G6788`: restauration exacte de tokens grecs.
- `G9073`: restauration du marqueur `5.`.

La revue produit a ensuite identifié et corrigé 17 cas supplémentaires, tracés par `translation.reviewEngine = "manual-product-review"`:

- `H1990`, `H2526`: correction du nom propre `Ham` traduit à tort par `Jambon`; choix final `Cham`.
- `G7709`: correction de l'anglais anatomique `ham` en `jarret`.
- `G2651`, `G3440`, `G3441`: correction du résidu anglais `only`.
- `G2720`: correction d'espacement autour des références.
- `G2492`, `H0347`: correction du nom propre `Job` traduit à tort par `Emploi`.
- `H0203`, `H0204`: correction du nom propre/lieu `On` traduit à tort par `Le`.
- `H0876`: correction du nom propre/lieu `Beer` traduit à tort par `Bière`.
- `H5113`: correction du lieu `Nod` traduit à tort par `Hochement de tête`.
- `H6316`: correction du nom propre/peuple `Put` traduit à tort par `Mettre`.

Après cette passe, `npm run review:lexicon:fr:v2` donne `0` anomaly candidate.

Import DB effectué après validation utilisateur:

- table finale: `LexiconTranslations`;
- colonnes conservées: `id`, `stepEntryId`, `language`, `gloss`, `meaning`, `meaningHtml`, `createdAt`, `updatedAt`;
- colonnes pipeline supprimées: `targetLanguage`, `status`, `notes`, `confidence`, `sourceModel`, `reviewedAt`;
- `meaning`: version FR simple;
- `meaningHtml`: version FR V2 HTML stricte.

Validation technique passée:

```bash
npm run lint
npm run typecheck
npm exec tsc -- --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext scripts/generateLexiconFrV2DeepL.ts
npm exec tsc -- --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext scripts/generateLexiconFrV2ProductReview.ts
```

Note quota DeepL:

- corpus complet naïf: environ `5 496 683` caractères source (`gloss + meaning`) pour `22 717` entrées;
- corpus dédupliqué séparément par `meaning` et `gloss`: environ `5 175 506` caractères source;
- quota relevé pendant la production;
- usage DeepL visible en fin de run: `4 224 376` caractères;
- la production complète a été effectuée.

## Données sources

Source canonique:

- `data/dictionaries/strong_lexicon.sqlite`
- table `StepEntries`
- champs importants:
  - `id`
  - `language`
  - `eStrong`
  - `dStrong`
  - `uStrong`
  - `original`
  - `transliteration`
  - `morph`
  - `gloss`
  - `meaning`

Ne pas utiliser `strong_fr.sqlite` comme autorité.

## Protection avant DeepL

Avant appel DeepL, protéger:

- références bibliques;
- Strong codes;
- mots grecs;
- mots hébreux;
- sigles lexicographiques qu'on ne veut pas traduire;
- éventuellement abréviations bibliographiques comme `WH`, `mg.`, `Rec.`, `DB`, `VGT`, `MM`, `LXX`.

La protection doit utiliser des placeholders temporaires, pas seulement des spans visibles, puis restaurer exactement les tokens après traduction.

Exemple:

```html
Mat.8:8
```

devient temporairement:

```html
<span translate="no" class="notranslate ref">__REF_0001__</span>
```

puis redevient exactement:

```html
Mat.8:8
```

## Paramètres DeepL recommandés

Utiliser l'API DeepL avec:

- `source_lang: EN`
- `target_lang: FR`
- `tag_handling: html`
- `split_sentences: nonewlines`
- `preserve_formatting: true`
- `model_type: quality_optimized`
- auth par header `Authorization: DeepL-Auth-Key ...`

Ne jamais envoyer la clé en query string ou body.

## Schéma de sortie recommandé

Ne pas dupliquer inutilement plain text et rich text.

Pour la V2, produire un champ canonique d'affichage riche:

```json
{
  "stepEntryId": 3168,
  "targetLanguage": "fr",
  "status": "accepted",
  "translation": {
    "glossFr": "parole",
    "meaningHtmlFr": "...",
    "notesFr": "",
    "engine": "deepl",
    "reviewEngine": null
  },
  "validation": {
    "issues": [],
    "sourceReferenceCount": 98,
    "translatedReferenceCount": 98,
    "missingReferences": []
  }
}
```

Le plain text peut être dérivé à l'affichage ou pour la recherche. Ne pas stocker deux longues versions sauf nécessité produit.

## Validations obligatoires

Chaque entrée doit vérifier:

- JSON parseable;
- `stepEntryId` unique;
- `stepEntryId` existe dans `StepEntries`;
- `glossFr` non vide;
- `meaningHtmlFr` non vide;
- HTML whitelisté;
- aucun tag dangereux;
- références source conservées exactement;
- Strong source conservés exactement quand présents;
- pas de Strong inventé;
- grec/hébreu non corrompu;
- nombre de tags HTML cohérent;
- marqueurs structurants conservés;
- pas d'artefact détecté autour des placeholders;
- pas de placeholder non restauré;
- pas de résumé évident;
- pas de résidu anglais anormal, hors abréviations volontairement conservées.

## Détecteurs d'artefacts

Ajouter des règles pour détecter:

- `__REF_`;
- `__STRONG_`;
- `__GREEK_`;
- `__HEBREW_`;
- mots collés après référence: `Jas.4:4 ement`;
- espaces avant ponctuation non voulus en masse;
- références bibliques localisées alors qu'elles auraient dû rester exactes;
- HTML déséquilibré;
- contenu beaucoup plus court que la source;
- disparition de `I.`, `II.`, `1.`, `1a)`, `__(a)`.

## Gemini post-review

Envoyer à Gemini uniquement les entrées:

- avec référence manquante;
- avec placeholder non restauré;
- avec artefact détecté;
- avec HTML invalide;
- avec réduction de longueur suspecte;
- avec entrée théologique longue;
- avec noms propres ou translittérations abîmées;
- avec warning de validation.

Gemini doit recevoir:

- source STEP originale;
- sortie DeepL;
- liste des erreurs détectées;
- consigne de corriger sans résumer;
- consigne de préserver tous les tokens et références.

Gemini ne doit pas réécrire les entrées déjà propres.

## Sorties attendues

- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.deepl.candidates.jsonl`
- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.review-needed.json`
- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.gemini-reviewed.jsonl`
- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.final.jsonl`
- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.final-review-needed.json`
- `outputs/lexicon-fr-v2/strong_lexicon_fr_v2.final-rejected.json`
- `reports/lexicon-fr-v2-deepl-production.md`
- `reports/lexicon-fr-v2-validation.md`
- `reports/lexicon-fr-v2-gemini-review.md`
- `reports/lexicon-fr-v2-final-quality.md`
- `reports/lexicon-fr-v2-final-samples.md`
- `reports/lexicon-fr-v2-import-plan.md`

## Import DB

Ne pas importer automatiquement.

Avant import:

- garder la V1 simplifiée snapshotée;
- décider si la V2 remplace `LexiconTranslations.meaning`;
- ou si une nouvelle colonne `meaningHtml` / `meaningHtmlFr` est ajoutée;
- ne pas écrire dans la DB sans validation explicite.

Décision probable:

- ajouter une colonne riche plutôt que perdre immédiatement la V1;
- ou créer une nouvelle table de versions si on veut comparer V1/V2 dans l'app.

## Critères d'acceptation

- 22 717 entrées couvertes.
- 0 référence source manquante.
- 0 Strong inventé.
- 0 placeholder non restauré.
- 0 HTML dangereux.
- 0 entrée vide.
- 0 entrée résumée quand la source est longue.
- Rapport final généré.
- Échantillons longs revus manuellement, incluant:
  - `G3056`
  - `G0026`
  - `G5485`
  - `H3068`
  - `H7225`
- Import DB non effectué sans approbation explicite.

Statut au 2026-06-21: critères remplis côté fichier JSONL final et validation automatique. Le fichier final est prêt pour revue produit/import DB, mais aucun import DB n'a été effectué.

## Commande de départ recommandée

Commencer par étendre le pilot avant production complète:

```bash
npm run benchmark:deepl:strict-fr -- --strongs G3056,G0026,G5485,H3068,H7225
```

Puis créer un pilot plus large de 50 à 100 entrées difficiles avant de lancer les 22 717.
