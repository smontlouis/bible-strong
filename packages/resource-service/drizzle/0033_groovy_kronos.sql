CREATE TABLE "dictionary_directory_verse_presences" (
	"publication_id" integer NOT NULL,
	"verse_key" text NOT NULL,
	"work" text NOT NULL,
	"language" text NOT NULL,
	"resource_id" text NOT NULL,
	"title" text NOT NULL,
	"abbreviation" text NOT NULL,
	"entry_id" integer NOT NULL,
	"word" text NOT NULL,
	"normalized_word" text NOT NULL,
	"correspondence_id" text,
	"evidence_kind" text NOT NULL,
	CONSTRAINT "dictionary_directory_verse_presences_primary" PRIMARY KEY("publication_id","verse_key","work","entry_id","evidence_kind")
);
--> statement-breakpoint
ALTER TABLE "dictionary_directory_verse_presences" ADD CONSTRAINT "dictionary_directory_verse_presences_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dictionary_directory_verse_presences_lookup" ON "dictionary_directory_verse_presences" USING btree ("publication_id","verse_key","language");