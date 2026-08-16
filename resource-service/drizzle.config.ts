import { defineConfig } from 'drizzle-kit'

const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

export default defineConfig({
  dialect: 'postgresql',
  schema: './resource-service/src/database/schema.ts',
  out: './resource-service/drizzle',
  dbCredentials: { url: connectionString },
  strict: true,
  verbose: true,
})
