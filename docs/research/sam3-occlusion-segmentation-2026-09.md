# SAM 3 pour régénérer les occlusions de Bible Strong World

Recherche du 20 septembre 2026, sources Meta et fal.ai officielles uniquement. Cette note compare les options documentées ; elle ne contient ni appel d'inférence, ni modification du pipeline ou des assets.

## Conclusion

Pour régénérer environ 91 occluders à partir de la carte finale 6672 × 3760, je recommande un **pipeline hors ligne assisté**, exécuté sur des crops par objet avec `fal-ai/sam-3/image`, puis revu visuellement. Il n'est pas nécessaire d'uploader la carte à la main dans le playground : le client fal accepte un fichier binaire et l'upload automatiquement, ou fournit `fal.storage.upload`. La clé doit rester dans un script local ou un backend, jamais dans le navigateur. [API fal SAM 3 Image](https://fal.ai/models/fal-ai/sam-3/image/api)

Il ne faut pas segmenter la carte complète en une seule passe. Le processeur officiel de SAM 3 redimensionne l'image en **1008 × 1008** avant l'inférence, puis réinterpole le masque à la taille originale. Sur une carte panoramique de 6672 × 3760, cette réduction sacrifierait les détails fins des branches, bancs, livres, rambardes et treillis. Une sortie ayant les dimensions originales ne recrée pas l'information perdue pendant cette réduction. [Processeur d'image officiel](https://github.com/facebookresearch/sam3/blob/main/sam3/model/sam3_image_processor.py)

SAM 3 est préférable à l'auto-segmentation SAM 2 pour l'amorçage de ce travail, car il ajoute les concepts textuels ouverts et permet de combiner texte, boîtes et clics de correction. Il ne faut toutefois pas attendre une découpe parfaite sans revue : Meta présente SAM 3 comme meilleur sur les tâches de segmentation promptée, mais ne garantit pas des contours exacts pour une illustration ni une supériorité pixel par pixel sur nos 91 objets. [Présentation Meta de SAM 3](https://ai.meta.com/research/sam3/)

SAM 3.1 n'est pas le premier choix pour cette carte fixe. Sa nouveauté officielle principale, Object Multiplex, accélère surtout le suivi conjoint de nombreux objets en **vidéo** ; Meta ne documente pas dans cette release un gain particulier de précision des contours sur images fixes. fal facture en outre son endpoint image deux fois plus cher que SAM 3 : 0,01 $ contre 0,005 $ par requête. [Release SAM 3.1](https://github.com/facebookresearch/sam3/blob/main/RELEASE_SAM3p1.md), [fal SAM 3.1 Image](https://fal.ai/models/fal-ai/sam-3-1/image), [fal SAM 3 Image](https://fal.ai/models/fal-ai/sam-3/image)

## État actuel de Meta SAM 3

SAM 3 est un modèle unifié de détection, segmentation et suivi promptables pour images et vidéos. Par rapport à SAM 2, sa capacité nouvelle est de trouver et segmenter exhaustivement les instances correspondant à un concept ouvert décrit par une courte phrase ou un exemple. Il conserve aussi l'interaction visuelle de SAM 2. [Dépôt officiel](https://github.com/facebookresearch/sam3), [page de recherche Meta](https://ai.meta.com/research/sam3/)

### Modes de prompting documentés par Meta

- **Texte** : un mot ou une courte phrase désigne un concept et peut produire toutes ses instances.
- **Exemplar** : une boîte tracée autour d'un exemple sert à retrouver les objets analogues.
- **Boîte visuelle** : une boîte cible ou affine un objet précis dans une image.
- **Points positifs et négatifs** : des clics incluent ou excluent des régions ; des clics supplémentaires permettent une correction interactive.
- **Masque** : Meta présente le masque comme prompt visuel dans les capacités générales du modèle, notamment pour les workflows interactifs et vidéo.

Ces capacités générales ne sont pas toutes nécessairement exposées de la même façon par chaque hébergeur. Le README officiel montre directement le prompt texte pour l'image, ainsi que des notebooks texte + boîtes et des raffinements vidéo par points. La page Meta documente texte, exemplars, clics positifs/négatifs et prompts de suivi. [README officiel](https://github.com/facebookresearch/sam3#basic-usage), [exemples officiels](https://github.com/facebookresearch/sam3#examples), [page Meta](https://ai.meta.com/research/sam3/)

### Résolution et conséquence pour l'alignement

Le `Sam3Processor` officiel :

1. mémorise la largeur et la hauteur originales ;
2. redimensionne l'entrée à 1008 × 1008 ;
3. calcule le masque dans l'espace du modèle ;
4. réinterpole bilinéairement les logits vers la hauteur et la largeur originales ;
5. binarise à 0,5.

Le masque local final a donc bien la taille de l'image fournie, mais sa frontière dérive d'une représentation 1008 × 1008. Pour Bible Strong World, un crop serré dont les dimensions restent au plus proches de cette résolution préserve beaucoup plus d'information qu'une inférence sur la carte panoramique complète. [Implémentation officielle de `Sam3Processor`](https://github.com/facebookresearch/sam3/blob/main/sam3/model/sam3_image_processor.py)

### Exécution locale officielle

Meta documente actuellement :

- Python 3.12 ou supérieur ;
- PyTorch 2.7 ou supérieur ;
- GPU compatible CUDA avec CUDA 12.6 ou supérieur ;
- demande préalable d'accès au checkpoint Hugging Face et authentification pour le télécharger ;
- Flash Attention 3 et `cc_torch` en options pour accélérer l'inférence.

Le chemin officiellement pris en charge est donc une machine NVIDIA/CUDA. Le README ne documente pas de chemin macOS/Apple Silicon, CPU seul, ONNX ou TensorRT officiellement supporté pour SAM 3. [Installation officielle](https://github.com/facebookresearch/sam3#installation)

### Licence

SAM 3 n'est pas publié sous Apache-2.0 comme un paquet open source permissif classique, mais sous la **SAM License** spécifique de Meta, datée du 19 novembre 2025. Elle accorde une licence limitée, mondiale, gratuite et non transférable pour utiliser, reproduire, distribuer et modifier les matériaux SAM. Toute redistribution des matériaux SAM ou de leurs dérivés doit conserver cette licence ; une publication de recherche doit reconnaître SAM ; l'usage doit respecter les lois, la protection des données et les restrictions de contrôle des échanges. La licence contient également exclusions de garantie, limitation de responsabilité et clause de résiliation. [Texte officiel de la SAM License](https://github.com/facebookresearch/sam3/blob/main/LICENSE)

Notre cas réduit le risque de redistribution : le pipeline resterait hors ligne et le produit publierait seulement des PNG d'occlusion revus, pas le checkpoint ni le code du modèle. Cette observation n'est pas un avis juridique et la licence ne doit pas être résumée par le seul badge « commercial use » de fal.

## Offres fal.ai officielles

### `fal-ai/sam-3/image`

L'endpoint image accepte :

- `image_url` ; un fichier local peut être auto-uploadé par le client fal ;
- `prompt` textuel ;
- `point_prompts` avec `x`, `y`, label 1/0 et `object_id` facultatif ;
- `box_prompts` en coordonnées `x_min`, `y_min`, `x_max`, `y_max`, avec `object_id` facultatif ;
- PNG, JPEG ou WebP en sortie ;
- plusieurs masques, un maximum configurable, les scores et les boîtes en option.

Les points et boîtes portant le même `object_id` raffinent le même objet. Lorsqu'un prompt texte est présent, l'identifiant permet de sélectionner l'objet détecté à raffiner. La réponse fournit une image principale facultative, une liste de masques et, sur demande, scores et boîtes. Le schéma image n'expose pas actuellement de champ de **masque d'entrée**, malgré la description générale de SAM 3 évoquant des prompts masque. [Schéma officiel fal SAM 3 Image](https://fal.ai/models/fal-ai/sam-3/image/api)

Le prix affiché est **0,005 $ par requête**. La page produit annonce une sortie native 1024 × 1024 et jusqu'à 32 masques ; le schéma d'API montre lui aussi des exemples de sorties 1024 × 1024. Pour un premier passage par crop sur 91 objets, l'ordre de grandeur maximal est donc **0,455 $**, hors reprises. Regrouper plusieurs boîtes dans une requête peut réduire le nombre d'appels, mais le découpage objet par objet facilite le contrôle qualité et maintient chaque cible grande dans l'espace 1024 × 1024. [Prix et caractéristiques fal](https://fal.ai/models/fal-ai/sam-3/image)

### `fal-ai/sam-3/image-rle`

Cet endpoint prend les mêmes prompts texte, points et boîtes, mais renvoie le masque sous forme de **run-length encoding** plutôt que comme PNG. Il peut aussi renvoyer métadonnées, scores et boîtes. Le RLE est une représentation propre pour un alpha binaire, mais le contrat affiché ne fournit pas explicitement les dimensions du masque avec le RLE ; un essai contrôlé est donc nécessaire avant d'en faire le format canonique du pipeline. Le prix affiché est **0,005 $ par unité**. [API officielle SAM 3 Image RLE](https://fal.ai/models/fal-ai/sam-3/image-rle/api), [prix affiché](https://fal.ai/models/fal-ai/sam-3/image-rle)

### `fal-ai/sam-3-1/image`

fal expose aussi SAM 3.1 avec le même schéma principal : image, texte, points, boîtes, masques multiples, scores et boîtes. Le prix affiché est **0,01 $ par requête**, soit environ **0,91 $** pour 91 crops avant reprises. La justification officielle de SAM 3.1 porte surtout sur Object Multiplex et les optimisations de suivi multi-objet ; elle ne suffit pas à justifier ce surcoût pour notre image fixe sans essai comparatif. [API fal SAM 3.1](https://fal.ai/models/fal-ai/sam-3-1/image/api), [prix fal SAM 3.1](https://fal.ai/models/fal-ai/sam-3-1/image)

### `fal-ai/sam2/image`

L'endpoint SAM 2 guidé accepte une image, des points positifs/négatifs et des boîtes, puis renvoie une image segmentée. Il n'accepte pas de prompt texte. Son schéma convient donc au pipeline existant fondé sur boîtes et points, mais n'apporte pas la désambiguïsation sémantique de SAM 3. [API officielle fal SAM 2 Image](https://fal.ai/models/fal-ai/sam2/image/api)

La page officielle consultée n'affiche pas de prix fixe exploitable pour cet endpoint ; il ne faut pas déduire un coût nul de l'exemple générique « 0 $ par compute second » montré sur certaines pages fal.

### `fal-ai/sam2/auto-segment`

L'endpoint automatique ne reçoit qu'une image et renvoie un masque combiné ainsi que des masques individuels. Il n'offre ni boîte ni points dans le schéma publié. Il est utile pour inventorier grossièrement une scène, mais moins adapté à 91 cibles déjà connues et annotées. Sa page affiche également « 0 $ par compute second », sans tarif opérationnel fixe documenté. [Page officielle SAM 2 Auto Segmentation](https://fal.ai/models/fal-ai/sam2/auto-segment)

### Upload et automatisation

fal accepte une URL publique, une data URI ou un fichier uploadé. Le client officiel peut appeler `fal.storage.upload(file)` et auto-uploade les objets binaires. La data URI est explicitement déconseillée pour les gros fichiers à cause de son impact sur les performances. La clé API doit rester côté serveur ou dans un outil local. Il n'est donc pas nécessaire que l'utilisateur ouvre le playground et charge 91 images manuellement. [Gestion des fichiers et sécurité de la clé](https://fal.ai/models/fal-ai/sam-3/image/api)

## Comparaison pour les 91 occluders

| Option | Forces | Limites pour la carte | Avis |
| --- | --- | --- | --- |
| SAM 2.1 ONNX actuel | Pipeline déjà maîtrisé, boîtes + points, exécution locale CPU | Contours parfois imparfaits ; pas de texte ; export communautaire, pas SAM 3 officiel | Garder comme référence de comparaison |
| SAM 2 guidé sur fal | Même logique boîte + points, aucun setup GPU | Pas de texte ; prix fixe non documenté ; sortie d'exemple 1024² | Peu d'avantage face au pipeline actuel |
| SAM 2 auto sur fal | Inventaire automatique rapide | Pas de prompts ciblés ; scène illustrée dense ; fusion/sur-segmentation probables | Ne pas l'utiliser pour les assets finaux |
| SAM 3 local officiel | Contrôle local, sortie remise aux dimensions d'entrée, texte + prompts visuels | NVIDIA/CUDA 12.6, Python 3.12, checkpoint gated ; modèle interne à 1008² | Bon si une machine CUDA est déjà disponible |
| SAM 3 Image sur fal | Aucun setup CUDA, texte + boîtes + points, coût très faible, automatisable | Upload distant ; sortie documentée à 1024² ; revue toujours nécessaire | **Choix recommandé pour ce lot ponctuel** |
| SAM 3.1 Image sur fal | Version la plus récente | Bénéfice documenté surtout en vidéo, coût ×2 | Tester seulement si SAM 3 échoue sur un échantillon |

## Pipeline recommandé pour préserver l'alignement

1. **Figer le raster de référence exact.** Segmenter le raster normalisé qui sert réellement à produire les tuiles, pas le PNG brut avant normalisation et pas la preview. Le pipeline de carte normalise actuellement le monde à 6684 × 3764, soit exactement 4 × le repère logique 1671 × 941. C'est cette image normalisée qui doit fournir les pixels RGB et les coordonnées de placement.
2. **Réutiliser les annotations existantes.** Multiplier boîtes, points, marges et `baseY` du repère 1671 × 941 par quatre. Les revoir lorsque l'upscale a changé la silhouette réelle.
3. **Produire un crop par objet**, avec une marge équivalente à la marge actuelle de 32 pixels logiques, donc environ 128 pixels dans le raster 4×. Maintenir autant que possible chaque crop sous 1008/1024 pixels par axe. Pour un grand treillis ou bâtiment, scinder en parties cohérentes plutôt que réduire toute la scène.
4. **Prompt hybride SAM 3.** Envoyer une courte expression concrète, idéalement en anglais, une boîte serrée, deux ou trois points positifs et des points négatifs sur les voisins. Utiliser le même `object_id` pour les raffinements d'un objet. Demander plusieurs masques et leurs scores, mais conserver le choix visuel humain comme autorité finale.
5. **Utiliser fal par script local.** Auto-uploader chaque crop, appeler `fal-ai/sam-3/image`, télécharger les résultats et conserver l'identifiant de requête, les prompts et le score dans les métadonnées de QA. Aucun upload manuel n'est requis.
6. **Ne jamais prendre les couleurs de la sortie fal.** Extraire uniquement l'alpha du masque ; les pixels RGB du sprite doivent provenir du crop exact de la carte normalisée. Cette règle maintient l'identité pixel par pixel du fond et de l'occluder.
7. **Reprojeter dans le crop exact.** Vérifier la largeur, la hauteur et l'orientation retournées. Replacer le masque dans les dimensions exactes du crop, puis dans la carte à l'origine entière du crop. Ne jamais recalculer la position depuis une boîte normalisée arrondie.
8. **Faire une revue de frontières.** Examiner au minimum les branches fines, feuillages ajourés, pieds de banc, pages de livres, rambardes, colonnes et pergolas. Corriger le masque par points supplémentaires ou retouche binaire locale. Conserver suppression des petites composantes et remplissage des intérieurs seulement par type d'objet, comme dans le pipeline actuel.
9. **Valider automatiquement l'invariant final.** Chaque PNG doit être RGBA, non vide, dans les limites du raster ; sa couche RGB doit être strictement identique au rectangle correspondant du raster normalisé. Une planche de contact avant/après doit rendre la sélection humaine reproductible.

## Essai minimal avant les 91 objets

Comparer sur dix cibles représentatives : un arbre feuillu, un cyprès, une rambarde, un banc, une pile de livres, une table avec intérieur à remplir, une colonne, une arche fleurie, un treillis et un petit arbuste. Pour chaque cible, conserver le même crop et les mêmes prompts géométriques, puis comparer :

- SAM 2.1 actuel ;
- fal SAM 3 avec boîte + points ;
- fal SAM 3 avec texte + boîte + points ;
- SAM 3.1 uniquement sur les échecs persistants.

Les critères doivent être le nombre de corrections nécessaires, les faux positifs voisins, les trous indésirables, la conservation des parties fines et l'alignement après recomposition — pas uniquement le score du modèle. Si le texte n'améliore pas ces dix cas, le coût de migration vers SAM 3 ne se justifie pas par principe ; s'il réduit clairement les retouches, le lot complet peut être automatisé pour moins d'un dollar de première passe.

## Décision proposée

Utiliser **fal SAM 3 sur des crops issus du raster normalisé final**, piloté par un script local, avec texte + boîte + points et revue humaine. Cette solution évite de préparer une machine CUDA, coûte environ 0,46 $ pour 91 premières passes et ne demande aucun upload manuel. Garder SAM 2.1 comme baseline de l'essai, ne passer à SAM 3.1 qu'en cas de gain mesuré, et ne considérer aucune variante comme suffisamment précise pour supprimer la validation visuelle.
