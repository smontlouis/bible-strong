# Bible Strong Web

L’expérience web Bible Strong utilise [TanStack Start](https://tanstack.com/start), le routage fichier TanStack Router, Tailwind CSS v4 et les primitives shadcn/ui.

## Développement

Depuis la racine du monorepo :

```bash
yarn install
yarn dev:web
```

L’application est disponible sur `http://localhost:3000`.

## Validation

```bash
yarn workspace @bible-strong/web typecheck
yarn workspace @bible-strong/web build
```

Les routes se trouvent dans `src/routes`. Le fichier `src/routeTree.gen.ts` est généré avec `yarn workspace @bible-strong/web generate-routes`.

Les composants shadcn/ui vivent dans `components/ui`; les variables du thème, les fontes et les styles éditoriaux globaux sont définis dans `src/styles.css`.

## Déploiement

Le build produit un serveur Nitro dans `.output/server` et les assets publics dans `.output/public`. `vercel.json` sélectionne l’adaptateur TanStack Start sur Vercel.
