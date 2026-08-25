CREATE TABLE "commentary_verses" (
	"publication_id" integer NOT NULL,
	"verse_key" text NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "commentary_verses_publication_verse_primary" PRIMARY KEY("publication_id","verse_key")
);
--> statement-breakpoint
CREATE TABLE "cross_reference_links" (
	"publication_id" integer NOT NULL,
	"verse_key" text NOT NULL,
	"ordinal" integer NOT NULL,
	"reference" text NOT NULL,
	CONSTRAINT "cross_reference_links_publication_verse_ordinal_primary" PRIMARY KEY("publication_id","verse_key","ordinal")
);
--> statement-breakpoint
ALTER TABLE "commentary_verses" ADD CONSTRAINT "commentary_verses_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cross_reference_links" ADD CONSTRAINT "cross_reference_links_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "commentary_verses_lookup" ON "commentary_verses" USING btree ("publication_id","verse_key");
--> statement-breakpoint
CREATE INDEX "cross_reference_links_lookup" ON "cross_reference_links" USING btree ("publication_id","verse_key","ordinal");
