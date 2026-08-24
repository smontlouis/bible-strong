# Issue #325 — campagne QA de la recherche

Cette checklist couvre la recherche de références, les passages textuels tolérants, Strong, les
thèmes, Qwen3 Embedding + pgvector, les filtres, l'affichage et les bascules Online/Offline-copy.

## Fiche de passe

- [ ] Plateforme : iOS simulateur / iPhone / Android émulateur / Android physique
- [ ] Build et commit testés : `________________________`
- [ ] API : locale / staging / production
- [ ] Langue de l'app : FR / EN
- [ ] Bible par défaut : `________`
- [ ] Versions téléchargées : `________________________`
- [ ] Date et testeur : `________________________`

Pour chaque anomalie, conserver : requête exacte, filtres, version, langue de ressource, capture,
temps approximatif et présence éventuelle d'une erreur Metro/API.

## P0 — smoke test en 15 minutes

- [ ] En LSG, `Jean 3:16-18` affiche une référence directe en première position et l'ouvre sur la bonne plage.
- [ ] En LSG, `jesus pleura` retrouve Jean 11:35 et met visuellement en évidence les mots trouvés.
- [ ] En LSG, `condamner` retrouve des flexions comme `condamnera`, `condamneront` ou `condamnés`.
- [ ] Les longs extraits de `condamner` sont centrés autour du mot trouvé, notamment dans Nombres et Deutéronome.
- [ ] `resurection` retrouve des occurrences de `résurrection` sans modifier le texte biblique affiché.
- [ ] `G26` ouvre/affiche l'entrée Strong G26 sans lancer une recherche de passages inutile.
- [ ] `agape` fait apparaître G26 malgré l'absence d'accent/macron.
- [ ] `anxiété` retourne des passages thématiques pertinents en LSG.
- [ ] `je suis inquiet pour demain` retourne des passages sémantiques et affiche une raison liée au thème.
- [ ] La phrase entre guillemets `"je suis inquiet pour demain"` reste strictement textuelle et ne produit pas artificiellement les résultats sémantiques de la requête sans guillemets.
- [ ] Le filtre Version commence par `Bible par défaut (<version>)`, sans option `Toutes les versions`.
- [ ] La section Passages apparaît avant Strong, Dictionnaire, Nave, Notes, Liens et Études.
- [ ] Aucun crash, aucune erreur `RESOURCE_UNSUPPORTED` et aucun résultat d'une ancienne requête ne remplace la dernière saisie.

Un seul échec P0 bloque la validation.

## 1. Préparer l'environnement local complet

### Données et services

- [ ] Démarrer PostgreSQL et appliquer les migrations :

  ```bash
  yarn resources:db:up
  yarn resources:migrate
  ```

- [ ] Démarrer le binding Workers AI dans un terminal séparé :

  ```bash
  yarn resources:topics:embeddings:dev
  ```

- [ ] Si l'index thématique n'est pas encore présent, l'importer une fois :

  ```bash
  yarn resources:topics:import
  ```

- [ ] Démarrer l'API locale dans un autre terminal :

  ```bash
  yarn resources:dev:local
  ```

- [ ] Vérifier que l'app utilise `http://127.0.0.1:8787` sur le simulateur iOS, `http://10.0.2.2:8787` sur l'émulateur Android, ou l'adresse LAN du Mac sur un appareil physique.
- [ ] Vérifier dans les logs que les recherches de passages utilisent la source `online` lorsque l'API est joignable.

### Intégrité attendue de l'index local actuel

- [ ] Le rapport `resource-service/.local/topic-import-report.json` indique 11 518 thèmes.
- [ ] Le rapport indique 11 574 alias.
- [ ] Le rapport indique 32 274 liens Torrey et 71 209 liens OpenBible.
- [ ] Le rapport indique 3 422 relations thématiques.
- [ ] `referencesRejected`, `unknownBooks` et `canonConflicts` ne révèlent aucune nouvelle erreur.
- [ ] Le modèle est `@cf/qwen/qwen3-embedding-0.6b`, le contrat `bible-topic-qwen3-v2` et la dimension 1 024.
- [ ] Le stockage thématique reste côté serveur ; aucune base SQLite vectorielle volumineuse n'est téléchargée sur le téléphone.

