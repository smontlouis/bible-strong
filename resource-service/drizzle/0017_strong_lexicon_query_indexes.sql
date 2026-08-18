CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_entries_browse" ON "strong_lexicon_entries" USING btree ("publication_id", lower(COALESCE("payload"->>'gloss', '')), (("payload"->>'baseCode')::integer), "entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_entries_random" ON "strong_lexicon_entries" USING btree ("publication_id", "language", "entry_id") WHERE "payload"->>'gloss' <> '';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_entries_search" ON "strong_lexicon_entries" USING gin (lower(COALESCE("payload"->>'original', '') || ' ' || COALESCE("payload"->>'transliteration', '') || ' ' || COALESCE("payload"->>'gloss', '') || ' ' || "e_strong" || ' ' || "d_strong" || ' ' || "u_strong") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_translations_gloss_search" ON "strong_lexicon_translations" USING gin (lower(COALESCE("payload"->>'gloss', '')) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_entry_identities_code_search" ON "strong_lexicon_entry_identities" USING gin (lower("step_code") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_relations_from_lookup" ON "strong_lexicon_relations" USING btree ("publication_id", "from_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_relations_to_lookup" ON "strong_lexicon_relations" USING btree ("publication_id", "to_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_resources_entry_lookup" ON "strong_lexicon_resources" USING btree ("publication_id", "step_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_entity_translations_lookup" ON "strong_lexicon_entity_translations" USING btree ("publication_id", "entity_id", "language");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_entity_relations_from_lookup" ON "strong_lexicon_entity_relations" USING btree ("publication_id", "from_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_entity_relations_to_lookup" ON "strong_lexicon_entity_relations" USING btree ("publication_id", "to_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strong_lexicon_morphology_code_lookup" ON "strong_lexicon_morphology_codes" USING btree ("publication_id", lower("normalized_code"), lower("code"));
