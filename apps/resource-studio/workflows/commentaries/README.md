# Commentaires — workflow d’édition et lecteur local

Module d’acquisition, de normalisation, de traduction, de validation et de lecture des commentaires bibliques. Son lecteur HTML autonome utilise les fichiers JSON locaux. Le module n'écrit jamais dans Firebase et ne crée encore ni PostgreSQL ni SQLite.

## Ouvrir le lecteur local

Depuis la racine du dépôt :

```bash
yarn resources:commentaries:validate
yarn resources:commentaries:test
yarn resources:commentaries:serve
```

Puis ouvrir <http://127.0.0.1:4177>. Le port peut être changé avec `COMMENTARY_READER_PORT`.

Quand la bibliothèque locale a été construite, le lecteur expose trente et un corpus disponibles en JSON. Les 315 301 ancres source sont normalisées en 309 647 unités éditoriales et découpées par chapitre afin que le navigateur ne charge que les fichiers nécessaires au passage consulté. La différence provient de la déduplication réversible des plages Barnes : chaque ancre et chaque variante française historique restent conservées. La bibliothèque comprend les douze corpus initiaux, la Bible Annotée de Neuchâtel, seize commentaires de la vague 3 issue de STEP/CrossWire, le SDA Bible Commentary enrichi par les couches EGW et les annotations originales Douay–Rheims. TSK reste la source historique de la ressource de références croisées `TRESOR` de Bible Strong et n’est donc pas présentée comme un commentaire.

Le jeu versionné `data/comments.json` ne sert plus que de repli léger lorsque la bibliothèque complète, volontairement ignorée par Git, n'est pas présente. `data/catalog.json` inventorie aussi les autres œuvres examinées, même quand leur contenu n'est pas encore importé.

## Taxonomie éditoriale

Chaque ressource du catalogue possède une `tradition` large et stable, puis plusieurs `tags` cumulables. Les traditions actuellement utilisées sont `Protestantisme`, `Catholicisme`, `Christianisme ancien`, `Judaïsme` et `Interconfessionnel`. Les tags précisent les courants attestés — par exemple réformé, presbytérien, méthodiste, Frères, dispensationaliste ou patristique — sans mélanger ces courants avec le genre du document ou son époque.

Le catalogue compte trente et une œuvres, comme la bibliothèque. Aquifer y figure une seule fois comme ressource bilingue `Aquifer`; l’ancien identifiant technique `aquifer-fr` est conservé provisoirement dans les exports et les traductions publiées pour ne pas casser leur provenance, mais il n’est pas présenté à l’utilisateur. Les futurs artefacts de téléchargement pourront être nommés séparément `aquifer-en` et `aquifer-fr` sans créer deux œuvres dans le catalogue.

Chaque fiche possède également un objet `description` localisé. Ses clés correspondent exactement aux langues distribuées par la ressource : français et anglais pour une ressource bilingue, français seul pour une édition française, anglais seul pour une édition anglaise. Chaque texte présente la nature de l’œuvre, sa granularité et son apport de lecture sans répéter les champs techniques de couverture, de provenance ou de droits. Le validateur refuse toute langue manquante ou superflue ainsi que les textes trop courts ou dupliqués.

Le lecteur permet de filtrer simultanément par ressource, tradition et tag. La tradition et les tags exacts restent visibles sur chaque commentaire ainsi que dans le registre du catalogue.

## Exporter les vagues 1 et 2

Les sept paquets CrossWire officiels doivent être extraits sous `.local/sources/crosswire/installed/`. L'exporteur utilise `mod2imp` du moteur officiel SWORD ; son chemin peut être passé avec `--mod2imp`. L'index officiel `books.json` de Sefaria doit être placé sous `.local/sources/sefaria/`.

```bash
yarn resources:commentaries:export-waves \
  --mod2imp /chemin/vers/sword/utilities/mod2imp
yarn resources:commentaries:audit-waves
```

L'exporteur télécharge seulement les 39 éditions anglaises explicitement sélectionnées de Rachi. Il refuse les assemblages `merged` de Sefaria et toute licence différente de `CC-BY`. Le manifeste compact versionné `data/audit/waves-1-2.json` conserve versions, dates, URLs et hashes des sources sans committer les corpus.

## Construire la bibliothèque JSON complète

Après l'export Firestore complet, fournir un clone local épinglé d'Aquifer :

```bash
yarn resources:commentaries:build-library \
  --aquifer-root /chemin/vers/AquiferOpenStudyNotes
yarn resources:commentaries:validate-library
```

