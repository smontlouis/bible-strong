# Source de la Vulgate clémentine

_État de la recherche : 20 juillet 2026._

## Conclusion

La source recommandée est le **dépôt officiel du Clementine Text Project**, figé au
commit `edc85da058be630183d26e4deb6714ade80e600c`.

- Dépôt : [Clementine Text Project — Text](https://bitbucket.org/clementinetextproject/text/src/master/)
- Commit immuable :
  [`edc85da058be630183d26e4deb6714ade80e600c`](https://bitbucket.org/clementinetextproject/text/commits/edc85da058be630183d26e4deb6714ade80e600c)
- Archive déterministe à utiliser :
  [`edc85da058be630183d26e4deb6714ade80e600c.tar.gz`](https://bitbucket.org/clementinetextproject/text/get/edc85da058be630183d26e4deb6714ade80e600c.tar.gz)
- SHA-256 observé le 20 juillet 2026 :
  `bd7c226655a51424fdb195f38000e7a215d48ec8c88391227c85418b7e7db0c7`
- Taille observée : `1 516 963` octets.

Cette source est préférable aux paquets CrossWire, eBible ou `open-bibles` : elle vient
directement du projet qui a créé et relu la transcription, possède un historique Git,
est plus récente que ces redistributions et porte une déclaration explicite de domaine
public.

Elle contient exactement les **73 livres du canon catholique**, sans la Prière de
Manassé ni III–IV Esdras. Esther possède 16 chapitres, Daniel 14 et la Lettre de Jérémie
est intégrée comme Baruch 6.

## Identité exacte du texte

Le projet identifie la référence clémentine définitive comme l’_Editio Typica_ publiée
par le Typographus Vaticanus en 1598. Sa transcription électronique n’est cependant pas
un fac-similé diplomatique du volume de 1598 : elle a été établie principalement depuis
l’édition Colunga–Turrado de 1946, avec consultation de Vercellone 1861 et Hetzenauer
1914 pour les lectures douteuses. Le projet a également pris ses propres décisions de
ponctuation, paragraphes, graphie, usage de `j` et ligatures `æ`/`œ`.

Source :
[page officielle du Clementine Text Project, sections « The version of the text » et « Editorial decisions »](https://bitbucket.org/clementinetextproject/website/raw/ac930d3f78d163f9cd9cf6067ed94e6708ebc9e9/htdocs/index.html).

La désignation exacte à publier devrait donc être :

> Vulgate clémentine — transcription du Clementine Text Project, fondée sur
> l’Editio Typica de 1598 et principalement sur Colunga–Turrado 1946.

Il serait trop fort de la présenter comme une transcription caractère pour caractère de
l’impression de 1598.

## Situation juridique

### Texte historique

L’édition de référence date de 1598. Le texte historique est donc sorti depuis longtemps
des durées ordinaires de protection patrimoniale. Le risque utile à examiner n’était pas
le texte latin ancien lui-même, mais les choix et le travail de la transcription
électronique moderne.

### Transcription numérique

Le Clementine Text Project déclare explicitement avoir placé **le texte** dans le
domaine public. Il demande l’attribution de la source, le signalement des erreurs et
l’indication des modifications, tout en précisant que ces demandes ne sont imposées par
aucune licence.

Source :
[déclaration officielle « Copyright and licensing »](https://bitbucket.org/clementinetextproject/website/raw/ac930d3f78d163f9cd9cf6067ed94e6708ebc9e9/htdocs/index.html).

La fiche SourceForge affiche « GPLv2 », mais cette licence concerne le logiciel
**VulSearch**, pas le texte biblique. La page officielle distingue expressément :

- le texte : domaine public, sans obligations de licence ;
- le logiciel VulSearch : GPL v2 ou ultérieure.

Il ne faut donc pas déclarer le JSON sous GPL. Les métadonnées du corpus devraient
indiquer `Public Domain`, accompagnées de l’URL de la déclaration officielle.

Précaution conseillée, même si elle n’est pas juridiquement imposée :

```text
Source text: Clementine Text Project
Source revision: edc85da058be630183d26e4deb6714ade80e600c
Source status: Public Domain
Converted and normalized for Bible Strong; formatting markers removed.
```

Cette recherche constitue une vérification de provenance technique, pas un avis
juridique. La source ne fournit pas de fichier SPDX ou CC0 autonome ; sa déclaration
publique est néanmoins directe, explicite et émise par le créateur de la transcription.

## Artifact et format

Le dépôt de premier niveau explique que le sous-dépôt `Text` contient le texte
clémentin brut et documente le format :
[README officiel](https://bitbucket.org/clementinetextproject/vulsearch4/raw/f72f9d829b76c28bb4cc7074f8fa860a7ff04ffe/README.md).

Caractéristiques vérifiées sur l’archive figée :

| Propriété | Valeur |
|---|---|
| Fichiers bibliques | 73 fichiers `.lat` |
| Encodage | Windows-1252 |
| Fins de ligne | CRLF |
| Structure | une ligne par référence, `chapitre:verset texte` |
| Enregistrements | 35 809 |
| Clés dupliquées | aucune |
| Séquentialité | chapitres et versets séquentiels ; chaque chapitre commence à 1 |
| Métadonnées dans le texte | marqueurs éditoriaux inline, pas de JSON/XML |

Toutes les lignes bibliques correspondent à la forme `^[0-9]+:[0-9]+ `. Le format est
donc simple à convertir de manière déterministe, malgré l’encodage ancien.

### Marqueurs éditoriaux

Le texte utilise :

- `\` pour une rupture de paragraphe ;
- `[` et `]` pour encadrer une section poétique ;
- `/` pour une rupture de ligne poétique ;
- `<...>` pour un locuteur ou une indication telle que `<Prologus>`.

Le générateur JSON doit prendre une décision explicite pour ces marqueurs. Pour le
format actuel de Bible Strong, la stratégie la plus sûre est :

1. convertir Windows-1252 vers UTF-8 ;
2. conserver tout le contenu lexical ;
3. transformer les ruptures `\` et `/` en espaces normalisés ;
4. retirer uniquement les délimiteurs `[` et `]`, sans supprimer leur contenu ;
5. traiter les balises `<...>` selon leur nature au lieu de supprimer aveuglément le
   texte qu’elles contiennent ;
6. signaler dans le manifeste que le formatage éditorial a été normalisé.

Attention particulière : Lamentations et le Siracide placent un `<Prologus>` au début
de `1:1`. Le
[README officiel](https://bitbucket.org/clementinetextproject/vulsearch4/raw/f72f9d829b76c28bb4cc7074f8fa860a7ff04ffe/README.md)
le documente. Il faut décider si ce prologue est conservé dans `1:1`, exposé comme
métadonnée ou omis de façon déclarée.

## Canon et ordre des livres

La page officielle indique que seuls les livres canoniques sont présents. L’ordre de
publication du projet est conservé dans son
[fichier officiel `data.txt`](https://bitbucket.org/clementinetextproject/scripts/raw/e3e49c88644ce2439f65e4a94112714db45f4da0/data.txt).

Les sept livres absents d’un canon protestant à 66 livres sont :

| Fichier source | Livre | Chapitres | Enregistrements |
|---|---|---:|---:|
| `Tob.lat` | Tobie | 14 | 298 |
| `Jdt.lat` | Judith | 16 | 346 |
| `Sap.lat` | Sagesse | 19 | 439 |
| `Sir.lat` | Siracide / Ecclésiastique | 51 | 1 592 |
| `Bar.lat` | Baruch | 6 | 213 |
| `1Mcc.lat` | 1 Maccabées | 16 | 929 |
| `2Mcc.lat` | 2 Maccabées | 15 | 558 |

L’ordre clémentin du corpus n’est pas « les 66 livres puis les 7 livres
deutérocanoniques ». Les positions pertinentes sont :

- Tobie, Judith, Esther ;
- Sagesse et Siracide après le Cantique ;
- Baruch après les Lamentations et avant Ézéchiel ;
- 1–2 Maccabées après Malachie et avant Matthieu.

Les IDs internes supérieurs à 66 peuvent rester stables, mais l’application doit
afficher les livres selon cet ordre canonique indépendant de leurs IDs.

## Esther, Daniel et Baruch

### Esther

`Est.lat` contient les additions dans le même livre :

- 16 chapitres ;
- 275 enregistrements ;
- chapitres 11–16 présents, plutôt qu’un livre séparé.

Le mapping attendu est donc l’ID existant d’Esther, avec une couverture allant jusqu’au
chapitre 16.

### Daniel

`Dn.lat` intègre les parties deutérocanoniques :

- chapitre 3 jusqu’au verset 100, incluant la prière et le cantique ;
- chapitre 13 jusqu’au verset 65, Suzanne ;
- chapitre 14 jusqu’au verset 42, Bel et le Dragon.

Le mapping attendu est l’ID existant de Daniel, avec 14 chapitres.

### Baruch 6

`Bar.lat` contient six chapitres. La Lettre de Jérémie est intégrée comme Baruch 6
jusqu’au verset 72 ; elle ne doit pas recevoir un identifiant de livre séparé.

Les fichiers sources correspondants sont directement consultables dans le dépôt :
[Esther](https://bitbucket.org/clementinetextproject/text/raw/edc85da058be630183d26e4deb6714ade80e600c/Est.lat),
[Daniel](https://bitbucket.org/clementinetextproject/text/raw/edc85da058be630183d26e4deb6714ade80e600c/Dn.lat) et
[Baruch](https://bitbucket.org/clementinetextproject/text/raw/edc85da058be630183d26e4deb6714ade80e600c/Bar.lat).

## Appendice

L’artifact recommandé ne contient pas :

- `Oratio Manassæ` ;
- `Esdræ III` ;
- `Esdræ IV`.

Ce choix est intentionnel : la page officielle précise que le projet publie uniquement
les livres canoniques, alors que certains volumes imprimés ajoutent ces trois ouvrages
en appendice.

Ils ne doivent donc pas être inventés ni importés depuis une autre édition pendant la
première génération du JSON. S’ils sont ajoutés plus tard, ils devront constituer une
ressource `appendix` distincte avec leur propre source, licence et provenance.

## Source indépendante de validation

Pour contrôler quelques versets sensibles sans remplacer la source principale, la
transcription Hetzenauer 1914 de SacredBible.org constitue un bon oracle indépendant :

- [identité de l’édition et déclaration de domaine public](https://www.sacredbible.org/vulgate1914/version.htm) ;
- [index des 73 livres](https://www.sacredbible.org/vulgate1914/index.htm) ;
- [documentation des fichiers et de leur redistribution](https://www.sacredbible.org/vulgate1914/technical.htm).

SacredBible.org déclare le texte et ses fichiers HTML dans le domaine public et autorise
leur téléchargement, usage et redistribution. Son format HTML livre par livre est
cependant moins pratique et moins traçable qu’un commit Git du Clementine Text Project.
Il est donc recommandé comme contrôle ponctuel, pas comme entrée principale.

## Alternatives écartées comme entrée principale

### CrossWire SWORD

Le module officiel
[`VulgClementine`](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=VulgClementine)
indique correctement le Clementine Vulgate Project comme source et `Public Domain` comme
licence de distribution. Toutefois, il est fourni dans un format SWORD compressé,
nécessite des outils supplémentaires et correspond à une version 2017 du texte. Il est
utile comme validation secondaire, pas comme source de génération.

### Redistributions USFX

Les redistributions USFX sont plus faciles à parser, mais elles introduisent un
intermédiaire de provenance, peuvent être plus anciennes et ne transportent pas toujours
la déclaration juridique complète du créateur de la transcription. Le gain de parsing
ne compense pas la perte de traçabilité, puisque le format `.lat` officiel est déjà
simple.

## Chaîne de provenance recommandée

```text
Clementine Text Project
  commit edc85da058be630183d26e4deb6714ade80e600c
    archive tar.gz + SHA-256
      conversion Windows-1252 → UTF-8
        normalisation déclarée des marqueurs éditoriaux
          JSON Bible Strong + manifeste de génération
            publication sur le CDN
```

Le manifeste de génération devrait au minimum conserver :

- l’URL de l’archive ;
- le commit intégral ;
- le SHA-256 de l’entrée ;
- la déclaration `Public Domain` et son URL de preuve ;
- la date de génération ;
- la version du générateur ;
- le nombre de livres, chapitres et versets ;
- la liste des transformations textuelles ;
- le SHA-256 du JSON produit.

Cette chaîne suffit pour générer un candidat d’import de la Vulgate clémentine pour
Bible Strong sans mélanger des éditions ni dépendre d’une source juridiquement ambiguë.
