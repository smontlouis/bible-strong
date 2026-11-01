# Liens d’étude

Cet atelier relie les sujets Nave, les articles de dictionnaire et les événements de la chronologie.
Il ne relie pas tout à tout : une personne, un lieu ou un groupe passe par son entité biblique, et un
thème passe par son sujet Nave. Les autres liens s’en déduisent.

```bash
yarn resources:study-links:test
yarn resources:study-links:export
yarn resources:study-links:build
yarn workspace @bible-strong/resource-studio study-links:database
```

`export` lit les publications actives en lecture seule. `build` écrit dans
`apps/resource-studio/outputs/study-links/` :

- `links.jsonl` : chaque lien avec sa preuve ;
- `report.json` : les compteurs et les faux amis écartés ;
- `title-corrections.json` : les titres français à corriger dans Nave et la chronologie ;
- `french-titles.json` : tous les titres qui changent, relus ou tirés de la Louis Segond ;
- `graph.json` puis `study-links.sqlite` : les fiches et les liens de la ressource.

## Règles

Un nom ouvre une candidature, seules les preuves la confirment. Sans preuve, pas de lien.

- **Orthographes.** Les index Strong de KJV et de LSG donnent la façon dont chaque Bible écrit une
  entité, sans comparaison floue : « Jacob » mène à `Israel@Gen.25.26-Rev`, « Saul » à Paul.
- **Versets.** Le sujet doit partager des versets avec l’entité. Un article de dictionnaire est jugé
  sur ce qu’il cite, car un verset contenant le même nom ne distingue pas les homonymes.
- **Test lexical.** Parmi les mots des versets écrits comme le nom, on compte ceux qui portent le
  Strong de l’entité. « sin » est H2403 et le désert de Sin H5512 : ce faux ami est écarté.
- **Homonymes.** Un sujet peut couvrir plusieurs personnes. Un événement titré d’un nom n’en
  concerne qu’une.
- **Chronologie.** Une personne doit être nommée par le titre et présente dans les chapitres, ou
  nommée par la description et présente dans les versets. Après la génération de Jacob, Israël
  désigne le peuple et ne renvoie pas à sa fiche.

Les niveaux de preuve sont `confirmed`, `probable` et `reviewed`.

## Corrections relues

- `config/overrides.json` retire ou ajoute un lien en disant pourquoi. Une correction qui ne
  correspond plus à aucun lien arrête la génération. Sa clé `rejectedSpellings` écarte les noms que
  la source confond avec une entité : Rama n’est pas Mitspa.
- `config/nave-french-titles.json` remplace les titres français de Nave issus de la traduction
  automatique. La clé `normalized_name` ne change pas.
- `config/timeline-french-titles.json` fait de même pour la chronologie, par `slug`.

Ces deux fichiers viennent d’une relecture. Un nom resté non traduit n’y garde sa correction que si le
texte de la Louis Segond ne l’atteste pas déjà tel quel.

## Fiabilité mesurée

Audit du 30 et 31 octobre 2026, soit environ 3 800 verdicts. Tous les liens des 200 entités les plus
citées ont été audités et les faux retirés. Sur un tirage neuf du reste des dictionnaires, 248 liens
sont corrects sur 250. Les erreurs se concentrent sur les grandes entités, qu’un tirage au hasard
atteint rarement : toute règle nouvelle se contrôle donc aussi sur elles.

Les liens `probable` de la chronologie ne sont pas à publier. Un lien de rôle `mentioned` s’affiche
sur la fiche de l’événement, pas dans la liste des événements d’une personne : le texte la nomme,
sans qu’elle y prenne part.

## Publication

La ressource `study-links` se construit depuis `study-links.sqlite` :

```bash
yarn workspace @bible-strong/resource-studio resources:publication:study-links \
  --sqlite "$PWD/apps/resource-studio/outputs/study-links/study-links.sqlite" \
  --output-dir "$PWD/apps/resource-studio/outputs/study-links/bundle"
```

Pour les titres français, `scripts/apply-french-titles.mjs` part des publications actives de
`nave:fr` et `timeline:fr` placées dans `outputs/study-links/regeneration/` et corrige aussi les
titres embarqués dans `apps/expo/src/assets/timeline/events.txt`. La clé d’un sujet et le `slug` d’un
événement ne changent pas ; la lettre d’un sujet suit son nouveau titre.

L’ordre de production est celui de la compétence `resource-publication`, avec la migration `0037`
avant l’import. Une application qui embarque `study-links` dans son catalogue exige que le Worker le
connaisse : déployez le Worker avant de livrer cette application.

La copie hors ligne arrive avec les dictionnaires. Un lecteur qui les a déjà installés lit les liens
en ligne ; sans réseau, il n’a pas la section tant qu’il n’a pas réinstallé ou mis à jour un
dictionnaire.
