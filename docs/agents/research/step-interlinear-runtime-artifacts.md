# Artefacts STEP TAHOT/TAGNT pour le nouvel interlinéaire

_Recherche réalisée le 24 juillet 2026 à partir du générateur, des releases locales et des
consommateurs actuels de l’application._

## Conclusion

La release intégrée est
[`bible-step-interlinear-runtime-v4`](../../../../bible-lexicon-maker/outputs/releases/bible-step-interlinear-runtime-v4/catalog.json),
pas le ledger d’authoring. Elle matérialise déjà exactement le modèle envisagé :

- `bible-step.json` est une Bible autonome en langues originales ;
- `bible-step-interlinear-fr.sqlite` et `bible-step-interlinear-en.sqlite` sont deux projections
  localisées du même index interlinéaire ;
- le JSON et les SQLite sont appariés par `textSha256`; les deux SQLite partagent les mêmes
  identifiants de verset, token et segment.

Le texte de lecture peut donc être installé seul. Le mode avancé télécharge seulement l’index de la
langue souhaitée. Les anciens `INT` et `INT_EN` exposent au contraire deux grosses bases SQLite
autonomes et dupliquent le texte original.

## Artefacts exacts

Le contrat et les commandes sont documentés par
[`docs/step-interlinear-release.md`](../../../../bible-lexicon-maker/docs/step-interlinear-release.md)
et générés par
[`src/stepInterlinearRuntimePublication.ts`](../../../../bible-lexicon-maker/src/stepInterlinearRuntimePublication.ts).
La commande est `npm run strong:release:step-interlinear:runtime`.

| Artefact runtime v4 | Taille | SHA-256 |
| --- | ---: | --- |
| `bible-step.json` | 7 305 397 octets | `0b52f772b5484ee4c420d9234b760cb2aec022e1add3e0e23fb6b65ee513f811` |
| `bible-step-interlinear-fr.sqlite` | 46 215 168 octets | `572070e8396d89e5cfd82ca87203ddaa298a6c3b167fab6fd8ef3e3ef0676593` |
| `bible-step-interlinear-en.sqlite` | 47 038 464 octets | `b751644d51e21b624d878515e76e5f095ce725dcd164e7ad863a722f9173b285` |

Le répertoire contient aussi `catalog.json`, avec `schemaVersion=3`, les hashes du ledger et des
sources, les compteurs et la politique des gloses françaises. Le runtime contient 31 210 versets,
443 239 tokens canoniques, 607 175 segments et 868 863 identités.

Le générateur V4 crée des archives ZIP déterministes séparées :

| Archive séparée | Taille mesurée |
| --- | ---: |
| `bible-step.json.zip` | 1 783 949 octets |
| `bible-step-interlinear-fr.sqlite.zip` | 19 781 886 octets |
| `bible-step-interlinear-en.sqlite.zip` | 20 176 808 octets |

Les archives séparées correspondent au modèle canonique + sidecar déjà pris en charge dans
[`downloadBibleToSqlite.ts`](../../../src/helpers/downloadBibleToSqlite.ts) et
[`strongBibleSidecar.ts`](../../../src/helpers/strongBibleSidecar.ts). Une archive commune des
trois fichiers ferait 29 605 024 octets, mais obligerait chaque lecteur à télécharger les deux
langues et empêcherait l’installation indépendante de l’index.

## Contrat du JSON

`bible-step.json` est un objet imbriqué compatible avec le format biblique plat existant :

```json
{
  "1": {
    "1": {
      "1": "בְּרֵאשִׁ֖ית בָּרָ֣א …"
    }
  }
}
```

Les clés sont `bookOrder -> chapter -> verse`, sur 66 livres. L’Ancien Testament vient de TAHOT
(hébreu et araméen) et le Nouveau de TAGNT (grec). Le texte ne contient ni Strong ni données
interlinéaires. Il contient toutefois 116 versets `0`, principalement les suscriptions des Psaumes;
le futur contrat de lecture doit explicitement les conserver ou décider leur présentation.

Les offsets SQLite sont des unités de code UTF-16 et découpent exactement ces chaînes JSON. Les
applications doivent refuser une paire dont le `ResourceMetadata.textSha256` ne correspond pas au
hash du JSON.

## Schéma SQLite runtime V4

Les deux locales ont exactement la même structure :

- `ResourceMetadata(key, value)` : schéma, locale, source TAHOT/TAGNT, hash texte, compteurs,
  politiques et hashes de provenance ;
- `Verses(id, bookOrder, bookId, chapter, verse, ref)` ;
- `Tokens(id, verseId, readingOrdinal, startOffset, length)` ;
- `Segments(id, tokenId, ordinal, startOffset, length, transliterationId, lemmaId,
  morphologyId, glossId, strongCodeId, eStrongCodeId, dStrongCodeId, uStrongCodeId)` ;
