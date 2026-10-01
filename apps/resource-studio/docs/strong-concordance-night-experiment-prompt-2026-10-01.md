# Prompt autonome : reconstruction Strong face à Concordance.bible

Tu travailles dans `/Users/stephane/Projects/bible-strong/bible-strong-app`, à partir
de la branche `codex/strong-resolution-concordance-benchmark`. Travaille cette nuit
de façon autonome, sans demander à Stéphane de revoir des versets ou de choisir
des conventions. Termine une expérience mesurée et reproductible ; un plan ou une
page de revue ne constitue pas le résultat attendu.

## Objectif de cette expérience

Évaluer puis améliorer notre génération déterministe de Strong en reconstruisant
une Bible dont Concordance.bible possède déjà les annotations, d'abord S21
(`SG21` sur le site), puis NEG79 si les données sont accessibles. Réutilise LSG,
Darby et DarbyR pour les contrôles de non-régression. Conserve un moteur commun,
avec des adaptations justifiées par édition ; mesure leur apport au lieu de
multiplier les règles particulières.

Notre objectif produit est de rendre compte de chaque occurrence source :

- un mot ou une expression française qui la traduit, avec ses preuves ;
- une absence explicite justifiée, dont l'ancrage du Strong vide est évalué
  séparément ;
- une incertitude motivée lorsque les preuves ne permettent pas de trancher.

Un échec de recherche ne prouve pas une absence. Une expression, une reformulation
ou une réalisation grammaticale peut rendre le sens sans correspondance mot à
mot. Le nombre de Strong affichés et la densité d'annotation ne sont pas des
objectifs de qualité. Préserve les occurrences répétées, les relations de groupe,
les variantes de lecture et le texte cible exact.

## Contexte à lire

Lis `AGENTS.md`, `CONTEXT-MAP.md`, `apps/resource-studio/CONTEXT.md`, la matrice
`docs/agents/validation.md`, puis les ADR 0013 et 0035. Le périmètre principal est
`apps/resource-studio`. Depuis ce dossier, lis :

- `.agents/skills/bible-to-strong/SKILL.md` ; les présentes consignes excluent les
  anciens parcours imposant une intervention humaine ou des modèles distants ;
- `docs/strong-quality-methodology.md` ;
- `docs/strong-resolution-extended-experiment-2026-10-01.md` ;
- `docs/strong-autonomous-grammar-2026-10-01.md` ;
- `docs/strong-concordance-checkpoint-2026-10-01.md` ;
- `src/evaluateStrongGold.ts`, `src/strongCanonicalResolution.ts`,
  `src/strongResolution.ts`, `src/translationProfiles.ts` et les outils sous
  `scripts/strong-*-benchmark/` et `scripts/strong-resolution-workflow/` selon
  leur pertinence.

L'ancien objectif de neuf Bibles complètes n'est pas atteint. Cette nuit, donne la
priorité à la preuve de qualité par reconstruction, sans relancer d'emblée le lot
des neuf éditions. Crée un goal borné par les livrables ci-dessous si ton
environnement propose cette fonction. Ne le déclare pas terminé après un simple
rapport intermédiaire.

## Protocole

1. **Acquérir et figer le contrôle externe.** Identifie les données S21 accessibles
   sur Concordance.bible, leur édition exacte, leur format et leurs annotations.
   Conserve URL, date, empreintes et procédure d'acquisition dans un cache local.
   Vérifie que les Strong réellement récupérés permettent l'évaluation : la seule
   présence d'un bouton « Strongs » ou d'un texte sans annotations ne suffit pas.
   Privilégie un export existant ; sinon acquiers un échantillon borné de pages
   publiques avec cache et débit modéré. Aucun contournement d'accès. Si S21 est
   inaccessible, essaie NEG79 puis exécute le protocole sur les témoins locaux,
   en indiquant clairement que le nouveau contrôle externe reste non réalisé.

2. **Aligner les bonnes unités.** Concordance emploie une numérotation BHS/NA.
   Vérifie les correspondances de texte et de versets avant de noter les Strong.
   Sépare notes d'éditeur et texte biblique. Les regroupements de versets,
   expressions et changements de lecture ne sont pas automatiquement des erreurs
   lexicales. Tout cas non comparable doit être compté et expliqué.

