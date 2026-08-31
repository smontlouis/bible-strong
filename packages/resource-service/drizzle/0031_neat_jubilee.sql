ALTER TABLE "dictionary_verse_links" ADD COLUMN "entry_id" integer;--> statement-breakpoint
ALTER TABLE "dictionary_verse_links" ADD COLUMN "evidence_kind" text;--> statement-breakpoint
CREATE INDEX "dictionary_verse_links_entry_lookup" ON "dictionary_verse_links" USING btree ("publication_id","verse_key","entry_id");