# Fiches des stores — brouillon de décembre 2026

Textes pour l'App Store et Google Play, en français et en anglais. Longueurs vérifiées par script (limites entre parenthèses).

## État au 27 novembre 2026

- **App Store Connect** : tout est saisi dans la version 28.3.2 (build 308), en brouillon, **pas encore soumise**. Textes FR et EN, catégorie, URL, copyright, 10 captures iPhone et 10 captures iPad par langue, header et image de recherche iOS 27 (FR et EN), 3 aperçus vidéo iPhone par langue.
- **Google Play** : fiches FR (par défaut) et en-US publiées avec bandeau, 8 captures téléphone 9:16, 8 captures tablette 7" et 10", et vidéo YouTube. Les 8 captures desktop (Chromebook) par langue sont enregistrées en brouillon, à publier.
- Les textes ci-dessous sont ceux qui ont été saisis.

## Visuels

Source unique : `design/store/bible-strong-stores.pen` (Pen). Les images lourdes ne sont pas dans git (`design/store/.gitignore`) : `assets/`, `captures/`, `exports/`, `final/`, `fonts/` restent sur le Mac de travail. La police des titres est Neue Haas Unica Pro XBlack Italic, déclarée dans le `.pen`.

| Emplacement | Taille | Contenu |
|---|---|---|
| App Store iPhone | 1206×2622, 10 écrans | 01 tout en un … 09 commentaires, 10 hors ligne avec Strobi |
| App Store iPad 13" | 2064×2752, 10 écrans | même série |
| App Store header (iOS 27) | 3840×1646 | personnages de part et d'autre, « Étudiez la Bible en profondeur » dans la zone sûre 1646×661 |
| App Store recherche (iOS 27) | 3840×2560 | même ciel, grand titre derrière les personnages ; s'affiche **en entier et petit** sur iPhone |
| Play téléphone | 1440×2560 (9:16), 8 écrans | les 8 premiers écrans iPhone, bandes latérales floutées |
| Play tablette 7" et 10" | 2070×3680, 8 écrans | écrans iPad recadrés en 9:16 |
| Play desktop | 3840×2160, 8 écrans | captures iPad en paysage, titre à gauche, fenêtre à droite |
| Play bandeau | 1024×500 | Strobi et « Pose-moi tes questions ! » |

Portraits adoucis : `assets/*-subject-soft.png` (fondu en bas et sur les côtés du buste), générés à partir des `*-subject.png`.

## Vidéos (YouTube, non répertoriées, 27 novembre 2026)

| Vidéo | Id | Usage |
|---|---|---|
| Teaser FR 16:9 | `HSkWOKnEsLE` | vidéo de la fiche Play fr-FR |
| Teaser EN 16:9 | `fMA2pgEbgUI` | vidéo de la fiche Play en-US |
| Teaser FR 9:16 (Short) | `Awywk3jgfQQ` | — |
| Teaser EN 9:16 (Short) | `txLB_I5QJ-E` | — |

