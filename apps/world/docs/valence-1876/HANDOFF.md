# Handoff : Valence 1876

Rédigé le 14 octobre 2026, session distante. Branche `docs/valence-1876-decor`, poussée sur origin, pas de pull request ouverte. Tout ce qui suit est dans ce dossier ; rien d’autre n’a été modifié dans le dépôt.

## 0. État au soir du 14 octobre 2026

L’univers est construit et jouable à l’adresse `/valence-1876` de World : carte HD, huit stations avec leurs habitants animés, dialogues en trois temps en français et en anglais avec leurs sources, fil pointillé, frise, sept objets du pionnier, image de partage, épilogue vers le livre d’or, mode stand, particules. Fonctionnement, production des images et limites : [README.md](./README.md). Dialogues : [dialogues.md](./dialogues.md).

Les décisions de la section 6 sont prises : la famille s’appelle Faure, le format en trois temps est retenu. Les étapes 1 à 4 de la section 7 sont faites. Restent la relecture UFA (étape 5) et, pour samedi, la mise en production et la réponse à Philippe Penner (étape 6).

## 1. D’où on vient

**L’événement.** Samedi 17 octobre 2026, Palais des congrès de Valence, l’UFA fête les 150 ans de l’adventisme en France (première église fondée à Valence en 1876). Célébration à 10h, table ronde l’après-midi, concert Gospel Philharmonic Experience à 20h, repas tiré du sac, inscription obligatoire. Stéphane y tient un stand Bible Strong, comme à ASI Europe en septembre (où World en mode stand et des vidéos anglaises avaient servi d’aimant).

**Logistique du stand**, d’après le mail de Philippe Penner (FFJA Sud) du 12 octobre : palais ouvert à 6h, installation des stands conseillée à 7h, public à 9h, démontage possible à 20h, fermeture 22h. Il manque des tables : en apporter une et de quoi l’habiller. Sièges attachés par blocs de quatre. Électricité disponible mais faible puissance. Il attend une réponse sur la table.

**Ce qui a été conseillé pour samedi, en trois jours** : garder World en mode stand en français, rebaptisé « livre d’or des 150 ans » ; une démo tablette « 1876 → 2026 » (un verset en Ostervald, puis en Segond 1910 avec Strong et le commentaire Ellen White en français, tout est déjà dans l’app) ; une frise 1876 → 2026 en boucle sur un écran à la place des vidéos anglaises ; un quiz seulement s’il reste une journée. Pas de pixel art. Aucun de ces éléments n’a été construit : la conversation a bifurqué vers le projet de fond.

**Le concept de fond, sans contrainte de date** : « 1876 → 2026. La Bible qu’ils lisaient, la Bible que vous étudiez. » Cinq pièces classées par valeur durable : un Parcours 150 ans dans l’app (plan de lecture en quinze étapes, à écrire avec un historien de l’UFA), le mur des 150 ans (livre d’or de World en vue grand écran, à proposer à l’UFA pour la grande salle), un univers Valence 1876, une page frise sur le site public, et un stand physique avec une vraie Bible Ostervald du XIXe posée à côté de la tablette. Stéphane a choisi de développer d’abord **Valence 1876**.

## 2. Ce qu’est Valence 1876

Un univers à part entière, séparé de Bible Strong World mais sur le même moteur (document de navigation, occluders, avatars ambiants, dialogues par étapes, mode stand, livre d’or, liens profonds). Une seule carte de Valence en sépia. Des personnages de l’époque qui racontent comment ils étudiaient la Bible en 1876-1877, et ce que le visiteur a aujourd’hui dans la poche. Jamais de reproche : le contraste fait le travail, la seule phrase tournée vers le visiteur est une question.

**Le décor complet est dans [decor.md](./decor.md).** Les quatre dossiers de recherche sourcés sont dans [recherche/](./recherche/README.md).

## 3. Les décisions prises

