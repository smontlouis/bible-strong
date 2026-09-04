# Expérience dictionnaire

## Modèle utilisateur

L’expérience distingue deux objets :

- une **notion** regroupe les variantes françaises et anglaises reconnues comme équivalentes ;
- un **article** reste une définition exacte, appartenant à un dictionnaire, une langue et une révision.

Les définitions ne sont jamais fusionnées. La notion sert uniquement à découvrir les articles disponibles et à passer d’une source à une autre.

## Points d’entrée

### Répertoire global

`DictionaryListScreen` ouvre par défaut le répertoire commun :

- recherche et navigation alphabétique sur les notions ;
- choix de la langue française ou anglaise dans le menu d’options ;
- choix entre le répertoire commun et un dictionnaire précis dans le même menu ;
- liste volontairement sobre : seul le terme est affiché, les sources apparaissent dans le détail.

En ligne, le répertoire est fédéré par le Resource service. Hors ligne, l’interface indique explicitement qu’elle consulte le dictionnaire installé sélectionné : elle ne prétend pas fournir un index global incomplet.

### Depuis un verset

`DictionnaireVerseDetailCard` affiche les **articles qui citent précisément le verset**. Il ne cherche pas naïvement les mots de la traduction biblique affichée et ne précharge plus toutes les définitions. Les résultats sont regroupés par notion, puis l’utilisateur ouvre l’article de son choix.

### Lecture d’un article

`DictionaryDetailTabScreen` conserve l’identité exacte de l’article (`work`, `resourceId`, `language`, `entryId`). Lorsqu’une correspondance existe, un sélecteur montre les autres dictionnaires et variantes linguistiques. Les liens `bible://`, `strong://` et les liens vers d’autres articles ouvrent leur surface native.

### Accueil et téléchargements

Le widget d’accueil ouvre l’article dans la ressource réellement utilisée et propose son téléchargement géré. Les copies hors ligne restent gérées par dictionnaire dans l’écran de téléchargements ; elles ne sont pas confondues avec le répertoire de découverte.

## Accès aux données

Toutes les surfaces passent par `useResourceAccess().dictionary`. Le contrat fournit notamment :

- `listWorks` pour le catalogue ;
- `browseDirectoryPage` et `searchDirectoryPage` pour les notions ;
- `listByLetterPage` et `searchPage` pour un dictionnaire précis ;
- `loadEntryById` pour préserver l’identité d’un article ;
- `discoverPassageEntries` pour les citations d’un verset.

`dictionaryExperience.ts` contient les règles déterministes de regroupement, de préférence linguistique et de résolution d’une notion depuis un article. Ces règles sont testées indépendamment des composants.

## Invariants

- Ne jamais fusionner le texte de plusieurs dictionnaires.
- Ne jamais déduire une correspondance à partir d’un identifiant absent.
- Transporter l’identité complète lorsqu’un article est ouvert.
- Présenter les liens depuis un verset comme des citations d’articles, pas comme une concordance exhaustive.
- Rendre toute dégradation hors ligne visible pour l’utilisateur.
