# Valence 1876 : le décor

Proposition du 14 octobre 2026, à valider avant d’écrire les dialogues. Chaque élément renvoie aux [dossiers de recherche](./recherche/README.md). Ce qui n’est pas sourcé est marqué comme choix de mise en scène.

## 1. Le temps : onze mois sur une seule carte

**Nom du projet : Valence 1876.** C’est l’année de l’arrivée de Daniel Bourdeau, celle que l’UFA célèbre, celle que tout le monde connaît.

**Une seule carte, plusieurs moments.** La ville ne change pas entre octobre 1876 et septembre 1877 ; les événements, si. La carte est donc un seul lieu, dessiné une fois, et chaque station est un moment daté. En se déplaçant dans Valence, le visiteur traverse les onze mois de l’histoire :

| Station | Moment | Ce qui s’y joue |
| --- | --- | --- |
| La gare | Octobre 1876 | L’arrivée de la famille Bourdeau, les premiers numéros des *Signes des Temps* |
| Le temple Saint-Ruf | Automne 1876 | L’invitation des familles protestantes, la chaire prêtée une fois |
| La maison de la famille | Hiver 1876-1877 | Les veillées d’étude dans les maisons |
| La cathédrale | Février 1877 | La lettre de Bourdeau sur Pie VI et les 1260 ans |
| La citadelle | 29 août 1799 | Le lieu de la mort du pape, hors du temps de la visite : une station mémoire |
| Le Champ de Mars | Mars à octobre 1877 | Le retour de Paris, la crise politique, les élections |
| La place des Clercs | Été 1877 | L’étal de livres « in lively operation » |
| Le Rhône | Septembre 1877 | Les dix-sept baptêmes, l’épilogue |

**Comment le temps se lit.** Chaque station ouvre sur un carton daté. Un fil au sol, pointillé comme les ponts de World, relie les stations dans l’ordre des dates : on peut le suivre ou se promener librement. Une frise discrète dans l’interface, d’octobre 1876 à septembre 1877, s’allume station après station. Rien n’oblige à l’ordre ; les cartons suffisent à se repérer.

**Le carton d’ouverture** : « Il y a cent cinquante ans, en octobre 1876, Daniel Bourdeau s’installait à Valence. Traversez la ville : chaque lieu est un moment des onze mois qui ont suivi. »

**Lumière et saisons.** Une seule lumière pour toute la carte, fin d’après-midi, basse et chaude, venant de l’ouest par-dessus le Rhône. Les saisons se disent par de petits accessoires propres à chaque station, jamais par la lumière : feuilles tombées et malles sur le quai de la gare en octobre, volets clos et lampe allumée à la maison en hiver, étals de fruits sur la place en été, linge qui claque au mistral sur les quais en septembre. Le mistral souffle « un jour sur trois » ; c’est le détail qui fait sentir la vallée.

## 2. La palette : le sépia comme argument

Le monde de 1877 est en sépia : une seule famille de bruns chauds, du papier crème pour les murs clairs et les pages, une encre brun-nuit pour les traits. Pas de seconde couleur. Les personnages sont monochromes comme dans les univers illustrés de Bible Strong, mais dans la gamme sépia.

Deux exceptions, et elles portent le message.

- **L’avatar du visiteur garde ses couleurs.** Il vient de 2026. Il est la seule chose colorée dans Valence. Rien à expliquer.
- **Les panneaux « aujourd’hui » s’ouvrent en pleine couleur**, sur le canvas bleu de Bible Strong, avec une vraie capture de l’app. Le passage du sépia à la couleur est le message.

Ce choix de palette est propre à ce brief. Il n’existe pas dans la table des univers de `docs/design/illustrations.md` et doit y être enregistré comme tel.

Le style reste celui de la carte de World : illustration plate, vue légèrement plongeante, grandes masses rondes, lignes fines pour les détails. La carte doit se lire aussi bien que l’archipel actuel à la taille d’un téléphone.

