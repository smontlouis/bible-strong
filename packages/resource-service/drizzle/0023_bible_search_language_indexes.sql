DROP INDEX IF EXISTS "bible_verses_text_trigram";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bible_verses_normalized_fts"
  ON "bible_verses"
  USING gin (to_tsvector('simple', bible_search_normalize("text")));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bible_verses_normalized_french_fts"
  ON "bible_verses"
  USING gin (to_tsvector('french', bible_search_normalize("text")));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bible_verses_normalized_english_fts"
  ON "bible_verses"
  USING gin (to_tsvector('english', bible_search_normalize("text")));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bible_verses_normalized_trigram"
  ON "bible_verses"
  USING gin (bible_search_normalize("text") gin_trgm_ops);