Le script lit également, sans le modifier, le SQLite MHY déjà présent dans les sorties du dépôt, les exports des vagues sous `.local/wave-export/`, l’export Bible Annotée sous `.local/bible-annotee-export/`, la vague 3 sous `.local/wave-3-export/` et l’export Douay–Rheims sous `.local/douay-rheims-export/`. Sa sortie reste exclusivement du JSON sous `.local/library/` : un index et 23 503 fragments par ressource et chapitre. L'instantané du 29 août 2026 contient :

- ACBC : 20 794 unités anglaises et françaises, aucune absence ;
- Barnes : 18 570 unités éditoriales et 24 224 ancres source, toutes disponibles en français ;
- Matthew Henry : 4 145 unités françaises ;
- Aquifer : 16 923 unités anglaises et françaises, aucune absence ;
- Matthew Henry Concise EN : 4 059 unités ;
- Jamieson–Fausset–Brown : 16 945 unités ;
- Wesley : 16 930 unités ;
- Augustin FR : 1 726 unités, avec des livres deutérocanoniques présents dans la source ;
- Chrysostome FR : 693 unités ;
- Calvin : 11 063 unités ;
- Treasury of David : 151 unités longues, une introduction et un commentaire par psaume ;
- Rachi EN : 28 060 unités sur les 39 livres du Tanakh.
- Bible Annotée de Neuchâtel FR : 23 320 unités sur les 66 livres, dont 667 introductions de chapitre AT et 27 introductions de livre NT.
- Vague 3 STEP/CrossWire : 101 841 unités anglaises réparties entre 16 commentaires. Les 31 151 unités TSK sont exclues du lecteur, car elles appartiennent à la ressource de références croisées `TRESOR`.
- SDA Bible Commentary : 25 062 unités anglaises sur les 66 livres et 1 189 chapitres, dont 66 introductions ; cette couche principale est enrichie dans la même ressource par 3 664 extraits EGW et 14 042 entrées de l’index scripturaire EGW.
- Original Douay–Rheims Annotations : 1 659 annotations anglaises publiées en JSON, sur 390 chapitres et 53 livres comportant du contenu.

Les huit corpus des vagues 1 et 2 sont publiés dans leur langue source. Aucune traduction n'est produite par ces scripts.
Les vingt marqueurs CrossWire littéraux `[]`, sans contenu éditorial, sont exclus des nombres ci-dessus.

## Portée éditoriale et couverture des versets

La bibliothèque JSON utilise le contrat `chapter-json-v2`. Chaque unité possède une `anchor` qui conserve son rattachement source et un `scope` canonique indépendant :

- `verse` pour une note ponctuelle ;
- `range` pour une plage explicitement structurée ;
- `section` pour une plage ou section éditoriale reconnue dans l’intitulé ;
- `chapter` et `book` pour les commentaires généraux et introductions ;
- `homily` pour les œuvres patristiques dont l’ancre est seulement un point d’entrée.

Le lecteur résout les bornes inclusivement et affiche leur libellé sur chaque carte. Les contenus de chapitre sont accessibles depuis tous les versets du chapitre sans être dupliqués physiquement. Les 223 plages Aquifer franchissant au moins un chapitre sont retrouvées par `coverageChunks`, un index secondaire vers leur chunk de départ.

La normalisation applique, dans cet ordre, les informations structurées Aquifer/MHM/SDABC, la déduplication exacte de Barnes, puis des parseurs conservateurs propres à MHY-FR, MHCC, JFB, Bible Annotée, Keil & Delitzsch, Fourfold Gospel et Luther. Une portée issue d’un titre porte `confidence: high` et reste distinguée d’une portée source `exact`. Une simple longueur ou une référence croisée ne suffit jamais à élargir une portée.

La normalisation est exécutée automatiquement après une construction ou une installation de corpus. Elle peut aussi être relancée seule, de façon idempotente :

```bash
yarn resources:commentaries:normalize-scopes
```

## Références bibliques OSIS et nettoyage des liens

La construction des JSON normalise aussi les liens incorporés aux commentaires. Le HTML publié ne contient aucun `<a>` ni `href` arbitraire : les destinations bibliques connues d’ACBC, Barnes, Aquifer, MHY, Calvin et CrossWire sont d’abord converties en OSIS, puis BCV Parser complète les références textuelles restantes en français ou en anglais.

Chaque contenu associe ses marqueurs de présentation à une cible structurée :

```json
{
  "html": "Voir <span class=\"bible-ref\" data-reference-id=\"r1\">Jean 3.16</span>.",
  "references": [
    {
      "id": "r1",
      "kind": "bible",
      "osis": "John.3.16",
      "label": "Jean 3.16",
      "source": "provider-href",
      "confidence": "exact"
    }
  ]
}
```

