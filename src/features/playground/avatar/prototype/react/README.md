# Avatar Studio — prototype React

Prototype jetable de l’avatar procédural. Le HTML historique reste dans le dossier parent comme
référence visuelle.

```bash
yarn avatar:prototype
```

Puis ouvrir `http://127.0.0.1:5173/`.

- React gère une bibliothèque locale d’avatars. Le premier avatar s’appelle Strobi.
- Chaque avatar conserve son propre corps ; les expressions et les états restent globaux au Studio.
- La galerie Avatars affiche chaque corps avec l’expression 00 et ouvre sa construction au double-clic.
- Le constructeur de corps s’ouvre à la création d’un avatar ou via « Modifier le corps ».
- Motion gère les ressorts, les interruptions et les clignements.
- `surfaces.ts` décrit les surfaces interchangeables (sphère, cube, capsule, etc.).
- La sphère devient naturellement un ellipsoïde lorsque ses trois dimensions diffèrent.
- La forme Mickey assemble une tête ellipsoïdale et deux oreilles sphériques liées à sa rotation.
- La forme Curseur assemble un corps cylindrique et une pointe conique dans le même repère 3D.
- L’éditeur de corps conserve une forme principale porteuse des yeux et des primitives secondaires indépendantes.
- Chaque primitive secondaire possède ses propres dimensions, position et rotation locales et la construction est sauvegardée dans le navigateur.
- Le cône expose des rondeurs indépendantes pour sa pointe et sa base.
- Le cylindre expose une rondeur commune pour ses deux arêtes.
- Le diamant peut être progressivement adouci jusqu’à une forme ellipsoïdale.
- Le cube, le cylindre et le cône proposent aussi un morphing global vers l’ellipsoïde.
- Un repère facial commun conserve les expressions puis les projette sur la surface réelle.
- `geometry.ts` reste indépendant du framework et projette expressions et maillages sur la surface active.
