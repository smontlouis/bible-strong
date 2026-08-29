# Audit des liens des commentaires et stratégie BCV

Date de l'audit : 28 août 2026
Périmètre : prototype JSON `apps/resource-studio/workflows/commentaries`, bibliothèque active décrite par `.local/library/index.json`.

## Conclusion

Il ne faut **ni conserver aveuglément les liens HTML des fournisseurs, ni supprimer toutes les balises `<a>` avant de les avoir interprétées**.

La solution recommandée est hybride, avec l'essentiel du travail réalisé à la construction des JSON :

1. convertir les destinations bibliques connues (`/Gen_1.26`, `ref.ly/John3:16`, `JHN3.16`, `osisRef`, etc.) en références OSIS internes ;
2. remplacer ensuite les liens fournisseur par une référence Bible Strong structurée ;
3. retirer la balise `<a>` des autres liens incorporés en conservant leur texte ;
4. conserver les liens externes réellement éditoriaux sous forme de métadonnées contrôlées, et non comme HTML arbitrairement cliquable ;
5. exécuter BCV Parser à la construction sur le texte restant pour détecter les références n'ayant jamais possédé de lien ;
6. réserver le parsing à la volée au contenu non préparé ou comme solution de repli.

L'index EGW constitue une exception volontaire : ses liens sont déjà modélisés dans `citations[]`. Ce sont des actions fonctionnelles de consultation, pas des liens HTML parasites, et ils doivent être conservés.

## Méthodologie et limites

Le scan part exclusivement de l'index actif et de ses chemins de chunks, sans parcourir d'anciens exports :

- 31 ressources actives ;
- 23 503 chunks JSON uniques ;
- 309 647 unités éditoriales normalisées ;
- 399 827 champs HTML examinés, en comptant les sources, traductions et variantes françaises de Barnes ;
- 410 821 balises `<a>` équilibrées examinées.

Les comptes de balises, d'attributs, de schémas et de domaines sont exacts pour ce snapshot. Une variante de traduction est comptée parce qu'elle fait réellement partie du JSON distribuable, même si elle ne s'affiche qu'à certains versets d'une plage.

Le test BCV est une mesure heuristique : il vérifie ce que le parseur strict français ou anglais peut reconstruire à partir du **libellé visible isolé**. Il ne constitue pas une mesure exhaustive de toutes les références bibliques présentes dans les textes. Les abréviations, les références numériques dépendant du contexte et les fragments de phrases expliquent une grande partie des échecs.

La disponibilité actuelle de chaque site externe n'a pas été testée URL par URL. « Brisé » signifie ci-dessous brisé dans le prototype actuel en raison de son routage ou de sa sanitisation ; les URL distantes sont seulement qualifiées de volatiles lorsqu'elles dépendent d'un site tiers.

## Vue d'ensemble

Parmi les 410 821 balises `<a>` :

| Type | Nombre exact | Interprétation |
|---|---:|---|
| Ancres nommées sans `href` | 103 318 | Vestiges de navigation interne aux éditions HTML, principalement Barnes |
| Liens possédant un `href` | 307 503 | Bibliques, éditoriaux ou externes |
| Liens dont le `href` survit au sanitizer actuel | 303 872 | « Cliquable » ne signifie pas fonctionnel dans Bible Strong |
| Schémas `javascript:`, `data:`, `mailto:` ou protocol-relative | 0 | Aucun lien de ce type dans le snapshot |

Les marqueurs de références non exprimés comme liens sont également très nombreux :

- 413 231 `<span class="ref">` ;
- 2 862 `<span class="source-ref">`, tous dans les couches EGW ;
- soit 416 093 spans de référence au total ;
- 13 642 balises historiques `<scripRef>` ;
- 2 596 spans Aquifer `data-bnType="resourceReference"` pointant vers une autre note ou ressource du fournisseur.

Ces marqueurs montrent que retirer seulement `<a>` ne règle pas le problème de fond : le corpus contient plusieurs dialectes de références qu'il faut normaliser.

