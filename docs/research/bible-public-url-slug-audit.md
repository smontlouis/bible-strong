# Audit des identifiants de livres dans les URLs publiques

Date : 2026-09-19

## Recommandation

Bible Strong devrait utiliser une identité de livre invariante, fondée sur l’OSIS déjà
présent dans le dépôt, et la normaliser en minuscules dans les URLs :

```text
/bible/lsg/john/3
/bible/lsg/john/3/16
/bible/lsg/strong/john/3/16
```

Ici, `John` est l’ID canonique ; `john` est seulement sa forme URL. `jean`, `jhn`, les
noms français, les short names et les abréviations historiques doivent rester des alias
d’entrée, redirigés vers une URL canonique unique.

Le slug localisé (`jean`) apporte surtout de la lisibilité pour une audience française.
Les recommandations Google autorisent les mots localisés, mais ne permettent pas de
conclure à un bénéfice SEO matériel ou mesurable. Google indique en outre que la langue
est principalement déterminée par le contenu visible, pas par l’URL. L’audit ne mesure
pas les classements : aucune donnée Search Console, backlink ou expérimentation A/B n’a
été utilisée.

## État du dépôt

Le dépôt possède déjà plusieurs couches, à ne pas confondre :

| Couche                         | Source                                                                                          | Exemple Jean                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------- |
| Catalogue Expo                 | [`books-desc.ts`](../../apps/expo/src/assets/bible_versions/books-desc.ts)                      | `Numero: 43`, `Nom: 'Jean'` ; 77 livres |
| Short names / alias            | [`books.json`](../../apps/expo/src/assets/bible_versions/books.json)                            | `jhn`, `john`, `jean`                   |
| OSIS parser                    | [`osisReference.ts`](../../packages/bible-reference-parser/src/osisReference.ts)                | `John`                                  |
| IDs Resource Studio            | [`books.ts`](../../apps/resource-studio/src/books.ts)                                           | `John`                                  |
| Registre éditorial français    | [`frenchEditorialPolicy.ts`](../../apps/resource-studio/src/lexiconV3/frenchEditorialPolicy.ts) | `John` ↔ `Jean`                         |
| Route publique avant cet audit | [`publicBibleRoutes.ts`](../../apps/expo/src/features/bible/publicBibleRoutes.ts)               | slug dérivé du français : `jean`        |

Les 66 IDs OSIS principaux sont :

```text
Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth
Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph
Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim
2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev
```

Le parser prend aussi en charge `Tob`, `Jdt`, `Wis`, `Sir`, `Bar`, `1Macc`, `2Macc`,
`1Esd`, `3Macc`, `4Macc` et `PssSol`, mappés vers les livres 67–77. Les short names
explicites incluent notamment `gen`, `exo`, `jhn`, `1co`, `1jn`, `rev`, `1esd`, `3ma`,
`4ma` et `pss`; le fichier [`books.json`](../../apps/expo/src/assets/bible_versions/books.json)
reste la source complète de ces triplets anglais/français.

Le parser documente également les alias français hérités `1Ro`, `2Ro`, `Esr`, `Can`,
`Ézé` et `Osé` ([README](../../packages/bible-reference-parser/README.md)). Ils sont
compatibles avec des références historiques, mais ne doivent pas devenir des URLs
canoniques.

L’ADR-0053 définit `/bible/:version/:book/:chapter`, les variantes passage, Strong et
reverse-interlinear, ainsi que `/strong/:code`. À la suite de cet audit, il retient l’OSIS
minuscule comme chemin généré et les noms localisés comme alias. Les redirections HTTP,
métadonnées et politiques d’indexation restent une décision séparée
([ADR-0053](../../docs/adr/0053-add-canonical-public-bible-and-strong-routes)).

## URLs observées

Échantillon : Jean/John 3.

