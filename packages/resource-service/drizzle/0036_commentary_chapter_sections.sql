CREATE TABLE "commentary_chapter_sections" (
	"publication_id" integer NOT NULL,
	"book" integer NOT NULL,
	"chapter" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"slug" text NOT NULL,
	"start_verse" integer NOT NULL,
	"end_verse" integer NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "commentary_chapter_sections_primary" PRIMARY KEY("publication_id","book","chapter","ordinal")
);
--> statement-breakpoint
ALTER TABLE "commentary_chapter_sections" ADD CONSTRAINT "commentary_chapter_sections_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;