## 3. Les règles d’intégrité

1. **Chaque lieu existe en septembre 1877**, dans l’état décrit au dossier de la ville. La liste des anachronismes à ne pas dessiner est au point 8.
2. **Les vraies personnes ne disent que ce que les sources permettent.** Daniel et Marion Bourdeau sont présents. Leurs répliques sont écrites par nous, mais chaque phrase factuelle est traçable à une source du dossier, et aucune opinion ni aucune théologie ne leur est prêtée au-delà de ce qu’ils ont publié. L’interface le dit : « Dialogue reconstitué d’après les sources », avec un bouton Sources sur chaque dialogue.
3. **Les personnages inventés sont annoncés comme tels** : « Personnage composite ». Ils portent tout ce qui relève de la vie quotidienne et de l’émotion.
4. **Andrews, Charles et Mary Andrews, Dietschy n’apparaissent que par lettre et par colis.** Rien ne les place à Valence.
5. **Ne sont pas dans la scène** : Ellen White (1886), Jean Vuilleumier (douze ans, à Tramelan), Erzberger, Augustin Bourdeau (en Europe en 1884), Badaut (converti plus tard), et Gabert, l’évangélisateur bénévole de Valence, parce que les sources le datent de 1878. Gabert a droit à une ligne dans l’épilogue.

## 4. La carte

Une seule carte, même moteur que World : document de navigation, occluders, avatars ambiants, dialogues par étapes. Le Rhône à l’ouest, la gare à l’est, la vieille ville sur son plateau entre les deux.

```
                                  NORD
   ┌──────────────────────────────────────────────────────────────────┐
   │ Crussol au fond, rive ardéchoise       Saint-Jean   Place de la   │
   │ ~~~~ Rhône ~~~~   Citadelle       Préfecture        Pierre        │
   │ pont suspendu ─── (vestiges)      (hôtel Saint-Ruf) (halle)       │ Boulevards
   │ ~~~~~~~~~~~~~~    Temple Saint-Ruf      ┆                          │ en chantier,
   │ bas-port, pontons,                  Grande Rue                     │ restes de
   │ vapeur, lavandières  côte Sylvante      ┆   Place des Clercs       │ remparts,
   │ ~~~~~~~~~~~~~~       et poterne         ┆   marché, étal de livres │ caserne Brunet
   │ ~~~~~~~~~~~~~~                          ┆   Maison des Têtes       │
   │ Champ de Mars : kiosque 1862,           ┆                          │   GARE PLM
   │ statue Championnet      Cathédrale      Pendentif                  │   façade
   │                         clocher blanc,                             │   Bouchot 1866
   │                         chantier         maison de la famille      │
   └──────────────────────────────────────────────────────────────────┘
                                  SUD
```

La géographie est simplifiée mais respecte la ville réelle : le Champ de Mars et la cathédrale au sud-ouest sur la terrasse au-dessus du fleuve, la citadelle et le temple au nord-ouest, la place des Clercs au centre, la gare à l’est hors des anciens remparts.

### Ce qu’on voit, zone par zone

