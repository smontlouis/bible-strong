CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bible_verses_text_trigram"
  ON "bible_verses" USING gin ("text" gin_trgm_ops);