Les liens documentaires conservés après curation sont déplacés dans `externalSources[]` avec la politique `metadata-only`. Les publicités, ancres historiques et navigations propres aux anciens sites sont supprimées en conservant leur éventuel texte. Les objets `citations[]` de l’index EGW restent séparés et inchangés.

Le lecteur utilise directement les cibles OSIS pour sa navigation locale et n’exécute pas BCV Parser au rendu. La normalisation peut être relancée explicitement avec :

```bash
yarn resources:commentaries:normalize-links
```

## Importer les annotations originales Douay–Rheims

Le dépôt `janvier-s/original-douay-rheims` est la source éditoriale retenue. Son JSON est accepté tel que publié : Bible Strong ne le collationne pas avec les fac-similés, ne reconstitue pas les informations absentes et ne modifie pas le contenu des annotations. L’export ne fait qu’une conversion mécanique vers le schéma du prototype et conserve le commit ainsi que les hashes de provenance.

```bash
yarn resources:commentaries:export-douay-rheims
yarn resources:commentaries:install-douay-rheims
yarn resources:commentaries:validate-library
```

L’instantané courant est épinglé au commit `0bf4218b9b46b5b00d29a703b5b74226051b97a5`. Le dossier source comprend 394 fichiers JSON dans 54 dossiers de livres ; 390 chapitres et 53 livres contiennent effectivement les 1 659 objets importés. Les dix chapitres deutérocanoniques absents des autres corpus sont ajoutés à l’index sans changer leur numérotation source.

## Exporter et installer le SDA Bible Commentary

Le responsable Bible Strong confirme disposer des autorisations couvrant l’usage, l’extraction, la transformation et la redistribution du SDA Bible Commentary complet et des ressources EGW associées. Le prototype reste exclusivement en JSON. Les PDF des volumes 1 à 7 sont récupérés livre par livre depuis l’archive `SdaBibleCommentary1980`, mis en cache localement, convertis en texte avec conservation de la mise en page puis découpés en introductions et commentaires bibliques.

```bash
node apps/resource-studio/workflows/commentaries/scripts/export-sdabc.mjs
node apps/resource-studio/workflows/commentaries/scripts/install-sdabc-library.mjs
node apps/resource-studio/workflows/commentaries/scripts/validate-library.mjs
```

L’export contrôlé couvre les 66 livres et les 1 189 chapitres du canon protestant. Il produit 25 062 unités, dont 66 introductions, sous `.local/sdabc-export/`. Les rubriques imprimées `ELLEN G. WHITE COMMENTS` sont exclues de l’OCR général afin d’éviter les doublons : les 3 664 extraits EGW déjà extraits de façon structurée sont réinjectés comme compléments. Les 14 042 entrées du *Complete Scripture Index* sont conservées comme index de sources, et non présentées comme des commentaires exégétiques. Dans l’interface, ces trois couches appartiennent à une seule ressource utilisateur `sdabc`.

## Importer la Bible Annotée de Neuchâtel

L’autorisation ThéoTeX couvrant l’usage, la transformation et la redistribution a été confirmée par le responsable de Bible Strong. La pièce d’archive correspondante reste à rattacher au manifeste. L’import actuel ne produit que du JSON : aucun schéma SQL ou fichier SQLite n’est créé.

```bash
yarn resources:commentaries:export-bible-annotee
yarn resources:commentaries:audit-bible-annotee
yarn resources:commentaries:install-bible-annotee
yarn resources:commentaries:validate-library
```

Les pages HTML originales sont mises en cache sous `.local/sources/theotex-bible-annotee/`. Le corpus intégral et son manifeste détaillé restent sous `.local/bible-annotee-export/`; le manifeste compact versionné est `data/audit/bible-annotee.json`. Chaque page source possède son URL et son SHA-256. La page `Luc_nta_29.html`, tronquée sur le serveur source, est conservée dans l’inventaire avec zéro note extraite afin que cette lacune reste visible.

## Exporter et installer la vague 3 STEP/CrossWire

Le responsable Bible Strong confirme avoir obtenu de STEP et des auteurs l’autorisation nécessaire pour l’usage, la transformation et la redistribution des ressources concernées. Cette confirmation est inscrite dans le manifeste ; les pièces originales doivent rester archivées dans le registre de provenance.

```bash
yarn resources:commentaries:export-wave-3
yarn resources:commentaries:audit-wave-3
yarn resources:commentaries:install-wave-3
yarn resources:commentaries:validate-library
```