1. **Une seule carte, onze mois.** La ville ne change pas entre octobre 1876 et septembre 1877, les événements si. Chaque station est un moment daté ; un fil pointillé au sol relie les stations dans l’ordre des dates ; une frise dans l’interface s’allume station après station. Une seule lumière de fin d’après-midi ; les saisons se disent par des accessoires propres à chaque station.
2. **Le sépia comme argument.** Tout 1877 est en sépia, une seule famille de bruns, papier crème, encre brun-nuit. Deux exceptions : l’avatar du visiteur garde ses couleurs (il vient de 2026), et les panneaux « aujourd’hui » s’ouvrent en pleine couleur sur le canvas de Bible Strong avec une vraie capture de l’app. Choix de palette propre à ce brief, à enregistrer dans `docs/design/illustrations.md`.
3. **Intégrité historique.** Les vraies personnes (Daniel et Marion Bourdeau) ne disent que ce que les sources permettent ; leurs répliques portent l’étiquette « Dialogue reconstitué d’après les sources » et un bouton Sources. Les personnages inventés sont annoncés « Personnage composite ». Andrews, Charles et Mary Andrews, Dietschy n’apparaissent que par lettre et colis. Exclus : Ellen White (1886), Jean Vuilleumier (douze ans en 1876), Erzberger, Augustin Bourdeau (1884), Badaut, et Gabert (daté 1878 par les sources, une ligne dans l’épilogue).
4. **Huit stations en trois temps** : le fait (sourcé), comment j’étudie (les outils de 1877), aujourd’hui (un geste précis dans Bible Strong, ouvert par un lien profond).
5. **Sept objets du pionnier** à trouver sur la carte, chacun avec une carte « hier, aujourd’hui » ; les sept donnent une carte de partage « J’ai visité Valence 1876 ».
6. **Pas de multijoueur, pas de quiz de dates, pas de pixel art** au lancement.

## 4. L’histoire en onze mois

| Moment | Événement | Station |
| --- | --- | --- |
| Juillet 1876, Bâle | Andrews et Bourdeau lancent *Les Signes des Temps* : 8 pages de 30 × 41 cm, 2 000 exemplaires, 400 abonnés en décembre | — |
| Octobre 1876 | Daniel Bourdeau s’installe à Valence avec Marion et un enfant d’un an, invité par des familles protestantes à parler au temple | La gare, le temple Saint-Ruf |
| Hiver 1876-1877 | Le groupe étudie dans les maisons : Bible Ostervald, concordance de 1856, dictionnaire de Bost de 1849, lampe ou bougie | La maison de la famille |
| 22 février 1877 | Bourdeau écrit de Valence sur Pie VI, mort prisonnier dans la citadelle le 29 août 1799, dont le cœur repose dans la cathédrale, et sur les 1260 ans | La cathédrale, la citadelle |
| Mars 1877 | Bourdeau et Andrews à Paris pour demander au gouvernement de travailler avec moins de contraintes | Le Champ de Mars |
| Été 1877 | « A book stand in lively operation » : une vingtaine de volumes reliés, des centaines de tracts (Review and Herald, 4 octobre 1877) | La place des Clercs |
| Septembre 1877 | Dix-sept personnes baptisées, première église adventiste de France ; Bourdeau repart en Suisse | Le Rhône |

Ce que Bible Strong contient déjà des outils de l’époque : Ostervald, Martin 1744, Lausanne 1872, Darby, le Dictionnaire de Bost, le Calmet. Et ce qui n’existait pas : numéros Strong (1890), Bible annotée (1879), Segond complète (1880), commentaire adventiste et Ellen White en français.

## 5. Les personnages

Présents : Daniel Bourdeau (41 ans en 1877), Marion Saxby Bourdeau (35) avec le petit Augustin, la famille composite de Valence (nom provisoire Faure : Louis, Jeanne, Élise 16 ans, le grand-père Jacques 84 ans qui avait six ans à la mort de Pie VI), le pasteur du temple, le colporteur biblique, l’employé du PLM. Figurants : soldats du 10e régiment d’artillerie, lavandières, bateliers, marchandes, crieur du *Journal de Valence*, chanoine, enfants.

## 6. Ce qui n’est pas tranché

À décider par Stéphane :

- Le nom de la famille composite (Faure en attendant).
- Le format en trois temps par station, confirmé par défaut.

À vérifier avec un relecteur de l’UFA, sans que cela bloque la carte ni les dialogues (le décor évite chaque point) :

