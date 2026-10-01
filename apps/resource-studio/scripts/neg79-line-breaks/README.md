# Sauts de ligne perdus de NEG79

Rétablit les sauts de ligne internes que la conversion de la source NEG79 a
supprimés (« voix!Femmes », « cielEt »), puis réancre les décisions des paroles
de Jésus sur le texte réparé. Contexte, règles et résultats :
[`docs/neg79-line-breaks-2026-10-01.md`](../../docs/neg79-line-breaks-2026-10-01.md).

```sh
yarn exec tsx scripts/neg79-line-breaks/run.ts --output-dir outputs/neg79-line-breaks/<date>
```

- `lineBreaks.ts` : détection des soudures, insertion de « \n », report des
  plages ;
- `run.ts` : réparation de toute la Bible, contrôles (aller-retour, paroles de
  Jésus appliquées avant et après) et fichiers de sortie, jamais écrasés.