| Zone | Ce qui est dessiné | État en 1877 | Dossier |
| --- | --- | --- | --- |
| Le Rhône et le pont suspendu | Pont de 1830 à pile unique en rivière, pylône-portique en calcaire de Crussol d’environ 20 m, câbles, deux travées, 235 m. Saint-Péray et le château de Crussol sur l’autre rive. | Oui. Le pont de pierre de 1905 n’existe pas. | ville, § pont suspendu |
| Le bas-port | Quais à deux niveaux depuis les travaux de 1859, pontons de bois des compagnies de vapeurs, un vapeur de la ligne Lyon–Valence, la rampe publique de 1876, des lavandières. | Oui. | ville, § quais |
| La côte Sylvante | Escaliers du quartier de La Rivière vers la ville haute, poterne à herse sous l’ancien palais abbatial de Saint-Ruf. | Oui. | ville, § côtes |
| Le Champ de Mars | Esplanade en balcon sur le Rhône, kiosque à musique simple de 1862 à piliers de fonte, statue de bronze du général Championnet au nord (1845), promeneurs, soldats. | Oui. Pas le kiosque Peynet de 1890. Platanes non confirmés : des arbres sans espèce marquée. | ville, § Champ de Mars, kiosque |
| La cathédrale Saint-Apollinaire | Nef en molasse ocre-grise, clocher neuf roman plus haut en pierre blanche de Crussol (1856, tympan de 1869), échafaudages du chantier intérieur (1858–1881). Le Pendentif de 1548 sans toit à côté. Dans le chœur, le monument de Pie VI : cénotaphe de marbre, buste attribué à Canova. | Oui. | ville, § cathédrale, Pendentif |
| La citadelle | Vestiges à l’angle nord-ouest, quartier de la Préfecture, une tour. Lieu de la mort de Pie VI le 29 août 1799. | Oui, mais l’aspect de 1877 est incertain. Dessiner une tour et un pan de mur, sans détail affirmatif. | ville, § Pie VI et la citadelle |
| Le temple Saint-Ruf | Façade classique à fronton triangulaire nu, portail en plein cintre entre pilastres, deux fenêtres en plein cintre encadrant un oculus, pas de clocher (démoli en 1805), un pan de mur nord. Intérieur : nef unique baroque, stuc. | Oui. Pas d’orgue (1896). | ville, § temple |
| La Grande Rue et la place des Clercs | Rue commerçante, Maison des Têtes (1528–1532, têtes sculptées), marché sur la place, boutiques. L’étal de livres de Bourdeau sur la place. | Oui. Jours de marché de 1877 non établis. | ville, § Grande Rue, place des Clercs |
| La place de la Pierre et Saint-Jean | Halle du XIXe (forme incertaine, rester sobre), clocher-porche roman de Saint-Jean. | Oui. Pas la halle métallique de 1899. | ville |
| Les boulevards | Boulevards neufs sur le tracé des remparts, immeubles en construction, tronçons de muraille et fossés encore visibles, la caserne Brunet avec son artillerie. | Oui, chantier jusqu’en 1880. | ville, § boulevards, casernes |
| La gare PLM | Façade Bouchot de 1866 en pierre de taille, cinq baies encadrées de pilastres doriques, balustrade, deux ailes en retrait, marquise métallique, une locomotive. | Oui. Pas la grande halle, postérieure à 1901. | ville, § gare |
| La maison de la famille | Maison modeste de la vieille ville, une pièce avec table, lampe, livres. | Choix de mise en scène : le logement des familles n’est pas documenté. | — |
| La maison des Bourdeau | Non dessinée comme lieu distinct : son emplacement n’est pas documenté. Les Bourdeau sont rencontrés en ville. | — | — |

## 5. Les personnages

### Présents sur la carte

**Daniel T. Bourdeau, 41 ans.** Réel. Pasteur canadien-français, arrivé en Suisse en janvier 1876, à Valence depuis octobre 1876 avec sa famille. Corédacteur des *Signes des Temps* avec Andrews. Il tient l’étal de livres de la place des Clercs. Il a écrit de Valence sur la mort de Pie VI. Il est allé à Paris en mars 1877. Ses répliques sont reconstituées d’après les sources, rien de plus.

**Marion Saxby Bourdeau, 35 ans.** Réelle. Mariée en 1861, sa sœur Charlotte a épousé Augustin, le frère de Daniel. Arrivée en Europe avec son mari en janvier 1876 : La Coudre, Le Locle, Bâle, puis Valence. On la rencontre au Champ de Mars, en 1877, avec un enfant en bas âge, Augustin, né en 1875. La fille, Patience, n’est pas nommée sur la carte : son âge n’est pas établi. Répliques reconstituées d’après les sources, qui ne disent presque rien d’elle : elle parlera peu, et de faits.

