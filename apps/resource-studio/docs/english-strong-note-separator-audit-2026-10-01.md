# Mots collés autour des notes dans les Bibles anglaises SWORD

Date : 1er octobre 2026. Diagnostic hors ligne et correction de la génération ;
rien n'a été publié ni importé en production.

## Symptôme

La production sert pour `DARBY` des versets où « God » est collé au mot
précédent :

- `GET /v1/bibles/DARBY/books/40/chapters/4`, verset 4 : « …goes out
  through**God's** mouth. » ; verset 7 : « …the] Lord thy**God**. » ;
- Genèse 1:1 : « In the beginning**God** created… » ;
- Jean 20:17, 20:28 et 20:31.

Le même défaut existe, très marginalement, dans `RWEBSTER` (« In
the**beginning** God », Gen 1:1 ; Abd 1:10) et `BSB` (« into the
web.**Then** », Jg 16:14).

## Cause racine

Ce n'est pas un `<divineName>` : le module Darby n'en contient aucun. Ce sont
des notes de bas de page qui portent le nom divin hébreu (`Elohim`, `El`,
`Eloah`) et qui sont collées des deux côtés dans la source SWORD :

```xml
<w lemma="strong:H7225">beginning</w><note placement="foot"><reference
type="annotateRef">1.1 </reference><w lemma="strong:H430">Elohim</w></note><w
lemma="strong:H430">God</w>
```

- `pysword` renvoie ce fragment tel quel (`clean=False`, aucun `strip`) et
  `scripts/extract_sword_rich_bibles.py` le conserve octet pour octet ;
  l'espace n'est donc perdu ni à l'extraction ni dans la couche riche.
- La source eBible d'origine (`ebible.org/engDBY`) contient l'espace, avant
  le marqueur : « In the beginning °God », « me, — °God », « my fathers'
  °God ». L'espace a disparu lors de la conversion USFM → OSIS du module
  CrossWire Darby 2.0 (2020-12-21, « New source from ebible.org »).
- `parseStrongBibleMarkup()` retire ensuite légitimement chaque `<note>` et
  chaque `<ref>` du texte canonique pour en faire un événement positionné. Les
  deux mots voisins se retrouvent alors adjacents dans `text`.

Le défaut est donc une omission de la source, rendue visible par la
projection. La correction appartient à `projectSwordOsisMarkup()` : la couche
riche reste une copie sans perte du module, et le parseur canonique commun aux
Bibles françaises n'est pas modifié.

## Quantification

Chaîne complète rejouée localement à partir des neuf archives SWORD épinglées
(SHA-256 vérifiés) : extraction riche → `projectSwordOsisMarkup()` →
`enrichEnglishStrongMarkup()` → `compileStrongBibleMobilePublication()`.
La reconstruction reproduit exactement les `textRevision` servies en
production pour DARBY, BSB et RWEBSTER, ce qui prouve que ces artefacts
viennent bien de cette chaîne.

| Bible    |  Notes | Espaces restaurés | Versets touchés | `textRevision` actuelle (prod)  | Après correction                 |
| -------- | -----: | ----------------: | --------------: | ------------------------------- | -------------------------------- |
| DARBY    |  4 296 |             4 258 |           3 676 | `darby-c154ea76fe98519f61ad`    | `darby-8928d05c012d0bf9191e`     |
| RWEBSTER |  7 881 |                 2 |               2 | `rwebster-ca0e35e6107b68df4fec` | `rwebster-eaf60f3981714dc5cb7a`  |
| BSB      |  4 817 |                 1 |               1 | `bsb-64705565357e807a011e`      | `bsb-a80fae6fe44fb1af93b8`       |
| KJV      |  6 959 |                 0 |               0 | inchangée                       | JSONL identique octet pour octet |
| NASB2020 | 61 635 |                 0 |               0 | inchangée                       | JSONL identique octet pour octet |
| NASB1995 | 61 296 |                 0 |               0 | inchangée                       | JSONL identique octet pour octet |
| ASV      |     16 |                 0 |               0 | inchangée                       | JSONL identique octet pour octet |
| RLT      |  6 899 |                 0 |               0 | inchangée                       | JSONL identique octet pour octet |
| RV1895   |     16 |                 0 |               0 | inchangée                       | JSONL identique octet pour octet |

Détail DARBY :

- 2 505 versets dans l'Ancien Testament, 1 171 dans le Nouveau ; livres les
  plus touchés : Psaumes (368), Deutéronome (320), Genèse (184), 2 Chroniques
  (163), Actes (157), Romains (136).
- Mot suivant : `God` 3 855, `gods` 224, `God's` 80, `god` 74, `godly` 12,
  `goddess` 4, `godliness` 4, `godless` 2, `Godhead` 2, `god's` 1.
- Note concernée : `Elohim` 3 982, `El` 222, `Eloah` 54.
- Caractère précédent : lettre 4 103, `,` 98, `]` 29, `:` 15, `.` 4, `?` 4,
  `;` 3, `—` 1, `'` 1.
- Les 38 notes restantes en début de verset (« ⟦note⟧God is not a man… »)
  n'ont pas de mot à gauche et ne sont pas touchées.

Les 3 notes RWEBSTER/BSB sont deux renvois croisés (`crossReference`) placés
avant le mot et une note BSB après la fin de phrase.

## Correction

`projectSwordOsisMarkup()` restaure un séparateur, juste avant la note, lorsque
le texte visible de part et d'autre d'une `<note>` ou d'une `<ref>` de premier
niveau n'est séparé par aucune espace et que :

- le caractère suivant est une lettre ou un chiffre, et le précédent une
  lettre, un chiffre ou une marque combinante ;
