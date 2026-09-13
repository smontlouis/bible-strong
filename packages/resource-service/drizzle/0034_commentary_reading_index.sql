CREATE TABLE "commentary_reading_sections" (
	"publication_id" integer NOT NULL,
	"id" text NOT NULL,
	"book" integer NOT NULL,
	"chapter" integer NOT NULL,
	"range_start_verse" integer NOT NULL,
	"range_end_verse" integer NOT NULL,
	"excerpt" text NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "commentary_reading_sections_primary" PRIMARY KEY("publication_id","id")
);
--> statement-breakpoint
ALTER TABLE "commentary_reading_sections" ADD CONSTRAINT "commentary_reading_sections_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commentary_reading_sections_chapter" ON "commentary_reading_sections" USING btree ("publication_id","book","chapter","range_start_verse");