**La famille de Valence.** Composite, à annoncer comme tel. Une famille protestante de la ville, de celles qui ont invité Bourdeau à parler au temple à l’automne 1876. Nom provisoire : Faure, nom fréquent en Drôme, à changer si l’UFA connaît les vrais noms des dix-sept. Quatre personnes :

- Le père, Louis, 45 ans, ouvrier en soie : la filature valentinoise est en crise depuis les années 1860, ça se sent dans la maison.
- La mère, Jeanne, 42 ans. C’est elle qui tient les comptes et le cahier des versets.
- La fille, Élise, 16 ans. Elle lit mieux que ses parents, elle lit à voix haute le soir. Elle sera parmi les dix-sept.
- Le grand-père, Jacques, 84 ans. Né en 1793, il avait six ans quand Pie VI est mort dans la citadelle. Il a vu passer le cortège. C’est le lien vivant entre la ville et la prophétie que Bourdeau prêche.

**Le pasteur du temple.** Composite, sans nom. Valence avait deux pasteurs modérés, l’un évangélique, l’autre libéral, et un consistoire hostile au Réveil. Il a prêté la chaire une fois, à la demande des familles. Depuis, le groupe se réunit dans les maisons. Il n’est pas un adversaire : il est tiède, et honnête sur ce qu’il lit.

**Le colporteur biblique.** Composite. Un colporteur de la Société biblique britannique, sac en bandoulière, Nouveaux Testaments Ostervald de l’édition de Londres de 1870. Il connaît la loi sur le colportage et le prix d’une Bible. Il est l’autre face de l’étal de Bourdeau.

**L’employé du PLM.** Composite. Il remet le colis de Bâle. Il connaît les horaires, Lyon à deux heures et demie par le vapeur en descente, dix heures en remontée.

### Présents par lettre et par colis seulement

**John N. Andrews, 48 ans**, à Bâle depuis avril 1876, rédacteur des *Signes des Temps*. Gravement malade en 1877, « close call with death caused by impoverished living conditions ». **Charles, 20 ans**, apprend l’imprimerie, le français et l’allemand. **Mary, quinze ou seize ans**, assistante de rédaction et correctrice. **Jules-Étienne Dietschy**, gérant du journal. Ils existent dans la scène sous la forme d’une lettre et d’un paquet de journaux. La lettre est reconstituée : elle ne contient que des faits sourcés, et le dit.

### Figurants (avatars ambiants)

Soldats du 10e régiment d’artillerie, caserne Brunet : la ville compte environ 3 000 militaires dans les années 1870. Lavandières sur le Rhône. Bateliers et un chauffeur de vapeur. Marchandes de la place des Clercs. Un crieur du *Journal de Valence*, organe républicain, qui passe à six numéros par semaine le 1er septembre 1877. Un chanoine près de la cathédrale. Des enfants. Un chien, des pigeons, une charrette à mule. Les uniformes et les tenues sont à vérifier sur les gravures de l’époque avant génération ; les sources trouvées sont générales au Dauphiné.

## 6. Les huit stations

Chaque station est un lieu, un moment daté, un personnage, et un dialogue en trois temps : **le fait** (sourcé), **comment j’étudie** (les outils de 1877), **aujourd’hui** (un geste précis dans Bible Strong, ouvert par un lien profond). Jamais de reproche. La seule phrase tournée vers le visiteur est une question.

### 1. La gare, octobre 1876 : l’arrivée

Lieu : la gare PLM. Personnage : l’employé du PLM, puis Bourdeau qui vient chercher son paquet.

- Le fait. La famille Bourdeau descend du train de Lyon : Daniel, Marion, un enfant d’un an. Dans les malles, les premiers numéros des *Signes des Temps* : premier numéro en juillet 1876, huit pages de 30 sur 41 cm, deux mille exemplaires. Chaque mois, un paquet suivra de Bâle ; en décembre, le journal comptera quatre cents abonnés, surtout en Suisse et en France. Il est imprimé chez un imprimeur bâlois, l’Église n’a pas d’imprimerie avant 1884.
- Comment j’étudie. Tout vient par la poste. Un article, une réponse, un tract : un mois d’attente. Mary Andrews, quinze ou seize ans, relit les épreuves.
- Aujourd’hui. Ouvrir la bibliothèque en ligne de Bible Strong : commentaires, dictionnaires, Bibles, mis à jour sans attendre le train. Lien : la bibliothèque.