La vague source contient Abbott, Burkitt, Catena Aurea, Darby Notes, Family Notes, Geneva Notes, Keil & Delitzsch, KingComments, Lightfoot, Luther, Matthew Henry complet, Matthew Henry Modern English, People’s New Testament, Robertson’s Word Pictures, Scofield, Fourfold Gospel et Treasury of Scripture Knowledge. Les seize modules historiques sont téléchargés depuis le dépôt officiel CrossWire ; MHM est exporté depuis l’API STEP, chapitre par chapitre, avec un hash pour chacune des 1 189 réponses. TSK reste inventoriée dans l’audit de provenance, mais elle est exclue de la bibliothèque de commentaires parce que Bible Strong la distribue déjà comme références croisées sous l’identité `TRESOR`.

`TNotes` n’est pas réimporté : STEP le décrit comme la même œuvre *Tyndale Open Study Notes* déjà présente depuis le dépôt officiel Aquifer. `Spurious` est volontairement exclu parce qu’il s’agit d’un appareil signalant des passages contestés du Nouveau Testament, pas d’un commentaire. Aucune traduction française n’est produite dans cette vague.

## Produire et publier des traductions par lots

Les absences ACBC, Barnes et Aquifer peuvent être découpées en paquets bornés, sans service de traduction externe :

```bash
yarn resources:commentaries:prepare-translations
yarn resources:commentaries:prepare-translations:remaining
yarn resources:commentaries:validate-translations
yarn resources:commentaries:apply-translations
```

Les entrées sources restent sous `.local/translation-jobs/`. La commande `prepare-translations:remaining` élimine les textes déjà traduits et regroupe les rattachements qui partagent le même hash. Les sorties versionnables sont placées dans `data/translations/published/<ressource>/` et conservent l'identifiant, le passage, le hash exact du texte anglais, le modèle et l'effort de raisonnement. Le constructeur de bibliothèque les applique à tous les passages partageant ce hash, seulement lorsque la source correspond, et refuse d'écraser une traduction historique existante.

Les traductions présentes dans ce répertoire sont le contenu français publiable de référence. Elles ne portent aucun état de brouillon ou de revue. Les contrôles automatiques garantissent l'identité de la source, la structure HTML, les références bibliques normalisées et la traçabilité du lot. Les corrections ultérieures suivent un modèle réactif : un signalement utilisateur conduit à corriger le segment concerné et à republier les artefacts.

Au 29 août 2026, 1 727 textes français traçables sont publiés dans 127 lots : 747 ACBC, 979 Barnes et l'unique absence Aquifer. Leur application complète la couverture française d'ACBC, de Barnes et d'Aquifer.

## Reproduire l'audit ACBC/Barnes

L'export complet lit les collections publiques Firestore en lecture seule :

```bash
yarn resources:commentaries:export
yarn resources:commentaries:audit
```

Les données intégrales sont écrites sous `.local/firestore-export/` et restent hors de Git : environ 240 Mio lors de l'audit du 27 août 2026. Elles comprennent :

- `comments/acbc.json` et `comments/barnes.json` : source anglaise, éventuelle traduction française, hashes et résultat QA ;
- `missing/*.json` : lots exhaustifs immédiatement traduisibles, avec texte anglais ;
- `quality/*.json` : langue probable, identités anglaises, HTML dangereux et corps répétés ;
- `manifest.json` : compteurs et hashes de l'instantané.

Les manifestes compacts et versionnables se trouvent dans `data/audit/`. Ils permettent de revoir tous les identifiants manquants sans committer les textes intégraux.

Pour fabriquer uniquement un échantillon :

```bash
node apps/resource-studio/workflows/commentaries/scripts/export-firestore.mjs \
  --verses 1-1-1,43-3-16 \
  --output apps/resource-studio/workflows/commentaries/.local/sample-export
```

## Régénérer seulement les données de démonstration

Après un export complet, fournir un clone local épinglé d'Aquifer :

```bash
node apps/resource-studio/workflows/commentaries/scripts/build-reader-sample.mjs \
  --export-root apps/resource-studio/workflows/commentaries/.local/full-export \
  --aquifer-root /chemin/vers/AquiferOpenStudyNotes
```

Ce second script ne fabrique que le petit jeu de repli versionné ; il ne remplace pas `build-library.mjs` pour une lecture intégrale.

## Contrôles et corrections

- Toute traduction présente est exploitable par le prototype et par les futurs exports de données. La provenance technique disponible est conservée sans créer de statut éditorial.
- Les détections de langue restent heuristiques et servent à cibler les anomalies signalées ou détectées automatiquement.
- Les 39 alertes HTML Barnes proviennent notamment de balises de style présentes dans le corpus. L'interface applique une liste blanche et supprime scripts, styles, formulaires, objets, iframes et SVG.
- Les corps de traduction répétés ne sont pas automatiquement des doublons erronés : un même commentaire peut légitimement couvrir plusieurs versets.
- Les erreurs remontées par les utilisateurs sont corrigées au niveau du segment, puis les JSON sont régénérés et validés.
