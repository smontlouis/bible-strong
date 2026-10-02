# Import STEP, réparation S21 et contexte lexical

Suite du commit `34e3949ec`, sans appel de modèle ni publication. Le jeu retenu
comprend les 968 versets déjà consultés comme développement et 201 nouveaux versets
réservés dans huit chapitres. Les exclusions et la sélection par SHA-256 sont
consignées dans `plan.json`. Ces chapitres sont consommés après cette expérience :
un rejeu démontre la reproductibilité, pas une nouvelle généralisation.
La première réserve de 337 versets a été retirée après qu’un audit intégral a
révélé des porteurs grammaticaux inappropriés dans la règle des verbes supports.
Le nouveau garde-fou et le complément de relation ont été figés avant la seconde
réserve. Les deux tentatives restent archivées séparément.

## Rejouer la comparaison

Depuis `apps/resource-studio`, avec les données locales et dépendances du dépôt :

```sh
python3 scripts/strong-source-context/init.py --root outputs/context-replay \
  --cache outputs/strong-source-context-2026-10-02/recheck/acquisition
python3 scripts/strong-source-context/run.py baseline --root outputs/context-replay
python3 scripts/strong-source-context/run.py source --root outputs/context-replay
python3 scripts/strong-source-context/development.py --root outputs/context-replay
```

`baseline` utilise le code archivé de `34e3949ec`. `source` utilise le nouvel
importeur avec la couche de contexte désactivée. Les ablations `light`, `local`
et `groups` isolent les nouvelles règles ; `all` les combine et conserve la
convention de tête des contrôles CSV. `common` applique aussi le choix du nouveau
porteur nominal aux contrôles : cette comparaison porte sur la nouvelle couche,
pas sur une réévaluation de toutes les adaptations des expériences précédentes.

L'initialiseur copie le code courant pour l'ablation source ; le flag de contexte
reste désactivé. Le dossier livré conserve aussi l'instantané exact employé dans
l'expérience originale. Les corps annotés restent côté évaluateur. Les copies des
témoins autorisés, les masques, la source des prédictions et les empreintes sont
vérifiés. Darby et DarbyR représentent une seule famille.

Après analyse du développement, consigner `development-selection.json` avec les
sept résultats, leurs pertes éventuelles et `selected: "all"`. Le gel exige que
la sélection soit complète et sans perte de porteur auparavant exact sur ce
contrôle de développement. Les décisions de sélection de l'expérience livrée
sont disponibles dans ses artefacts.

```sh
python3 scripts/strong-source-context/select-policy.py --root outputs/context-replay
python3 scripts/strong-source-context/freeze.py --root outputs/context-replay
python3 scripts/strong-source-context/reserve.py --root outputs/context-replay
python3 scripts/strong-source-context/run.py candidate --root outputs/context-replay
python3 scripts/strong-source-context/verify-replay.py --root outputs/context-replay
```

Le dernier contrôle vérifie les octets figés et exige les mêmes prédictions alors
que les pages, annotations externes et évaluations sont physiquement masquées.
L'éligibilité au score d'identité et les strates de difficulté restent celles du
modèle initial, avec correspondance des identités physiques par fichier/ligne.
Les règles ne doivent pas changer après consultation de la réserve.

## Réparer et générer les deux candidates complètes

La réparation est bornée à la version textuelle connue de Jérémie 23.18–19.
Elle refuse une empreinte différente, un marqueur ambigu, un verset 19 existant
ou une présentation nécessitant une migration. Elle conserve toutes les autres
entrées canoniques, produit une nouvelle révision et prouve la reconstruction de
l'ancien texte par réinsertion du marqueur retiré. L'original n'est pas modifié.

```sh
node --import tsx scripts/strong-source-context/repair-input.ts \
  /chemin/vers/la/publication/s21/canonical/bible-s21.json \
  outputs/context-replay/text-repair
python3 scripts/strong-source-context/prepare-full.py --root outputs/context-replay \
  --previous outputs/strong-candidates-2026-10-02/refined
python3 scripts/strong-candidates/run.py freeze --root outputs/context-replay/full
python3 scripts/strong-candidates/run.py generate --root outputs/context-replay/full
python3 scripts/strong-candidates/run.py verify --root outputs/context-replay/full
```

`--previous` doit pointer sur les candidats du cycle précédent avec leurs
correspondances déjà révisées. Dans le checkout principal, l'alias
`outputs/strong-candidates-2026-10-02` pointe directement sur ce dossier ; dans
ce worktree il se trouve sous `refined/`. Ne pas utiliser les premiers
manifests du détecteur à la place des correspondances révisées.

Les correspondances existantes sont conservées, sauf le découpage explicitement
réparé de Jérémie. Les seize versets NEG79 encore discutés restent incertains.
`input-manifest.json` active explicitement `concordanceContext`; le générateur
habituel ne l'active pas implicitement pour toutes les Bibles.

```sh
python3 scripts/strong-source-context/audit-full.py outputs/context-replay neg79
python3 scripts/strong-source-context/audit-full.py outputs/context-replay s21
node --import tsx scripts/strong-source-context/source-audit.ts outputs/context-replay
```

Les JSONL lecteurs, SQLite d'auteur et contrôles sont dans `full/`. Le nouveau
canonique S21 et sa preuve de réparation sont dans `text-repair/`. Les diagnostics
et jugements assistés n'ont pas le statut d'une vérité indépendante. Un signal
de désaccord ne devient jamais une absence de traduction. Aucune commande de ce
parcours n'active de ressource dans le service ou l'application.