## 2. Barrière automatisée

- [ ] Tests Jest de l'application :

  ```bash
  yarn test --runInBand
  ```

- [ ] Tests unitaires du Resource Service :

  ```bash
  yarn resources:test
  ```

- [ ] Tests PostgreSQL d'intégration :

  ```bash
  yarn resources:test:integration
  ```

- [ ] Contrôles TypeScript, Worker et architecture :

  ```bash
  yarn typecheck
  yarn resources:worker:check
  yarn resources:architecture:check
  yarn agents:styles:check
  yarn lint
  ```

- [ ] Benchmark thématique avec le Worker d'embedding actif :

  ```bash
  yarn resources:topics:benchmark
  ```

- [ ] Les 22 requêtes canaris ont un thème attendu en première position (`22/22`).
- [ ] Comparer p50, p95 et maximum au rapport précédent ; investiguer toute régression supérieure à 20 % dans les mêmes conditions.
- [ ] Baseline locale du 24 août 2026 : p50 186 ms, p95 4 209 ms, maximum 6 912 ms. Cette baseline inclut l'appel Workers AI distant et n'est pas un SLA de production.

## 3. Références BCV

- [ ] `Jean 3:16` affiche la référence exacte et ouvre Jean 3 au verset 16.
- [ ] `Jean 3:16-18` conserve et ouvre toute la plage.
- [ ] `1 Corinthiens 13:4-7` reconnaît correctement le livre numéroté.
- [ ] En interface anglaise, `John 3:16` fonctionne.
- [ ] Les espaces et variantes usuelles (`Jean 3.16`, `Jn 3:16`) suivent les capacités habituelles du BookSelector/BCV.
- [ ] Une référence exacte ne déclenche pas de fausse liste de passages FTS.
- [ ] La référence est la première section visible, avant les autres ressources éventuelles.
- [ ] Une saisie incomplète comme `Jean 3:` ne provoque ni crash ni navigation erronée.

## 4. Recherche textuelle exacte et normalisée

- [ ] `Jésus pleura` retrouve Jean 11:35.
- [ ] `jesus pleura` retrouve le même passage sans accent.
- [ ] `JÉSUS PLEURA` retrouve le même passage sans dépendre de la casse.
- [ ] `l'amour`, `l’amour` et `amour` tolèrent les variantes d'apostrophe attendues.
- [ ] `resurrection` retrouve les occurrences de `résurrection`.
- [ ] `grace` retrouve les occurrences de `grâce` dans une version qui utilise ce mot.
- [ ] `dieu monde` applique un AND implicite : chaque passage textuel proposé contient les deux idées lexicales requises.
- [ ] `"Dieu a tant aimé"` retrouve la phrase dans le bon ordre.
- [ ] `"tant Dieu aimé"` ne se comporte pas comme une recherche de mots non ordonnés.
- [ ] Une phrase entièrement entre guillemets n'est jamais complétée par des résultats vectoriels.
- [ ] Une saisie de moins de deux caractères ne lance pas une recherche globale coûteuse.
- [ ] Les espaces en début/fin sont ignorés.
- [ ] Une saisie vide restaure l'état d'accueil et ses exemples.

## 5. Stemming français et anglais

- [ ] En LSG, `condamner` retrouve et surligne une forme comme `condamnera`.
- [ ] En LSG, `condamnés` retrouve les passages de la même famille morphologique.
- [ ] En LSG, le stemming ne surligne pas un mot sans rapport partageant seulement quelques lettres.
- [ ] En NIV, `condemn` retrouve des formes anglaises comme `condemned` ou `condemns` si présentes.
- [ ] En NIV, `love` retrouve les flexions anglaises pertinentes.
- [ ] Avec l'application en français et la NIV sélectionnée, le stemming reste anglais.
- [ ] Avec l'application en anglais et la LSG sélectionnée, le stemming reste français.
- [ ] Changer seulement la langue de l'interface ne modifie pas le texte ni la version interrogée.

