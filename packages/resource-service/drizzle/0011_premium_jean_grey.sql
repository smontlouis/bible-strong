CREATE TABLE "dictionary_entries" (
	"publication_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"word" text NOT NULL,
	"normalized_word" text NOT NULL,
	"definition" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "dictionary_entries_publication_entry_primary" PRIMARY KEY("publication_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "dictionary_verse_links" (
	"publication_id" integer NOT NULL,
	"verse_key" text NOT NULL,
	"ordinal" integer NOT NULL,
	"word" text NOT NULL,
	"normalized_word" text NOT NULL,
	CONSTRAINT "dictionary_verse_links_publication_verse_ordinal_primary" PRIMARY KEY("publication_id","verse_key","ordinal")
);
--> statement-breakpoint
ALTER TABLE "dictionary_entries" ADD CONSTRAINT "dictionary_entries_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_verse_links" ADD CONSTRAINT "dictionary_verse_links_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dictionary_entries_browse" ON "dictionary_entries" USING btree ("publication_id","normalized_word","entry_id");--> statement-breakpoint
CREATE INDEX "dictionary_entries_search" ON "dictionary_entries" USING btree ("publication_id","word");--> statement-breakpoint
CREATE INDEX "dictionary_verse_links_lookup" ON "dictionary_verse_links" USING btree ("publication_id","verse_key","ordinal");