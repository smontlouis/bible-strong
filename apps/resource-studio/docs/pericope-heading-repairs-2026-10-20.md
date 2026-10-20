# Titres de péricope qui n'étaient pas des titres

Date : 20 octobre 2026. Correction à la publication, régénération et
publication en production le même jour.

## Audit

Tous les titres des 47 Bibles ordinaires publiées ont été relus (43 à leur
révision en ligne ; POV, SBLGNT, TR1624 et TR1894, Nouveaux Testaments seuls,
d'après leur unique bundle). Trois défauts :

| Défaut                                              | Bibles                                                         | Titres |
| --------------------------------------------------- | -------------------------------------------------------------- | ------ |
| Ligne de renvois prise pour un titre                | LSG (Ex 1:1), NEG79 (Gn 15:1)                                  | 2      |
| Notes collées dans un titre de péricope historique  | NET 271, EASY 152, BDS 23, NFC 5, BFC 3, FRC97 3               | 457    |
| Notes lues dans une suscription de Psaume (SWORD)   | RLT 47, NASB2020 46, NASB1995 45, BSB 31, DARBY 1              | 170    |

Les titres qui finissent par leur étendue (S21 « La création 1.1–4.26 », NET
« I. The Prologue (1:1-2:13) », NEG79 Pr 10 et 25) suivent l'édition imprimée
et restent tels quels.

## Corrections

- **Corrections revues des péricopes historiques** :
  `config/ordinary-bible-pericope-repairs.json`, ancrées sur l'empreinte du
  fichier de péricopes et sur celle de chaque titre ; le dépôt ne contient
  aucun texte biblique, seulement des décalages. Une correction qui ne trouve
  pas son titre, ou un titre qui a changé, fait échouer la publication.
  - `retype` : LSG Ex 1:1 devient `kind: "parallel"`, `type: "scope"` (la
    ligne d'étendue de la grande section, gardée au niveau `h2` par l'app) ;
    NEG79 Gn 15:1 devient `kind: "parallel"`. Leurs références sont balisées.
  - `notes` : le titre perd ses notes ; chacune devient une note du verset
    qu'elle nomme (`#38.21` → v. 21), sinon du verset que le titre ouvre,
    avant le premier mot. Les décalages viennent du HTML de bible.com
    (`yarn tsx src/legacyPericopeNoteRepairsCli.ts --version …`), qui marque
    chaque note (`<span class="note f">`, libellé `#`, ancre `fr`, corps
    `ft`) : l'ancien export avait recollé libellé et corps dans le titre, et
    dans les suscriptions NET le titre reprend après la note sans aucun
    séparateur. Les notes NET collées (`…”sn According…`) sont séparées ;
    leur étiquette `sn`/`tn`/`tc` est retirée. FRC97, absente de bible.com,
    est lue chez BFC (mêmes titres, typographie près).
  - 458 titres alignés sur 458. EASY So 2:3 n'est pas corrigé : la Bible n'a
    pas de verset 3, ce titre n'a jamais été publié.
- **Suscriptions SWORD** : à la publication, un titre canonique ne lit plus
  ses `<note>` (`liftCanonicalHeadingNotes`) ; elles deviennent des notes du
  verset 1, projetées comme les autres notes de verset, et l'espace entre deux
  mots qu'une note séparait est rétabli (DARBY Ps 90 « the man of God. »).
  Les sources en R2 ne changent pas.

## Écart mesuré

Par rapport aux bundles en production : textes de versets identiques dans les
13 Bibles ; seuls les titres et les notes changent (EASY Mc 8:27 : les
paroles de Jésus gardent leur place, leur numéro d'ordre suit la note
ajoutée).

| Bible    | Révision                                             | Notes          |
| -------- | ---------------------------------------------------- | -------------- |
| LSG      | `lsg-291b54…` → `lsg-73efd3ba244d460ecd27`           | —              |
| NEG79    | `neg79-b85d49…` → `neg79-3147da9de4d832bcf8da`       | —              |
| NET      | `net-e19827…` → `net-3bd138057c0d53c4552e`           | 0 → 294        |
| EASY     | `easy-807bf3…` → `easy-1f1bc186001c7e243727`         | 0 → 152        |
| BDS      | `bds-b4bab7…` → `bds-25e21dd1d829f66ab117`           | 0 → 23         |
| NFC      | `nfc-75b93d…` → `nfc-22e8f91ca6642def3eb6`           | 0 → 5          |
| BFC      | `bfc-606a70…` → `bfc-90e80743a27102d2c2cc`           | 0 → 3          |
| FRC97    | `frc97-0e4bd5…` → `frc97-0e625746f668ad02cb30`       | 0 → 3          |
| RLT      | `rlt-a3027f…` → `rlt-262219e3bfef5500da02`           | 6 899 → 6 955  |
| NASB2020 | `nasb2020-65ace2…` → `nasb2020-45e2f00fdcf9fa707424` | 61 635 → 61 700 |
| NASB1995 | `nasb1995-94ac05…` → `nasb1995-525f472939f28b774164` | 61 296 → 61 361 |
| BSB      | `bsb-00f760…` → `bsb-73a544f0b1047400a28e`           | 4 817 → 4 853  |
| DARBY    | `darby-dbda36…` → `darby-ae2ce9e443bf73cc2114`       | 4 296 → 4 297  |

Bundles Strong réappariés (textes de verset vérifiés identiques) : BSB, DARBY,
LSG, NASB1995, NASB2020, RLT.

## Publication (20 octobre 2026)

1. Bundles : `outputs/releases/ordinary-bible-publications-2026-10-20-heading-notes`
   et `outputs/releases/strong-bible-publications-2026-10-20-heading-notes`.
2. Catalogue mobile corrigé (`r2ArtifactSources catalog-patch`), 19 bundles
   dans R2 (`resources:r2:publish-changed:prod`), copies hors ligne chiffrées
   recréées (`resources:offline:encrypt:prod`).
3. Import et activation dans Neon des 13 `bible-text` et 6
   `strong-bible-index` ; inventaire adopté.
4. Worker déployé (version `4fe4222e`). Vérifié en lecture : LSG Ex 1:1
   (`parallel`/`scope`), NEG79 Gn 15:1, BDS Ex 38:1 (« Les comptes ») et sa
   note au v. 21, NET Ps 18, BSB Ps 6, DARBY Ps 90, FRC97 Jb 26:5, et l'index
   Strong LSG apparié à `lsg-73efd3ba244d460ecd27`.
5. Dossiers du site rafraîchis : `/bible/<version>` des 13 Bibles, et
   `strong`, `reverse-interlinear` des 6 index Strong. Le site n'affiche pas
   les titres de péricope ; rien n'y change à l'œil.

## Sur la 27.2

L'app place une ligne `parallel` au niveau `h4` ; la 28.0 garde au niveau `h2`
une ligne `parallel` de type `scope`. Sur la 27.2, LSG Ex 1:1 affiche donc la
ligne de renvois sous « Souffrances des Israélites en Égypte », jusqu'à la
mise à jour.
