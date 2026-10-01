# Checkpoint avant l'expérience Concordance

Ce checkpoint conserve le travail de recherche et d'intégration réalisé le
1er octobre 2026. Il ne certifie pas la qualité sémantique des Bibles générées.
La nouvelle priorité proposée à Stéphane est une reconstruction mesurée par
édition ; son prompt autonome est dans
[strong-concordance-night-experiment-prompt-2026-10-01.md](./strong-concordance-night-experiment-prompt-2026-10-01.md).

## Ce qui est intégré

- Identité des occurrences STEP, y compris les collisions de numéros de mots aux
  frontières Nombres 25.19 / 26.1 et la propriété des références alternatives.
- Décisions visible/vide/incertain, avec preuves de l'absence et de l'ancrage
  séparées ; conservation dans le ledger SQLite et ses mises à jour partielles.
- Règle française bornée pour le marqueur d'objet H0853/HTo, sans transformer
  toute absence de candidat en absence de traduction.
- Notes éditoriales exclues des témoins d'alignement ; familles de témoins
  corrélés distinguées ; dictionnaire explicite dans les empreintes.
- Outils d'expérimentation Laya/JEV, eflomal, arbitrage, occurrences et résolution,
  avec leurs rapports historiques. Ils ne sont pas tous utilisés en production.
- Pilote `src/strongAutonomous.ts` : entrées figées, génération canonique,
  vérification locale, exports et reprise par empreintes.

Les revues sous `scripts/strong-resolution-workflow/reference/` sont des décisions
assistées exposées aux témoins, pas un jeu de vérité indépendant. Leur adoption
automatique reste désactivée dans le résolveur canonique.

## Données locales à conserver

Tous les chemins de cette section sont relatifs à `apps/resource-studio`.
Les données et résultats ignorés ne sont pas inclus dans le commit : un autre
poste ou worktree doit les retrouver explicitement, sans supposer leur présence.

- Témoins annotés : `data/strongs/Sg1910.csv`, `Darby.csv`, `DarbyR.csv`.
  Aucun export annoté S21 ou NEG79 n'a encore été acquis pour cette expérience.
- Sources : `data/external/stepbible/amalgamated/`.
- Dictionnaire utilisé :
  `data/dictionaries/strong_lexicon.en-fr.full.production.sqlite`.
  Le dictionnaire par défaut `strong_lexicon.full.production.sqlite` est refusé
  par son attestation V3 dans l'environnement actuel ; ne pas supprimer ce contrôle.
- Textes complets BFC/FRC97/NFC :
  `outputs/releases/ordinary-bible-publications-2026-10-01/<id>/canonical/bible-<id>.json`.
  La copie historique BFC n'avait que 12 psaumes sur 150. Le préparateur utilise
  ces publications complètes et conserve leurs 73 livres ; hors corpus STEP,
  aucun Strong n'est inventé.
- Ancien code figé : `outputs/strong-grammar-empty/before-v1/`.
- Dernier lot interrompu : `outputs/strong-autonomous/v2/`.
- Évaluations masquées historiques : `outputs/strong-autonomous/canary-v2/`.

## État réel du lot complet

Le lot v2 a terminé ses contrôles structurels pour NBS et FMAR. BDS, BFC et FRC97
ont échoué sur des correspondances de versets ; NFC a été interrompue pendant
la génération et conserve donc un état `generating` obsolète dans `run.json`.
NVS78P, OST et S21 n'ont pas été atteintes. Aucun lot de génération n'est en cours
au moment du checkpoint.

NBS v2 contient 31 169 versets, 441 276 unités source modélisées, 345 064 décisions
visibles, 1 589 vides grammaticaux et 94 623 incertitudes. Ces catégories décrivent
le résultat du système ; « visible » n'est pas une certification indépendante.
Le code a changé après cette génération : les anciens artefacts ne valident pas
le détecteur v5 ni le code du présent commit. La remise en forme change aussi les
empreintes et doit invalider la réutilisation aveugle des anciens résultats.

Les évaluations canary-v2, sur 200 versets par témoin avec sa famille exclue,
mesuraient les F1 de porteur exact suivants : LSG 0,8476, Darby 0,8428,
DarbyR 0,8376. Ce sont des accords éditoriaux sur des échantillons déjà utilisés.
Ils ne constituent ni un contrôle externe nouveau ni un score S21.

## Travail restant à traiter explicitement

- Les listes comprimées demandent des relations plusieurs-à-plusieurs. Exemple :
  BDS 1 Chroniques 25.9–10 correspond à 25.9–31 du témoin ; BFC 1 Chroniques 24.7
  regroupe une liste couvrant 24.7–18. Abaisser un seuil ne suffit pas.
- Le détecteur v5 conserve les replis sur coordonnées comme incertains et propose
  des regroupements longs bornés par les coordonnées natives. Son comportement
  n'a pas encore été validé par une nouvelle génération intégrale.
- `strongLedger.ts` conserve désormais `unassignedCanonicalSource` pour les
  blocs sans cible. La vérification globale et les exports du pilote autonome
  doivent encore intégrer explicitement ces occurrences et leur non-duplication.
- Les fichiers envisagés `strong-structural-reviews.json` et
  `strongStructuralReviews.ts` n'ont pas été créés. Aucune revue de ces regroupements
  n'a été appliquée silencieusement.
- Aucun nouveau test S21/NEG79 ni protocole d'acquisition Concordance n'est encore
  implémenté. Le prompt décrit l'expérience à faire, pas une expérience terminée.

## Validation au checkpoint

Les journaux sont sous `outputs/strong-autonomous/checkpoint-validation/`.

- Typecheck du workspace : réussi.
- ESLint des fichiers TypeScript du périmètre : réussi.
- Tests TypeScript des outils d'expérimentation : 39 réussis.
- Tests Python des contrats eflomal/Laya/JEV : 8 réussis, sans appel de modèle.
- Suite du workspace : 1 111 tests, 1 088 réussis, 22 en échec, 1 ignoré.
  Les mêmes 22 noms d'échec sont reproduits sur le code figé antérieur avec les
  mêmes ressources locales. Ils concernent les attestations/réparations du
  lexique V3 ; `preexisting-failures.json` conserve cette comparaison.
- Build du workspace : 6 erreurs TS6059 dues à des imports de scripts du lexique
  hors de `rootDir: src`. Les mêmes 6 erreurs sont reproduites avec le code
  antérieur. Le build complet n'est donc pas annoncé comme réussi.

Le rejeu antérieur utilise les sources TypeScript de `before-v1`, les fichiers de
support non TypeScript présents et les scripts du lexique inchangés. Il isole les
modifications Strong de ce cycle, sans prétendre reconstituer une ancienne version
de toutes les données externes. Les erreurs de lexique et la configuration de
build n'ont pas été modifiées pour contourner les contrôles.

## Commandes de reprise utiles

Depuis `apps/resource-studio`, consulter les options avant d'agrandir le périmètre :

```sh
yarn strong:evaluate --gold Sg1910 --limit 200 --backend canonical \
  --dictionary data/dictionaries/strong_lexicon.en-fr.full.production.sqlite
yarn typecheck
yarn exec node --import tsx --test --test-concurrency=2 tests/**/*.test.ts
```

L'ancien serveur de revue sur le port 8769 montre un prototype historique ; ce
n'est ni la source du benchmark externe ni une tâche à confier à Stéphane.
