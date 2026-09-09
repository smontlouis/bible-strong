# React Strict DOM dans Bible Strong

Recherche du 8 septembre 2026, sources primaires uniquement. Aucun benchmark de l'application ni changement de son code.

## Avis

React Strict DOM (RSD) mérite une veille et éventuellement un essai ciblé. Une migration générale motivée uniquement par la performance n'est pas justifiée par les preuves disponibles. Le bénéfice technique plausible concerne surtout les composants Web aujourd'hui rendus par React Native Web (RNW). Sur mobile, aucun gain automatique n'est démontré.

## Ce que fait RSD

RSD propose un sous-ensemble de HTML, CSS et des API DOM, avec `html.div`, `html.button` et une API de styles JavaScript obligatoire basée sur StyleX. Il rend ces composants dans le DOM sur Web et via React Native sur mobile. Il ne transforme pas une bibliothèque React DOM arbitraire en bibliothèque native. La documentation indique que le projet reste en développement, avec des capacités natives incomplètes. [Présentation officielle](https://react.github.io/react-strict-dom/learn/)

Avec son preset Babel, RSD extrait les styles en CSS statique et optimise les éléments. La documentation affirme une absence de surcoût d'exécution Web par rapport à React DOM avec une solution CSS atomique comme StyleX. C'est une comparaison avec React DOM + StyleX, pas un benchmark de Bible Strong ni une promesse de pourcentage gagné face à RNW. [Preset Babel](https://react.github.io/react-strict-dom/api/babel-preset/)

Le chiffre officiel « moins de 2 Ko » décrit le runtime RSD Web, pas le bundle complet de l'application : React, React DOM, la navigation, les composants externes et les ressources restent à compter. [Présentation officielle](https://react.github.io/react-strict-dom/learn/)

## Maturité et intégration Expo

- Le registre npm interrogé directement donne `latest: 0.0.55`, publié le **9 janvier 2026**, avec des peer dependencies `react: ^19.0.0`, `react-dom: ^19.0.0`, `react-native: >=0.79.5`. [Registre npm](https://registry.npmjs.org/react-strict-dom)
- Le dernier commit de `main` observé est daté du **31 août 2026** : activité du dépôt et nouvelle publication npm sont deux choses distinctes. [Commit observé](https://github.com/react/react-strict-dom/commit/abd34bbf22bb468ffdc0baaf606f172c3a583487)
- Meta utilise RSD en production, notamment pour partager des composants Web avec ses applications VR. Son mainteneur décrit l'API Web comme stable et la couche native comme utilisable, avec des limites. Cela n'équivaut pas à une garantie de compatibilité avec tous les usages d'une application mobile existante. [Avis du mainteneur](https://github.com/react/react-strict-dom/discussions/270)
- Expo est le framework recommandé par RSD. L'intégration impose Babel, extraction PostCSS, entrée CSS et configuration par plateforme ; la documentation demande une version récente d'Expo et la New Architecture. [Installation Expo](https://react.github.io/react-strict-dom/learn/setup/)
- L'exemple officiel observé sur `main` utilise encore **Expo 55 / RN 0.83.6**, et garde une dépendance RNW. Les versions locales Expo 56 / RN 0.85.3 satisfont les plages de peers, mais cet exemple ne constitue pas une validation d'Expo 56. [Exemple officiel](https://github.com/react/react-strict-dom/blob/main/apps/expo-app/package.json)

## Performance et coût d'adoption

Sur Web, réduire l'adaptation des props RN et le traitement dynamique des styles pourrait réduire le travail JavaScript des composants concernés. Il s'agit d'une **hypothèse à mesurer**. Les sources examinées ne donnent pas de benchmark reproductible permettant d'annoncer un gain chiffré pour une application Expo + RNW comparable à Bible Strong.

Sur native, le mainteneur confirme un surcoût d'exécution inhérent aux fonctionnalités que RSD ajoute au-dessus de React Native. Il indique que des optimisations ont été réalisées et que certaines fonctionnalités migrent progressivement vers RN core. On ne peut donc pas vendre RSD comme une accélération de l'application iOS/Android. [Explication du mainteneur](https://github.com/react/react-strict-dom/discussions/270)

La compatibilité native reste partielle : la documentation signale notamment des limites de mise en page flow/grid/inline. Le mélange progressif avec RN exige des frontières explicites ; mélanger les deux formats de styles sur un même élément n'est pas pris en charge. `compat.native`, destiné à l'adoption progressive, est explicitement expérimental et instable. [Compatibilité HTML](https://react.github.io/react-strict-dom/api/html/), [recommandations d'adoption](https://github.com/react/react-strict-dom/discussions/270), [API compat](https://react.github.io/react-strict-dom/api/other/compat/)

## Application à ce dépôt

La décision récente est Uniwind/Tailwind v4 pour les primitives partagées, et HeroUI **Web** dans des adaptateurs Web. Ce n'est pas une application entièrement construite avec HeroUI Native. Une adoption RSD ferait changer les primitives et leur système de styles dans les zones migrées ; elle ne remplace pas simplement une dépendance. [ADR-0040](../../adr/0040-use-uniwind-for-expo-styles.md)

Le dépôt possède déjà des frontières DOM pour les contenus de lecture et éditoriaux. L'ADR-0042 conserve HTML, CSS et les actions natives asynchrones via Expo DOM. Ces zones ne peuvent pas être considérées comme du surcoût RNW à supprimer par RSD ; conserver ou réécrire leur usage des API DOM constitue une décision distincte. [ADR-0042](../../adr/0042-share-editorial-html-through-expo-dom.md)

Conserver HeroUI Web dans des composants `.web` est envisageable, mais RSD n'en fournit pas automatiquement une version native. Garder des composants RN et RNW dans l'application signifie aussi qu'une migration partielle ne supprime pas nécessairement RNW du bundle. L'exemple officiel lui-même conserve cette dépendance. [Exemple Expo](https://github.com/react/react-strict-dom/blob/main/apps/expo-app/package.json)

## Perspective React Native Web

Le mainteneur de RNW explique qu'il continue de revoir et fusionner des correctifs, sans prévoir de gros investissements personnels dans de nouvelles fonctionnalités ; il réaffirme cette orientation en mai 2025. En décembre 2025, il se dit ouvert à l'ajout de mainteneurs issus d'Expo et Software Mansion. Il est donc raisonnable de parler d'un développement majeur limité et d'une orientation vers RSD, pas d'une obligation immédiate de migration ni d'un abandon total. [Position du mainteneur](https://github.com/necolas/react-native-web/discussions/2646), [ouverture à d'autres mainteneurs](https://github.com/necolas/react-native-web/discussions/2816)

## Décision proposée

Conserver la pile actuelle. Si un profil de production montre un coût important dans un composant partagé RNW, comparer sa version actuelle à un petit équivalent RSD sur une branche dédiée : même interface, même contenu et même scénario. Mesurer temps JavaScript, latence d'interaction, rendu, poids JS/CSS réellement chargé et absence de régression mobile. Mesurer également le coût des primitives actuelles et de la résolution Uniwind avant d'attribuer un problème à RNW. Aucune amélioration de FPS, de chargement ou de mémoire n'a été mesurée dans cette recherche.
