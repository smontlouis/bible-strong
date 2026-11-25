# Lecteur audio de la Bible

Un seul lecteur pour toute l'app, qui fait entendre un chapitre avec l'enregistrement de la version ou
avec la voix de l'appareil (ADR-0116). Il garde son propre passage : les onglets le lancent et le
suivent, ils ne le possèdent pas.

## Pièces

| Fichier                               | Rôle                                                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bibleAudioPlayer.ts`                 | La façade : `listenToPassage`, `play`, `pause`, `togglePlay`, `stop`, `skip`, `seekTo`, `goToAdjacentChapter`, `changePassage`, `chooseBibleAudio`, `interruptBibleAudio`. Passage d'un livre à l'autre, fin de la Bible, minuterie. |
| `types.ts`                            | Le passage, le moteur (`recorded` ou `speech`) et l'enregistrement, l'état, la progression, et l'interface `BibleAudioEngine`.                                                                                                       |
| `audioCatalog.ts`                     | Le catalogue des enregistrements, le choix par version et sa résolution pour un passage.                                                                                                                                             |
| `recordedEngine.ts`                   | Les enregistrements : une playlist `expo-audio` par livre, qui enchaîne les chapitres en natif et pilote l'écran verrouillé et la notification.                                                                                      |
| `speechEngine.ts`, `speechChapter.ts` | La voix de l'appareil (`expo-speech`), verset par verset. Elle charge elle-même le chapitre par l'accès aux ressources du lecteur, en ligne si la Bible n'est pas installée.                                                         |
| `atoms.ts`                            | L'état du lecteur, sa progression (à part : quatre mises à jour par seconde), l'ouverture du grand lecteur, l'onglet qui suit, et les réglages enregistrés (vitesse, répétition, voix, hauteur).                                     |
| `useFollowBibleAudio.ts`              | Le suivi souple, appelé par `BibleViewer`.                                                                                                                                                                                           |
| `useShowBibleAudioText.ts`            | « Afficher le texte ».                                                                                                                                                                                                               |
| `ui/`                                 | Le petit et le grand lecteur, et leurs boutons.                                                                                                                                                                                      |

## Comportement

- **Enregistrements (ADR-0117).** Une version a de 0 à N enregistrements, streamés depuis leur
  éditeur, ou hébergés sur l'hôte média quand l'éditeur l'a permis par écrit (Trésor sonore).
  `audioCatalog.ts` lit `bible-audio/catalog-v2.json` sur l'hôte média une fois par jour et
  garde la dernière copie ; l'app embarque le même fichier (`@bible-strong/resource-catalog/bible-audio`)
  pour le premier lancement. Les adresses se construisent dans le domaine
  (`@bible-strong/resource-domain/bible-audio`). Le lecteur retient un enregistrement par son id, ou
  la voix de l'appareil, et mémorise le choix par version. Un enregistrement qui ne couvre pas un
  livre laisse la place à un autre de la version, puis à la voix. Pour en ajouter un : éditer
  `packages/resource-catalog/src/bibleAudioCatalog.json`, puis `yarn resources:audio check` et
  `yarn resources:audio publish`.
- **Mention de l'éditeur.** Un enregistrement peut porter une `attribution` (texte, lien, logo) que
  l'éditeur exige : `RecordingAttribution` l'affiche sous les options du grand lecteur, et l'écran de
  verrouillage la reprend. Chaque chapitre qui commence compte un événement `bible_audio_listen`
  (`listenStats.ts`), d'où l'on tire les écoutes annuelles demandées par l'éditeur.
- **Petit lecteur.** Tant qu'un passage est chargé, une rangée en haut de la barre d'onglets
  (`variant="bar"`) : titre, lecture/pause, croix qui arrête et cache le lecteur. La barre grandit de
  `MINI_PLAYER_HEIGHT` ; tout ce qui se place au-dessus d'elle lit `useBottomBarHeightInTab`, la bulle
  de l'assistant et la liste des onglets aussi. Sur grand écran, une carte en bas de la barre latérale
  (`variant="card"`), ou flottante en bas à gauche quand la barre latérale est cachée.
- **Grand lecteur.** `BibleAudioPlayerSheet`, monté à la racine. Sur téléphone, un plein écran qui
  monte du petit lecteur et redescend au doigt ; le haut prend une teinte de la partie de la Bible.
  Il montre la pochette du chapitre (`BibleAudioCover` : le nom du livre et un grand numéro coupé par
  le bord, aux couleurs de la partie, `themes/bibleBookColors.ts`), qui grandit pendant la lecture.
  Dessous, le titre et la version (chacun ouvre son sélecteur), « Lire » (afficher le texte), la
  barre, qu'on fait glisser ou qu'on touche pour aller ailleurs dans le chapitre (`seekTo`), puis
  les commandes d'Audibible : −10 s ou −1 verset, chapitre précédent, lecture, chapitre suivant,
  +10 s ou +1 verset. Les options sont de grandes icônes : « Écouter avec » (les enregistrements de la version et la
  voix de l'appareil), la vitesse, la voix et la
  tonalité pour la synthèse, la répétition et la minuterie avec le temps restant. « … » mène à
  Audibible. Sur grand écran, un panneau en bas à gauche (Échap le ferme), la pochette en vignette à
  côté du titre. La bulle de l'assistant se cache tant qu'il est ouvert.
- **Pochette.** Le catalogue nomme l'image d'un chapitre : sa scène de la frise (`scenes`, peintures
  de la frise), sinon son lieu (`places`, portraits de l'hôte média), sinon celle d'un chapitre voisin
  du livre (trois au plus). La peinture passe sous la pochette, dans la teinte de la partie :
  l'accent en fusion « color », un voile du fond, un fondu en haut. `yarn resources:audio covers`
  choisit ces images (passages de la frise par l'API, TIPNR, et les exceptions de
  `apps/resource-studio/config/bible-audio-*-overrides.json`), puis `publish` les publie. Le petit
  lecteur en montre une vignette, qui ne garde que le numéro.
- **Suivi souple.** Le bouton lecture d'un onglet Bible appelle `listenToPassage` avec l'onglet. Cet
  onglet suit les changements de chapitre de l'audio. Dès que son lecteur va ailleurs, il se détache
  et l'audio continue ; il se détache aussi si l'audio sort de son plan de lecture ou change de
  version. « Afficher le texte » ramène l'onglet d'origine sur le passage entendu (ou en ouvre un) et
  relance le suivi. Une page Bible hors onglet lance la lecture sans rien suivre.
- **Écran verrouillé.** Activé une seule fois par le moteur des enregistrements : sur Android, une
  seconde activation recrée la session média et arrête le lecteur. Ensuite seules les métadonnées
  changent. La voix de synthèse n'a pas de commandes d'écran verrouillé.
- **Erreurs.** La playlist iOS ne signale pas d'échec de chargement : un chapitre qui ne démarre pas
  en 20 s passe en erreur. Android signale l'échec dans une seule mise à jour de statut. Toucher
  lecture après une erreur recharge le chapitre.
- **Minuterie.** Vérifiée chaque seconde pendant la lecture ; une pause, dans l'app ou depuis l'écran
  verrouillé, l'annule.
- **Prononciation Strong.** `StrongAudioProvider` joue sur un autre lecteur `expo-audio` et met la
  Bible en pause avec `interruptBibleAudio`.