### 2. Le temple Saint-Ruf, automne 1876 : l’invitation

Lieu : le temple, façade à fronton, sans clocher. Personnage : le pasteur.

- Le fait. Des familles de Valence ont invité Bourdeau à parler au temple à l’automne 1876. Le temple est protestant depuis 1806. La Drôme est l’une des régions les plus protestantes de France. Les nouveaux groupes religieux n’ont pas accès aux bâtiments publics : c’est l’obstacle qui mènera Bourdeau à Paris au printemps.
- Comment j’étudie. Le pasteur lit l’Ostervald, « la version généralement usitée pour le culte public ». Il n’a que celle-là au pupitre. Pour comparer, il faudrait la Bible de Lausanne, complète depuis 1872, le Nouveau Testament de Darby de 1859, et le seul Ancien Testament de Segond, paru en 1874. Quatre livres, quatre prix.
- Aujourd’hui. Ouvrir un verset en Ostervald, puis en Lausanne 1872, Martin 1744, Darby et Segond 1910, côte à côte. Les quatre Bibles du pasteur sont dans l’app. Lien : la comparaison de versions.

### 3. La maison de la famille, hiver 1876-1877 : la veillée

Lieu : la pièce de la famille Faure, la table, la lampe. Personnages : Élise, Jeanne, Louis.

- Le fait. Depuis l’automne, le groupe se réunit dans les maisons, le soir, après le travail. Sur la table : la Bible Ostervald de la Société biblique de Paris, la *Concordance des Saintes Écritures* de 1856 fondée sur l’Ostervald, le *Dictionnaire de la Bible* de Bost en deux volumes de 1849, un cahier, un tract de Bâle. La lampe à pétrole coûte cher ; souvent c’est la bougie.
- Comment j’étudie. Élise lit à voix haute. Jeanne cherche chaque mot dans la concordance, page après page. Pour un mot hébreu, il n’existe qu’un dictionnaire hébreu-français, celui de Sander et Trenel de 1859, fait pour les écoles juives. Pour le grec, rien en français : les lexiques sont en latin. Les numéros Strong n’existent pas, ils paraîtront en 1890, en anglais.
- Aujourd’hui. Le geste central de la visite : ouvrir le verset lu par Élise, toucher un mot, voir le mot hébreu ou grec, l’entendre, lire sa définition. Puis ouvrir le Bost de 1849 et le Calmet, qui sont dans l’app. Lien : le lexique, puis les dictionnaires.

### 4. La cathédrale, février 1877 : le cœur du pape

Lieu : le chœur, le monument de Pie VI. Personnages : le grand-père Jacques, puis Bourdeau.

- Le fait. Pie VI, prisonnier du Directoire, est mort dans la citadelle de Valence le 29 août 1799. Son corps est parti pour Rome en 1802, son cœur est resté ici, sous ce buste. Bourdeau écrit ce mois-ci sur ce monument, dans sa lettre du 22 février 1877, et sur les 1260 ans. Pour un adventiste de 1877, Valence est le lieu de la « blessure mortelle » d’Apocalypse 13. Le grand-père, lui, se souvient du cortège : il avait six ans.
- Comment j’étudie. Pour la prophétie, Bourdeau n’a que des livres anglais : *Thoughts on Daniel and the Revelation* d’Uriah Smith, l’*History of the Sabbath* d’Andrews, les tableaux prophétiques. Il traduit lui-même, le soir, pour les tracts.
- Aujourd’hui. Ouvrir Apocalypse 13:3 en Segond 1910, toucher « blessure », voir le mot grec, puis lire les commentaires en français : la Bible annotée, le commentaire biblique adventiste, les écrits d’Ellen White. Lien : le verset avec ses commentaires.