Le teaser (film pitch, environ 60 s, avec l'avatar animé de Strobi) ne peut pas servir d'App Preview : Apple n'accepte que des images de l'app, de 15 à 30 s.

## Aperçus vidéo App Store (App Previews, 27 novembre 2026)

Trois parcours filmés dans l'app (simulateur iPhone 17), envoyés dans la 28.3.2, jeu « iPhone with Dynamic Island (medium display) », 886×1920, FR et EN, dans cet ordre :

| # | Parcours | FR | EN |
|---|---|---|---|
| 1 | Cartes : nouvel onglet, Ruth 4, descendre, toucher un personnage, récupérer sa carte | Ruth, 22,6 s | Boaz, 21,5 s |
| 2 | Mot à mot : Genèse 1 en interlinéaire, un mot, son étude, la concordance | « créa », 17,6 s | « God » (KJV), 18,4 s |
| 3 | Frise : Chronologie, les patriarches, les Juges, Moïse | 16,8 s | 17,6 s |

- **Son :** silencieux, par choix (la musique synthétisée faisait trop enfantin). La piste audio est vide.
- **Titres :** en Pulp Display, sur un dégradé sombre en haut ou en bas de l'écran.
- **Projet :** `videos/bible-strong-app-previews/`, hors git. Le README de ce dossier explique comment refaire une prise.
- **iPad :** pas d'aperçu iPad. Ce n'est pas obligatoire : la fiche iPad montre les captures.
- **Image d'aperçu :** c'est celle par défaut, prise à 5 s.

## App Store — français (fr-FR)

| Champ | Texte | Long. |
|---|---|---|
| Nom (30) | `Bible Strong : Étude biblique` | 29 |
| Sous-titre (30) | `Hébreu, grec et assistant IA` | 28 |
| Mots-clés (100) | `concordance,segond,louis,audio,lexique,dictionnaire,commentaire,hors,ligne,méditation,verset,lecture` | 100 |
| Texte promotionnel (170) | `Nouveau : Strobi, l’assistant d’étude, répond à vos questions en citant votre Bible et ses sources. Et chaque jour, une méditation illustrée.` | 141 |

Règles suivies pour les mots-clés : aucun mot déjà présent dans le nom ou le sous-titre (bible, strong, étude, biblique, hébreu, grec, assistant, ia), pas d'espace après les virgules, singulier, aucun nom d'app concurrente. Apple combine les mots des trois champs : « bible » + « audio » couvre « bible audio », « louis » + « segond » couvre « louis segond », « hors » + « ligne » couvre « bible hors ligne ».

Retirés de l'ancienne liste : `bible`, `strong` (déjà dans le nom), `lexique` en double, `strong français`, `caucheranne`.

## App Store — anglais (en-US)

| Champ | Texte | Long. |
|---|---|---|
| Name (30) | `Bible Strong: Study Bible` | 25 |
| Subtitle (30) | `Hebrew, Greek & AI assistant` | 28 |
| Keywords (100) | `concordance,strongs,interlinear,lexicon,kjv,audio,commentary,dictionary,offline,devotional,verse` | 96 |
| Promotional text (170) | `New: Strobi, the study assistant, answers your questions by quoting your own Bible and showing its sources. And every day, an illustrated meditation.` | 149 |

Les tags générés par Apple (visibles aux US) partent de ces métadonnées en-US.

## App Store — autres champs

- Catégorie secondaire : **Éducation** (aujourd'hui vide).
- URL de support : `https://bible-strong.app` (aujourd'hui `github.com/bulby97/bible-strong`).
- URL marketing : `https://bible-strong.app` (aujourd'hui vide).
- Copyright : `© 2026 LeStudio316`.

## Google Play — français (fr-FR, fiche par défaut)

| Champ | Texte | Long. |
|---|---|---|
| Titre (30) | `Bible Strong : Étude biblique` | 29 |
| Description courte (80) | `Étudiez la Bible en hébreu et grec, avec 40 Bibles, l’audio et un assistant IA` | 78 |

## Google Play — anglais (en-US)

| Champ | Texte | Long. |
|---|---|---|
| Title (30) | `Bible Strong: Study Bible` | 25 |
| Short description (80) | `Study the Bible in Hebrew and Greek, with 40+ Bibles, audio and an AI assistant` | 79 |

## Description longue — français (App Store et Google Play)

Sur Google Play, ce texte compte pour la recherche ; sur l'App Store, il sert seulement à convaincre.

```text
Bible Strong est une application d’étude biblique complète. Lisez la Bible, découvrez les mots originaux hébreux et grecs avec la concordance Strong, et posez vos questions à Strobi, un assistant d’étude qui cite toujours votre Bible et ses sources.

Gratuite, sans publicité et open source, elle réunit dans une seule application les outils d’étude habituellement réservés aux spécialistes.

LIRE LA BIBLE
• Plus de 40 Bibles en français, en anglais, en hébreu et en grec : Louis Segond, Segond 21, Nouvelle Bible Segond, Darby, Ostervald, Bible du Semeur, Français courant, Parole de Vie, King James, ESV, NIV…
• Lecture parallèle pour comparer plusieurs traductions côte à côte
• Onglets pour garder plusieurs passages ouverts
• Thèmes, polices et réglages de lecture

HÉBREU, GREC ET CONCORDANCE STRONG
• Le mot original derrière chaque mot de votre Bible, avec translittération, définition et morphologie
• Un lexique hébreu et grec, et une concordance pour suivre un mot dans toute la Bible
• Une Bible interlinéaire hébreu-grec, en français et en anglais

STROBI, L’ASSISTANT D’ÉTUDE (IA)
• Trouvez un passage, comprenez un mot, rapprochez des textes, situez une question
• Le texte biblique cité vient toujours de votre Bible, et chaque réponse montre ses sources
• Sur les points débattus entre chrétiens, Strobi présente les différentes compréhensions sans trancher à votre place
• Quelques questions gratuites chaque jour avec un compte ; l’abonnement Premium lève la limite

UNE BIBLIOTHÈQUE D’ÉTUDE
• Dictionnaires bibliques et commentaires d’auteurs de différentes traditions, chacun signé
• Thèmes Nave, références croisées, personnages et lieux de la Bible
• Une frise chronologique illustrée de toute l’histoire biblique
• Des cartes à collectionner des personnages et des lieux bibliques

ÉCOUTER ET MÉDITER
• Bible audio, en arrière-plan, avec une musique de fond si vous le souhaitez
• Chaque jour, une méditation illustrée et le verset du jour
• Des plans de lecture annuels et thématiques, avec suivi de progression

VOTRE ÉTUDE PERSONNELLE
• Surlignages, notes, signets, étiquettes et liens entre versets
• Des études rédigées avec un éditeur riche
• Synchronisation entre iPhone, iPad, Android, ordinateur et navigateur

HORS LIGNE
• Téléchargez les Bibles et les ressources dont vous avez besoin pour étudier sans connexion

Bible Strong est un projet indépendant, soutenu par les dons et l’abonnement Premium. Les outils d’étude sont gratuits et le restent.
```

## Description longue — anglais (App Store et Google Play)

```text
Bible Strong is a complete Bible study app. Read the Bible, discover the original Hebrew and Greek words with Strong’s concordance, and ask your questions to Strobi, a study assistant that always quotes your own Bible and shows its sources.

Free, ad-free and open source, it brings together in one app the study tools usually kept for specialists.

READ THE BIBLE
• More than 40 Bibles in English, French, Hebrew and Greek: King James, NKJV, ESV, NIV, NASB, NLT, CSB, Berean Standard Bible, Louis Segond…
• Parallel reading to compare translations side by side
• Tabs to keep several passages open
• Themes, fonts and reading settings

HEBREW, GREEK AND STRONG’S CONCORDANCE
• The original word behind every word of your Bible, with transliteration, definition and morphology
• A Hebrew and Greek lexicon, and a concordance to follow a word through the whole Bible
• A Hebrew-Greek interlinear Bible, in English and French

STROBI, THE AI STUDY ASSISTANT
• Find a passage, understand a word, bring texts together, place a question
• The Bible text it quotes always comes from your Bible, and every answer shows its sources
• On points Christians debate, Strobi presents the different understandings without deciding for you
• A few free questions every day with an account; the Premium subscription lifts the limit

A STUDY LIBRARY
• Bible dictionaries and commentaries by authors from different traditions, each one signed
• Nave’s topics, cross-references, people and places of the Bible
• An illustrated timeline of the whole biblical story
• Collectible cards of biblical people and places

LISTEN AND MEDITATE
• Audio Bible, in the background, with optional background music
• Every day, an illustrated meditation and the verse of the day
• Yearly and topical reading plans, with progress tracking

YOUR PERSONAL STUDY
• Highlights, notes, bookmarks, tags and links between verses
• Written studies with a rich editor
• Sync across iPhone, iPad, Android, computer and browser

OFFLINE
• Download the Bibles and resources you need to study without a connection

Bible Strong is an independent project, supported by donations and the Premium subscription. The study tools are free and will stay free.
```

## Google Play — fiche personnalisée « bible »

Pour les personnes qui cherchent simplement « bible » (trafic signalé par la Play Console). L'accent passe de l'étude approfondie à la lecture quotidienne.

**État au 27 novembre 2026 : brouillon** dans la Play Console, nom de référence « Recherche bible (FR) » (le nom ne peut plus changer). Dupliquée de la fiche par défaut (mêmes visuels), diffusée à 50 % de l'audience ciblée (on peut monter, pas redescendre), sans date de fin. À publier depuis la Play Console.

Audience : mots-clés de recherche, sans restriction de pays : `bible`, `la bible`, `bible en français`, `bible francais`, `bible app`, `sainte bible`, `bible louis segond`, `louis segond`, `bible segond`, `bible audio`, `bible gratuite`, `bible française`, `application bible`. « bible strong » et les autres recherches de marque restent volontairement sur la fiche par défaut (45 % des visiteurs, 87 % de conversion).

| Champ | FR | EN |
|---|---|---|
| Titre (30) | `Bible Strong : Bible et audio` (29) | `Bible Strong: Bible & Audio` (27) |
| Description courte (80) | `La Bible Louis Segond et 40 versions, audio, verset du jour et méditation` (73) | `The KJV and 40+ Bible versions, audio Bible, verse of the day and devotional` (76) |

Description longue : celle de la fiche par défaut, avec un premier paragraphe tourné vers la lecture et l'écoute, puis « LIRE LA BIBLE » et « ÉCOUTER ET MÉDITER » en premier (FR 2547 caractères, EN 2293).

## App Store — pages produit personnalisées

**État au 28 novembre 2026 : quatre pages « Ready to Submit »**, pas soumises. Copiées de la 28.3.2 (header, image de recherche, captures), FR et EN.

| Page | Product Page ID | Première capture | Mots-clés associés | Texte promo FR |
|---|---|---|---|---|
| Strobi — assistant d'étude | `df0f87c3-7e8c-42a2-b9ae-8bde3adea270` | 02 Strobi | aucun (aucun mot-clé « IA » dans la version en ligne) | Strobi, l'assistant d'étude, répond à vos questions sur la Bible en citant votre version et en montrant ses sources. Quelques questions gratuites chaque jour. |
| Hébreu et grec | `a148dbaf-dfd5-42d2-b511-e778c72a2960` | 04 mot à mot | FR : hébreu, grec, concordance, lexique grec, lexique hébreu, strong français ; EN : Hebrew, Greek, concordance, Greek lexicon, Hebrew lexicon | Le mot hébreu ou grec derrière chaque mot de votre Bible : définition, translittération, concordance Strong et Bible interlinéaire. Gratuit et sans publicité. |
| Bible audio — écoute | `759e38af-d248-4233-9ea2-af40b6e5be3e` | 11 « Écoutez la Bible », 12 « Choisissez la voix », 13 « Une musique douce en fond » (nouvelles), puis 01, 03, 04, 05, 08, 02, 10 | aucun | Écoutez la Bible : la Segond lue par Trésor sonore, avec ou sans musique de fond, chapitre après chapitre. Gratuit et sans publicité. |
| Étude d'un verset | `b8f73dde-b299-43b8-a620-edd31db55e17` | 14 « Tout autour d'un verset », 15 « Les références croisées », 16 « Des dictionnaires bibliques » (nouvelles), puis 04, 09, 06, 01, 03, 05, 02 | aucun | Étudiez un verset en profondeur : autres versions, grec et hébreu mot à mot, références croisées, dictionnaires et commentaires. Gratuit et sans publicité. |

- Les mots-clés proposés sont ceux de la **version en ligne** (28.2.4). Après la sortie de la 28.3.2, revoir l'association (par exemple « audio » pour une future page audio).
- Lien public de chaque page : bouton « Copy Link » dans App Store Connect (`apps.apple.com/app/id1454738221?ppid=<Product Page ID>`).
- Les deux pages du 28 novembre n'ont pas de vidéo (« Remove All » sur le jeu iPhone, puis les captures dans l'ordre voulu). L'iPad FR garde la série de la version ; l'iPad EN est renvoyé dans un ordre adapté à la page. Textes EN : « Listen to the Bible: the King James read aloud… » et « Study any verse in depth… ».
- Nouveaux écrans iPhone dans le `.pen` : « iOS FR/EN 11 Audio » à « 16 Dictionnaires » (x 13060 à 19590). Exports dans `final/app-store/pages/`, captures brutes `captures/ios-fr|en/14-…20-…`.
- Un nom de page supprimée reste réservé chez Apple : d'où « Bible audio — écoute » au lieu de « Bible audio ».
- Défauts vus dans l'app anglaise pendant les captures : les références Nave restent en français (« Exode », « Matthieu »), l'étiquette des résultats de dictionnaire est « Dictionnaire », la puce « Easton + Webster 1828 » apparaît deux fois sur « Grace ».
- Dans App Store Connect, le glisser-déposer des captures marche sur iPhone mais pas sur iPad : pour réordonner, « Remove All » puis renvoyer les fichiers un par un dans l'ordre voulu.

## Points à valider

1. **Liste des versions citées.** Toutes figurent dans `apps/expo/src/helpers/bibleVersions.ts` (la Bible de Jérusalem y est commentée, donc retirée). À confirmer : chacune se télécharge bien pour tout le monde.
2. **Strobi pour tous.** Les textes Play sont en ligne : Strobi devrait être ouvert à tous, sinon la fiche promet ce que certains ne voient pas.
3. **« caucheranne »** : retiré des mots-clés. À remettre s'il a une raison d'être.
4. **« What's New » EN de la 28.3.2** : commence par « What's new in version 28.2 ». À vérifier avant de soumettre.
5. **Fiche Play personnalisée « bible » et pages produit App Store** : créées en brouillon le 27 novembre, à publier ou soumettre.
