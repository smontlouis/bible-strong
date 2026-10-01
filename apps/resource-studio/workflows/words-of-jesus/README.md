# Paroles de Jésus

Données de rédaction des paroles de Jésus (« mots en rouge ») de chaque Bible publiée sans
marquage propre. Elles sont fusionnées dans la Bible canonique au moment de la publication
(événements `layout` `wj`) ; aucun fichier de mots rouges n’est livré séparément.

Les Bibles dont la source marque déjà les paroles de Jésus (KJV, RLT, NASB 2020, NASB 1995 via
SWORD) gardent leur marquage d’éditeur et servent de références. Les textes en langue originale
(BHG, SBLGNT, TR1624, TR1894, VUL) et les Bibles limitées à l’Ancien Testament n’en ont pas.

## Format

Un fichier JSON Lines par Bible dans `data/<version>.jsonl`. La première ligne est l’en-tête :

```json
{"format":"bible-strong-words-of-jesus","schemaVersion":1,"versionId":"NBS"}
```

Chaque ligne suivante est la décision d’un verset :

```json
{"ref":"43-14-6","verseSha256":"3f1c0a9b8e7d6c5b","spans":[[15,101]],"origin":"aligned"}
```

- `spans` : plages demi-ouvertes en unités UTF-16 dans le texte du verset ;
- `verseSha256` : 16 premiers caractères hexadécimaux du SHA-256 du texte du verset. Si le texte
  change, la publication échoue (`words-of-jesus-text-drift`) au lieu de décaler le rouge ;
- `spans: []` : verset relu, sans parole de Jésus ;
- `origin` : `legacy-red-words` (anciens fichiers par index de mots), `aligned` (transfert depuis
  des références, déterministe ou relu par un agent), `manual`.

Le dépôt est public : les données ne contiennent aucun texte biblique, seulement des positions
et des empreintes.

## Commandes

Depuis la racine du dépôt :

```bash
yarn resources:words-of-jesus verify-sources
yarn resources:words-of-jesus import-legacy
yarn resources:words-of-jesus audit
yarn resources:words-of-jesus prepare-alignment --auto-full
yarn resources:words-of-jesus transfer --version S21 --from LSG
yarn resources:words-of-jesus apply-alignment
yarn resources:words-of-jesus adopt --version FRC97 --from BFC
yarn resources:words-of-jesus check
```

Toutes acceptent `--version V[,V]` et `--text-overrides overrides.json` (texte local par
version). Les sources téléchargées, audits et lots vivent sous `outputs/words-of-jesus/`.

- `verify-sources` reconstruit chaque Bible comme l’ancienne publication et compare sa
  `textRevision` à la production : les décisions s’ancrent sur le texte réellement publié.
- `import-legacy` convertit les anciens fichiers `red-words-<v>.json` (index de mots) en plages.
  Pour LSG et DBY, retypographiées après la création de ces fichiers, les index sont résolus sur
  l’ancien texte puis reportés par alignement de mots. Les décisions relues sont conservées.
- `audit` compare chaque Bible aux références KJV, NASB 2020 et NASB 1995 et signale les
  versets à revoir : texte modifié, verset marqué par les références mais non décidé, marquage
  sans appui, couverture très différente.
- `prepare-alignment` produit les lots de revue. Avec `--auto-full`, un verset entièrement
  rouge dans toutes les références et sans narration visible dans la cible est transféré
  directement.
- `transfer` reporte, par alignement de mots, les décisions d’une Bible pivot de même famille
  (LSG pour le français, KJV pour l’anglais) sur les versets en attente ; un verset dont les
  bornes ne s’alignent pas reste en attente.
- `apply-alignment` intègre les réponses des agents (`batch-NNN.result.json`), selon
  [ALIGNMENT.md](ALIGNMENT.md).
- `adopt` reprend les décisions d’une Bible au texte identique (FRC97 partage le Nouveau
  Testament de la BFC).
- `check` vérifie que chaque jeu de données s’ancre encore sur le texte qui sera publié.
