# Audit échantillonné des lemmes/POS anglais — KJV et ASV

Date de décision : 2026-07-30

## Statut courant

Le candidat
`bible-strong-reverse-interlinear-v18-wordnet-context-candidate` passe les
gates mécanique et sémantique sur exactement les 100 identités du premier
audit v10 :

- statut mécanique : `pass`;
- statut sémantique : `pass`;
- 172 630 occurrences identité–mot et 133 929 spans uniques;
- 4 707 spans modifiés par rapport à v10, dont 4 199 KJV et 508 ASV;
- zéro POS vide ou indéterminé;
- zéro coordonnée source manquante;
- zéro occurrence finale `name` sans forme propre reconnue;
- 77 785 accords avec la morphologie STEP contre 75 227 dans v10;
- 2 844 améliorations et 286 éloignements de STEP;
- 8 désaccords dominants KJV/ASV avant et après, avec 2 résolus et 2 nouveaux.

La morphologie STEP reste un témoin diagnostique, pas la vérité du POS
anglais. Les 286 éloignements sont principalement des clitiques possessifs
(`Abraham’s`, `Christ’s`, etc.) dont le lemme technique `s` est maintenant
`particle`; le Strong source reste naturellement celui du nom possédé.

Artefact autoritatif :

`outputs/audits/english-lexeme-pos-kjv-asv-v18-same-sample-100-v9`

SHA-256 :

- `audit.json` :
  `318bd193e364f7cc171964bf96eecf37ae1ae9c9c45f53bfe359759d96fc54ec`;
- `report.md` :
  `27cd4df46a4a32a8bf4358378aba5a308e5488938a1e03a66236f8d824cff60b`.

Reproduction exacte :

```sh
npm run strong:english:lexemes:audit -- \
  --before-release outputs/releases/bible-strong-reverse-interlinear-v10-lexeme-refined-candidate \
  --after-release outputs/releases/bible-strong-reverse-interlinear-v18-wordnet-context-candidate \
  --output-dir outputs/audits/<nouveau-dossier-immuable> \
  --sample-from outputs/audits/english-lexeme-pos-kjv-asv-v10-sample-100-v3/audit.json \
  --generated-at 2026-07-30T00:00:00.000Z
```

Le fichier passé à `--sample-from` fige les mêmes 100 identités; le seed seul
ne suffit pas si la strate « correction-heavy » change entre releases.

## Statut historique v10

Le candidat
`bible-strong-reverse-interlinear-v10-lexeme-refined-candidate` est
**mécaniquement valide mais sémantiquement non promouvable en l'état**.

Le contrôle de 100 identités Strong partagées par KJV et ASV conclut :

- statut mécanique : `pass`;
- statut sémantique : `remediation-required`;
- aucun POS vide ou indéterminé;
- aucune coordonnée v9 manquante;
- mais des corrections systématiques erronées vers `name`.

Cette conclusion ne remet pas en cause la règle produit : chaque occurrence
doit continuer à publier un POS concret. Les erreurs identifiées doivent être
corrigées dans une nouvelle génération additive, jamais remplacées par un POS
indéterminé.

## Audit existant et audit ajouté

Le release v10 possédait déjà :

- un audit JSON exhaustif de toutes les corrections pour chaque Bible;
- l'index SQLite partagé des décisions et corrections;
- les canaris globaux `H430G`, `Jehovah`, entités et POS indéterminés.

Ces artefacts disent exactement **ce qui a été modifié et pourquoi**, mais ne
constituent pas un contrôle qualité représentatif : ils n'échantillonnent pas
les occurrences inchangées, ne comparent pas v9/v10 sur les mêmes Strong et
n'affichent pas les surfaces anglaises.

La commande suivante ajoute ce second niveau :

```sh
npm run strong:english:lexemes:audit
```

Implémentation :

- `src/auditEnglishStrongLexemeSample.ts`;
- `tests/auditEnglishStrongLexemeSample.test.ts`.

Artefact autoritatif de ce run :

`outputs/audits/english-lexeme-pos-kjv-asv-v10-sample-100-v3`

