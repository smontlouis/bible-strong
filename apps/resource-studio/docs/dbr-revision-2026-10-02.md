# DBR : passage à la révision 2026 de Concordance.bible

Préparé le 2 octobre 2026, à la suite de la décision de reprendre les témoins de
Concordance.bible exportés le 28 septembre 2026. Rien n'a été publié ni activé.

## Constat

Le texte DBR publié est exactement le texte de l'ancien CSV DarbyR, notes et
balises retirées : les 31 171 versets coïncident. Concordance.bible a depuis
révisé ce texte : guillemets ajoutés, « Et » initiaux retirés, quelques mots
changés. Dans l'export du 28 septembre, 3 599 versets diffèrent du texte publié
et les notes passent de 8 845 à 9 042.

Les témoins du moteur Strong utilisent désormais cet export. Ses annotations
DarbyR suivent le texte révisé : elles ne s'appliquent plus au texte DBR publié.
DBR suit donc la révision.

## Chaîne de génération

La publication DBR (texte canonique, notes, Strong) est dérivée du CSV témoin
`data/strongs/DarbyR.csv` :

1. `yarn strong:references:jsonl --output-dir <dossier>` écrit les JSONL Strong
   des trois témoins. Les attributs internes au générateur (`head`, `pos`) en
   sont retirés.
2. `packageMobileStrongBibles` compile le texte canonique et la base Strong de
   LSG, DBY et DBR (essai local : `outputs/releases/strong-mobile-2026-10-02`).
3. La publication ordinaire DBR applique ensuite les paroles de Jésus.

Résultats de l'essai local :

| Bible | Révision du texte                                   | Notes         | Occurrences Strong |
| ----- | --------------------------------------------------- | ------------- | -----------------: |
| LSG   | inchangée (`lsg-a1edb9406bd74711735b`)              | 0             |            417 671 |
| DBY   | change (ordre interne des balises de mise en forme) | 6 340         |            418 216 |
| DBR   | change (`dbr-7a419e50857cc7aafdad`, texte révisé)   | 8 845 → 9 042 |            416 970 |

Les étiquettes Strong de LSG et DBY changent aussi : nouvelles annotations de
Concordance et locutions entières. Leur texte ne change pas ; seule la
numérotation interne des événements de mise en forme de 243 versets DBY bouge.

## Paroles de Jésus

`yarn words-of-jesus rebase-text --version DBR --previous-text <ancien DBR>`
reporte par alignement de mots les décisions dont le verset a changé : 218
décisions reportées (202 avec des plages), aucun échec. Les plages couvrent les
mêmes paroles, guillemets de la révision compris. Le paquet DBR ordinaire se
reconstruit localement sans dérive (`outputs/releases/dbr-revision-2026-10-02`).

Fichiers prêts sous `outputs/dbr-revision-2026-10-02/` (ignoré par Git) : le
texte canonique révisé, le jeu de décisions reporté et `source-overrides.json`.

## Reste à faire (publication)

Comme pour NEG79, le texte et les décisions changent ensemble :

1. Publier les nouvelles publications Strong LSG, DBY et DBR et le texte DBR
   révisé.
2. Dans le même changement, remplacer `workflows/words-of-jesus/data/dbr.jsonl`
   par le jeu reporté.
3. Vérifier (`yarn resources:words-of-jesus check --version DBR`), mettre en
   paquet et activer.

La licence de DBR (« © Bibles et Publications Chrétiennes — CC BY-NC-ND ») reste
à confirmer pour la révision 2026 avant toute publication.