- ou le caractère suivant est une lettre et le précédent une ponctuation de fin
  de proposition (`. , ; : ! ?`), une ponctuation fermante (`) ] }`) ou un
  guillemet fermant (`’ ”`) ;
- ou le précédent est un guillemet droit qui suit un mot (`fathers'`) ;
- ou le précédent est un tiret espacé (`me, —`).

Restent intacts : guillemets et parenthèses ouvrants (`“⟦note⟧Let`,
`(⟦note⟧the`), tirets non espacés de NASB/BSB (`sons--⟦note⟧Simeon`), notes
suivies de ponctuation, notes déjà espacées et notes de bord de verset. Des
notes consécutives ne reçoivent qu'un séparateur.

L'espace est inséré avant la note, comme dans la source eBible : la note reste
attachée au mot qu'elle annote (« beginning ⓘGod »). Pour l'unique cas BSB,
dont la note commente la phrase précédente, le texte est corrigé mais le
marqueur se retrouve devant « Then » plutôt qu'après « web. ».

Le résumé de projection (`mobile-jsonl/catalog.json`) expose désormais
`restoredSeparatorCount` par Bible : 4 258 pour `darby-en`, 2 pour
`rwebster`, 1 pour `bsb`, 0 ailleurs.

## Vérification

- Régression : `tests/projectEnglishStrongMobileJsonl.test.ts` rejoue
  Genèse 1:1 Darby à l'octet près (texte canonique et offset de note), les
  variantes de ponctuation attestées et les cas négatifs NASB/BSB. Les trois
  nouveaux tests échouent sur la version précédente et passent avec la
  correction.
- Différence canonique avant/après pour les trois Bibles : uniquement des
  espaces insérés, chacun à l'offset d'une note ; nombres de notes, en-têtes,
  `layout` et `startTags` inchangés ; offsets des notes décalés exactement du
  nombre d'espaces insérés avant elles.
- Sidecars Strong reconstruits : même nombre de spans (DARBY 679 619, BSB
  412 259, RWEBSTER 347 013), surfaces de mots identiques, aucun span bordé
  d'espace ; seuls les offsets changent.
- Après correction : zéro note entre deux mots collés et zéro différence de
  séquence de mots entre texte canonique et source espacée, sur les neuf
  modules.
- `yarn typecheck` passe. Les échecs restants de `yarn test` concernent des
  fichiers qui n'importent pas la projection (données locales lexicon v3 et
  catalogue mobile en cours de modification par ailleurs).

## Ce qu'il faut régénérer

Changer le texte change `textSha256`, donc `textRevision`. Conformément à
l'ADR-0013, le JSON canonique et son sidecar Strong doivent être reconstruits
et publiés ensemble pour DARBY, BSB et RWEBSTER. Aucune de ces étapes n'a été
exécutée en production.

1. Source riche : inchangée. Si `outputs/imports/english-sword/rich-source/`
   est absent, `yarn strong:english:extract-rich` la recrée depuis les
   archives épinglées.
2. Projection : `yarn strong:english:jsonl`. Contrôler `restoredSeparatorCount`
   (4 258 / 2 / 1 / 0) et l'identité octet pour octet des six autres JSONL.
3. JSON canonique + sidecar couplés : `yarn strong:english:reverse-interlinear`
   vers un nouveau nom de release (la lignée sanitized@9 ; ne jamais écraser
   un release existant).
4. Raffinement lexical : `yarn strong:english:lexemes:refine` avec la politique
   acceptée (`english-lexeme-refinement@9` / `english-wordnet-context-pos@8`),
   parent explicite, nouveau nom de release (par exemple v19). Les surfaces
   étant inchangées, le digest logique des décisions devrait rester
   `617295063c1884bd6f89fa7ca01f90b6b69b9e7e6fe7089d9103c9edaafb8f79` ;
   tout écart doit être expliqué avant promotion. Les six Bibles non touchées
   doivent ressortir identiques et ne pas être republiées.
5. Artefacts hébergés : nouveaux `bible-darby.json.zip`,
   `bible-darby-strong.sqlite.zip` et équivalents BSB/RWEBSTER sous des URL
   versionnées (cache iOS), puis mise à jour de
   `config/mobile-resource-inventory.json` (`bible:*` et `bible-strong:*`).
6. Bundles de publication : bundle Bible ordinaire (`bible:DARBY`, `bible:BSB`,
   `bible:RWEBSTER`) puis bundle Strong lié à la nouvelle révision de texte
   (`resources:publication:strong-bibles`). Import, upload et activation
   restent du ressort du Resource service.
7. Application Expo : remplacer les tuples épinglés DARBY, BSB et RWEBSTER
   (canonique et Strong) dans
   `apps/expo/src/helpers/strongBiblePublications.ts` et
   `apps/expo/src/helpers/strongBibleReverseInterlinearCandidate.ts`.
8. Annotations de mots : la nouvelle révision déclenche la migration
   journalisée de l'ADR-0013. Les annotations des 3 676 versets DARBY touchés
   se décalent au plus d'une espace par note précédente ; le réalignement par
   texte mémorisé devrait les retrouver, et les cas ambigus restent visibles
   sans être supprimés.
9. Dépendances indexées par offsets : `workflows/words-of-jesus/data/darby.jsonl`
   (non versionné, en cours de construction) cible le texte DARBY anglais par
   empreinte de verset et intervalles de caractères. 167 de ses 2 050
   enregistrements tombent dans des versets modifiés (Matt 4:4, 4:7, 4:10,
   5:8…) et doivent être réalignés contre la nouvelle révision. Les versets
   modifiés de BSB et RWEBSTER (Jg 16:14, Gn 1:1, Ab 1:10) ne contiennent pas
   de paroles de Jésus.
