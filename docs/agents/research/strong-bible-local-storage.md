# Stockage local des Bibles Strong de l’issue #199

_Décision mise en œuvre le 23 juillet 2026._

## Modèle retenu

LSG, DBY et DBR sont chacune une seule Bible visible dans l’application, avec deux ressources
indépendamment téléchargeables :

- un JSON canonique qui porte le texte et toute sa présentation ;
- un sidecar SQLite Strong optionnel, sans copie du texte, qui porte les plages, identités Strong,
  lexèmes, notes et index de concordance.

Le mapping entre l’identité applicative DBR et le dataset de génération DBYR est interne. `LSGS`
reste accepté pour restaurer d’anciens onglets, mais n’est plus une Bible visible et son texte
historique n’est plus utilisé pour lire LSG.

Le JSONL enrichi reste un format d’entrée du pipeline. Il n’est ni téléchargé ni interprété par
l’application.

## Pourquoi séparer le texte et le sidecar

Le texte canonique doit rester lisible sans télécharger Strong. Quand l’utilisateur active Strong,
les offsets du sidecar sont appliqués exactement à la révision du texte avec laquelle ils ont été
générés. Le couple `textRevision` + `textSha256` bloque tout mélange incompatible.

Dupliquer le texte dans le sidecar ferait de celui-ci une seconde source de vérité et augmenterait
le risque de désynchronisation. Fusionner toutes les tables Strong dans `bibles.sqlite` couplerait
les installations et mises à jour de ressources indépendantes, et augmenterait le rayon d’impact
d’une migration ou d’une corruption.

## Contrat de publication

Le pipeline produit six archives ZIP déterministes :

- `bible-lsg.json.zip` et `bible-lsg-strong.sqlite.zip` ;
- `bible-dby.json.zip` et `bible-dby-strong.sqlite.zip` ;
- `bible-dbr.json.zip` et `bible-dbr-strong.sqlite.zip`.

Le JSON canonique contient le texte visible, les événements de présentation et les balises actives
au début d’un verset. Le sidecar contient uniquement les identités de versets et les données Strong.
Le catalogue publie les checksums des archives et contenus, tailles, schémas, compteurs et révisions.

L’installation télécharge dans un emplacement temporaire, vérifie les deux checksums, valide le
format ou l’intégrité SQLite, puis active atomiquement la nouvelle copie. Une activation échouée
conserve la copie précédente.

## Lecture et navigation

Le lecteur obtient toujours le texte depuis le JSON canonique importé dans `bibles.sqlite`. Le mode
Strong superpose les plages du sidecar seulement si sa révision est compatible. Les concordances
interrogent le sidecar choisi, sont paginées en SQL et affichent leur version source.

Depuis un verset, l’application essaie d’abord le sidecar compatible de la Bible ouverte, puis la
Bible Strong par défaut installée. Le lexique hébreu/grec partagé reste dans la base Strong
historique : le sidecar remplace la source des occurrences, pas les définitions.

## Annotations lors d’une mise à jour

Avant d’activer une nouvelle révision de texte, l’application journalise un plan de réalignement des
annotations mot à mot. Elle valide d’abord le texte mémorisé à l’offset courant, puis cherche une
correspondance normalisée unique avec contexte.

Une annotation n’est déplacée que si le nouvel emplacement est déterministe. Si elle est ambiguë ou
introuvable, elle reste inchangée et visible normalement. Le journal rend l’opération reprenable
après une interruption et la synchronisation Firestore réutilise l’action Redux groupée.

## Compatibilité Expo / React Native

Les sidecars utilisent `expo-sqlite`. Les ZIP sont extraits avec `react-native-zip-archive`, qui est
autolinké sur iOS et Android et nécessite le client de développement de l’application (pas Expo Go).
Les trois sidecars vivent dans un sous-répertoire du répertoire SQLite partagé et ne sont ouverts
qu’à la demande.

La décision durable est enregistrée dans
[ADR-0013](../../adr/0013-pair-canonical-bible-text-with-optional-strong-sidecars.md).
