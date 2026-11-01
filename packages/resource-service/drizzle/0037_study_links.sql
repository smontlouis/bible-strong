CREATE TABLE "study_link_nodes" (
	"publication_id" integer NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"label_fr" text NOT NULL,
	"label_en" text NOT NULL,
	"detail_fr" text,
	"detail_en" text,
	"language" text,
	"position" integer,
	CONSTRAINT "study_link_nodes_primary" PRIMARY KEY("publication_id","kind","key")
);
--> statement-breakpoint
CREATE TABLE "study_links" (
	"publication_id" integer NOT NULL,
	"left_kind" text NOT NULL,
	"left_key" text NOT NULL,
	"right_kind" text NOT NULL,
	"right_key" text NOT NULL,
	"role" text,
	CONSTRAINT "study_links_primary" PRIMARY KEY("publication_id","left_kind","left_key","right_kind","right_key")
);
--> statement-breakpoint
ALTER TABLE "study_link_nodes" ADD CONSTRAINT "study_link_nodes_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_links" ADD CONSTRAINT "study_links_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_links_right_lookup" ON "study_links" USING btree ("publication_id","right_kind","right_key");