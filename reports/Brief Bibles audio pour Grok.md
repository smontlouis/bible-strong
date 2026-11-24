# Brief : obtenir les droits des Bibles audio pour Bible Strong

Document autonome, rédigé le 24 novembre 2026, à transmettre tel quel à un assistant. Il contient le contexte, l'état des droits par enregistrement, les contacts, et ce qui reste à faire.

## 1. Contexte

- **Bible Strong** est une application d'étude biblique gratuite (iOS, Android, Web), d'abord francophone, avec des utilisateurs anglophones. Développeur basé en France.
- **Objectif** : proposer le plus de Bibles audio possible dans l'application (français et anglais, lues ou dramatisées), puis plus tard en distribuer sur Audible.
- **Situation actuelle** : l'application diffuse déjà de l'audio par lien direct, sans accord écrit, depuis quatre sources :
  - TopChrétien (Louis Segond 1910) ;
  - bible.audio (Semeur, NIV) ;
  - biblestudytools / swncdn (ESV, NLT) ;
  - wordpocket.org (KJV).
  Aucune de ces sources ne donne de droit à Bible Strong ; il faut les régulariser ou les remplacer.

### À compléter par le porteur du projet avant tout envoi

Les éditeurs demandent tous ces informations ; elles ne figurent pas dans ce document.

