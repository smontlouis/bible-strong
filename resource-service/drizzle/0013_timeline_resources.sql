CREATE TABLE "timeline_events" (
	"publication_id" integer NOT NULL,
	"event_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"article" text NOT NULL,
	"period" text NOT NULL,
	"dates" text NOT NULL,
	"related" jsonb NOT NULL,
	"images" jsonb NOT NULL,
	"videos" jsonb NOT NULL,
	"scriptures" jsonb NOT NULL,
	CONSTRAINT "timeline_events_publication_event_primary" PRIMARY KEY("publication_id","event_id")
);
--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "timeline_events_publication_slug_unique" ON "timeline_events" USING btree ("publication_id","slug");
--> statement-breakpoint
CREATE INDEX "timeline_events_browse" ON "timeline_events" USING btree ("publication_id","ordinal");
