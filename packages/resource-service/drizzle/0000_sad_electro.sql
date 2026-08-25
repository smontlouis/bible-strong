CREATE TYPE "public"."resource_publication_status" AS ENUM('staged', 'active');--> statement-breakpoint
CREATE TABLE "bible_verses" (
	"publication_id" integer NOT NULL,
	"book" integer NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"text" text NOT NULL,
	"presentation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "bible_verses_publication_location_primary" PRIMARY KEY("publication_id","book","chapter","verse")
);
--> statement-breakpoint
CREATE TABLE "resource_publications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resource_publications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"resource_identity" text NOT NULL,
	"resource_kind" text NOT NULL,
	"revision" text NOT NULL,
	"language" text,
	"status" "resource_publication_status" DEFAULT 'staged' NOT NULL,
	"canonical_sha256" text NOT NULL,
	"offline_artifact_sha256" text NOT NULL,
	"provenance" jsonb NOT NULL,
	"rights" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bible_verses" ADD CONSTRAINT "bible_verses_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bible_verses_chapter_lookup" ON "bible_verses" USING btree ("publication_id","book","chapter","verse");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_publications_identity_revision_unique" ON "resource_publications" USING btree ("resource_identity","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_publications_one_active_identity" ON "resource_publications" USING btree ("resource_identity") WHERE "resource_publications"."status" = 'active';