## 6. Grec, hébreu et translittérations

- [ ] Dans une publication grecque compatible, `αγαπη` retrouve `ἀγάπη`.
- [ ] La même recherche fonctionne avec la forme accentuée `ἀγάπη`.
- [ ] Le sigma final et le sigma ordinaire sont normalisés lorsqu'ils apparaissent dans une requête grecque pertinente.
- [ ] Dans BHS, `אלהים` retrouve `אֱלֹהִים` sans niqqud.
- [ ] La recherche hébraïque accentuée retrouve le même passage.
- [ ] Le texte affiché conserve ses accents grecs ou ses signes hébreux originaux.
- [ ] La recherche dans une version française n'affiche pas artificiellement un verset grec simplement parce qu'un thème est grec.

## 7. Tolérance aux fautes

- [ ] `resurection` retrouve `résurrection`.
- [ ] Le mot trouvé est surligné dans son orthographe biblique originale.
- [ ] Une faute sur un mot de moins de quatre caractères ne déclenche pas une correction agressive.
- [ ] Une requête exacte qui possède déjà des résultats ne reçoit pas de résultats trigrammes moins pertinents avant eux.
- [ ] `monde` garde les passages contenant réellement `monde` en tête.
- [ ] Une requête aléatoire longue (`xqzptv`) ne produit pas une avalanche de faux positifs.
- [ ] Une phrase entre guillemets mal orthographiée ne déclenche pas le fuzzy fallback.

## 8. Strong

- [ ] `G26`, `g26` et `G0026` retrouvent la même entrée canonique G26.
- [ ] `agape`, `agapē` et `ἀγάπη` font apparaître G26.
- [ ] En ressources françaises, `amour` peut faire apparaître G26 via le glossaire localisé.
- [ ] En ressources anglaises, `love` peut faire apparaître G26.
- [ ] `H430` retrouve l'entrée hébraïque attendue.
- [ ] Une recherche par forme hébraïque originale retrouve H430 lorsqu'elle correspond.
- [ ] Un code Strong exact n'affiche pas une recherche de passages parasite.
- [ ] Appuyer sur le résultat ouvre la bonne fiche lexicale et non une entrée au même numéro dans l'autre langue.
- [ ] Le badge affiche le code Strong canonique.
- [ ] Le résultat conserve l'original, la translittération et le glossaire dans la langue de ressource choisie.
- [ ] Hors ligne avec le lexique téléchargé, `agape` et `G26` restent fonctionnels.
- [ ] Hors ligne sans le lexique, l'app affiche un état de disponibilité contrôlé et ne plante pas.

## 9. Recherche thématique et vectorielle

### Thèmes courts et contrôlés

- [ ] `anxiété` renvoie des passages liés à l'anxiété et affiche le thème explicatif.
- [ ] `solitude` renvoie des passages liés à la solitude.
- [ ] `deuil` renvoie des passages liés au deuil.
- [ ] `pardonner à quelqu’un` renvoie des passages liés au pardon.
- [ ] `peur de mourir` renvoie des passages liés à la peur ou à la mort.
- [ ] `confiance en Dieu` renvoie des passages liés à la confiance.
- [ ] `colère`, `amour` et `condamner` ne perdent pas leurs bons résultats lexicaux lorsque des résultats thématiques existent aussi.

### Questions naturelles françaises

- [ ] `je suis inquiet pour demain` remonte un thème de souci/inquiétude.
- [ ] `je me sens stressé sans raison` remonte stress, inquiétude ou anxiété.
- [ ] `je n’arrive pas à dormir à cause de mes soucis` remonte un thème lié aux soucis.
- [ ] `j’ai l’impression que tout le monde m’a abandonné` remonte abandon ou solitude.
- [ ] `la mort d’un proche me laisse inconsolable` remonte deuil ou perte d'un proche.
- [ ] `je refuse de pardonner à la personne qui m’a trahi` remonte pardon.
- [ ] `je suis amer quand quelqu’un possède plus que moi` remonte envie ou jalousie.
- [ ] `le poids de mes fautes passées m’écrase` remonte culpabilité ou pardon des péchés.
- [ ] `j’ai l’impression que Dieu ne répond jamais quand je lui parle` remonte prière, doute ou prière sans réponse.
- [ ] `je retombe toujours dans la même mauvaise habitude` remonte tentation ou péché répété.
- [ ] `j’ai envie d’abandonner devant cette épreuve` remonte courage, persévérance ou épreuves.
- [ ] `mon esprit est agité en permanence` remonte paix, anxiété ou esprit troublé.

