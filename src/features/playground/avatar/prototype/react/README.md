# Avatar Studio — prototype React

Prototype jetable de l’avatar procédural. Le HTML historique reste dans le dossier parent comme
référence visuelle.

```bash
yarn avatar:prototype
```

Puis ouvrir `http://127.0.0.1:5173/`.

- React gère l’éditeur et les presets en mémoire.
- Motion gère les ressorts, les interruptions et les clignements.
- `geometry.ts` reste indépendant du framework et calcule la projection sphérique et les paths SVG.