| Service           | URL française                                                                      | URL anglaise                                                                       | Observation                                                 |
| ----------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| YouVersion        | [`JHN.3.LSG`](https://www.bible.com/fr/bible/93/JHN.3.LSG)                         | [`JHN.3.NIV`](https://www.bible.com/bible/111/JHN.3.NIV)                           | `JHN` reste invariant ; le titre visible devient Jean/John. |
| BibleGateway      | [`search=Jean+3`](https://www.biblegateway.com/passage/?search=Jean+3&version=LSG) | [`search=John+3`](https://www.biblegateway.com/passage/?search=John+3&version=NIV) | Référence en query string.                                  |
| BibleHub          | —                                                                                  | [`/john/3.htm`](https://biblehub.com/john/3.htm)                                   | Nom anglais lisible dans le chemin.                         |
| BibleServer       | [`/LSG/Jean3`](https://www.bibleserver.com/LSG/Jean3)                              | [`/NIV/John3`](https://www.bibleserver.com/NIV/John3)                              | Nom du livre localisé.                                      |
| AELF              | [`/bible/Jn/3`](https://www.aelf.org/bible/Jn/3)                                   | —                                                                                  | Abréviation française/catholique `Jn`.                      |
| Blue Letter Bible | —                                                                                  | [`/nkjv/jhn/3/1/`](https://www.blueletterbible.org/nkjv/jhn/3/1/)                  | Version + `jhn` + chapitre + verset.                        |

Il n’existe donc pas de convention de marché unique. YouVersion illustre toutefois une
bonne séparation entre identité technique (`JHN`) et libellé localisé.

## SEO, langues et alias

Google recommande des URLs simples, logiques, lisibles, avec des mots descriptifs et des
tirets plutôt que des identifiants numériques opaques ([URL Structure Best Practices](https://developers.google.com/search/docs/crawling-indexing/url-structure)).
Cela favorise `/bible/lsg/john/3/16` par rapport à `/bible/lsg/43/3/16`, mais ne prouve
aucun gain de classement lié au mot `john` ou `jean` lui-même.

Google autorise les mots localisés dans les URLs et recommande des URLs distinctes pour
des pages réellement multilingues, reliées par `hreflang` ([Managing multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites),
[Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions)).
La locale ne doit toutefois pas être confondue avec la version biblique : `LSG` ou `NIV`
identifie le texte, tandis que `fr` ou `en` identifie l’interface et les métadonnées.

Pour les doublons, Google recommande de choisir une canonique et d’utiliser redirections,
`rel="canonical"` et sitemap de manière cohérente ([Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization),
[Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)).

Donc :

- `/jean` et `/john` pour exactement la même page ne devraient pas être deux URLs
  indexables ; l’un doit rediriger vers l’autre ;
- `/fr/...` et `/en/...` sont justifiés si le contenu, la navigation et les métadonnées
  sont réellement localisés ; chaque variante doit alors avoir sa canonique et ses liens
  `hreflang` réciproques ;
- un slug ne remplace ni le contenu traduit, ni le titre, ni le `h1`, ni le rendu
  indexable.

## Options

| Option                | Exemple                   | Verdict                                                                                      |
| --------------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| Slug français unique  | `/bible/lsg/jean/3/16`    | Compatible avec le public actuel, mais implicitement francophone et coûteux à faire évoluer. |
| Slug invariant OSIS   | `/bible/lsg/john/3/16`    | Recommandé : lisible, stable et déjà aligné sur parser/Resource Studio.                      |
| Abréviation technique | `/bible/lsg/jhn/3/16`     | Bon alias entrant ; moins clair et non identique à l’OSIS canonique `John`.                  |
| Numéro de catalogue   | `/bible/lsg/43/3/16`      | À réserver au stockage/API ; peu lisible et couplé au catalogue.                             |
| Locale + OSIS         | `/fr/bible/lsg/john/3/16` | Cible future si Bible Strong publie de vraies pages françaises et anglaises.                 |

## Mise en œuvre recommandée

1. Créer un registre `osisId ↔ displayName[locale] ↔ aliases ↔ publicSlug` avec une
   contrainte d’unicité.
2. Faire de l’OSIS minuscule le seul slug généré par les liens internes et le partage.
3. Résoudre `jean`, `john`, `jhn`, les short names et les alias historiques vers le même
   livre canonique.
4. Rediriger les anciennes routes françaises vers la nouvelle URL ; ne pas servir de
   doublons indexables en 200.
5. Ajouter `/fr` et `/en` uniquement lorsque les pages sont réellement localisées, avec
   canonique et `hreflang` cohérents.
6. Mesurer ensuite indexation, sélection canonique, impressions et clics dans Search
   Console ; ne pas présumer d’un uplift SEO.

Cette stratégie conserve la compatibilité de l’ADR-0053 tout en évitant de faire dépendre
l’identité publique d’un catalogue français ou d’un numéro interne.

## Sources primaires

- [ADR-0053 — routes publiques Bible/Strong](../../docs/adr/0053-add-canonical-public-bible-and-strong-routes)
- [Résolution actuelle des routes Bible](../../apps/expo/src/features/bible/publicBibleRoutes.ts)
- [Catalogue et alias du dépôt](../../apps/expo/src/assets/bible_versions/books.json)
- [Support OSIS partagé](../../packages/bible-reference-parser/src/osisReference.ts)
- [IDs Resource Studio](../../apps/resource-studio/src/books.ts)
- [CrossWire — OSIS Book Abbreviations](https://wiki.crosswire.org/OSIS_Book_Abbreviations)
- [Google — URL Structure](https://developers.google.com/search/docs/crawling-indexing/url-structure)
- [Google — sites multilingues](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- [Google — versions localisées](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google — canonicalisation](https://developers.google.com/search/docs/crawling-indexing/canonicalization)
