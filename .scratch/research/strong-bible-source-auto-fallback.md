# Pourquoi la modale affiche « Automatique · LSG » depuis DBY

## Règle exacte

Dans la modale de ressources, le choix Strong manuel du tab (`strongBibleSourceVersionId`) est transmis comme préférence, tandis que la version biblique ouverte est transmise comme version courante. La carte demande explicitement l’ordre de repli correspondant à la langue de la Bible ouverte (`getStrongBibleFallbackPriority(selectedVersion)`) ([`ResourceModal.tsx:298-320`](../../src/features/bible/resources/ResourceModal.tsx#L298), [`ResourceModal.tsx:382-388`](../../src/features/bible/resources/ResourceModal.tsx#L382), [`BibleVerseDetailCard.tsx:202-211`](../../src/features/bible/BibleVerseDetailCard.tsx#L202)).

Pour `DBY` :

- `DBY` est la Darby française et possède le dataset Strong `DBY` ([`bibleVersions.ts:253-262`](../../src/helpers/bibleVersions.ts#L253)).
- La priorité française publiée est `LSG, DBY, DBR`; `getStrongBibleFallbackPriority` choisit cette liste pour toute version absente de l’ensemble anglais, ce qui est le cas de `DBY` ([`strongBiblePublications.ts:35-50`](../../src/helpers/strongBiblePublications.ts#L35), [`strongBiblePublications.ts:643-663`](../../src/helpers/strongBiblePublications.ts#L643)).
- Le résolveur construit, dans l’ordre, `[préférence manuelle, version courante, Bible Strong par défaut, ...replis de la langue courante]`, supprime les doublons, puis prend le premier sidecar dont le statut est `available` ([`strongBibleResourceAccess.ts:152-183`](../../src/features/resources/strongBibleResourceAccess.ts#L152)).

Donc, sans préférence manuelle, les candidats effectifs sont :

1. `DBY` — version ouverte ;
2. `LSG` — premier repli français restant après dédoublonnage ;
3. `DBR`.

Si le sidecar DBY n’est pas installé, sa disponibilité vaut `missing`; si LSG est disponible, le résolveur retourne LSG avec `isFallback: true` ([`strongBibleSidecar.ts:68-88`](../../src/helpers/strongBibleSidecar.ts#L68), [`strongBibleResourceAccess.ts:180-189`](../../src/features/resources/strongBibleResourceAccess.ts#L180)). Le test de référence couvre précisément « DBY manquante, LSG disponible » et attend une provenance LSG en fallback ([`strongBibleResourceAccess-test.ts:70-97`](../../src/features/resources/__tests__/strongBibleResourceAccess-test.ts#L70)).

Si LSG n’est pas disponible non plus, le résolveur essaie DBR. S’il n’existe aucun candidat disponible, il retourne `unavailable` au lieu d’imposer LSG ([`strongBibleResourceAccess-test.ts:194-223`](../../src/features/resources/__tests__/strongBibleResourceAccess-test.ts#L194)).

## Libellé UI versus source réellement lue

Le bouton ne choisit pas lui-même LSG. En mode automatique, il affiche simplement `Automatique · {{version}}` à partir de la `resolvedProvenance` remontée après le chargement ([`StrongBibleSourceSelector.tsx:110-125`](../../src/features/bible/resources/StrongBibleSourceSelector.tsx#L110)). Avant que cette provenance arrive, il affiche seulement `Automatique`.

Cette provenance correspond ici à la source effectivement lue : après résolution, `loadVerse` utilise le `versionId` résolu pour charger **le texte canonique et les spans Strong** ([`strongBibleResourceAccess.ts:197-218`](../../src/features/resources/strongBibleResourceAccess.ts#L197)). La carte renvoie ensuite cette même provenance à la modale, qui alimente le bouton ([`BibleVerseDetailCard.tsx:250-267`](../../src/features/bible/BibleVerseDetailCard.tsx#L250)). Ainsi, « Automatique · LSG » signifie bien : sélection automatique active, contenu Strong actuellement chargé depuis LSG.

## Deux nuances

- Une préférence manuelle disponible passe avant DBY. Si elle est indisponible, le résolveur continue vers DBY puis les replis ([`strongBibleResourceAccess-test.ts:130-192`](../../src/features/resources/__tests__/strongBibleResourceAccess-test.ts#L130)).
- À l’ouverture de la modale ou du sélecteur, une préférence manuelle dont le sidecar n’est plus disponible est effacée, ce qui réactive le mode automatique ([`StrongBibleSourceSelector.tsx:381-421`](../../src/features/bible/resources/StrongBibleSourceSelector.tsx#L381)). La Bible Strong globale par défaut est transmise à la requête et reste prioritaire sur les replis linguistiques, même lorsque la carte fournit explicitement `fallbackVersionIds`. La langue des replis dépend toujours de la Bible actuellement ouverte, pas de la langue de cette préférence globale ([`BibleVerseDetailCard.tsx:202-208`](../../src/features/bible/BibleVerseDetailCard.tsx#L202), [`strongBibleResourceAccess.ts:152-169`](../../src/features/resources/strongBibleResourceAccess.ts#L152)).