### 5. La citadelle, 29 août 1799 : la tour

Lieu : les vestiges, une tour. Pas de personnage : une station de lieu, courte.

- Le fait. C’est ici que Pie VI est mort. Le corps a d’abord été déposé dans la chapelle de la citadelle. La citadelle occupe l’angle nord-ouest de la ville ; son état en 1877 est incertain, la carte reste sobre.
- Aujourd’hui. Une frise : 1798, 1799, 1876, 1877, 2026. Lien : la frise chronologique de l’app, si elle couvre la période ; sinon pas de lien, seulement la frise de la station.

### 6. Le Champ de Mars, de mars à octobre 1877 : la ville et le temps

Lieu : l’esplanade, le kiosque de 1862, la statue Championnet, Crussol en face. Personnages : Marion Bourdeau avec l’enfant, le crieur du *Journal de Valence*.

- Le fait. Bourdeau et Andrews reviennent de Paris, où ils sont allés en mars 1877 demander au gouvernement de pouvoir travailler avec moins de contraintes. Valence a 23 220 habitants et 3 000 soldats. Le conseil municipal a voté en mai 1876 une nouvelle caserne. Le journal républicain passe à six numéros par semaine le 1er septembre 1877 : la crise politique de l’année se joue, les élections sont en octobre. L’année suivante, Bourdeau écrira que les changements politiques ont rendu la prédication et la distribution de tracts plus faciles.
- Comment j’étudie. Marion dit en trois phrases le chemin de la famille : janvier 1876 La Coudre, Le Locle, Bâle, octobre 1876 Valence. Un enfant né en route. Elle ne dit rien d’autre : les sources ne disent rien d’autre.
- Aujourd’hui. Le verset du jour, et la lecture quotidienne qu’on emporte partout. Lien : la lecture du jour.

### 7. La place des Clercs, été 1877 : l’étal de livres

Lieu : le marché, l’étal de Bourdeau, la Maison des Têtes au fond. Personnages : Bourdeau et le colporteur biblique.

- Le fait. « A book stand in lively operation » : une vingtaine de volumes reliés et des centaines de tracts distribués en 1877. Le colportage d’imprimés est réglementé par la loi de 1849 ; la biographie d’Andrews parle d’une estampille exigée pour vendre des publications, détail à vérifier. Deux colporteurs envoyés vendre *Les Signes* et *Le Vulgarisateur* n’ont pas pu entrer dans les maisons. En 1871–1875, 78 % des hommes et 66 % des femmes savent signer.
- Comment j’étudie. Le colporteur vend le Nouveau Testament Ostervald de Londres, 1870, le livre le moins cher de l’étal. Une Bible complète, c’est une dépense ; les prix de 1877 n’ont pas été retrouvés, on ne les dira pas.
- Aujourd’hui. Télécharger toute une bibliothèque pour lire sans réseau. Lien : la bibliothèque hors ligne.

### 8. Le Rhône, septembre 1877 : dix-sept

Lieu : le bas-port, le pont suspendu, les lavandières. Personnages : Élise, puis personne : l’épilogue est un carton.

- Le fait. Dans quelques jours, dix-sept personnes de Valence seront baptisées. Le mois est donné par une seule source ; le lieu n’est pas documenté, et la station le dit : on ne montrera pas un baptême dans le Rhône comme un fait. Ce sera la première église adventiste de France. Bourdeau repart en Suisse en septembre 1877, il est aux États-Unis avant octobre 1878.
- Épilogue, en cartons datés. 1878 : un Valentinois nommé Gabert vend des abonnements aux *Signes* et va prêcher jusqu’à Crest et Lyon. 1886 : quelques observateurs du sabbat accueillent Ellen White pour deux réunions. 1902 : une dizaine d’églises et environ 130 membres en France. 2026 : cent cinquante ans.
- Aujourd’hui. Pas de ressource à ouvrir ici. La seule question de la visite, posée par Élise : « Vous avez tout ça dans la poche. Qu’allez-vous lire ce soir ? » Puis le livre d’or de World : laisser un mot pour les cent cinquante ans.

