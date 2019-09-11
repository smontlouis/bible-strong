export const logTypes = {
  BUG: 'bug',
  FEATURE: 'fonctionnalité',
  NEW: 'nouveauté',
  INFO: 'info'
}

export default [
  {
    date: '1568159596682',
    type: logTypes.FEATURE,
    title: 'Études et étiquettes',
    description:
      'Bonne nouvelle, vous avez maintenant accès aux études :). Vous pouvez créer vos études, mettre en lien des versets, des mots strong et les organiser par étiquettes. La fonctionnalité tags a également été renommée en "étiquettes" et a été retravaillée.'
  },
  {
    date: '1567897439396',
    type: logTypes.FEATURE,
    title: 'Historique',
    description:
      "Vous avez maintenant accès à l'historique de vos versets, strongs et mots de dictionnaire. L'îcone se trouve en haut à droite de l'écran Bible."
  },
  {
    date: '1567579490720',
    type: logTypes.BUG,
    title: 'Bible écran blanc',
    description:
      'Pour certaines personnes, la Bible affichait un écran blanc. Le bug a été en parti identifié et réglé.'
  },
  {
    date: '1567569873652',
    type: logTypes.FEATURE,
    title: 'Sommaire des péricopes',
    description:
      "Je pense que c'est ma fonctionnalité favorite. L'idée est de découvrir la Bible au travers de sommaires. Chaque version de la Bible (à part deux ou trois) possède ses propres sommaires. L'icône des péricopes est juste à côté de la version."
  },
  {
    date: '1567550380556',
    type: logTypes.BUG,
    title: 'Partage dictionnaire',
    description: "Le partage d'un mot du dictionnaire est maintenant possible."
  },
  {
    date: '1567540356582',
    type: logTypes.NEW,
    title: 'Mises à jour silencieuses',
    description:
      "L'application ne redémarrera plus lorsqu'une mise à jour aura été effectuée, pour ne pas être coupé dans votre lecture. Lorsque vous êtes prêts, redémarrer simplement l'application pour utiliser la dernière version."
  },
  {
    date: '1567539661219',
    type: logTypes.NEW,
    title: 'Changelog',
    description: "L'accès au changelog a été ajouté au menu."
  },
  {
    date: '1567514591426',
    type: logTypes.NEW,
    title: 'Personnalisation des couleurs',
    description:
      'Vous pouvez maintenant modifier jusqu\'à 5 couleurs pour vos surbrillances. Pour accéder à l\'option, rendez-vous dans les paramêtres de mise en forme "Aa".'
  },
  {
    date: '1567457171763',
    type: logTypes.NEW,
    title: 'Bouton de connexion et soutien financier',
    description:
      "J'ai ajouté un bouton de connexion dans les paramètres. Concernant le lien 'Soutenir le développeur', certains d'entres vous désireux de m'aider ne comprennent pas comment le faire. J'ai donc ajouté plus d'informations dans le lien."
  },
  {
    date: '1567396884383',
    type: logTypes.FEATURE,
    title: 'Connexion et études (cachées) !',
    description:
      "En résumé : La fonctionnalité est cachée pour l'instant. Pour y accéder, suivez-nous sur Facebook, j'ai mis les indications dans le premier post ! 😉. Le lien est dans le menu.\n \nVersion plus longue: Vous avez maintenant accès aux études et pouvez sauvegarder vos données dans le cloud. J'ai été obligé de \"cacher\" la fonctionnalité, Apple et Google n'aiment pas les fonctionnalités en phase de test. D'ailleurs s'ils voient ce message, je vais surement me faire taper sur les doigts. Les études sont donc en bêta ouverte. J'ai besoin de votre aide ! Merci de me donner vos retours et vos avis. "
  },
  {
    date: '1566639586810',
    type: logTypes.BUG,
    title: "Chargement de l'index...",
    description: "Au premier chargement de l'index, l'écran restait bloqué. Ce bug est résolu."
  },
  {
    date: '1566445889323',
    type: logTypes.FEATURE,
    title: 'Dictionnaire dans les versets',
    description:
      "3 mises à jours en 3 jours ? C'est Noël avant l'heure ;) \n Vous avez maintenant un accès direct aux mots du dictionnaire depuis un verset ! Si vous accédez à une strong / sélectionnez un verset, vous verrez apparaître la petite icône jaune du dictionnaire !"
  },
  {
    date: '1566358697045',
    type: logTypes.FEATURE,
    title: 'Filtres de recherche',
    description:
      'Voici les filtres de recherche. Vous pouvez trier par pertinence ou ordre alphabétique, et filtrer par section ou par livre. Enjoy !'
  },
  {
    date: '1566295101677',
    type: logTypes.BUG,
    title: 'Base de données corrompue',
    description:
      "Certains utilisateurs ont rencontré des problèmes d'accès à la base de données strong depuis la dernière mise à jour. Des données ont pu malencontreusement être corrompues lors du téléchargement. Pour régler ce problème, vous pouvez soit vider les données et le cache de l'application, ou la réinstaller. Toutes mes excuses pour le désagrément. \n\n Contactez-moi si le problème persiste."
  },
  {
    date: '1566246046551',
    type: logTypes.FEATURE,
    title: 'Tags, Lexique, Dictionnaire',
    description:
      "Je suis un peu occupé ces temps-ci à travailler sur la fonctionnalité Études. En attendant, voici quelques nouveautés: vous pouvez désormais regrouper vos surbrillances et notes par tags / catégories afin de mieux les organiser. Merci à Sylvia M. pour l'idée. J'ai également ajouté la possibilité de rechercher une strong directement par lexique. Enfin, la plus grosse nouveauté est l'ajout du Dictionnaire. Assurez-vous d'avoir de la place ! Le dictionnaire pèse 25Mo. "
  },
  {
    date: '1565126162912',
    type: logTypes.BUG,
    title: 'Mélange de chapitres',
    description:
      "En changeant de chapitre, certains versets du chapitre précédent se retrouvaient dans le chapitre suivant. Merci à Lysiane d'avoir remonté le bug."
  },
  {
    date: '1564895816518',
    type: logTypes.BUG,
    title: 'ERR_INTERNET_DISCONNECTED',
    description:
      "Il y avait un bug 'Error loading page - ERR_INTERNET_DISCONNECTED' à l'affiche de la Bible. Ce bug a été théoriquement réglé. N'hésitez à me donner des retours si ça continue."
  },
  {
    date: '1564107002776',
    type: logTypes.BUG,
    title: 'Malachie 4 - Bug sur la recherche et dans la Bible',
    description:
      "Certaines versions n'ont pas Malachie 4. De ce fait l'application plantait quand on essayait d'y accéder."
  },
  {
    date: '1563995302301',
    type: logTypes.FEATURE,
    title: 'Notes intégrées 🎉',
    description:
      "Il est maintenant possible de voir vos notes directement dans la Bible, à la suite des versets. Il est toujours possible de retourner à l'affichage classique en allant dans les paramètres de mise en forme."
  },
  {
    date: '1563752259891',
    type: logTypes.INFO,
    title: 'Vous remarquez des bugs ?',
    description:
      "S'il vous plaît, n'hésitez surtout pas à reporter les bugs dans l'application! Dans les paramètres, vous pouvez directement me joindre par mon mail ou reporter un bug. Merci :) !"
  },
  {
    date: '1563752166214',
    type: logTypes.NEW,
    title: 'Verset sélectionné',
    description:
      'Quand vous choisissez un verset vous aurez dorénavant une légère animation pour trouver facilement le verset sélectionné.'
  },
  {
    date: '1563749584258',
    type: logTypes.NEW,
    title: 'Ouvrir dans Bible',
    description:
      "Quand vous accédez à vos surbrillances, un verset trouvé dans une concordance, ou des résultats de recherche, la Bible s'ouvre dans une nouvelle page en lecture seule, pour ne pas vous sortir de votre contexte. J'ai ajouté un bouton 'Ouvrir dans Bible' pour vous permettre de retourner à l'accueil."
  },
  {
    date: '1563746444270',
    type: logTypes.BUG,
    title: 'Mode sombre - définition',
    description:
      'En mode sombre, les définitions des strongs apparaissaient parfois en noir. Ce bug a été réglé'
  },
  {
    date: '1562753462096',
    type: logTypes.NEW,
    title: 'Ajout de la Bible King James Française (KJF)!',
    description: `🎉Bonne nouvelle !🎉
    
La bible King James Française a été ajoutée à l'application ! 

La seule traduction basée sur le Texte Massorétique Hébreu Ben Chayyim pour l’Ancien Testament, (édition correcte de Ben Chayyim), qui est sans équivoque la copie exacte des textes “ originaux” .Ce texte n’est malheureusement plus imprimé, étant erronément édité par Christian Ginsburg.. Pour le Nouveau Testament, c’est le texte (Texte Majoritaire) Byzantin Grec ou Textus Receptus d’Érasme . Les traducteurs de la Bible King James se sont appuyés sur de précédentes éditions anglaises et étrangères de la Bible, aussi bien que sur de plus pures éditions en hébreu et en grec, qui ne nous sont plus disponibles aujourd’hui.
    
La raison primordiale de cette traduction était de justement donner aux francophones une Bible vraiment basée sur les manuscrits dont se sont servis les traducteurs de la King James anglaise. Cette Bible est unique en son genre. Une refonte totale était devenue nécessaire afin de mettre en valeur cette spécificité pour les lecteurs francophones.
    
C'est pourquoi ce travail est : mot pour mot, verset par verset la traduction intégrale - au plus près possible - du vocabulaire de la King James Bible anglaise.
    
Traduction N. Stratford.
http://www.kingjamesfrancaise.net/
    `
  },
  {
    date: '1562621003832',
    type: logTypes.BUG,
    title: 'Meilleures performances entre les chapitres',
    description:
      "Au changement de chapitre, il était possible de voir un écran blanc entre les transitions. C'est maintenant quasi-instantané."
  },
  {
    date: '1562583055833',
    type: logTypes.FEATURE,
    title: 'Ajout de péricopes - titres de sections',
    description:
      "J'ai appris ce mot il y a deux jours, je l'avoue. Péricope vient du mot 'découpage'. En résumé vous avez maintenant les titres ou sections des différentes parties d'un texte biblique."
  },
  {
    date: '1562470112286',
    type: logTypes.BUG,
    title: 'Texte italique sur Android',
    description: "Dans certains endroits de l'App, le texte était italique. Ce bug a été réglé."
  },
  {
    date: '1562469387018',
    type: logTypes.NEW,
    title: 'Ajout de "Quoi de neuf ?"',
    description: "Vous serez dorénavant tenu au courant de chaque modification dans l'App."
  },
  {
    date: '1562460467170',
    type: logTypes.BUG,
    title: 'Vibration désactivée',
    description:
      "Lorsqu'on sélectionne un verset, le téléphone vibrait très légèrement. Un utilisateur a remonté une erreur critique à ce niveau. J'ai désactivé pour l'instant la vibration."
  },
  {
    date: '1562459400000',
    type: logTypes.BUG,
    title: 'Bible LSG',
    description:
      "Il y a avait pas mal de soucis d'espace pour la Bible Louis Segond. Ce souci a été réglé."
  }
]
