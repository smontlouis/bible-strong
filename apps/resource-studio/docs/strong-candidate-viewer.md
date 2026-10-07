# Visualiser les candidates S21 et NEG79

Depuis `apps/resource-studio`, préparer les index locaux à partir du manifeste
de livraison vérifié :

```bash
yarn exec tsx scripts/prepareStrongCandidateViewer.ts outputs/strong-source-context-2026-10-02/recheck/delivery-manifest.json
yarn viewer
```

Ouvrir [les deux candidates dans le visualiseur](http://localhost:4173/viewer/?view=jsonl&versions=S21-CANDIDATE,NEG79-CANDIDATE&book=Gen&chapter=1).
Le paramètre `versions` sélectionne les éditions, puis la sélection est conservée
dans l'URL et dans le navigateur. Le mode « Versets » les compare côte à côte ;
les mots annotés ouvrent leur fiche et la concordance de l'édition sélectionnée.

Le script contrôle les SHA-256 du manifeste, copie les exports de lecture dans
`outputs/strong-candidate-viewer/`, puis les indexe avec le compilateur SQLite
existant. Il vérifie le nombre de versets et l'identité du texte source. Les
fichiers de l'expérience restent intacts. Aucune génération d'annotations ni
publication n'est effectuée.

Les noms « S21 candidate » et « NEG79 candidate » les distinguent des anciennes
éditions du catalogue. Le lecteur présente les annotations retenues dans les
JSONL ; les hypothèses non résolues et leurs justifications restent dans les
ledgers de l'expérience. L'absence d'un Strong dans ce lecteur ne prouve donc
pas son absence du texte source.

## Lexique local

Si les modules de lexique par défaut ne sont pas présents, le serveur accepte
`LEXICON_DB`, `LEXICON_RESOURCES_DB` et `ENTITIES_DB` pour utiliser les modules
locaux correspondants. La session du 2 octobre 2026 utilise les trois modules
dans `outputs/legacy-strong/identity-projection` du checkout principal.

## Vérification du 2 octobre 2026

- Les deux index contiennent chacun 31 169 versets ; leurs empreintes sources
  correspondent au manifeste de `strong-source-context-2026-10-02/recheck`.
- API vérifiée sur Genèse 1, Jérémie 23 (dont S21 23.19) et Romains 7, pour les
  deux éditions ; concordances H0430G disponibles.
- Affichage côte à côte et ouverture d'une fiche Strong vérifiés dans le navigateur.
- Compilation du visualiseur, contrôles TypeScript serveur et navigateur,
  lint ciblé et les 7 tests existants du lecteur réussis.
- Les dépendances partagées installées utilisaient React Flow 12.11.4 avec un
  export manquant. Ce worktree utilise désormais sa version verrouillée
  12.10.2 et `@xyflow/system` 0.0.76, restaurées du cache Yarn dans une copie
  locale de ces deux paquets. Aucun changement du lockfile ni des dépendances
  du checkout principal.
