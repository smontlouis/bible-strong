# Formats courts BibleProject et liens Strong

## Conclusion

Les formats courts contiennent un vrai sous-corpus lexical. Sur les 214 vidéos classées `short` (173 EN, 41 FR), huit vidéos horizontales actuellement admissibles sont des mini-études de mots suffisamment explicites pour recevoir immédiatement une ou plusieurs ancres Strong. Elles conservent leur ancre biblique principale et reçoivent la fiche Strong comme attribution complémentaire.

Les formats verticaux contiennent eux aussi plusieurs dizaines de candidats lexicaux. Ils restent toutefois dans `Rejets` conformément à la décision éditoriale sur le 9/16 : identifier un mot Strong ne doit pas les republier automatiquement dans Bible View.

## Associations validées pour les formats courts admissibles

| Vidéo | Langue | Mot | Strong | Autre placement conservé |
| --- | --- | --- | --- | --- |
| `aLvcF1NLwYU` — These Two Hebrew Words Both Mean “Outcry” | EN | tse'aqah / ze'aqah | H6818 / H2201 | Exode 2.23-25 |
| `YMTR7M33eIQ` — This Hebrew Word Is Translated as “Sign” | EN | 'ot | H0226 | Exode 4.1-9 |
| `YoOgGeDfXDk` — Why “Remember” Means So Much in the Bible | EN | zakar | H2142 | Exode 2.23-25 |
| `hhkafDU0XF0` — Why this Hebrew Word Can Mean Something Good—or Something Terrible | EN | 'avad | H5647 | Exode 3.7-12 |
| `FL-n3dnClY8` — Test/Épreuve (Nissah) | FR | nissah | H5254 | Exode 16.4-30 |
| `VZxb06PVFAE` — Désert (Midbar) | FR | midbar | H4057 | Exode 16-17 |
| `mz0tAI2SdPk` — Demeure (Mishkan) | FR | mishkan | H4908 | Exode 25-31 |
| `tlwz151z_80` — Gloire (Kavod) | FR | kavod | H3519 | Exode 33.18-34.9 |

Les codes ont été contrôlés dans le lexique hébreu officiel de [STEPBible Data](https://github.com/STEPBible/STEPBible-Data). Pour `midbar`, la source STEPBible distingue une entrée `H4057b`; l'application utilise volontairement le numéro Strong de base à quatre chiffres `H4057`.

## Candidats lexicaux présents dans les rejets 9/16

Les titres ou descriptions officielles permettent déjà d'identifier, entre autres :

| Exemples EN | Strong probable ou confirmé | Équivalent FR repéré |
| --- | --- | --- |
| `nRTy2olkOOQ` — Basileia | G0932 | `40-O2KZ7sKE` |
| `q5PqOP3s_Ag` — Qavah | H6960 | — |
| `Ib3D_10gsE4` — Ruakh | H7307 | — |
| `TaaW2ZTQQAU` — Teleios | G5046 | `2s6UILdhNRE` |
| `377jWExYeqc` — He'imin | H0539 | — |
| `c5UWxBnPaKA` — Avon | H5771 | — |
| `PagWXFv14iE` — 'Ot | H0226 | `8B48InLtlyY` |
| `bXqQZiPmuEQ` — Ga'al | H1350 | `BDHhKQlOpCU` |
| `wtp_zCElBaw` — Kopher | H3724 | `4Noh_yJLflQ` |
| `cvEdmYKN8VE` — Midbar | H4057 | `Rq95M_DO52A` |
| `ZeXyBc9Bfq4` — Pesha | H6588 | — |
| `JFWgzy2wcEs` — Dikaiosune | G1343 | `jbEcpK6MYQ4` |
| `MWlL8xAkh10` — Tov | H2896 | — |
| `gSyhHIM2JZE` — Ets | H6086 | — |
| `jLHPjKC7C2I` — Mammon | G3126 | `TMCd7IpyIfw` |

Ce tableau est une file de recherche, pas un manifeste de publication. Avant d'en faire des attributions applicatives, il faut contrôler le sens exact développé par chaque vidéo et les variantes morphologiques éventuelles.

## Méthode

1. Filtrage du catalogue local sur `category = short`.
2. Séparation entre vidéos admissibles et rejets éditoriaux 9/16.
3. Recherche d'un terme hébreu ou grec explicite dans le titre, la description officielle et, lorsqu'il existe, le transcript local.
4. Vérification du lemme et du numéro Strong dans STEPBible.
5. Attribution Strong complémentaire, sans écraser l'ancre passage/livre déjà proposée.

## Recommandation de modèle

- Une vidéo peut avoir une ancre principale de passage et plusieurs ancres liées (`strong`, `library`, etc.).
- Les huit vidéos admissibles peuvent être affichées dès maintenant dans Bible View et dans les fiches Strong correspondantes.
- Les candidats verticaux doivent garder leur statut `Rejets`, mais leur cible lexicale peut être mémorisée séparément comme métadonnée de recherche. Une éventuelle réintégration doit rester une décision manuelle.
