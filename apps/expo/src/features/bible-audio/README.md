# Lecteur audio de la Bible

Un seul lecteur pour toute l'app, qui fait entendre un chapitre avec l'enregistrement de la version ou
avec la voix de l'appareil (ADR-0116). Il garde son propre passage : les onglets le lancent et le
suivent, ils ne le possèdent pas.

## Pièces

| Fichier                               | Rôle                                                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bibleAudioPlayer.ts`                 | La façade : `listenToPassage`, `play`, `pause`, `togglePlay`, `stop`, `skip`, `goToAdjacentChapter`, `changePassage`, `setSource`, `interruptBibleAudio`. Passage d'un livre à l'autre, fin de la Bible, minuterie. |
| `types.ts`                            | Le passage, la source (`recorded` ou `speech`), l'état, la progression, et l'interface `BibleAudioEngine`.                                                                                                          |
| `recordedEngine.ts`                   | Les enregistrements : une playlist `expo-audio` par livre, qui enchaîne les chapitres en natif et pilote l'écran verrouillé et la notification.                                                                     |
| `speechEngine.ts`, `speechChapter.ts` | La voix de l'appareil (`expo-speech`), verset par verset. Elle charge elle-même le chapitre par l'accès aux ressources du lecteur, en ligne si la Bible n'est pas installée.                                        |
| `atoms.ts`                            | L'état du lecteur, sa progression (à part : quatre mises à jour par seconde), l'ouverture du grand lecteur, l'onglet qui suit, et les réglages enregistrés (vitesse, répétition, voix, hauteur).                    |
| `useFollowBibleAudio.ts`              | Le suivi souple, appelé par `BibleViewer`.                                                                                                                                                                          |
| `useShowBibleAudioText.ts`            | « Afficher le texte ».                                                                                                                                                                                              |
| `ui/`                                 | Le petit et le grand lecteur, et leurs boutons.                                                                                                                                                                     |

## Comportement

- **Sources.** Une version avec enregistrements les joue, sauf si le lecteur choisit la voix de
  synthèse dans le grand lecteur ; une version sans enregistrement prend la voix. L'arrêt revient aux
  enregistrements pour la lecture suivante.
- **Petit lecteur.** Tant qu'un passage est chargé, une rangée en haut de la barre d'onglets
  (`variant="bar"`) : titre, lecture/pause, croix qui arrête et cache le lecteur. La barre grandit de
  `MINI_PLAYER_HEIGHT` ; tout ce qui se place au-dessus d'elle lit `useBottomBarHeightInTab`, la bulle
  de l'assistant et la liste des onglets aussi. Sur grand écran, une carte en bas de la barre latérale
  (`variant="card"`), ou flottante en bas à gauche quand la barre latérale est cachée.
- **Grand lecteur.** `BibleAudioPlayerSheet`, monté à la racine : une feuille faite main qu'on glisse
  vers le bas sur téléphone, un panneau en bas à gauche sur grand écran (Échap le ferme). Il contient
  la source, le livre et le chapitre (sélecteur de livres de l'app), la version (sélecteur de
  versions), la progression, ±10 s ou ±1 verset, chapitre précédent et suivant, vitesse, répétition,
  minuterie, voix et hauteur pour la synthèse, et « Afficher le texte ». La bulle de l'assistant se
  cache tant qu'il est ouvert.
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