SHA-256 :

- `audit.json` :
  `d07c3dbd1f83f81a983857f95ad6a3d8be84bfabe7965ad0fdcc283ed2bdf009`;
- `report.md` :
  `75542a7e192b2989601f3c977ba4d8732c916f53d21fce224f3346cb7859f139`.

Les runs `...sample-100` et `...sample-100-v2` sont conservés comme historique
additif, mais sont obsolètes. Le premier ne normalisait pas la casse des codes
`eStrong` (`H1121a`/`H1121A`); le v2 corrige ce comptage; le v3 ajoute le
diagnostic sémantique et les désaccords résiduels.

## Échantillonnage reproductible

Seed :

`english-lexeme-pos-kjv-asv-2026-07-30`

L'univers contient 3 179 identités lexicales partagées, présentes au moins dix
fois dans chaque Bible. Les 100 identités sont sélectionnées ainsi :

- 4 canaris partagés : `H430G`, David, Moses et Christ;
- 35 identités très corrigées;
- 20 identités très fréquentes;
- 20 identités hébraïques déterministes;
- 20 identités grecques déterministes;
- 1 identité de remplissage déterministe.

`H3068` n'est pas une identité lexicale partagée après l'assainissement ASV :
le contrôle `Jehovah` reste donc un canari global du release, et non une strate
partagée.

La commande refuse d'écraser un dossier existant. Un nouveau run doit utiliser
un nouveau `--output-dir`.

## Résultats chiffrés

| Mesure                             |                  Résultat |
| ---------------------------------- | ------------------------: |
| Identités Strong                   |                       100 |
| Occurrences identité–mot           |                   172 630 |
| Spans anglais uniques              |                   133 929 |
| Spans corrigés v9 → v10            |                     2 724 |
| Corrections KJV                    |                     1 524 |
| Corrections ASV                    |                     1 200 |
| POS v10 vides ou indéterminés      |                         0 |
| Coordonnées v9 manquantes          |                         0 |
| Accords morphologiques STEP avant  | 74 665 / 88 492 (84,37 %) |
| Accords morphologiques STEP après  | 75 227 / 88 492 (85,01 %) |
| Améliorations vers l'accord STEP   |                     1 436 |
| Éloignements de STEP à revoir      |                       874 |
| Désaccords dominants KJV/ASV avant |                        10 |
| Désaccords dominants KJV/ASV après |                         8 |
| Désaccords résolus                 |                         2 |
| Nouveaux désaccords                |                         0 |

La morphologie STEP est un témoin diagnostique, pas une obligation : une
traduction anglaise peut légitimement changer de catégorie grammaticale. Le
gain net de 562 accords et l'absence de nouveau désaccord KJV/ASV montrent que
le consensus est utile. Ils ne compensent cependant pas les faux `name`
systématiques décrits ci-dessous.

## Défaut bloquant découvert

Dans l'échantillon, 1 012 corrections ont produit `name` alors qu'aucune forme
du lemme dans le span ne commence par une majuscule :

| Méthode           | Nombre |
| ----------------- | -----: |
| `divine-identity` |    468 |
| `entity-registry` |    544 |

Principaux lemmes :

| Lemme      | Nombre |
| ---------- | -----: |
| `god`      |    468 |
| `sabbath`  |    221 |
| `passover` |     94 |
| `river`    |     90 |
| `hell`     |     35 |
| `lord`     |     33 |
| `man`      |     31 |
| `great`    |     25 |

Exemples attestés :

- `gods`, `my gods`, `a god` : `noun -> name`;
- `the man` : `noun -> name`;
- `upon their rivers` : `noun -> name`;
- `the passover` : `noun -> name`;
- `a sabbath` : `noun -> name`.

Les formes `god/gods` sont un défaut certain au regard du contrat publié :
`H430G + God` doit être `name`, tandis que les emplois communs `god/gods`
doivent être `noun`.

## Causes racines

### Perte de la surface dans la règle divine

