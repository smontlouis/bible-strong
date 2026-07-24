# Format des renvois bibliques dans les notes canoniques V3

_Recherche réalisée le 24 juillet 2026 à partir des artefacts V3, du code de
Bible Strong et des spécifications OSIS officielles._

## Mise en œuvre

L’application normalise désormais les bornes relatives présentes dans les
artefacts V3 avant d’exposer les attributs `<ref>` ou de calculer une
destination de navigation :

- `Rom.5.13-17` devient `Rom.5.13-Rom.5.17` ;
- `Rom.8.1-11` devient `Rom.8.1-Rom.8.11` ;
- `Rom.1-8` devient `Rom.1-Rom.8`.

Cette normalisation côté lecture assure la compatibilité avec les fichiers V3
déjà publiés. Les plages multichapitres continuent volontairement d’ouvrir leur
première borne tant que le viewer reste fondé sur un chapitre courant unique.

## Réponse courte

Le contenu de l’attribut `id` des balises V3 `<ref>` est **majoritairement une
référence de passage au format OSIS** :

```xml
<ref id="Gen.1.21">v. 21</ref>
<ref id="Isa.6.9-Isa.6.10">Ésaïe 6. 9-10</ref>
<ref id="Exod.16">Exode 16</ref>
```

L’enveloppe XML n’est toutefois pas l’enveloppe OSIS normative. OSIS 2.1.1
emploie un élément `<reference>` et un attribut `osisRef`, par exemple
`<reference osisRef="Gen.1.1">…</reference>`. Dans les données V3,
`<ref id="…">` est donc un balisage interne qui transporte généralement une
**valeur OSIS**.

Pour ouvrir ces renvois, il ne faut pas reparcourir leur libellé français avec
le BCV Parser. L’identifiant est déjà une valeur machine indépendante de la
langue. Le chemin correct est celui qui existe actuellement :

1. lire `ref@id` ;
2. le convertir directement avec `osisToBibleReferenceTarget` ;
3. ouvrir `/bible-view` avec `book`, `chapter`, `verse` et, lorsque la plage
   reste dans un chapitre, `focusVerses`.

Il faut en revanche normaliser trois identifiants DBY abrégés lors de la
génération, et décider l’expérience attendue pour quinze plages DBR qui
traversent plusieurs chapitres.

## Ce que dit réellement OSIS