- tables internées `Transliterations`, `Lemmas`, `Morphologies`, `Glosses`, `StrongCodes`.

La surface originale n’est pas dupliquée dans SQLite : `Tokens.startOffset/length` la découpe dans
le verset JSON, puis `Segments.startOffset/length` découpe les sous-segments dans le token. Chaque
segment fournit translittération, lemme exact, morphologie STEP compacte, glose localisée et jusqu’à
quatre identités (`strong`, `estrong`, `dstrong`, `ustrong`). L’explication longue des 2 122 codes de
morphologie doit être résolue depuis les tables déjà présentes dans le lexique de production.

Différence entre les deux SQLite :

- anglais : glose contextuelle TAHOT/TAGNT ;
- français : 381 516 gloses contextuelles alignées sur Sg1910/DarbyR/Darby et 225 659 replis sur la
  glose lexicale française dStrong.

### Indexation mobile

Le runtime V4 ajoute les index adaptés aux accès `Verses(bookOrder, chapter, verse)`,
`Tokens(verseId, readingOrdinal)` et `Segments(tokenId, ordinal)`. La requête mobile charge ainsi
un chapitre par les clés de relation plutôt que de scanner les 607 175 segments.

## Provenance et licence

Le ledger est construit depuis les quatre fichiers TAHOT et les deux fichiers TAGNT listés dans
[`stepInterlinearPublication.ts`](../../../../bible-lexicon-maker/src/stepInterlinearPublication.ts).
Les en-têtes locaux indiquent « Data created by www.STEPBible.org based on work at Tyndale House
Cambridge (CC BY 4.0) » et demandent de référer les utilisateurs vers `github.com/STEPBible`.
La fiche de téléchargement et les mentions légales conservent cette attribution. Le
`catalog.json` V4 la porte aussi sous forme structurée avec la licence et l’URL source.

## Ce qui est remplacé dans l’application

Les versions actuelles sont `INT` et `INT_EN` dans
[`bibleVersions.ts`](../../../src/helpers/bibleVersions.ts). Chacune pointe vers un
`interlineaire.sqlite` localisé
([`firebase.ts`](../../../src/helpers/firebase.ts),
[`requireBiblePath.ts`](../../../src/helpers/requireBiblePath.ts)) et
[`loadInterlineaireChapter.ts`](../../../src/helpers/loadInterlineaireChapter.ts) lit une table
unique `INTERLINEAIRE(Livre, Chapitre, Verset, Texte)`.

Les fichiers CDN historiques font environ 20,96 Mo (français) et 22,03 Mo (anglais). Leur champ
`Texte` encode chaque mot avec des séparateurs `@` et `#`; le rendu le reparcourt dans
[`InterlinearVerse.tsx`](../../../src/features/bible/BibleDOM/InterlinearVerse.tsx) et
[`InterlinearVerseComplete.tsx`](../../../src/features/bible/BibleDOM/InterlinearVerseComplete.tsx).
Ce format ne correspond pas au nouveau schéma relationnel.

Les principaux points de remplacement sont :

1. fusionner les deux identités visibles `INT`/`INT_EN` en une seule version biblique originale,
   dont la Bible canonique est importée depuis `bible-step.json`;
2. remplacer le cas spécial `INTERLINEAIRE` de
   [`bibleContentAccess.ts`](../../../src/features/resources/bibleContentAccess.ts) par une lecture
   normale du JSON, puis un overlay optionnel de tokens/segments;
3. remplacer la disponibilité, le téléchargement et la suppression spéciaux dans
   [`resourceAvailability.ts`](../../../src/features/resources/resourceAvailability.ts),
   [`downloadItemFactory.ts`](../../../src/helpers/downloadItemFactory.ts),
   [`resourceDatabaseInstallation.ts`](../../../src/helpers/resourceDatabaseInstallation.ts) et
   [`VersionSelectorItem.tsx`](../../../src/features/bible/VersionSelectorItem.tsx) par le modèle
   « Bible de base + index interlinéaire localisé »;
4. faire consommer aux deux rendus interlinéaires des objets structurés plutôt que la chaîne
   `@/#`, tout en conservant l’ouverture du lexique à partir des identités Strong;
5. adapter les conditions codées en dur `version === 'INT' || version === 'INT_EN'` dans
   `Verse.tsx`, `BibleDOMComponent.tsx` et `bibleReadingChapter.ts`.

Le nom produit reste à décider. Le dataset interne peut rester `STEP`; un identifiant applicatif
stable distinct du nom affiché évitera une nouvelle migration lorsque le libellé sera choisi.
