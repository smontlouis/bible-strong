# Avatar Studio — prototype React

Prototype jetable de l’avatar procédural. Le HTML historique reste dans le dossier parent comme
référence visuelle.

```bash
yarn avatar:prototype
```

Puis ouvrir `http://127.0.0.1:5173/`.

- React gère l’éditeur et les presets en mémoire.
- Motion gère les ressorts, les interruptions et les clignements.
- `surfaces.ts` décrit les surfaces interchangeables (sphère, cube, capsule, etc.).
- La sphère devient naturellement un ellipsoïde lorsque ses trois dimensions diffèrent.
- La forme Mickey assemble une tête ellipsoïdale et deux oreilles sphériques liées à sa rotation.
- Le cône expose des rondeurs indépendantes pour sa pointe et sa base.
- Le cylindre expose une rondeur commune pour ses deux arêtes.
- Le diamant peut être progressivement adouci jusqu’à une forme ellipsoïdale.
- Le cube, le cylindre et le cône proposent aussi un morphing global vers l’ellipsoïde.
- Un repère facial commun conserve les expressions puis les projette sur la surface réelle.
- `geometry.ts` reste indépendant du framework et projette expressions et maillages sur la surface active.