## Ressources contenant des balises `<a>`

| Ressource | `<a>` | Sans `href` | Liens avec `href` | Nature et décision proposée |
|---|---:|---:|---:|---|
| ACBC / Adam Clarke | 39 574 | 0 | 39 574 | Tous sont des références `/OSIS_C.V` avec `class="bible-ref"` : convertir en OSIS interne |
| Aquifer | 77 556 | 0 | 77 556 | 77 553 `ref.ly` bibliques, plus 3 liens externes : convertir `ref.ly`, examiner séparément les trois autres |
| Barnes | 284 935 | 103 270 | 181 665 | 181 361 références `/OSIS_C.V`, 228 chemins d'une ancienne édition HTML et 76 publicités Compassion vides : convertir les premières, retirer le reste |
| Calvin | 7 843 | 0 | 7 843 | 4 453 fragments, environ 2 564 requêtes `?scrBook`, 697 chemins CCEL, 120 renvois de notes et 3 URL CCEL : importer les références récupérables, supprimer la navigation d'édition |
| Augustin FR | 1 | 0 | 1 | Lien Wikisource isolé : provenance éventuelle, pas lien inline par défaut |
| Kingcomments | 11 | 0 | 11 | PDF, Wikipédia, YouTube et autres sites : liens externes éditoriaux à mettre en métadonnées/curation |
| Lightfoot | 66 | 48 | 18 | 17 URL HTTP et un chemin relatif, plus 48 ancres d'édition : texte simple ou métadonnées après curation |
| Luther | 7 | 0 | 7 | Fragments locaux vers des paragraphes absents : navigation morte, à retirer |
| MHY-FR | 828 | 0 | 828 | Identifiants bibliques comme `MAT28.20` ; un cas emploie `JHN4:23` : convertir avec un parseur propre à cette source |

Les 22 autres ressources ne contiennent aucune balise `<a>` : Abbott, Bible Annotée, Burkitt, Catena Aurea, Darby Notes, Douay–Rheims, Family Notes, Fourfold Gospel, Chrysostome, Geneva Notes, JFB, Keil & Delitzsch, MHC, MHCC, MHM, PNT, Rachi, Robertson, Scofield, SDABC, Treasury of David et Wesley.

L'absence de `<a>` ne signifie pas absence de références. Bible Annotée, JFB, Keil & Delitzsch, MHC, Robertson, Scofield, Treasury of David et plusieurs autres possèdent des milliers de `span.ref` ; Family Notes, Geneva, PNT et Wesley emploient notamment `<scripRef>`.

## Les cas importants

### Aquifer et les liens `ref.ly`

Aquifer contient exactement 77 553 occurrences `https://ref.ly/...`, représentant 21 926 destinations distinctes. Le chemin encode déjà la cible, par exemple `Heb7:20-Heb7:22`. Les 21 926 chemins distincts ont tous produit une référence avec le BCV Parser anglais lors du contrôle de cet audit.

Ces liens ne doivent donc pas être ouverts chez le fournisseur. Ils doivent être transformés à l'ingestion en navigation Bible Strong. Le libellé seul n'est pas suffisant : Aquifer emploie fréquemment des raccourcis comme `22:11–12`, `91:11`, `14` ou `3:17, 1`, qui exigent le contexte précédent.

Les trois autres liens Aquifer sont :

- un lien Remacle ajouté à la traduction française comme source de la traduction de Justin Martyr ;
- un lien BibleHub vide, placé sur une espace typographique dans la source anglaise ;
- `http://28-29.su`, créé dans la traduction française autour de « 28–29 » alors que la source anglaise contient une relation Aquifer vers la note `21:28–29`. Ce dernier est une anomalie manifeste de traduction/HTML et doit être supprimé.

Les 2 596 `resourceReference` Aquifer sont une autre catégorie : ils désignent des notes thématiques ou notes d'étude du même écosystème. Le sanitizer retire aujourd'hui leurs attributs. Il faut garder leur texte et, si leur cible devient utile, conserver `resourceId`/`resourceType` en métadonnées internes ; ils ne doivent pas devenir des liens web par défaut.