La page officielle de CrossWire désigne OSIS 2.1.1 comme la version actuelle du
schéma et renvoie vers son XSD et son manuel
([page OSIS officielle](https://www.crosswire.org/osis/)).

Le schéma officiel définit :

- l’élément de lien biblique sous le nom `reference`, avec un attribut
  `osisRef` ;
- `osisRefType` comme une **liste** de valeurs `osisRefRegex` ;
- une plage comme deux bornes complètes séparées par `-`.

([documentation XSD officielle](https://www.crosswire.org/osis/schemas/osisCore.2.1.1.xsd.html),
[manuel OSIS 2.1.1, annexe K](https://crosswire.org/osis/OSIS%202.1.1%20User%20Manual%2006March2006.pdf)).

CrossWire donne notamment les exemples suivants :

```xml
<reference osisRef="Gen.1.1">Genesis 1:1</reference>
<reference osisRef="Ps.119">Psalm 119</reference>
<reference osisRef="Prov.1-Prov.9">Proverbs 1-9</reference>
<reference osisRef="2Cor.6.14-2Cor.7.1">...</reference>
```

La documentation précise que les parties sont séparées par des points et que
les deux bornes d’une plage répètent le livre et le chapitre
([documentation CrossWire des références scripturaires](https://wiki.crosswire.org/OSIS_Genbooks#Scripture_References)).

Ainsi :

- `Rom.5.13-Rom.5.17` est une plage OSIS complète ;
- `Rom.5.13-17` est un raccourci humain, pas une plage OSIS complète ;
- plusieurs destinations OSIS peuvent théoriquement être placées dans un
  `osisRef` sous forme de liste séparée par des espaces, mais les artefacts V3
  inspectés mettent chaque destination dans sa propre balise `<ref>`.

## Inventaire réel des artefacts V3

Artefacts inspectés :

- `../bible-lexicon-maker/outputs/releases/bible-strong-mobile-v3-candidate/bibles/bible-dby.json.zip`
- `../bible-lexicon-maker/outputs/releases/bible-strong-mobile-v3-candidate/bibles/bible-dbr.json.zip`
- `../bible-lexicon-maker/outputs/releases/bible-strong-mobile-v3-candidate/bibles/bible-lsg.json.zip`

Chaque balise `<ref>` rencontrée possède uniquement un attribut `id`. Aucun
`osisRef`, identifiant multiple séparé par un espace, une virgule ou un
point-virgule n’a été trouvé.

| Artefact | Occurrences `<ref>` | Cibles uniques | Détail des cibles uniques |
|---|---:|---:|---|
| DBY | 1 044 | 789 | 681 versets, 8 chapitres, 97 plages complètes, 3 plages abrégées |
| DBR | 2 894 | 2 313 | 1 698 versets, 42 chapitres, 565 plages de versets, 8 plages de chapitres |
| LSG | 0 | 0 | Aucun renvoi |

### Formes normales présentes

- Verset : `Gen.1.21`
- Chapitre : `Exod.16`
- Plage dans un chapitre : `Isa.6.9-Isa.6.10`
- Plage entre chapitres : `Gen.11.29-Gen.12.4`
- Plage de chapitres : `1Kgs.16-1Kgs.21`
- Livres numérotés : `1Cor.15.45`, `2Kgs.17.24`, `3John.1.2`

Le libellé visible n’est pas une source fiable pour la navigation. Il peut être
relatif au contexte de la note :

```xml
<ref id="Gen.1.21">v. 21</ref>
<ref id="Gen.1.24">24</ref>
<ref id="Gen.2.19">2. 19</ref>
```

L’attribut `id` contient déjà la cible complète ; c’est lui qu’il faut ouvrir.

### Trois cibles DBY non conformes à une plage OSIS complète

| Valeur actuelle | Libellé | Normalisation recommandée |
|---|---|---|
| `Rom.1-8` | `chap. 1 à 8` | `Rom.1-Rom.8` |
| `Rom.5.13-17` | `v. 13 à 17` | `Rom.5.13-Rom.5.17` |
| `Rom.8.1-11` | `v. 1 à 11` | `Rom.8.1-Rom.8.11` |

Le runtime actuel ouvre tout de même la première borne de ces trois cibles,
mais ne peut pas construire correctement leur sélection complète.

### Quinze plages DBR traversent plusieurs chapitres

Huit plages de chapitres :

```text
1Kgs.16-1Kgs.21
2Sam.11-2Sam.12
Exod.7-Exod.12
Judg.11-Judg.16
Judg.4-Judg.8
Judg.7-Judg.8
Ps.111-Ps.112
Rev.2-Rev.3
```

Sept plages de versets interchapitres :

```text
Acts.27.1-Acts.28.16
Dan.2.4-Dan.7.28
Exod.2.1-Exod.3.10
Exod.33.12-Exod.34.9
Ezra.4.8-Ezra.6.18
Gen.11.29-Gen.12.4
Isa.8.23-Isa.9.1
```

Ces valeurs sont bien formées comme cibles OSIS. La limite se trouve dans le
modèle de navigation actuel, qui ne possède qu’un chapitre courant et une
liste de versets focalisés dans ce chapitre.

## Chemin d’ouverture déjà présent dans l’application

Le parseur structuré des notes conserve les attributs XML, sauf `ref@id` dont
les éventuelles bornes relatives sont normalisées en OSIS complet
([`canonicalBibleNotes.ts:64`](../../../src/helpers/canonicalBibleNotes.ts#L64),
[`canonicalBibleNotes.ts:82`](../../../src/helpers/canonicalBibleNotes.ts#L82)).

La bottom sheet :

- lit `node.attributes.id` ;
- rend le contenu de `<ref>` comme lien ;
- transmet directement cet identifiant au callback.

([`CanonicalBibleNoteSheet.tsx:73`](../../../src/features/bible/CanonicalBibleNoteSheet.tsx#L73)).

Le viewer appelle ensuite `osisToBibleReferenceTarget`, ferme la note et pousse
une route `/bible-view`
([`BibleViewer.tsx:732`](../../../src/features/bible/BibleViewer.tsx#L732)).

Le convertisseur direct :

- traduit les codes de livres OSIS en numéros internes ;
- prend le premier passage comme point d’ouverture ;
- transforme une plage ou une séquence située dans un seul chapitre en
  `focusVerses` ;
- ouvre une référence de chapitre sur son verset 1 ;
- renvoie `undefined` pour un livre non pris en charge.

([`bcvParser.ts:67`](../../../src/helpers/bcvParser.ts#L67),
[`bcvParser.ts:89`](../../../src/helpers/bcvParser.ts#L89),
[`bcvParser.ts:107`](../../../src/helpers/bcvParser.ts#L107),
[`bcvParser.ts:146`](../../../src/helpers/bcvParser.ts#L146)).

Les plages interchapitres ouvrent volontairement leur première borne sans
`focusVerses`, comportement couvert par un test
([`bcvParser-test.ts:157`](../../../src/helpers/__tests__/bcvParser-test.ts#L157)).

## Faut-il utiliser le BCV Parser ?

### Non pour `ref@id`

`parseInlineBibleReferences` et la dépendance
`bible-passage-reference-parser` servent à reconnaître une référence **dans du
texte humain** français ou anglais, puis à produire de l’OSIS
([`bcvParser.ts:42`](../../../src/helpers/bcvParser.ts#L42),
[`bcvParser.ts:207`](../../../src/helpers/bcvParser.ts#L207)).

La documentation du projet amont décrit exactement cet usage : repérer une
chaîne comme `John 3:16`, gérer les ambiguïtés et la convertir en forme machine
([documentation officielle du BCV Parser](https://github.com/openbibleinfo/Bible-Passage-Reference-Parser)).

Faire repasser `Gen.1.21` ou `Rom.5.13-Rom.5.17` dans ce parseur :

- ne fournit aucune information supplémentaire ;
- réintroduit inutilement une langue de parsing ;
- peut rendre le résultat dépendant d’heuristiques destinées à des saisies
  humaines.

Le bon outil est donc le petit convertisseur déterministe
`osisToBibleReferenceTarget`.

### Oui pour une référence dépourvue de cible machine

Le BCV Parser reste approprié si une future source ne fournit que du texte tel
que `voir Romains 5, 13-17`. Dans ce cas, la génération devrait convertir une
fois ce texte en OSIS, valider la cible et publier ensuite un `id` complet.
Cette interprétation ne devrait pas être répétée sur le téléphone.

## Recommandation

1. **Conserver le chemin runtime actuel** : `ref@id` →
   `osisToBibleReferenceTarget` → `/bible-view`.
2. **Déclarer explicitement dans le schéma V3** que `ref@id` doit contenir une
   cible OSIS complète, même si l’enveloppe reste le format interne
   `<ref id="…">`.
3. **Normaliser les trois plages DBY abrégées**. Le lecteur le fait désormais
   pour assurer la compatibilité des artefacts déjà publiés ; une prochaine
   génération devrait également publier directement les bornes complètes.
4. **Valider les références dans le pipeline de publication**. La validation
   V3 actuelle vérifie la présence et les offsets des notes, mais pas la
   grammaire de leurs cibles internes.
5. **Conserver le comportement actuel pour les plages interchapitres** tant que
   le produit accepte « ouvrir au début de la plage ». Si l’on veut afficher
   toute la plage, il faut étendre le contrat de la route et du viewer à une
   sélection multichapitre ; changer de parseur ne résoudra pas cette limite.
6. **Ne pas parser le libellé visible** (`v. 21`, `24`, `2. 19`) : il est
   contextuel et parfois volontairement abrégé.

En résumé : ce sont des **cibles OSIS dans une balise interne**, et
l’application les ouvre après une normalisation structurée des anciennes
bornes relatives. Le travail restant concerne la validation du pipeline de
publication et, si le besoin produit apparaît, un viewer multichapitre.