- Entité juridique qui porte la demande (forme, pays, numéro d'immatriculation) : `[À COMPLÉTER]`. Biblica n'accorde de licence complète qu'à une personne morale enregistrée.
- Modèle économique exact (publicité, abonnement, achats intégrés, dons) : `[À COMPLÉTER]`. Ce point décide de l'accès aux API gratuites, toutes réservées au non-commercial.
- Nombre d'utilisateurs actifs mensuels et répartition par pays : `[À COMPLÉTER]`
- Liens des stores et du site : `[À COMPLÉTER]`
- Nom et e-mail de l'interlocuteur : `[À COMPLÉTER]`

## 2. Fiabilité des informations

- **« Relu »** : lu directement sur la page de l'organisme le 24 novembre 2026.
- **« Non relu »** : tiré d'extraits de recherche web ou de sources tierces ; à vérifier sur la page avant envoi.
- Aucun contact n'a été inventé. « Non trouvé » signifie qu'aucune adresse n'est apparue.
- Ce document est une information, pas un avis juridique.

## 3. Catégorie A — utilisable maintenant, sans rien demander

Anglais seulement. En français, aucun enregistrement n'est libre : le texte Segond 1910 est dans le domaine public, mais chaque enregistrement appartient à son producteur.

| Audio | Statut | Fiabilité | Source |
|---|---|---|---|
| World English Bible, lue par Michael Paul Johnson | Enregistrement dans le domaine public | Relu | https://ebible.org/webaudio/ |
| KJV, BSB, Douay-Rheims, lectures bénévoles LibriVox | Domaine public ; qualité inégale | Non relu | https://archive.org/details/bible_kjv_complete_2001_librivox |
| Berean Standard Bible, trois narrations (Bob Souer, Barry Hays, Jordan Gilbert) | Texte dans le domaine public depuis le 30 avril 2023 (relu). Audio annoncé en CC0, **à confirmer** | Texte relu, audio non relu | https://berean.bible/licensing.htm, https://openbible.com/audio/ |

Ces fichiers peuvent être téléchargés, auto-hébergés, proposés hors-ligne et vendus.

## 4. Catégorie B — avec une clé API

| API | Contenu | Conditions | Fiabilité | Accès |
|---|---|---|---|---|
| Bible Brain (Faith Comes By Hearing, derrière Bible.is) | Plus gros catalogue multi-langues. KJV attestée. En français, vus sur des listes tierces : Segond 1910 (Trésorsonore), Semeur, Parole de Vie (NT dramatisé), Darby, Ostervald. Liste exacte à inventorier avec une clé | Licence sans redevance, révocable. Audio entièrement gratuit pour l'utilisateur final. Aucun usage commercial (vente, publicité, activité lucrative). Streaming seulement ; hors-ligne uniquement pour les contenus exposés par l'endpoint `/download`. Respect de la déclaration de foi de FCBH. Mentions de copyright visibles. Le contenu ne sort pas de l'application | Relu | Formulaire : https://4.dbt.io/api_key/request — support@digitalbibleplatform.com |
| API ESV (Crossway) | Audio ESV, un MP3 par passage (`/v3/passage/audio/`) | Usage non commercial, réservé aux particuliers et organisations non commerciales adhérant à sa déclaration de foi. 5 000 requêtes par jour, 1 000 par heure, 60 par minute. 500 versets par requête. Pas plus de 500 versets stockés | Relu | https://api.esv.org/ |
| API.Bible (American Bible Society) | Possiblement NLT, CSB, NASB, GNT | Offre gratuite non commerciale ; l'audio relèverait d'une licence spéciale à demander au support. Offre commerciale payante selon le nombre d'utilisateurs actifs | Non relu | https://api.bible — support@api.bible (non relu) |

YouVersion Platform n'expose pas d'audio dans sa documentation (non relu).

## 5. Catégorie C — demande par e-mail ou formulaire

### Français (priorité)

| Audio | Titulaire | Contact | Fiabilité du contact | Ce qu'on sait |
|---|---|---|---|---|
| Louis Segond 1910, lue par Alain Moreau et Jean-Micaël Saltzmann | Trésorsonore (Trésorsmédia, ex-Radio Évangile) | contact@tresorsonore.com ; contact@tresorsmedia.com ; tél. +33 4 75 02 10 10 | Non relu | Un développeur tiers rapporte une réutilisation gratuite contre mention « Voix : tresorsonore.com », lien et logo. Demander séparément l'app, le hors-ligne et un usage commercial (Audible) |
| Louis Segond 1910 de TopBible (source actuelle) | TopChrétien ; origine du master inconnue | contact@topchretien.com ; 8 rue de Soleure, 67000 Strasbourg | Non relu | Aucune offre de licence publiée. Demander l'origine de l'enregistrement et une autorisation écrite |
| Segond 21 (lue par Jean-Micaël Saltzmann, 2011) et NEG 1979 | Société Biblique de Genève, texte et enregistrement | info@societebiblique.com ; Ch. de Praz-Roussy 4 bis, CP 50, CH-1032 Romanel-sur-Lausanne ; tél. +41 21 867 10 10 | Relu | Des sites tiers diffusent texte et audio avec son accord. La SBG vend déjà la Segond 21 sur Audible |
| Bible du Semeur (℗ 2016 Biblica) | Biblica | Formulaire : https://www.biblica.com/permission-request-form/ ; page : https://www.biblica.com/permissions/ | Non relu (site protégé contre les robots) | Streaming seulement, pas de hors-ligne. Personne morale exigée. Produit publié plutôt que projet. Examen jusqu'à 15 jours ouvrés, contrat 4 à 6 semaines. Précédent : bible.audio, accord du 15 juillet 2020 après deux mois |
| Nouvelle Français courant, Parole de Vie, Bible en français courant, TOB, Colombe, NBS | Alliance biblique française / Éditions Bibli'O | Formulaire : https://editionsbiblio.fr/pages/obtenir-des-droits ; contact@alliancebiblique.fr ; 6 rue Lhomond, 75005 Paris ; tél. 09 72 56 15 30 | Relu | Autorisation écrite nécessaire dès qu'on dépasse la courte citation. L'audio NFC est coproduit avec la Mission Évangélique Braille (Suisse) : accord conjoint probable |
| Nouveau Testament Segond dramatisé « Bible Vivante » (℗ 2022) | Association Apogée | info@biblevivante.com ; tél. +33 6 21 82 25 96 | Non relu | Aucune condition publiée. Faire préciser le texte utilisé (1910 ou Segond 21) |
| Darby lue intégralement | Bibles et Publications Chrétiennes | Non trouvé ; boutique : https://boutique.editeurbpc.com | — | Aucune condition publiée |
| Traduction liturgique (Bible audio Mame, octobre 2026) | AELF pour le texte, Mame pour l'enregistrement | contact@aelf.org ; Mame : non trouvé | AELF relu | Toute réutilisation, même non commerciale, passe par le service juridique de l'AELF. Titre commercial récent : accord peu probable |

### Anglais

| Audio | Titulaire | Contact | Fiabilité du contact | Ce qu'on sait |
|---|---|---|---|---|
| NIV | Biblica pour les apps et l'audio | Même formulaire Biblica que ci-dessus | Non relu | Mêmes conditions. Précédent : Blue Letter Bible, mars 2025 |
| ESV au-delà de l'API | Crossway, texte et enregistrements | Formulaire audio : https://www.crossway.org/permissions/audio/ ; licensing@crossway.org | Relu | Le formulaire demande identité, type de demandeur, description du produit, part d'ESV, plan de diffusion |
| NLT | Tyndale House Publishers | permission@tyndale.com ; https://www.tyndale.com/permissions | Non relu (site protégé) | Redevance possible pour un produit monétisé |
| NKJV, KJV dramatisée, NIV dramatisée | HarperCollins Christian Publishing (Thomas Nelson, Zondervan) | HCCPpermissions@harpercollins.com ; https://www.harpercollinschristian.com/permissions/ | Relu | Délai moyen de six à huit semaines. **The Word of Promise : refus de principe**, y compris pour le streaming |
| NIV David Suchet | Hodder & Stoughton | permissions@hodder.co.uk | Relu | Négociation distincte de celle de Biblica |
| NASB, Amplified | The Lockman Foundation | https://www.lockman.org/permission-to-quote-copyright-trademark-information/ | Relu | Jusqu'à 1 000 versets sans autorisation ; au-delà, demande écrite |
| CSB | Holman Bible Publishers | https://csbible.com/permissions/ | Non relu | Jusqu'à 1 000 versets ; le formulaire prévoit le motif « audio » |
| KJV Stephen Johnston | Firefighters for Christ | Non trouvé ; hébergeur AudioTreasure : Dave@audiotreasure.com | Non relu | Usage personnel et de ministère non commercial |
| KJV Alexander Scourby | Litchfield Associates | Non trouvé ; https://www.scourby.com/ | — | Ne licencie pas le numérique ; a poursuivi un tiers en 2014 pour usage en application |
| KJV au Royaume-Uni (texte) | Cambridge University Press | permissions@cambridge.org | Non relu | Courriel de précaution à prévoir avant un titre Audible UK |

## 6. Audible

- Aucune API ni licence d'application n'autorise la revente d'un enregistrement.
- ACX (la porte d'entrée d'Audible) n'est ouvert qu'aux résidents des États-Unis, du Canada, du Royaume-Uni et de l'Irlande ; il refuse le domaine public seul et la narration par IA (non relu).
- Les éditeurs vendent déjà leurs propres audios sur Audible (Segond 21, Semeur, traduction liturgique, NIV, ESV, NLT, NKJV).
- Voies réalistes : un enregistrement humain propre de la Louis Segond 1910, ou un accord commercial exprès avec Trésorsonore, distribué par un agrégateur. La livraison à Audible par Voices by INaudio (ex-Findaway) n'est pas confirmée.
- Ordre de grandeur : l'Alliance biblique française annonce plus de 60 000 € pour la réalisation de sa Bible audio NFC (relu).

## 7. Ce qui reste à faire

1. Compléter les informations de la section 1.
2. Vérifier sur les pages les contacts marqués « non relu », en priorité Trésorsonore, Biblica, Tyndale et Bible Vivante.
3. Confirmer la licence des enregistrements BSB sur openbible.com/audio.
4. Demander la clé Bible Brain et inventorier les versions françaises et anglaises disponibles, avec leur drapeau de téléchargement.
5. Rédiger une demande par organisme de la catégorie C, en français pour les francophones et en anglais pour les autres.

### Contenu attendu d'une demande de droits

- Présentation de l'entité et de l'interlocuteur.
- Présentation de l'application : plateformes, langues, audience, modèle économique.
- L'enregistrement visé, désigné précisément (traduction, narrateur, année).
- L'usage demandé : streaming dans l'application, écoute hors-ligne ou non, territoire mondial, durée.
- Les garanties proposées : mention de copyright et lien vers l'éditeur, pas d'extraction des fichiers, statistiques d'écoute sur demande.
- Une question ouverte sur les conditions financières, aucun éditeur ne publiant de barème.
- Pour Audible, une demande séparée : c'est un usage commercial distinct.