### Multilingue et garde-fous

- [ ] Avec l'app en français et la NIV sélectionnée, une question française retourne le texte NIV aux références thématiques trouvées.
- [ ] Avec l'app en anglais et la LSG sélectionnée, une question anglaise peut retourner des passages LSG sémantiquement pertinents.
- [ ] Le changement de langue Nave privilégie le libellé thématique correspondant lorsqu'il existe.
- [ ] Une requête uniquement numérique (`12345`) ne déclenche pas une recherche vectorielle absurde.
- [ ] Une correspondance vectorielle faible ne produit pas de résultat sémantique sous le seuil prévu.
- [ ] Aucun résultat ne prétend être une réponse générée : l'app affiche toujours un vrai texte de la version sélectionnée.

## 10. Classement hybride et explications

- [ ] Un passage qui correspond lexicalement et thématiquement est bien classé et n'apparaît qu'une fois.
- [ ] Les correspondances lexicales exactes restent prioritaires sur les rapprochements vectoriels faibles.
- [ ] Un thème exact/contrôlé est prioritaire sur un thème fuzzy.
- [ ] Un thème fuzzy est prioritaire sur une correspondance uniquement vectorielle.
- [ ] Un résultat sémantique affiche `Sémantiquement proche du thème « … »`.
- [ ] Un résultat thématique/hybride affiche `Trouvé via le thème « … »`.
- [ ] La provenance affichée utilise uniquement les libellés `Nave`, `Torrey` et `OpenBible` attendus.
- [ ] Les sources multiples ne sont ni dupliquées ni affichées dans un ordre instable.
- [ ] Le libellé explicatif tient sur une ligne sans recouvrir le résultat.
- [ ] Une plage thématique affiche correctement son début et sa fin, y compris une plage traversant deux chapitres.
- [ ] Les références de Psaumes restent alignées malgré les différences de superscription entre versions.

## 11. Filtres de passages

### Bible par défaut et version fixe

- [ ] À la première ouverture, `Bible par défaut (<version courante>)` est sélectionné.
- [ ] L'option `Bible par défaut` est la première de la liste.
- [ ] L'option concrète de la même version, par exemple `LSG`, reste disponible séparément.
- [ ] L'option `Toutes les versions` n'existe plus.
- [ ] En choisissant `Bible par défaut (LSG)`, puis en changeant la Bible par défaut vers NIV dans les réglages, la recherche suit automatiquement NIV.
- [ ] En choisissant explicitement `LSG`, puis en changeant la Bible par défaut vers NIV, la recherche reste sur LSG.
- [ ] Le filtre sélectionné persiste après fermeture et réouverture de l'écran.
- [ ] `Réinitialiser` revient à Bible par défaut, pertinence, toute section, tout canon compatible et tout livre.

### Canon, testament, livre et ordre

- [ ] Le filtre Canon ne propose que les canons disponibles dans l'inventaire courant.
- [ ] Choisir un canon incompatible réconcilie la version au lieu de conserver une combinaison impossible.
- [ ] `Ancien Testament` inclut les deutérocanoniques pour un canon qui les contient.
- [ ] `Nouveau Testament` ne retourne aucun livre de l'Ancien Testament.
- [ ] Le filtre Livre limite strictement les passages au livre choisi.
- [ ] Changer de canon réinitialise un livre qui n'existe pas dans le nouveau canon.
- [ ] `Pertinence` classe selon les signaux hybrides.
- [ ] `Ordre biblique` classe selon l'ordre canonique de la version, pas selon l'identifiant technique.
- [ ] Le canon protestant suit exactement l'ordre du BookSelector de Genèse à Apocalypse.
- [ ] Dans le canon catholique, Tobie et Judith apparaissent après Néhémie, puis Esther, 1–2 Maccabées, Job ; ils ne sont pas rejetés après les 66 livres.
- [ ] Dans le canon clémentin, l'ordre correspond au BookSelector clémentin.
- [ ] Dans la Septante Théotex, l'ordre correspond au BookSelector Théotex.
- [ ] Le compteur de filtres actifs correspond au nombre réel de filtres non par défaut.

