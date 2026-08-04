# Audit d’exécution des consommateurs Strong après l’issue #199

_Audit en lecture seule réalisé le 24 juillet 2026._

## Conclusion

Les chemins principaux de LSG, DBY et DBR ont bien migré vers les sidecars : lecture Strong,
résolution de la Bible source, modal de ressource et concordances n’interrogent plus
`LSGSAT2`/`LSGSNT2`. La base `strong.sqlite` globale reste cependant nécessaire pour les définitions
des tables `Grec` et `Hebreu`, ce qui est conforme à
[ADR-0013](../../adr/0013-pair-canonical-bible-text-with-optional-strong-sidecars.md).

L’audit trouve deux défauts d’exécution prioritaires, quatre incohérences fonctionnelles et aucun
chemin P0.

## Findings

### P1 — Un verset sans occurrence alignée fait échouer le modal de ressource

**Statut : bug confirmé.**

Le modal charge d’abord le verset annoté depuis le sidecar, le parse, puis transmet toutes ses
références au lexique global
([`BibleVerseDetailCard.tsx:194`](../../../src/features/bible/BibleVerseDetailCard.tsx#L194),
[`BibleVerseDetailCard.tsx:213`](../../../src/features/bible/BibleVerseDetailCard.tsx#L213),
[`BibleVerseDetailCard.tsx:217`](../../../src/features/bible/BibleVerseDetailCard.tsx#L217)).
Quand le sidecar ne fournit aucune plage alignée, `parsedVerse.references` est vide.

`loadStrongReferences` filtre ce tableau, puis construit malgré tout
`SELECT * FROM <table> WHERE `, sans condition
([`loadStrongReferences.ts:39`](../../../src/helpers/loadStrongReferences.ts#L39),
[`loadStrongReferences.ts:40`](../../../src/helpers/loadStrongReferences.ts#L40),
[`loadStrongReferences.ts:48`](../../../src/helpers/loadStrongReferences.ts#L48)). SQLite renvoie une
erreur de syntaxe, convertie en `UNKNOWN_ERROR`; le modal affiche alors une erreur générique au lieu
d’un état « aucune donnée Strong alignée ».

Ce scénario existe dans les artefacts réellement publiés. Une requête sur les trois SQLite de
`../bible-lexicon-maker/outputs/releases/bible-strong-mobile-v2-candidate/bibles/` trouve :

- 7 versets sans Strong aligné pour LSG ;
- 6 pour DBY ;
- 6 pour DBR.

Exemples reproductibles : Actes 8.37, Actes 15.34, Actes 19.41 et Actes 24.7, ainsi que
Marc 9.44 et Marc 9.46 pour LSG. L’absence des occurrences non alignées est
actuellement intentionnelle : le chargeur ne sélectionne que `o.isAligned=1`
([`strongBibleSidecar.ts:221`](../../../src/helpers/strongBibleSidecar.ts#L221),
[`strongBibleSidecar.ts:228`](../../../src/helpers/strongBibleSidecar.ts#L228)) et le test de
l’overlay confirme que les occurrences non alignées sont ignorées
([`strongBibleOverlay-test.ts:19`](../../../src/helpers/__tests__/strongBibleOverlay-test.ts#L19)).
Le bug n’est donc pas ce filtrage, mais l’absence de garde sur une liste lexicale vide.

**Correction sûre :** faire retourner `[]` immédiatement par `loadStrongReferences` quand la liste
normalisée est vide, puis rendre un état sans lexème dans le modal.

### P1 — KJVS lit encore les anciennes tables et sa Bible dépend de la langue du lexique

**Statut : bug confirmé, hors des trois sidecars français mais encore accessible dans le produit.**

KJVS reste une version visible
([`bibleVersions.ts:357`](../../../src/helpers/bibleVersions.ts#L357)). Sa lecture passe encore par
`loadStrongBibleChapter`
([`bibleContentAccess.ts:173`](../../../src/features/resources/bibleContentAccess.ts#L173)), puis par
`loadStrongChapter`, qui choisit exclusivement `LSGSAT2` ou `LSGSNT2`
([`loadStrongChapter.ts:16`](../../../src/helpers/loadStrongChapter.ts#L16),
[`strongBookTables.ts:21`](../../../src/helpers/strongBookTables.ts#L21)).

La requête utilise `SQLStrongTransaction`, donc la langue choisie pour le **lexique** global
([`getSQLTransaction.ts:27`](../../../src/helpers/getSQLTransaction.ts#L27),
[`getSQLTransaction.ts:43`](../../../src/helpers/getSQLTransaction.ts#L43)). Les deux fichiers CDN
confirment que les mêmes tables portent des textes bibliques différents :

- `databases/strong.sqlite`, Genèse 1.1 : « Au commencement… » ;
- `databases/en/strong.sqlite`, Genèse 1.1 : « In the beginning… ».

Un utilisateur ayant KJVS ouvert et le lexique Strong réglé en français lit donc le texte LSG sous
le libellé KJVS. Inversement, une langue dont le fichier n’est pas installé produit un chapitre vide.
Cela contredit la décision selon laquelle la langue de la base globale change les définitions, pas
la Bible source.

L’état de téléchargement peut en plus diverger de la requête : la disponibilité de KJVS vérifie la
langue UI courante
([`resourceAvailability.ts:55`](../../../src/features/resources/resourceAvailability.ts#L55),
[`resourceAvailability.ts:78`](../../../src/features/resources/resourceAvailability.ts#L78),
[`resourceAvailability.ts:111`](../../../src/features/resources/resourceAvailability.ts#L111)),
alors que la lecture utilise `resourcesLanguage.STRONG`.

**Correction sûre :** soit migrer KJV/KJVS vers le même modèle canonique + sidecar, soit au minimum
fixer explicitement KJVS sur la base anglaise et utiliser la même langue explicite pour disponibilité
et requêtes. Le vieux `strongDB.init()` de
[`bibleContentAccess.ts:107`](../../../src/features/resources/bibleContentAccess.ts#L107) devrait
également disparaître : il initialise le handle racine historique alors que la requête réelle est
language-aware.

### P2 — Supprimer ou invalider un sidecar peut laisser le bouton Strong bleu

**Statut : bug confirmé.**

Si un onglet est en `strongMode: visible`, le chargement d’un sidecar manquant/incompatible avale
l’erreur et retourne silencieusement le texte canonique sans Strong
([`bibleContentAccess.ts:128`](../../../src/features/resources/bibleContentAccess.ts#L128),
[`bibleContentAccess.ts:136`](../../../src/features/resources/bibleContentAccess.ts#L136),
[`bibleContentAccess.ts:148`](../../../src/features/resources/bibleContentAccess.ts#L148)).
Le header colore pourtant le `S` uniquement à partir de `strongMode === 'visible'`, sans revalider
la disponibilité
([`BibleHeader.tsx:460`](../../../src/features/bible/BibleHeader.tsx#L460),
[`BibleHeader.tsx:492`](../../../src/features/bible/BibleHeader.tsx#L492)).

La suppression ferme et efface le sidecar mais ne remet aucun onglet en mode caché
([`deleteDownloadedItem.ts:86`](../../../src/helpers/deleteDownloadedItem.ts#L86)). L’écran des
téléchargements ne publie que le signal des versions installées, pas le signal de rafraîchissement
du lecteur
([`DownloadsScreen.tsx:374`](../../../src/features/settings/DownloadsScreen.tsx#L374)).

**Scénario :** activer Strong sur DBY, supprimer son index depuis les téléchargements, revenir à
l’onglet. Les anciens spans peuvent rester jusqu’au prochain chargement; ensuite le texte devient
normal mais le `S` reste bleu.

**Correction sûre :** après suppression/incompatibilité, invalider le chapitre et ramener les
onglets concernés à `hidden`, ou dériver l’état visuel de `strongMode + availability`.

### P2 — Les écrans de concordance ne résistent pas tous à une erreur de sidecar

**Statut : risque d’exécution confirmé.**

Le chargement principal du détail Strong lance les deux requêtes sidecar dans un `Promise.all`
sans `try/catch`, puis n’arrête le loader qu’après leur succès
([`StrongDetailScreen.tsx:155`](../../../src/features/lexique/StrongDetailScreen.tsx#L155),
[`StrongDetailScreen.tsx:174`](../../../src/features/lexique/StrongDetailScreen.tsx#L174)).
Le premier chargement de la concordance par livre suit le même modèle
([`ConcordanceByBookScreen.tsx:99`](../../../src/features/bible/ConcordanceByBookScreen.tsx#L99),
[`ConcordanceByBookScreen.tsx:106`](../../../src/features/bible/ConcordanceByBookScreen.tsx#L106)).
La pagination ultérieure, elle, possède déjà un `try/catch`.

Si un sidecar est supprimé, remplacé ou devient illisible après sa résolution mais avant la fin
des requêtes, la promesse de l’effet est rejetée sans traitement. En développement cela peut
produire une erreur non gérée ; en production l’écran peut rester en chargement. L’écran
intermédiaire `ConcordanceScreen` capture bien l’erreur via `useAsync`, mais ne rend aucun état pour
le statut `Rejected`
([`ConcordanceScreen.tsx:62`](../../../src/features/bible/ConcordanceScreen.tsx#L62),
[`ConcordanceScreen.tsx:87`](../../../src/features/bible/ConcordanceScreen.tsx#L87)).

**Correction sûre :** uniformiser les trois écrans autour d’un résultat erreur explicite, conserver
les données déjà affichées pendant un rechargement et toujours terminer l’état de chargement dans
un `finally`.

### P2 — La source DBY/DBR/LSG se perd dans deux navigations internes du lexique

**Statut : incohérence confirmée.**

La source choisie est correctement propagée depuis une carte Strong
([`StrongCard.tsx:115`](../../../src/features/bible/StrongCard.tsx#L115),
[`StrongCard.tsx:156`](../../../src/features/bible/StrongCard.tsx#L156)). En revanche, depuis la page
de détail :

- un lien vers une autre entrée Strong ne transmet pas `strongBibleVersionId`
  ([`StrongDetailScreen.tsx:239`](../../../src/features/lexique/StrongDetailScreen.tsx#L239));
- « ouvrir dans un nouvel onglet » crée aussi un onglet sans cette source
  ([`StrongDetailScreen.tsx:336`](../../../src/features/lexique/StrongDetailScreen.tsx#L336),
  [`StrongDetailScreen.tsx:342`](../../../src/features/lexique/StrongDetailScreen.tsx#L342)).

La nouvelle page retombe alors sur la Bible Strong par défaut, donc une concordance ouverte depuis
DBY peut devenir LSG sans action explicite. Les entrées ouvertes depuis la recherche, les tags,
l’historique ou une relation n’ont volontairement pas de source et suivent correctement la Bible
Strong par défaut.

### P2 — Un deep link historique `version=LSGS` avec localisation perd le mode Strong

**Statut : compatibilité partielle confirmée.**

Les onglets persistés sont bien migrés de LSGS vers LSG + `visible`
([`tabs.ts:393`](../../../src/state/tabs.ts#L393)). Le facade de lecture normalise également LSGS
([`strongBiblePublications.ts:171`](../../../src/helpers/strongBiblePublications.ts#L171)).

Mais un `/bible-view` avec livre/chapitre résout d’abord le texte via `resolveBibleVerses`, en
interrogeant le code de version tel quel
([`BibleScreen.tsx:130`](../../../src/features/bible/BibleScreen.tsx#L130),
[`bibleVerseResolver.ts:78`](../../../src/helpers/bibleVerseResolver.ts#L78)). `bibles.sqlite` ne
normalise pas `LSGS`; il finit donc généralement par choisir LSG comme fallback, puis le transmet
avec le `strongMode` original, souvent absent
([`BibleScreen.tsx:170`](../../../src/features/bible/BibleScreen.tsx#L170)). Le passage s’ouvre en
LSG normal au lieu de LSG Strong.

**Correction sûre :** normaliser `requestedVersion` avec `resolveStrongBibleVersion` avant la
résolution des versets et fusionner son `strongMode`.

## Accès globaux intentionnels et chemins sûrs

- La recherche globale et la liste du lexique interrogent uniquement `Grec` et `Hebreu`
  ([`loadLexiqueBySearch.ts:19`](../../../src/helpers/loadLexiqueBySearch.ts#L19),
  [`loadLexiqueByLetter.ts:23`](../../../src/helpers/loadLexiqueByLetter.ts#L23)) : c’est conforme,
  pas un reste à migrer.
- Le modal de ressource obtient le verset et sa provenance via `strongBible.loadVerse`, donc le
  sidecar courant/fallback, puis utilise la base globale uniquement pour enrichir les codes en
  définitions ([`BibleVerseDetailCard.tsx:194`](../../../src/features/bible/BibleVerseDetailCard.tsx#L194),
  [`BibleVerseDetailCard.tsx:217`](../../../src/features/bible/BibleVerseDetailCard.tsx#L217)).
- Les écrans de concordance utilisent tous `strongBible.loadCountsByBook` et
  `strongBible.loadFoundVersesByBook`, pas les anciennes recherches `Texte LIKE`
  ([`ConcordanceScreen.tsx:62`](../../../src/features/bible/ConcordanceScreen.tsx#L62),
  [`ConcordanceByBookScreen.tsx:71`](../../../src/features/bible/ConcordanceByBookScreen.tsx#L71),
  [`StrongDetailScreen.tsx:155`](../../../src/features/lexique/StrongDetailScreen.tsx#L155)).
- Le lecteur LSG/DBY/DBR charge le texte canonique puis ajoute `StrongSpans`; une indisponibilité
  du sidecar ne fait pas planter le chapitre
  ([`bibleContentAccess.ts:119`](../../../src/features/resources/bibleContentAccess.ts#L119)).
- `loadFirstFoundVerses`, `loadFoundVersesByBook`, `loadStrongVerse`,
  `loadStrongVersesCount` et `loadStrongVersesCountByBook` interrogent encore
  `LSGSAT2`/`LSGSNT2`, mais aucun appel produit courant ne les invoque. Ils restent exposés par
  `StrongAccess` et constituent surtout une dette dangereuse pour de futurs appels
  ([`strongAccess.ts:35`](../../../src/features/resources/strongAccess.ts#L35),
  [`strongAccess.ts:61`](../../../src/features/resources/strongAccess.ts#L61)).

## Couverture et validations

Les suites ciblées actuelles passent : 5 suites, 26 tests
(`strongBibleResourceAccess`, `bibleContentAccess`, `BibleVerseDetailCard`, overlay et disponibilité).
Elles mockent toutefois toutes les frontières qui auraient révélé les défauts ci-dessus.

Couverture manquante à ajouter :

1. test d’intégration `BibleVerseDetailCard` avec `references=[]`;
2. requêtes de contrat contre un vrai sidecar mobile LSG/DBY/DBR, dont un verset sans alignement;
3. KJVS avec langue UI différente de `resourcesLanguage.STRONG`;
4. suppression/incompatibilité d’un sidecar pendant qu’un onglet est en mode visible;
5. suppression/remplacement d’un sidecar pendant les trois écrans de concordance;
6. propagation de `strongBibleVersionId` dans les liens et nouveaux onglets du détail Strong;
7. deep link localisé avec `version=LSGS`.

Il n’existe actuellement aucun test direct des requêtes SQLite de
`loadStrongBibleChapterSpans`, `loadStrongBibleVerseCountsByBook` ou
`loadStrongBibleOccurrenceLocations` contre le schéma de release : les tests du resource access
mockent ces trois fonctions.
