# Avatar Studio — prototype React

Prototype jetable de l’avatar procédural. Le HTML historique reste dans le dossier parent comme
référence visuelle.

```bash
yarn avatar:prototype
```

Puis ouvrir `http://127.0.0.1:5173/`.

- React gère l’éditeur et les presets en mémoire.
- Motion gère les ressorts, les interruptions et les clignements.
- `surfaces.ts` décrit les surfaces interchangeables (sphère, cube arrondi, capsule, etc.).
- Le cône expose des rondeurs indépendantes pour sa pointe et sa base.
- Le cylindre expose une rondeur commune pour ses deux arêtes.
- Un repère facial commun conserve les expressions puis les projette sur la surface réelle.
- `geometry.ts` reste indépendant du framework et projette expressions et maillages sur la surface active.
