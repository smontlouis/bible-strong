# Lectures du jour

Cet atelier prépare ce que l’application lit chaque jour en mode immersif (ADR-0118) :

- les **méditations du verset**, écrites pour Bible Strong en français (sur la LSG) et en anglais
  (sur la BSB), avec leur calendrier de 366 jours et la réserve de « Changer de verset » ;
- les **19 recueils de méditations** de Firestore `plans`, découpés en cartes ;
- les **96 scènes peintes** sur lesquelles se posent les cartes.

Il en fait un fichier par collection et les images des scènes, puis les publie sur l’hôte média
public, comme les peintures de la frise (ADR-0096).

```bash
npx firebase-tools@15 projects:list        # rafraîchit la session Firebase CLI de l’opérateur
yarn resources:daily-readings:extract      # Firestore → outputs/daily-readings/raw (lecture seule)
yarn resources:daily-readings:normalize    # dates des recueils, par la fonction de l’application
PYTHON=<python avec Pillow> yarn resources:daily-readings:scenes
yarn resources:daily-readings:build        # versets, recueils, catalogue, contrôles
yarn resources:daily-readings:upload --dry-run
yarn resources:daily-readings:upload       # fichiers immuables d’abord, catalogue en dernier
```

## Sources

Les sources ne sont pas dans le dépôt. Elles vivent dans l’atelier d’écriture désigné par
`DAILY_READINGS_WORKSPACE`, par défaut `~/Projects/bible-strong/portraits/verse-of-the-day` :

- `production/all.jsonl` et `production/en/all_en.jsonl` : les 1 051 méditations relues, en
  français et en anglais ;
- `production/calendar/calendar.json` : le jour de chaque méditation et la réserve ;
- `library-1/` : la bibliothèque de scènes (`catalog.json`, fonds dans `out/bg-*.png`, premiers
  plans détourés dans `layers/fg-*.png`).

Les recueils viennent de Firestore `plans`, lus par `extract`. Tout ce que l’atelier écrit va dans
`apps/resource-studio/outputs/daily-readings/`, que Git ignore, avec le journal d’envoi
(`build/upload-ledger.json`) qui permet de reprendre un envoi interrompu.

## Règles

- **Méditations du verset.** Le texte du verset est nettoyé pour l’affichage : le titre d’un psaume
  au verset 1 (« Cantique des degrés. De David. »), « Pause » et « Selah » sont retirés, la
  première lettre passe en capitale, et un passage coupé sur une virgule finit par « … ». La
  référence s’écrit « Luc 11:9 ». La pastille Strong garde une seule graphie, avec les corrections
  du lexique (« ś » et non « ώ »).
- **Recueils.** Seul le texte de l’auteur, rien d’ajouté. La date de chaque jour vient de
  `normalizeMeditationCollection` de l’application, avec ses corrections et ses jours ajoutés.
  Chaque jour garde son identifiant Firestore, pour que la progression et l’historique restent les
  mêmes.
- **Réparations.** Deux paragraphes collés (« peau.J’ai ») sont séparés : par un saut de paragraphe
  dans les recueils qui ont perdu les leurs (365j, lbs, tpqir, avec leurs listes à tirets), par une
  espace dans les autres. Une abréviation ou une initiale n’est jamais séparée.
- **Coupes.** Une carte s’arrête entre deux paragraphes, sinon entre deux phrases, autour de 550
  signes. On ne coupe jamais après « : », au milieu d’un cantique ou d’une liste, ni avant une
  signature. Une référence d’Ellen White (« CTr 10.2 ») reste avec son paragraphe.
- **Contrôles.** `build` refuse un jour dont le texte recollé diffère de la source, signale les fins
  de carte et les cartes longues dans `build/flags.json`, et vérifie que chaque jour a sa scène,
  jamais la même deux jours de suite. `upload` ne publie le catalogue que si chaque fichier répond à
  son adresse.

## Format

| Clé de l’hôte média | Cache | Contenu |
| --- | --- | --- |
| `daily-readings/catalog.json` | une heure | le seul objet qui change : le fichier courant de chaque collection et les scènes |
| `daily-readings/<collection>/<hash>.json` | un an, immuable | une collection |
| `daily-scenes/<scène>/<hash>/{bg,fg}-w{768,1254}.webp` | un an, immuable | les deux calques d’une scène |

`hash` : les 12 premiers caractères hexadécimaux du SHA-256 des octets du fichier (pour une scène,
de ses deux PNG et des réglages d’export).

Une collection :

```json
{
  "format": "bible-strong-daily-readings",
  "version": 1,
  "id": "verse-meditations-fr",
  "kind": "verse-meditations",
  "language": "fr",
  "calendar": { "01-01": "1347" },
  "reserve": ["12"],
  "entries": {
    "1347": { "scene": "lac-calme-nuit-b", "ref": "LUK.11.9", "label": "Luc 11:9", "theme": "prière", "cards": [] }
  }
}
```

- `kind` : `verse-meditations` ou `devotional-book`. `reserve` n’existe que pour les méditations du
  verset. Une entrée d’un recueil porte `title` (le titre du jour, sans sa date) et `source.sha256`
  (l’empreinte de ses blocs Firestore), mais ni `ref` ni `label`.
- Les cartes, dans l’ordre : `verse` (`text`, `label`), `hook`, deux `part` (`title`, `text`,
  `strong` : `word`, `code`, `translit`), `prayer`, `questions` (`items`) pour un verset ;
  `opening` (`text`, `citation`), puis des `text` pour un recueil. Les paragraphes d’une carte sont
  séparés par une ligne vide.

L’application lit ce format dans `apps/expo/src/features/daily-reading/readings/`.
