# Drizzle + Kysely dans un backend Effect

Recherche vérifiée le 16 août 2026. Les constats de version reposent sur les paquets publiés et les dépôts officiels ; la recommandation pour Bible Strong est une déduction architecturale.

## Conclusion

Les personnes qui recommandent **Drizzle et Kysely ensemble ont une vraie raison technique** : elles ne proposent généralement pas deux couches de requêtes concurrentes. Elles utilisent :

- **Drizzle Schema + Drizzle Kit** pour déclarer le schéma et produire les migrations ;
- **Kysely** comme unique query builder à l'exécution ;
- le type `Kyselify<typeof table>` pour dériver les types Kysely des tables Drizzle.

Cette composition est documentée par Drizzle lui-même. Drizzle dit explicitement qu'elle permet de bénéficier de sa définition de schéma et de ses migrations automatiques tout en construisant les requêtes avec Kysely ; le cas historique mis en avant est l'ajout des outils Drizzle à un projet Kysely existant. [`Kyselify` ne contient que la conversion de types select/insert/update](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/kysely/index.ts) : il ne crée ni second client ni double exécution. [Documentation officielle Drizzle + Kysely](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/kysely/README.md).

Dire simplement « Drizzle et Kysely sont des alternatives, donc jamais ensemble » était donc trop catégorique. Ils sont concurrents **comme query builders**, mais complémentaires lorsque Drizzle est limité au schéma/migrations et Kysely aux requêtes.

## Ce que chaque pièce apporte

| Responsabilité | Drizzle seul | Drizzle + Kysely |
|---|---|---|
| Schéma TypeScript | Drizzle | Drizzle |
| Génération/revue des migrations | Drizzle Kit | Drizzle Kit |
| Requêtes applicatives | Drizzle | Kysely uniquement |
| Types de tables consommés par le query builder | Tables Drizzle | `Kyselify<typeof table>` |
| Client de base à l'exécution | Driver Drizzle | Dialecte Kysely |

