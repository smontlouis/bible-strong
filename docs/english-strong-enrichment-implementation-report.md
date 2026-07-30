# Enrichissement et assainissement Strong des neuf Bibles anglaises

Date de validation : 2026-07-30

## Résultat

Le candidat de publication des neuf sidecars anglais est disponible dans :

`outputs/releases/bible-strong-reverse-interlinear-v9-sanitized-candidate`

SHA-256 du catalogue :

`ad283d8de5c69e279269faf3ee2fb4e53385f5c87834d679cff1edcca65e3cbf`

Chaque sidecar contient désormais des liens `eStrong` (`kind=1`), `dStrong`
(`kind=2`) et `uStrong` (`kind=3`). Les identités enrichies sont matérialisées
seulement lorsqu'un porteur anglais peut être relié à un segment STEP concret.

ASV et Darby EN subissent en plus un assainissement du Strong classique :
les balises SWORD sans preuve STEP et sans correspondance lexicale fiable sont
retirées du sidecar publié. Cet assainissement explique pourquoi un article
comme `the` ne porte plus `H3117`.

## Cause racine

Deux problèmes indépendants se cumulaient.

1. Le projecteur SWORD ne produisait que l'attribut `strong`. Les sources
   intermédiaires ASV ne contenaient donc aucun `eStrong`, `dStrong` ou
   `uStrong`.
2. Le module SWORD ASV affecte très largement un Strong original aux mots
   anglais du groupe traduit, y compris aux articles, pronoms, prépositions et
   auxiliaires. Dans Genèse 1.5, la source attribuait ainsi `H3117` à
   `the`, `Day`, `the`, `he` et `day`. Ce n'était pas un bug d'affichage de
   l'application : ces liens existaient réellement dans la source projetée.

Le premier reverse-interlinear ajoutait seulement `stepTokenId`; il ne
matérialisait aucune identité enrichie dans `StrongCodes` et
`WordStrongCodes`. Son alignement pouvait aussi réutiliser un token STEP sur
plusieurs mots anglais et agrégeait plusieurs segments STEP au niveau du token.

L'absence initiale des kinds 1/2/3 était donc un manque du pipeline de
génération. La sur-affectation de `H3117` à `the` provenait de la granularité de
la source ASV, mais sa conservation aveugle dans le produit mobile était une
limitation du pipeline.

## Étapes responsables et correction

Le pipeline corrigé :

1. projette les modules SWORD vers le JSONL mobile dans
   `src/projectEnglishStrongMobileJsonl.ts` et
   `src/englishStrongLemmas.ts` ;
2. canonicalise les Strong anglais sans zéros de remplissage ;
3. traite les suffixes NASB minuscules comme `eStrong` tout en conservant le
   Strong classique de base ;
4. aligne les occurrences par Strong, ordre, lemme anglais et glosses STEP dans
   `src/reverseInterlinearMobile.ts` ;
5. conserve la granularité du segment STEP pour coupler glosses et identités ;
6. matérialise les identités non redondantes `kind=1/2/3` dans
   `StrongCodes` et `WordStrongCodes` ;
7. conserve le `stepTokenId` comme preuve de provenance ;
8. pour ASV et Darby EN seulement, conserve un Strong classique s'il possède
   une preuve d'alignement STEP ou si son lemme/POS correspond au vocabulaire
   lexical dominant de ce Strong ;
9. supprime sinon le lien classique et enregistre la décision dans un audit
   détaillé ;
10. valide et empaquette les neuf publications dans
    `src/packageReverseInterlinearStrongBibles.ts`.

La politique d'assainissement publiée est `step-segment-lexical@1`. Elle n'est
pas appliquée aux sept autres Bibles, dont la granularité source n'a pas le
profil massif de sur-balisage observé dans ASV et Darby EN.

## Comptages validés

Les cellules `kind` donnent `codes distincts / liens`.

| Bible | kind 0 | kind 1 | kind 2 | kind 3 | Couverture STEP |
|---|---:|---:|---:|---:|---:|
| KJV | 14 079 / 373 413 | 1 113 / 37 247 | 4 403 / 123 584 | 1 431 / 43 272 | 92,19 % |
| NASB2020 | 13 547 / 375 260 | 1 761 / 56 001 | 4 161 / 126 086 | 1 311 / 40 705 | 80,11 % |
| NASB1995 | 13 555 / 358 103 | 1 768 / 54 132 | 4 186 / 128 633 | 1 314 / 41 524 | 85,88 % |
| BSB | 13 867 / 435 307 | 1 123 / 57 951 | 4 405 / 147 569 | 1 456 / 46 808 | 97,28 % |
| ASV | 6 291 / 217 997 | 427 / 17 357 | 3 107 / 64 744 | 703 / 20 369 | 22,67 % |
| Darby EN | 6 228 / 216 810 | 412 / 17 287 | 2 968 / 64 191 | 673 / 20 134 | 22,44 % |
| RLT | 14 077 / 373 406 | 1 113 / 37 246 | 4 405 / 123 586 | 1 431 / 43 278 | 92,19 % |
| RWebster | 14 178 / 350 877 | 1 113 / 37 251 | 4 409 / 123 811 | 1 455 / 43 598 | 92,25 % |
| RV1895 | 10 511 / 401 886 | 563 / 33 612 | 3 582 / 105 264 | 1 112 / 33 473 | 65,84 % |

La couverture plus faible d'ASV et Darby EN est volontaire. Une égalité de
cardinalité, ou la simple présence d'un Strong sur un mot fonctionnel, ne
suffit pas à émettre une identité enrichie.