## 7. Les sept objets du pionnier

Sept objets cachés sur la carte. Chacun ouvre une carte « hier, aujourd’hui ». Les sept réunis donnent la carte de partage « J’ai visité Valence 1876 ».

| Objet | Où | Hier | Aujourd’hui dans Bible Strong |
| --- | --- | --- | --- |
| La Bible Ostervald | la maison | Édition stéréotype de la Société biblique protestante de Paris, la version du culte réformé | La version Ostervald, dans l’app |
| Un numéro des *Signes des Temps* | la gare | Juillet 1876, Bâle, huit pages, deux mille exemplaires | Le journal existe toujours : c’est la plus ancienne revue de France encore publiée. Pas de ressource à ouvrir |
| La *Concordance des Saintes Écritures* | la maison | Meyrueis, 1856, fondée sur l’Ostervald, in-octavo | La recherche, et le lexique Strong |
| Le *Dictionnaire de la Bible* de Bost | l’étal de livres | Deux volumes, 1849 | Le même Bost, dans l’app |
| Le dictionnaire hébreu-français de Sander et Trenel | le temple | 1859, le seul en français, fait pour les écoles juives | Le lexique hébreu, avec la prononciation |
| La lampe à pétrole | la maison | Le pétrole est cher ; la bougie reste la règle | Le thème sombre, pour lire la nuit |
| La lettre de Bâle | la place des Clercs, été 1877 | Reconstituée d’après les sources : la maladie d’Andrews au milieu de 1877, Mary aux épreuves, les abonnés | La bibliothèque en ligne |

## 8. Ce qu’on ne dessine pas

Hôtel de ville à beffroi (1894), fontaine monumentale (1887), halle Saint-Jean (1899), kiosque Peynet (1890), tramways (1894), pont de pierre (1905), parc Jouvet, orgue du temple (1896), caserne Latour-Maubourg (fin des années 1870), grande halle de la gare (après 1901), éclairage électrique, bicyclettes.

Ni Bible Segond complète (1880), ni Bible annotée de Neuchâtel (1879 et après), ni numéros Strong (1890), ni concordance de Young (1879), ni lexique de Thayer (1886), ni interlinéaire, ni imprimerie adventiste de Bâle (1884), ni méthode des lectures bibliques (1883).

Ni Ellen White, ni Jean Vuilleumier, ni Augustin Bourdeau, ni une tente d’évangélisation : la citation sur la tente concerne presque sûrement l’Amérique.

## 9. Ce qui reste à trancher avec un relecteur

- La date et le lieu des dix-sept baptêmes. Une seule page donne septembre 1877.
- Les noms des dix-sept. Le fonds Paul Badaut contient un mémoire « Premier effort à Valence en 1876 », inaccessible d’ici.
- Les mots exacts de l’invitation au temple, d’après la thèse de Jean-Michel Martin (1980).
- Les dates de Gabert.
- Les pasteurs de Valence en 1877.
- L’aspect du kiosque de 1862 et de la citadelle.
- L’estampille sur les publications : préfet ou archevêque.
- L’âge de Patience Bourdeau.

Rien de tout cela n’empêche de dessiner la carte ni d’écrire les dialogues : le décor évite chaque point incertain.

## 10. Prochaine étape : les dialogues

Huit stations, trois temps chacune, en français d’abord, puis en anglais. Les personnages de 1877 vouvoient le visiteur ; l’interface garde le tutoiement de World. Chaque dialogue porte son étiquette, « reconstitué d’après les sources » ou « personnage composite », et son bouton Sources. Après les dialogues : le brief d’illustration de la carte, zone par zone, dans le style de `docs/design/illustrations.md` adapté au sépia.
