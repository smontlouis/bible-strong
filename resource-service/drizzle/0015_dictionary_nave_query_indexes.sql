CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dictionary_entries_word_trgm" ON "dictionary_entries" USING gin ("word" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dictionary_entries_normalized_word_trgm" ON "dictionary_entries" USING gin ("normalized_word" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nave_topics_name_trgm" ON "nave_topics" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
ALTER TABLE "nave_topics" ADD COLUMN IF NOT EXISTS "random_key" double precision DEFAULT random() NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nave_topics_random" ON "nave_topics" ("publication_id", "random_key");
