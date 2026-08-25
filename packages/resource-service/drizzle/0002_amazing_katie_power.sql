CREATE TABLE "nave_topics" (
	"publication_id" integer NOT NULL,
	"normalized_name" text NOT NULL,
	"name" text NOT NULL,
	"initial" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "nave_topics_publication_name_primary" PRIMARY KEY("publication_id","normalized_name")
);
--> statement-breakpoint
CREATE TABLE "nave_verse_links" (
	"publication_id" integer NOT NULL,
	"verse_key" text NOT NULL,
	"normalized_name" text NOT NULL,
	CONSTRAINT "nave_verse_links_publication_verse_topic_primary" PRIMARY KEY("publication_id","verse_key","normalized_name")
);
--> statement-breakpoint
ALTER TABLE "nave_topics" ADD CONSTRAINT "nave_topics_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nave_verse_links" ADD CONSTRAINT "nave_verse_links_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nave_verse_links" ADD CONSTRAINT "nave_verse_links_topic_fk" FOREIGN KEY ("publication_id","normalized_name") REFERENCES "public"."nave_topics"("publication_id","normalized_name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nave_topics_browse" ON "nave_topics" USING btree ("publication_id","initial","name");--> statement-breakpoint
CREATE INDEX "nave_topics_search" ON "nave_topics" USING btree ("publication_id","name");--> statement-breakpoint
CREATE INDEX "nave_verse_links_verse_lookup" ON "nave_verse_links" USING btree ("publication_id","verse_key");--> statement-breakpoint
CREATE INDEX "nave_verse_links_topic_lookup" ON "nave_verse_links" USING btree ("publication_id","normalized_name");