- Date et lieu des dix-sept baptêmes (une seule page donne septembre 1877 ; lieu non documenté, on ne montre pas un baptême dans le Rhône comme un fait).
- Noms des dix-sept : le fonds Paul Badaut contient un mémoire « Premier effort à Valence en 1876 ».
- Mots exacts de l’invitation au temple (thèse de Jean-Michel Martin, 1980).
- Dates de Gabert, pasteurs de Valence en 1877, aspect du kiosque de 1862 et de la citadelle, estampille préfet ou archevêque, âge de Patience Bourdeau.

## 7. Prochaines étapes, dans l’ordre

1. **Les dialogues.** Huit stations, trois temps, français d’abord puis anglais. Les personnages de 1877 vouvoient le visiteur, l’interface garde le tutoiement de World. Chaque dialogue avec son étiquette et ses sources. Fichier suggéré : `dialogues.md` dans ce dossier, puis les copies dans `apps/world/src` au format des `*-discovery-copy.ts`.
2. **Le brief d’illustration de la carte**, zone par zone, d’après le tableau « Ce qu’on voit » de `decor.md`, dans le style de `docs/design/illustrations.md` adapté au sépia, avec les gravures et cartes postales de référence listées dans `recherche/valence-ville-1876.md`. Même perspective et même lisibilité que `apps/world/public/assets/map/preview.webp`.
3. **Les sept objets et la carte de partage** : visuels et textes.
4. **L’intégration moteur** : un commutateur d’univers par route, un nouveau document de navigation, les occluders, le fil au sol, la frise dans l’interface, une interface de dialogue de personnage proche de `DiscoveryDialog`, les liens profonds vers l’app et le site, l’avatar du visiteur en couleur sur fond sépia, le mode stand.
5. **Relecture UFA** avant toute diffusion. Philippe Penner est la porte d’entrée naturelle.
6. **Pour samedi**, indépendamment de tout ça : World en mode stand en français, la démo tablette 1876 → 2026, et répondre à Philippe Penner pour la table.

Estimation donnée : six à huit semaines en parallèle (recherche faite, dialogues une semaine, carte et personnages deux semaines, développement deux semaines).

## 8. Sources primaires à ouvrir en local

L’environnement distant ne pouvait pas ouvrir les pages web ; toutes les citations viennent d’extraits de moteur de recherche. En local, ouvrir au moins :

- Review and Herald du 5 avril 1877 (lettre de Bourdeau datée de Valence, 22 février 1877) : https://documents.adventistarchives.org/Periodicals/RH/RH18770405-V49-14.pdf
- Review and Herald du 4 octobre 1877 (rapport « D. T. Bourdeau, France », l’étal de livres) : https://documents.adventistarchives.org/Periodicals/RH/RH18771004-V50-14.pdf
- *Les Signes des Temps* 1876-1877, scans : http://www.etoiledumatin.org/index.php/ressources/signes-des-temps
- Encyclopédie adventiste, « Bourdeau, Daniel Toussaint » : https://encyclopedia.adventist.org/article?id=C90G ; « Andrews, John Nevins » : https://encyclopedia.adventist.org/article?id=C8VX
- Archives adventistes, « Histoire de l’adventisme en France » : https://www.archivesadventistes.org/blog/2006/09/histoire-de-lad.html
- Page de l’événement : https://adventisteffs.org/150-ans-adventisme-france/
- Pour la ville : cartepatrimoine.ladrome.fr (gare, pont, temple), patrimoine.auvergnerhonealpes.fr/dossier/IA26000336 (pont suspendu), archives.ladrome.fr (cartes postales, fonds Marius Villard).

## 9. Pour reprendre avec Claude en local

Coller ceci en ouvrant la session :

> Lis `apps/world/docs/valence-1876/HANDOFF.md`, puis `decor.md` et les quatre dossiers de `recherche/`. On est sur la branche `docs/valence-1876-decor`. Le décor est validé avec ces réponses : famille = [nom], format en trois temps = oui. Écris maintenant les dialogues des huit stations dans `apps/world/docs/valence-1876/dialogues.md`, en français d’abord, selon les règles d’intégrité du décor : chaque phrase factuelle traçable à un dossier, étiquettes « reconstitué d’après les sources » ou « personnage composite », aucun reproche au visiteur, une seule question finale.
