# ISBE et Translation Words — intégration dictionnaire

_Acquisition et audit exécutés le 31 août 2026. Aucune publication en production n’a été effectuée._

## International Standard Bible Encyclopedia

- Source numérique : module SWORD `ISBE` 2.2 de
  [CrossWire](https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/ISBE.zip).
- SHA-256 : `4de747545d9c349ab724bc1708b01df5481e3b93e5e51077f859dd8a32023a32`.
- Licence déclarée par le module : `Public Domain`.
- SourceType : TEI ; encodage : UTF-8.
- Œuvre historique dirigée par James Orr, publiée en 1915. Elle est présentée comme encyclopédie
  historique, pas comme état actuel de la recherche biblique.

Les 9 380 notices sont conservées séparément. La conversion transforme les paragraphes et les
sous-titres TEI en HTML sûr, les renvois `ISBE:` en liens de mots et les `osisRef` en références
contrôlées par le BCV parser. Le résultat contient 100 792 liens `bible://`, 6 079 renvois internes
et un index couvrant 34 551 versets.

Révision du paquet local validé : `dictionary-isbe-en-cd07667689f5b1ac93d8`.

## Translation Words

- Source : release stable [`unfoldingWord/en_tw` v90](https://git.door43.org/unfoldingWord/en_tw/releases/tag/v90),
  publiée le 14 août 2026.
- SHA-256 de l’archive source :
  `c3f68316628cc9cc0f719992d939c21040c84894e8a1c05813e802c2e3b0bfcd`.
- Licence : [CC BY-SA 4.0](https://git.door43.org/unfoldingWord/en_tw/src/tag/v90/LICENSE.md).
- Attribution exigée et conservée : « The original work by unfoldingWord is available from
  https://www.unfoldingword.org/utw ».

La ressource Bible Strong est explicitement une adaptation : Markdown converti en HTML sûr, liens
relatifs convertis en renvois de mots, liens bibliques `rc://` convertis puis contrôlés par le BCV
parser, et quatre fichiers à intitulé identique regroupés sans perte. Conformément aux instructions
de marque de la licence source, le produit dérivé est intitulé simplement « Translation Words ».

Les 953 fichiers source donnent 949 articles. Le résultat contient 5 163 liens `bible://`, 3 117
renvois internes et un index couvrant 6 945 versets.

Révision du paquet local validé :
`dictionary-unfoldingword-translation-words-en-ea0646cfd029313d76da`.

## Validation

Les deux ressources passent :

- l’intégrité SQLite avant et après normalisation ;
- l’audit exhaustif des ancres HTML et des URI `bible://` ;
- la parité entre données canoniques et archive hors-ligne ;
- les contrôles des manifestes, compteurs et sommes de contrôle ;
- les tests négatifs qui doivent rejeter un compteur ou un checksum falsifié.

Le lecteur local expose désormais huit dictionnaires sur <http://127.0.0.1:4178>.