## 12. Facettes, sections et présentation visuelle

- [ ] Les facettes reprennent le design compact antérieur : fond arrondi, icône, libellé et compteur.
- [ ] Les facettes ont un espace inférieur visible avant la bordure/le contenu suivant.
- [ ] La facette active est clairement identifiable en thèmes clair et sombre.
- [ ] `Tout` additionne correctement les compteurs des facettes visibles.
- [ ] Sélectionner `Passages` masque les autres sections sans perdre la requête.
- [ ] La section Passages est placée avant Notes, Liens, Études, Strong, Dictionnaire et Nave.
- [ ] Chaque en-tête de section possède son icône et son compteur.
- [ ] Les lignes de résultat n'ont pas d'icône individuelle.
- [ ] Chaque résultat conserve son fond arrondi et possède une bordure gauche de 3 px dans la couleur de son type.
- [ ] La bordure gauche suit correctement les coins arrondis et ne dépasse pas entre deux lignes.
- [ ] Dans l'en-tête Passages, seule l'icône de réglage est affichée ; le mot `Filtrer` n'apparaît pas.
- [ ] Les mots trouvés sont surlignés sans exposer les marqueurs internes `{{...}}`.
- [ ] Un extrait long commence/termine avec une ellipse seulement lorsque du texte a réellement été coupé.
- [ ] Plusieurs mots proches restent visibles ensemble dans le même extrait.
- [ ] Tester petit iPhone, grand iPhone, Android, thème sombre et taille de police système agrandie.

## 13. Écran vide et exemples

- [ ] `Que cherchez-vous ?` possède un espace supérieur confortable sous l'icône.
- [ ] Les exemples sont réunis dans un seul conteneur centré avec retour automatique à la ligne.
- [ ] Le conteneur conserve une largeur maximale et ne s'étale pas sur tout l'écran tablette.
- [ ] Il existe un exemple de référence, un exemple de texte de verset, H1234, G26 et un exemple de mot.
- [ ] Il n'existe plus de sous-sections/titres séparés pour chaque famille d'exemples.
- [ ] Appuyer sur chaque chip remplit la recherche et produit le type de résultat attendu.

## 14. Modales et scroll

- [ ] La liste des versions peut défiler jusqu'au dernier élément sur un iPhone avec Dynamic Island.
- [ ] Le dernier choix est entièrement visible et sélectionnable au-dessus de la zone sûre.
- [ ] Il n'existe pas de grand padding inférieur vide une fois le dernier élément atteint.
- [ ] Les listes Canon, Section, Livre et Ordre ont le même comportement de zone sûre.
- [ ] Une modale enfant se ferme après sélection et révèle correctement la modale de filtres parente.
- [ ] Le clavier ne bloque ni les facettes ni le bas des résultats.

## 15. Pagination et interactions

- [ ] Dans `Tout`, chaque section affiche au départ son aperçu limité et `Voir plus` lorsque nécessaire.
- [ ] `Voir plus` ajoute des résultats sans dupliquer ceux déjà visibles.
- [ ] Avec une seule source active, la liste charge la page suivante en approchant du bas.
- [ ] Un chargement en cours ne déclenche pas deux demandes de page simultanées.
- [ ] Le compteur Passages représente le total, pas seulement la page chargée.
- [ ] Changer la requête remet la pagination et les nombres visibles à zéro.
- [ ] Changer un filtre pendant un chargement annule/ignore correctement l'ancienne réponse.
- [ ] Saisir rapidement `cond... condamner` n'affiche finalement que les résultats de `condamner`.
- [ ] Appuyer sur un passage ouvre le bon livre, chapitre, verset et la bonne version.
- [ ] Revenir à la recherche conserve les filtres et la requête attendus.