### ACBC et Barnes

Les 220 935 liens `class="bible-ref"` cumulés par ACBC et Barnes portent une destination structurée telle que `/Gen_1.26`. Cette destination est plus fiable que le libellé, notamment après traduction.

Le prototype conserve le slash initial, mais il ne possède pas de route web `/Gen_1.26` : le clic sort donc de la lecture et aboutit à une route locale inexistante. L'application mobile historique sait déjà interpréter cette convention pour ouvrir la Bible, mais ce traitement dépend de `class="bible-ref"` et de la forme exacte du chemin.

Barnes contient aussi 103 270 `<a name="…">`, 228 chemins vers des pages telles que `isaiah-34.html` et 76 copies d'un lien publicitaire vide vers `www.compassion.com`. Ces éléments proviennent de la coque d'une ancienne édition web, pas du commentaire. Ils doivent être supprimés sans parsing BCV.

### Calvin, Luther et Lightfoot

Les fragments Calvin et Luther ne peuvent pas fonctionner dans le prototype : le sanitizer conserve `href="#…"`, mais retire les attributs `id` et `name` qui pourraient constituer leur destination. Le découpage par chunks empêche par ailleurs de garantir que la destination est chargée.

Les liens `?scrBook=...` de Calvin contiennent parfois une référence récupérable et doivent être interprétés avant suppression. Les fragments de notes, cartes, pages CCEL et anciennes navigations d'ouvrage sont des artefacts éditoriaux. Les liens HTTP de Lightfoot sont eux aussi liés à des sites et fichiers anciens ; ils ne doivent pas être rendus cliquables sans curation explicite.

### Références EGW : ne pas les confondre avec le HTML

SDABC contient 14 042 unités `editorialKind="scripture-index"` et 352 867 citations, pointant vers 69 317 paragraphes EGW distincts. Elles sont stockées dans `citations[]` avec `label`, `paragraphId` et `url`, puis rendues par une carte spécifique. Elles ne figurent pas dans le compte des 307 503 `href` incorporés aux commentaires.

Les 3 664 compléments EGW possèdent en outre 2 862 `originalSources`. Ces références bibliographiques doivent rester séparées des références bibliques : `source-ref` signifie « écrit EGW cité », pas passage biblique.

La chaîne EGW est déjà proche du bon modèle : l'importeur extrait les identifiants en objets structurés, puis supprime les liens arbitraires du HTML. L'index doit rester une fonctionnalité dédiée et autorisée, avec son libellé indiquant qu'une citation EGW n'est pas nécessairement un commentaire exégétique.

## Ce que fait le prototype aujourd'hui