`FrenchLexemes.lemma` contient le lemme normalisé `god`, y compris lorsque la
surface est `gods`. La politique v10 décide actuellement `name` à partir de ce
lemme singulier et ne lit pas le texte canonique. Elle ne peut donc pas
distinguer `God` de `god/gods`.

### Registre d'entités utilisé comme preuve POS suffisante

Une correspondance entre identité et alias d'entité est utile pour reconnaître
une entité, mais elle ne suffit pas à conclure que l'emploi anglais courant est
un nom propre. Des alias comme `man`, `river`, `sabbath`, `passover`, `hell` ou
`great` entrent en collision avec des noms communs ou adjectifs.

Le registre doit rester une preuve d'identité; la surface, la casse, la
morphologie et le contexte doivent décider si l'occurrence anglaise reçoit
`name`.

### POS provisoires résiduels

Huit couples identité+lemme restent dominants différemment entre KJV et ASV.
Les identités visibles dans l'échantillon incluent notamment `G3588`, `G2532`,
`G846`, `G2087` et `H4682`. Ces divergences n'ont pas été créées par le
raffinement; elles montrent les limites du repli obligatoire sur le tagger.
Elles doivent alimenter une file de corrections additives, sans publier
`unknown`.

## Correctif additif requis

Le prochain candidat doit être un v11 distinct et appliquer les règles
suivantes :

1. lire la surface exacte depuis la Bible canonique à l'aide de
   `startOffset`/`length`;
2. pour `H430G`, publier `name` uniquement pour l'emploi divin `God`, et
   `noun` pour les surfaces communes `god/gods`;
3. ne jamais promouvoir une occurrence en `name` sur le seul fait qu'un alias
   du registre d'entités correspond;
4. exiger une preuve de surface compatible avec un nom propre, ou un override
   éditorial explicitement versionné;
5. utiliser la morphologie nominale/adjectivale comme garde-fou renforcé
   lorsqu'une surface minuscule serait changée en `name`;
6. ajouter des canaris négatifs pour `gods`, `man`, `river`, `passover`,
   `sabbath`, `hell`, `lord` commun et `great`;
7. rejouer le même audit de 100 identités avec le même seed.

Le v11 ne sera promouvable que si :

- les invariants mécaniques restent à zéro;
- les faux `name` certains ci-dessus disparaissent;
- tout `name` minuscule résiduel est justifié par une liste d'exceptions
  auditée;
- le nombre de nouveaux désaccords KJV/ASV reste nul;
- aucun POS vide ou indéterminé n'est introduit.

## Résolution du défaut et lignée additive

Le « prochain candidat v11 » décrit ci-dessus est une exigence historique.
Plusieurs générations ont été nécessaires et sont toutes conservées :

| Candidat | Résultat                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| v11      | WordNet trop large; classes fermées altérées                                                                              |
| v12      | réduction insuffisante du périmètre                                                                                       |
| v13      | garde contextuelle encore trop faible                                                                                     |
| v14      | décisions lexicales uniques encore renversées                                                                             |
| v15      | 3 155 `name` minuscules dans le même échantillon                                                                          |
| v16      | aucun `name` minuscule, mais priorité STEP erronée pour des formes anglaises certaines et noms propres composés déclassés |
| v17      | règles anglaises prioritaires et composés conservés, mais `Behold` capitalisé restait `name`                              |
| v18      | garde des noms propres restreinte aux vrais composés, `Behold→verb`, gates passées                                        |

Les exemples qui ont fait rejeter v16 sont désormais explicitement couverts :

- `saith` et `liveth` restent `verb`, même si STEP vote `noun` ou `adj`;
- `ye`, `thee` et `whosoever` sont `pron`;
- `unto` est `prep`, `lest` est `conj`, `lo` est `interj`;
- `Kiriath-jearim`, `Beth-shemesh`, `Ben-hadad`, `Obed-edom`, etc. restent
  `name`;
- `God` reste `name`, tandis que `god/gods` sont `noun`;
- aucun conflit ne produit un POS indéterminé : le cas conserve une valeur
  concrète et, s'il est de faible marge, reste dans l'index de diagnostic.