## 16. Offline-copy et dégradation réseau

- [ ] Télécharger LSG et le lexique Strong, puis activer le mode avion.
- [ ] Hors ligne, `Jésus pleura` fonctionne depuis SQLite.
- [ ] Hors ligne, une recherche sans accent fonctionne lorsque la normalisation locale le permet.
- [ ] Hors ligne, `resurection` utilise la tolérance locale sans afficher de faux texte corrigé.
- [ ] Hors ligne, `G26` et `agape` fonctionnent avec le lexique installé.
- [ ] Hors ligne, une question sémantique n'annonce pas de résultat vectoriel local inexistant.
- [ ] Remettre Internet restaure automatiquement la recherche en ligne sans redémarrer l'app.
- [ ] Avec Internet actif mais l'API coupée, une version entièrement installée retombe sur SQLite après l'erreur temporaire.
- [ ] Avec Internet actif, API coupée et version non installée, l'erreur contrôlée est affichée sans crash ni boucle de requêtes.
- [ ] Couper seulement le Worker Qwen : la recherche textuelle et les thèmes exacts fonctionnent encore ; seuls les résultats vectoriels peuvent disparaître.
- [ ] Une erreur d'embedding ne renvoie pas `RESOURCE_UNSUPPORTED` et ne casse pas Strong, Dictionnaire ou Nave.
- [ ] Les notes, liens et études locales restent recherchables quand l'API est indisponible.

## 17. Performance et stabilité

- [ ] Mesurer séparément une recherche lexicale (`Jésus pleura`) et une recherche sémantique longue.
- [ ] Une recherche lexicale exacte ne déclenche pas d'appel Qwen inutile lorsqu'un thème exact suffit.
- [ ] La requête pgvector reste rapide ; la latence principale éventuelle est attribuable à l'inférence distante et apparaît dans les métriques.
- [ ] Faire 20 recherches successives sans croissance mémoire évidente ni ralentissement progressif.
- [ ] Faire défiler 200 résultats dans une facette unique sans saccades bloquantes.
- [ ] Changer cinq fois de version et de canon sans requête bloquée ni état incohérent.
- [ ] L'API renvoie une seule ligne logique par version/référence après fusion lexical + thématique.
- [ ] Les logs ne contiennent ni vecteur complet de 1 024 nombres, ni contenu sensible, ni spam d'erreurs récupérables.

## 18. Régressions hors recherche

- [ ] La lecture normale d'un chapitre fonctionne Online et Offline-copy.
- [ ] Le changement de Bible par défaut fonctionne encore dans le lecteur biblique.
- [ ] L'ouverture d'une fiche Strong depuis un verset fonctionne.
- [ ] Notes, surlignages, favoris et liens s'ouvrent depuis les résultats.
- [ ] Les écrans Dictionnaire et Nave restent navigables depuis leurs résultats.
- [ ] Le changement de langue des ressources dans les réglages reste persistant.
- [ ] Aucun avertissement React de clé dupliquée n'apparaît lors de résultats multi-version ou hybrides.

## Critères de sortie

- [ ] Tous les P0 passent sur iOS et Android.
- [ ] Aucun crash, aucune corruption de filtre et aucune mauvaise référence canonique.
- [ ] Tous les tests automatisés passent.
- [ ] Le benchmark conserve 22/22 canaris et aucune régression de latence inexpliquée.
- [ ] Les écarts visuels sont validés en clair, sombre et grande police.
- [ ] Les dégradations Qwen/API/Offline-copy sont contrôlées.
- [ ] Toute anomalie restante est enregistrée avec sévérité, reproduction et décision explicite avant production.

## Modèle de rapport d'anomalie

```text
ID : SEARCH-QA-___
Sévérité : P0 / P1 / P2 / P3
Plateforme/build :
API et réseau :
Langue app / langue ressources :
Bible par défaut / version filtrée :
Canon / section / livre / ordre :
Requête exacte :
Étapes :
Résultat obtenu :
Résultat attendu :
Temps observé :
Capture/logs :
```
