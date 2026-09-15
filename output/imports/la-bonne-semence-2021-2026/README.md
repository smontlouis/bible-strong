# La Bonne Semence — éditions 2021 à 2026

Source officielle : https://editeurbpc.com/calendriers/la-bonne-semence/YYYYMMDD
Autorisation de republication BPC et cible production confirmées par l'utilisateur le 14 septembre 2026.

Cible : `bible-strong-app`, base Firestore `(default)`.
Nouveaux recueils : `plans/la-bonne-semence-2021` à `plans/la-bonne-semence-2026`.
Le recueil perpétuel `plans/lbs` n'est pas modifié.

## Contenu

- `readings.json` : textes extraits, dates complètes, URLs et SHA256 des sources.
- `documents.json` : documents Firestore au format lisible, six parents et 72 sections.
- `validation.json` : couverture des dates, volumes et répétitions éditoriales.
- `collect.py` : acquisition limitée à trois requêtes simultanées avec reprise du cache.
- `build.py` : vérification des 2 191 dates et préparation des documents.
- `import_firestore.py` : préconditions d'absence sur chaque écriture ; aucune mise à jour d'un document existant.
- `rollback.py` : annulation explicite limitée aux documents créés, seulement s'ils n'ont pas changé depuis l'import.

Les textes sont conservés sans réécriture, avec paragraphes et références. L'italique HTML devient du texte simple, conformément au format actuel des lectures de Bible Strong. Les répétitions entre éditions sont signalées, jamais supprimées automatiquement. `editionYear` et `publicationDate` conservent l'année éditoriale ; `calendarDate` contient le mois/jour pour compatibilité avec le lecteur actuel. Chaque édition constitue un recueil distinct ; cet import n'ajoute pas de sélection automatique selon l'année dans le client.

## Exécution

Une connexion Firebase CLI valide sur ce Mac est nécessaire. Aucun secret n'est inclus dans les fichiers.

```bash
python3 import_firestore.py prepare
python3 import_firestore.py preflight
python3 import_firestore.py publish
python3 import_firestore.py verify
```

Chaque édition est créée atomiquement avec ses 12 mois. Le reçu est enregistré dans `receipt.json` après chaque édition. Si une exécution est interrompue, inspecter le reçu et les documents distants avant de reprendre ; ne pas écraser ni supprimer les documents existants.

En cas d'annulation expressément autorisée :

```bash
python3 rollback.py --confirm-delete-import
```

L'état de publication est donné par le reçu et la vérification distante, pas par la seule présence de ce dossier.