Le sanitizer du prototype autorise les balises `<a>` et les `href` commençant par `/`, `#`, `http:` ou `https:`. Il ajoute `rel="noreferrer"`, mais ne transforme pas les destinations fournisseur en routes Bible Strong ([`app.js`](../../apps/resource-studio/workflows/commentaries/app.js#L50)). En conséquence :

- les liens ACBC/Barnes en `/Book_C.V` restent cliquables mais ne correspondent pas au routeur du prototype ;
- les 77 553 `ref.ly` quittent le prototype dans le même onglet et dépendent du réseau ;
- les fragments Calvin/Luther restent visibles alors que leurs cibles `id`/`name` ont été supprimées ;
- les chemins relatifs Calvin/Barnes/MHY sont déjà dépouillés de leur `href`, mais la balise `<a>` inutile demeure.

La sanitisation protège déjà contre plusieurs risques actifs. Le snapshot contient notamment 152 balises `<script>`, 76 `<form>`, 152 `<input>` et 87 `<img>` issues surtout de Barnes/Lightfoot ; elles sont bloquées ou déballées. Aucun `javascript:` ou `data:` n'a été trouvé dans les ancres. En revanche, accepter tout domaine HTTP(S) laisse subsister les risques de pistage, de contenu devenu hostile et de liens morts.

Le lecteur EGW est volontairement distinct : il construit ses liens à partir de `citations[]`, avec `target="_blank"` et `rel="noreferrer"` ([`app.js`](../../apps/resource-studio/workflows/commentaries/app.js#L194)).

## Ce que l'import perd déjà

L'importeur CrossWire transforme actuellement :

```html
<reference osisRef="John.1.1">Jn 1:1</reference>
```

en :

```html
<span class="ref">Jn 1:1</span>
```

La cible `osisRef`, qui est l'information la plus fiable, est donc jetée avant le futur parsing ([`wave-sources.mjs`](../../apps/resource-studio/workflows/commentaries/scripts/wave-sources.mjs#L89)). La prochaine reconstruction des corpus doit préserver cet attribut sous forme structurée avant de normaliser la présentation.

À l'inverse, l'import EGW extrait correctement `data-link` et `title` pour créer des objets `citations`, puis normalise le HTML ([`egw-sources.mjs`](../../apps/resource-studio/workflows/commentaries/scripts/egw-sources.mjs#L137)). Ce principe doit être généralisé aux références bibliques.

## Évaluation des stratégies

### 1. Garder et seulement « mieux sanitizer »

Cette option évite une migration immédiate, mais elle conserve les dépendances à `ref.ly`, les routes fournisseur incompatibles, les fragments morts et le comportement différent entre web et mobile. Une liste blanche de schémas protège du JavaScript, pas de la sémantique ni de l'obsolescence. Ce n'est pas une solution durable.

### 2. Retirer tous les `<a>` en gardant leur texte, puis parser à la volée

C'est séduisant mais destructeur. Sur environ 299 323 liens bibliques fournisseur testés, le BCV strict n'a pu récupérer exactement que 250 965 libellés isolés, soit 83,84 %. Environ 48 358 cibles seraient donc perdues si le `href` était supprimé avant conversion. La majorité des pertes vient des références numériques/contextuelles Aquifer, mais les traductions et les libellés abrégés contribuent aussi au problème.

Le parsing à chaque rendu répète par ailleurs le même calcul, complexifie la conservation des balises HTML, peut donner des résultats différents après une mise à jour du parseur et rend les faux positifs plus difficiles à auditer. Il reste utile pour du texte utilisateur ou une ressource non préparée, pas comme format de publication principal.

### 3. Parser uniquement au build ou dans le backend

Cette option rend les résultats reproductibles, testables et disponibles hors ligne. Elle permet d'attacher provenance et confiance à chaque référence. Employée seule, elle exige toutefois une nouvelle publication pour profiter d'une amélioration du parseur.

### 4. Modèle hybride recommandé

Le build/backend produit les références canoniques déterministes ; le client utilise directement ces cibles. À la volée, BCV ne traite que le texte résiduel ou les contenus non encore normalisés. Une version du parseur et une version de la règle source sont enregistrées pour permettre une reconstruction ultérieure.

Le dépôt contient déjà les briques nécessaires : le BCV partagé fonctionne en français et en anglais avec une stratégie stricte ([`README du parseur`](../../packages/bible-reference-parser/README.md), [`apps/mobile/src/helpers/bcvParser.ts`](../../apps/mobile/src/helpers/bcvParser.ts#L43)), retourne les indices du texte reconnu et sait construire une cible de navigation ([`apps/mobile/src/helpers/bcvParser.ts`](../../apps/mobile/src/helpers/bcvParser.ts#L195)). La transformation éditoriale Strong montre aussi comment parcourir séparément les nœuds texte et éviter de reparsing les ancres existantes ([`strongEditorialHtml.ts`](../../apps/mobile/src/features/lexique/strongEditorialHtml.ts#L61)).

## Contrat JSON proposé

Une unité de contenu ne devrait dépendre d'aucun domaine tiers pour naviguer dans la Bible :

```json
{
  "html": "Voir <span class=\"bible-ref\" data-reference-id=\"r1\">Jean 3.16</span>.",
  "references": [
    {
      "id": "r1",
      "kind": "bible",
      "osis": "John.3.16",
      "source": "provider-href",
      "confidence": "exact"
    }
  ],
  "externalSources": [
    {
      "label": "Dialogue avec Tryphon",
      "url": "https://remacle.org/...",
      "policy": "metadata-only"
    }
  ]
}
```

Le JSON publié peut ainsi ne contenir aucune balise `<a>` dans le texte du commentaire. Un `href="bible://John.3.16"` peut être généré en mémoire au rendu si le composant l'exige. La cible canonique doit néanmoins être validée au build ; le protocole ne doit pas être dérivé librement du HTML à l'exécution.

Chaque langue doit posséder ses propres emplacements de référence, car le texte et les positions diffèrent entre anglais et français, tout en réutilisant la même cible OSIS lorsque le lien fournisseur établit cette correspondance.

## Pipeline recommandé

1. Parser le HTML en DOM, sans regex globale appliquée à tout le corpus.
2. Extraire d'abord les destinations fortes selon la ressource :
   - `osisRef` CrossWire ;
   - `/Book_C.V` ACBC/Barnes ;
   - chemin `ref.ly` Aquifer ;
   - identifiant MHY-FR ;
   - paramètres `scrBook/scrCh/scrV` Calvin ;
   - objets EGW déjà structurés.
3. Valider et normaliser ces cibles en OSIS.
4. Déballer toutes les autres ancres HTML en gardant leur contenu textuel.
5. Conserver séparément les liens externes explicitement autorisés, avec domaine, provenance et politique d'ouverture.
6. Lancer BCV EN ou FR sur les nœuds texte qui ne sont pas déjà couverts, avec le passage de l'entrée comme contexte lorsque la syntaxe est relative.
7. Stocker la cible, la provenance (`provider-href`, `osis-attribute`, `bcv-text`, `editorial`) et la confiance.
8. Sanitiser définitivement le HTML publié et interdire tout `http(s)` inline non autorisé.
9. Valider qu'aucun lien biblique ne dépend du réseau et qu'aucun domaine inconnu ne passe silencieusement.
10. Dans l'application, ouvrir les références bibliques via le routeur local ; proposer les liens externes autorisés avec une icône, une confirmation et un comportement hors ligne explicite.

## Ordre de mise en œuvre

### Vague 1 — sans ambiguïté

- ACBC et Barnes `/Book_C.V` ;
- Aquifer `ref.ly` ;
- MHY-FR ;
- conservation de `osisRef` dans l'import CrossWire ;
- suppression des ancres nommées, publicités Compassion et anomalie `28-29.su` ;
- tests de non-régression sur le nombre de cibles converties.

### Vague 2 — références textuelles

- `span.ref` et `<scripRef>` avec BCV EN/FR et contexte de l'entrée ;
- réanalyse des textes sans marqueur ;
- revue d'un échantillon de faux positifs et mesure par ressource ;
- publication du taux de confiance dans l'audit de chaque corpus.

### Vague 3 — curation éditoriale

- Calvin, Luther et Lightfoot ;
- relations Aquifer `resourceReference` ;
- liens documentaires de Kingcomments, Augustin et autres sources ;
- politique explicite par domaine et par type de lien.

### Vague 4 — application

- navigation `bible://OSIS` entièrement locale ;
- rendu dédié aux sources externes et à EGW ;
- fallback BCV à la volée avec cache, télémétrie de détection et possibilité de corriger au prochain build.

## Décision proposée

La règle de publication peut être formulée simplement :

> Le texte d'un commentaire ne contient aucun lien web arbitraire cliquable. Les références bibliques sont des cibles Bible Strong structurées et hors ligne. Les renvois éditoriaux autorisés, dont l'index EGW, sont des objets métier distincts. Tout autre `<a>` est retiré en conservant son texte.

Cette règle répond à l'objectif initial de nettoyage sans sacrifier les centaines de milliers de destinations déjà encodées par les fournisseurs.