3. **Empêcher les fuites de réponse.** Garde les annotations cibles uniquement du
   côté évaluateur. Exclue leur contribution des lexiques dérivés, caches,
   corrections et correspondances apprises utilisés pour prédire. Audite la
   provenance réelle des dictionnaires ; si une contamination ne peut pas être
   exclue, isole le scénario et ne le présente pas comme aveugle. Gèle des ensembles
   de développement et de test séparés par chapitres, couvrant AT/NT et différents
   genres. Les anciennes réserves de cette session ont déjà été consultées :
   elles servent à la non-régression, pas à un nouveau test indépendant.

4. **Établir un état de référence.** Sauvegarde les prédictions du code initial,
   ses empreintes et ses entrées avant toute amélioration. Mesure deux scénarios
   distincts : cible exclue mais autres témoins disponibles, puis famille proche
   exclue. Utiliser LSG pour reconstruire S21 est pertinent dans le premier
   scénario ; ce n'est pas une preuve de généralisation au second. Darby et
   DarbyR ne sont jamais deux votes indépendants. Documente aussi la proximité
   éditoriale entre LSG, S21 et NEG79.

5. **Corriger à partir des erreurs de développement.** Classe les désaccords :
   mauvais porteur, mauvaise occurrence répétée, expression, vide injustifié,
   ancrage, variante source, découpage, convention éditoriale ou indécidable.
   Choisis les deux ou trois familles d'erreurs les plus utiles. Compare le moteur
   initial, chaque amélioration et leur combinaison. Si une adaptation par
   édition semble nécessaire, compare-la explicitement à la règle commune.
   N'ajoute pas de synonymes ad hoc simplement pour réussir un exemple.

6. **Tester sans retoucher la réserve.** Gèle les règles, puis exécute le test
   réservé. Si tu consultes ses erreurs pour modifier le moteur, cet ensemble
   devient du développement : exige une nouvelle réserve pour toute nouvelle
   conclusion. Réexécute à entrées identiques pour vérifier les décisions
   déterministes et lance les contrôles pertinents sur LSG/Darby/DarbyR.

## Mesures et interprétation

Présente les effectifs et les résultats par édition, scénario, testament et type
de difficulté. Mesure précision/rappel des porteurs exacts et chevauchants,
identité et cardinalité des occurrences, classement visible/vide, ancrage des
vides, taux d'incertitude et proportion de versets entièrement comptabilisés.
La couverture de l'inventaire n'est pas une précision sémantique. Une sortie
entièrement incertaine ne doit pas sembler excellente par absence de faux positifs.

L'accord avec Concordance mesure l'accord éditorial. Leur FAQ décrit une première
affectation automatique suivie de corrections humaines ; leur référence n'est
pas infaillible. Examine toi-même un échantillon déterministe et stratifié des
désaccords avec le texte source et les témoins. Conserve les preuves et distingue
ton jugement assisté d'une validation humaine ou indépendante. N'affirme pas
« meilleur que Concordance » sur la seule base d'un score ou de ton propre avis.

Laya local peut classer des candidats si son utilité est mesurée par comparaison
avec le système sans Laya. Ne l'intègre pas par principe et ne confonds pas un
score avec une probabilité de vérité. Aucun nouvel appel à un modèle distant,
y compris via AI Gateway. Les anciens résultats JEV restent des observations
historiques, pas une autorisation de relancer des appels.

## Livrables de fin

- Un outil de reconstruction/évaluation rejouable, avec acquisition séparée,
  versions figées, découpage développement/test et absence de fuite documentés.
- Un rapport français avec les résultats avant/après, les effets de chaque
  amélioration, les limites, les désaccords expliqués et une recommandation sur
  les adaptations nécessaires par Bible.
- Des tests pertinents, leurs résultats et les éventuels échecs préexistants
  distingués des régressions. Le code modifié doit compiler.
- Les données complètes et sorties sous `outputs/strong-concordance-night/`,
  ignorées par Git ; le code et le rapport synthétique dans le dépôt. Aucun secret
  ni texte intégral de Bible dans les nouveaux fichiers suivis.

Travaille sur une branche d'expérience issue du checkpoint, en préservant les
modifications étrangères présentes. Aucune publication, activation, mise en
production, push ni message à un tiers. Ne te bloque pas sur une revue de Stéphane :
traite les cas analysables et conserve explicitement les autres comme incertains.

Sources primaires de départ :

- https://concordance.bible/SG21/Exod/10/
- https://concordance.bible/pages/faq/
- https://concordance.bible/pages/versification/
- https://concordance.bible/pages/bibles/
