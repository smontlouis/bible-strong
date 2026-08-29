# Pipeline française interne Lexicon V3

Date de conception : 2026-07-13

Statut : contrat de production implémenté ; exécution et release française en
cours. Les identifiants et empreintes de la release effective seront ajoutés
après son activation.

## Principe directeur

La traduction française est dérivée du **snapshot anglais publié exact**. Elle
n'est jamais dérivée directement d'une ligne STEP brute, d'un numéro Strong
classique seul, ni d'une traduction française historique.

L'unité d'identité est l'entrée STEP exacte, suffixes et sous-STEP compris. Pour
chaque champ français, le pipeline conserve l'identifiant de la version
anglaise parente, son hash de contenu, le snapshot de release et le digest
logique des sources. Une traduction dont le parent a changé devient obsolète et
ne peut pas être publiée après un simple rehashage.

## Rôle du français historique

`strong.legacy.sqlite`, les traductions STEP déjà présentes et les concordances
françaises restent utiles, mais seulement comme **témoins contrôlés** :

- noms propres, graphies déjà employées et formes attestées ;
- terminologie biblique et indices de cohérence ;
- signal de désaccord à examiner ;
- candidats de carriers d'alignement, jamais preuve de publication directe.

Le proposant A ne voit aucun de ces candidats et traduit à partir de l'anglais
canonique. Le proposant B peut les voir, explicitement étiquetés comme témoins
non fiables. Ainsi, l'ancien français peut améliorer la continuité sans devenir
une source de vérité cachée.

## Chaîne de décision

```text
release core-en exacte
  -> packets FR content-addressed
  -> registres éditoriaux (noms, lieux, livres, morphologie, termbase)
  -> work items et familles de sous-STEP
  -> proposant A aveugle aux témoins FR
  -> proposant B informé des témoins FR
  -> arbitre distinct
  -> auditeur distinct
  -> validateurs déterministes + contrôle global des siblings
  -> remédiation bornée des résiduels
  -> authoring bilingue
  -> candidate core/full
  -> vérification puis activation atomique
```

Les quatre rôles de production sont liés à un profil approuvé et signé :

| Rôle        | Modèle          | Effort |
| ----------- | --------------- | ------ |
| Proposant A | `gpt-5.6-luna`  | moyen  |
| Proposant B | `gpt-5.6-sol`   | faible |
| Arbitre     | `gpt-5.6-terra` | moyen  |
| Auditeur    | `gpt-5.6-sol`   | moyen  |

Chaque résultat doit posséder un reçu rejouable qui lie au minimum : le rôle,
l'entrée, le batch, le namespace, le manifeste, la sélection, la vue d'entrée,
la réponse structurée, l'agent, le thread, le modèle, l'effort, le binaire
Codex, les capacités désactivées et tous les artefacts source/résultat.

## Exécution interne, sans CEL ni AI Gateway

Le runner utilise une copie immuable et content-addressed du binaire Codex
fourni par l'application ChatGPT. Son SHA-256 et sa version sont vérifiés avant
et après chaque exécution. Les outils locaux, le shell et les outils de données
réseau sont désactivés dans les agents de traduction ; les seules données
présentées sont les vues JSON scellées par le pipeline.

Aucune clé CEL, AI Gateway, DeepL, Gemini ou autre fournisseur n'est nécessaire
et aucune de ces routes n'est appelée. « Interne » signifie ici **via les
agents Codex authentifiés de l'application**, et non un modèle exécuté
physiquement sans service de modèle.

## Validation d'une entrée

Une entrée n'est automatiquement validable que si toutes les preuves exigées
sont présentes et cohérentes :

- identité STEP et parent anglais exacts ;
- français fidèle, complet et naturel, sans ajout ni omission sémantique ;
- négation, modalité, incertitude et portée conservées ;
- noms propres, termes, gloss et morphologie conformes aux registres ;
- contenu protégé conservé ;
- HTML canonique, sûr et équivalent au texte visible ;
- arbitre sans réserve et auditeur `safe` avec tous les checks à `pass` ;
- cohérence avec toutes les entrées de la même famille sous-STEP ;
- quatre agents et quatre threads distincts, avec reçus valides.

Un désaccord ou un contrôle manquant ne produit pas un texte « assez bon » : il
produit un résiduel de remédiation. Chaque round de remédiation relance deux
proposants frais, puis un arbitre et un auditeur frais. Le nombre de rounds est
borné ; un résiduel final bloque la release.

## Porte pilote sans vérification manuelle

Avant les 22 717 entrées, le pipeline exécute un pilote stratifié de 300
entrées. Il couvre notamment langue, longueur, HTML, noms propres, morphologie,
sous-STEP, témoins historiques contradictoires et contenu à protéger.

Après les quatre rôles et la remédiation, 60 de ces 300 entrées sont choisies de
façon déterministe et stratifiée pour un **re-audit aveugle**. Le cinquième
agent ne voit que l'identité, l'anglais exact, le contenu protégé et la
traduction finale ; il ne voit ni les propositions, ni l'arbitrage, ni les
raisons des audits précédents, ni le français historique.

La génération complète reste impossible tant que la porte content-addressed
n'atteste pas simultanément :

- 300/300 entrées couvertes et sans résiduel ;
- 60/60 re-audits `safe` ;
- zéro `hold`, zéro `block`, zéro violation ;
- agents et threads frais ;
- lineage, sélections, reçus et sorties exacts.

## Publication

La release française produit une paire cohérente :

```text
strong_lexicon.fr.core.production.sqlite
strong_lexicon.fr.full.production.sqlite
```

La paire est copiée et vérifiée dans un répertoire de release immuable, puis le
répertoire entier est publié par renommage atomique. Un unique
`data/dictionaries/lexicon-v3-fr/current.json` active ensuite les deux fichiers
du même snapshot. Le lecteur résout ce pointeur une seule fois, vérifie le reçu,
les hashes physiques et les empreintes logiques, puis utilise la paire exacte.

Le profil `core` contient seulement les garanties V3. Le profil `full` conserve
les ressources historiques autorisées, sans leur accorder le statut de contenu
V3 validé. Les anciennes tables de traductions non attestées sont purgées des
surfaces V3 et les carriers d'alignement sont isolés des textes d'affichage.

## Ce que signifie « validé »

Le pipeline ne prétend pas qu'une traduction automatique est
mathématiquement parfaite. Il remplace une vérification manuelle exhaustive par
des contrôles indépendants, traçables et bloquants, puis refuse de publier les
cas qui ne franchissent pas ces contrôles. La release finale doit donc être
comprise comme : **tout le contenu a passé le même contrat reproductible, et
aucune exception silencieuse n'a été acceptée**.