## Assainissement ASV et Darby EN

| Bible | Strong classiques source | Conservés par STEP | Conservés lexicalement | Supprimés | Dont mots fonctionnels | Dont incompatibilités lexicales |
|---|---:|---:|---:|---:|---:|---:|
| ASV | 681 149 | 154 415 | 63 582 | 463 152 | 353 030 | 110 122 |
| Darby EN | 679 619 | 152 531 | 64 279 | 462 809 | 357 950 | 104 859 |

Les égalités suivantes sont vérifiées à la publication :

- `source = conservés STEP + conservés lexicalement + supprimés` ;
- les liens `kind=0` finaux correspondent exactement aux deux catégories
  conservées ;
- aucun lien `kind=0` ne subsiste sur un POS fonctionnel dans ASV ou Darby EN.

Les décisions sont inspectables dans :

- `audits/asv-strong-sanitization.json` ;
- `audits/darby-strong-sanitization.json`.

Chaque audit contient les compteurs par Strong, la raison de conservation ou
de suppression et des échantillons de références/mots.

## Canari H3117 / H3117G

Dans ASV final :

- `H3117`, `kind=0` : 1 876 liens, exclusivement `day` (1 873) ou
  `days` (3) ;
- `H3117G`, `kind=2` : 1 549 liens, 1 342 versets ;
- `H3117G`, `kind=3` : 214 liens, 185 versets.

Dans Genèse 1.5, les deux segments STEP `H3117G` sont liés aux deux occurrences
de `day`. Les balises SWORD classiques placées sur `the` et `he` sont
supprimées. Dans Genèse 1.8, seul `day` reçoit l'identité.

La concordance `H3117G` n'est donc ni un fallback vers `H3117`, ni une
duplication des 6 646 liens bruts historiques. Chaque lien enrichi possède une
preuve de segment STEP.

Darby EN est traité pour la même raison structurelle : son module SWORD présente
le même profil de Strong répétés sur les groupes de traduction. Le traitement
n'est pas lié à la langue française ni à la Bible Darby française.

## Invariants et validations

La publication échoue désormais si :

- une Bible anglaise ne possède aucun lien pour l'un des kinds 1, 2 ou 3 ;
- un compteur d'identités ne correspond pas aux lignes SQLite ;
- une publication assainie n'enregistre pas la politique attendue ;
- les compteurs source/conservés/supprimés ne se recomposent pas exactement ;
- un Strong classique reste attaché à un POS fonctionnel dans ASV ou Darby EN ;
- l'audit attendu manque ou son hash ne correspond pas au catalogue.

Les validations exécutées sur chaque sidecar final :

- `PRAGMA integrity_check = ok` ;
- zéro ligne dans `pragma_foreign_key_check` ;
- `ResourceMetadata.identityCount = count(WordStrongCodes)` ;
- zéro Strong classique encore préfixé par un zéro de remplissage ;
- SHA-256 de chaque archive et de chaque audit conforme à `SHA256SUMS` ;
- tests de régression `the/day/the/he/day` et de frontière autour des notes ;
- tests de non-résolution des porteurs ambigus.

## Impact de taille et révisions

L'augmentation agrégée des neuf SQLite par rapport aux sidecars d'entrée est de
16,38 %. Le comportement diffère selon la qualité de la source :

- KJV/RLT/RWebster : environ +38 % ;
- NASB1995/NASB2020 : environ +33 à +35 % ;
- BSB : +41,61 % ;
- RV1895 : +28,75 % ;
- ASV : -24,73 % ;
- Darby EN : -24,85 %.

ASV et Darby EN rétrécissent malgré l'ajout des kinds 1/2/3, car la suppression
de plus de 460 000 liens classiques non fiables par Bible compense largement
les nouvelles identités enrichies.

Le schéma mobile reste en version 5. Chaque Bible reçoit une nouvelle
`strongRevision`, dérivée de sa révision de base, du builder
`reverse-interlinear-mobile-sanitized@9`, de la révision STEP, des runtimes
compatibles et des métriques finales.

## Limites et compromis

La correction retenue est conservatrice :

- elle offre une excellente précision sur les identités enrichies ;
- elle empêche les mots fonctionnels manifestement faux d'alimenter les
  concordances classiques ;
- elle réduit le rappel ASV/Darby lorsqu'aucune preuve STEP ou lexicale fiable
  n'existe.

Les alternatives rejetées :

- dupliquer `H3117` vers `H3117G`, qui mélangerait les sens ;
- conserver toutes les balises SWORD classiques, qui maintiendrait les faux
  positifs comme `the` ;
- attribuer les identités enrichies uniquement par ordre, trop fragile lorsque
  la traduction ajoute ou réorganise des mots.

Une amélioration future du rappel devra fournir une preuve plus forte, par
exemple un alignement original anglais explicitement adressé. Elle ne devra pas
réactiver le fallback `H3117G → H3117`.

## Plan de promotion

1. faire relire les audits ASV/Darby et les canaris ;
2. valider explicitement le candidat v9 ;
3. promouvoir les neuf archives, le catalogue et les checksums ensemble ;
4. incrémenter les révisions de ressources consommées par l'application ;
5. installer les sidecars dans un environnement de recette ;
6. vérifier les concordances `H3117`, `H3117G`, plusieurs mots fonctionnels et
   un échantillon de Strong rares ;
7. comparer les compteurs installés au catalogue avant diffusion.

Le candidat n'est pas promu automatiquement dans les ressources de production
de l'application.