Kysely se définit comme un query builder SQL typé, utilisable notamment dans Node, Deno, Bun et Cloudflare Workers. Son inférence porte sur les tables/colonnes visibles, les alias, sous-requêtes, jointures et CTE. [Dépôt officiel Kysely](https://github.com/kysely-org/kysely).

Le bénéfice concret de la combinaison est donc de choisir la syntaxe et la composition de requêtes de Kysely sans renoncer à Drizzle Kit, Studio et au schéma exécutable Drizzle. Le coût est une frontière de types supplémentaire et deux dépendances dont les versions doivent rester compatibles.

## État Effect et versions au 16 août 2026

Deux générations incompatibles coexistent.

### Ligne stable Effect 3 / Drizzle 0.x

- `effect` stable est en 3.22.x ; `@effect/sql-drizzle` 0.51 demande Effect 3.22, `@effect/sql` 0.52 et Drizzle `>=0.43.1 <0.50`. [Manifeste officiel `@effect/sql-drizzle` 0.51](https://github.com/Effect-TS/effect/blob/%40effect/sql-drizzle%400.51.0/packages/sql-drizzle/package.json).
- `@effect/sql-kysely` 0.48 demande Effect 3.22, `@effect/sql` 0.52 et Kysely `^0.28.2`. [Manifeste officiel `@effect/sql-kysely` 0.48](https://github.com/Effect-TS/effect/blob/%40effect/sql-kysely%400.48.0/packages/sql-kysely/package.json).
- Kysely stable est désormais en 0.29.x. L'adaptateur Effect officiel n'accepte donc pas la ligne stable actuelle de Kysely sans rester volontairement sur Kysely 0.28.
- Surtout, Effect avertit que son intégration Kysely dépend d'internals Kysely, peut casser si les builders changent et doit être utilisée avec version épinglée. Son implémentation confirme qu'elle modifie les prototypes des builders pour les rendre `Effect`-compatibles. [Avertissement officiel](https://github.com/Effect-TS/effect/blob/%40effect/sql-kysely%400.48.0/packages/sql-kysely/README.md), [implémentation officielle](https://github.com/Effect-TS/effect/blob/%40effect/sql-kysely%400.48.0/packages/sql-kysely/src/internal/kysely.ts).

Il existe donc bien des intégrations Effect officielles pour les deux bibliothèques en Effect 3, mais l'intégration Kysely est explicitement plus fragile. Il n'est pas nécessaire de charger `@effect/sql-drizzle` **et** `@effect/sql-kysely` dans la même application : si Kysely exécute les requêtes, seul son raccordement runtime est concerné ; Drizzle peut rester un outil de schéma/migration.

### Ligne Effect 4 / Drizzle 1.0 RC

Drizzle 1.0 RC propose maintenant une intégration Effect native via `drizzle-orm/effect-postgres`, alimentée par `@effect/sql-pg`, ainsi que la génération d'Effect Schema via `drizzle-orm/effect-schema`. Cette intégration est documentée avec `PgDrizzle.makeWithDefaults`, des `Layer`, un logger Effect et un cache injectable. [Guide officiel Drizzle Effect Postgres](https://orm.drizzle.team/docs/connect-effect-postgres), [guide Effect Schema](https://orm.drizzle.team/docs/effect-schema), [changements v0 → v1](https://orm.drizzle.team/docs/v0-v1-changes).

Mais cette voie n'est pas encore la ligne stable générale : le tag npm `latest` de Drizzle reste 0.45.2 tandis que 1.0 est publié sous `rc`, et la documentation d'installation demande `drizzle-orm@rc`. Le manifeste de Drizzle 1.0 RC déclare Effect 4 et les pilotes `@effect/sql-*` comme pairs, alors que l'export Kysely présent en Drizzle 0.45 n'est plus publié dans le RC inspecté. [Manifeste officiel Drizzle 1.0 RC](https://github.com/drizzle-team/drizzle-orm/blob/748058e837d9c4247330e3d45580cbdae52bffda/drizzle-orm/package.json), [release officielle](https://github.com/drizzle-team/drizzle-orm/releases).

Autrement dit, il n'existe pas aujourd'hui de pile officielle homogène **Drizzle 1 RC + Effect 4 + Kysely**. La direction v4 la plus intégrée est Drizzle seul pour les requêtes ; la composition Drizzle + Kysely reste la voie stable 0.x, avec des wrappers Effect explicites ou l'adaptateur Effect 3 épinglé.

## Neon et Cloudflare

La contrainte déterminante n'est pas la syntaxe SQL, mais le transport.

- Drizzle prend officiellement en charge Neon par HTTP et WebSocket. HTTP est recommandé pour les requêtes et transactions non interactives ; les sessions et transactions interactives demandent WebSocket ou un driver compatible `pg`. [Guide officiel Drizzle + Neon](https://orm.drizzle.team/docs/connect-neon).
- L'organisation Kysely maintient `kysely-neon`, un dialecte pour le driver Neon **sur HTTP**. Le même code Kysely peut utiliser `PostgresDialect` + `pg` localement et `NeonDialect` dans le Worker. [Dépôt officiel `kysely-neon`](https://github.com/kysely-org/kysely-neon).
- Le driver Neon est GA et expose HTTP pour les opérations one-shot et WebSocket pour les sessions/transactions interactives. Il autorise aussi plusieurs requêtes dans une transaction HTTP non interactive. [Documentation officielle Neon](https://neon.com/docs/serverless/serverless-driver).
- Cloudflare accepte le driver Neon direct, mais recommande désormais Hyperdrive pour Neon ; Hyperdrive permet aussi `pg`/Drizzle avec `nodejs_compat`. [Cloudflare — Neon](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/), [Cloudflare — Drizzle avec Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm/).

Cela crée un choix réel pour Bible Strong :

1. **Conserver l'ADR « Neon HTTP direct, sans Hyperdrive au départ »** : Drizzle + Kysely est cohérent. Drizzle 0.45/Kit possède le schéma et les migrations ; Kysely 0.29 possède toutes les requêtes ; `PostgresDialect` utilise `pg` en local et `kysely-neon` utilise HTTP dans le Worker. Les opérations du repository enveloppent les Promises Kysely dans `Effect.tryPromise`, traduisent les erreurs et portent les traces/retry/timeouts Effect. Ne pas utiliser `@effect/sql-kysely` tant qu'il ne supporte pas la ligne Kysely actuelle sans son patch fragile.
2. **Privilégier l'intégration Effect la plus native** : Effect 4 + Drizzle 1 RC + `@effect/sql-pg` est la direction la plus nette, mais elle implique soit Hyperdrive/`pg` dans Cloudflare, soit un adaptateur séparé pour Neon HTTP, et accepte aujourd'hui des versions RC.
3. **Rester entièrement stable Effect 3** : `@effect/sql-drizzle` + Drizzle 0.45 est valide, mais `@effect/sql-pg` n'est pas le driver HTTP Neon direct. La promesse local `pg` → Neon HTTP ne doit donc pas être considérée comme vérifiée par cette seule intégration.

## Recommandation pour le Resource service

Pour la trajectoire actuellement décidée — PostgreSQL local, puis Cloudflare Worker + Neon HTTP sans Hyperdrive initial — la proposition la plus cohérente à prototyper est :

```text
Drizzle schema + Drizzle Kit migrations
                    ↓ Kyselify
Kysely repositories (seul query builder runtime)
        ├── pg / PostgresDialect en local
        └── kysely-neon / NeonDialect dans Worker
                    ↓
Effect services, erreurs, retry, timeout, traces et HTTP API
```

Ce n'est pas « deux ORM dans le domaine ». C'est un outil de schéma et un query builder, derrière un seul `ResourceRepository`. Les tables Drizzle ne doivent pas être importées par le domaine et aucune requête Drizzle ne doit coexister avec les requêtes Kysely.

Avant de modifier l'ADR, un petit spike doit prouver sous le vrai runtime Worker :

- une requête de chapitre et une recherche paginée ;
- une transaction HTTP non interactive compatible avec l'activation d'une publication, ou l'exécution de cette activation hors Worker si elle exige une transaction interactive ;
- la traduction des erreurs, interruption/timeout et observabilité Effect autour de Kysely ;
- la fidélité des types `Kyselify` pour enums, JSON, bigint, dates, colonnes générées et noms `snake_case` ;
- le bundle et le démarrage sous `workerd`.

Si ce spike échoue, la seconde option n'est pas d'empiler davantage d'adaptateurs : il faut choisir soit Drizzle natif avec Neon HTTP et wrappers Effect, soit Drizzle/Effect natif avec Hyperdrive.
