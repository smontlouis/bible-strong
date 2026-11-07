CREATE TABLE "library_passages" (
	"publication_id" integer NOT NULL,
	"passage_key" text NOT NULL,
	"corpus" text NOT NULL,
	"language" text NOT NULL,
	"work" text NOT NULL,
	"work_title" text NOT NULL,
	"tradition" text,
	"tags" jsonb NOT NULL,
	"title" text NOT NULL,
	"heading" text NOT NULL,
	"book" integer,
	"chapter" integer,
	"verse_start" integer,
	"verse_end" integer,
	"part" integer NOT NULL,
	"content" text NOT NULL,
	"target" jsonb NOT NULL,
	"model" text NOT NULL,
	"contract" text NOT NULL,
	"input_sha256" text NOT NULL,
	"embedding" halfvec(1024) NOT NULL,
	"search_vector" "tsvector" NOT NULL,
	CONSTRAINT "library_passages_primary" PRIMARY KEY("publication_id","passage_key")
);
--> statement-breakpoint
ALTER TABLE "library_passages" ADD CONSTRAINT "library_passages_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_passages_cosine_hnsw" ON "library_passages" USING hnsw ("embedding" halfvec_cosine_ops) WITH (m=16,ef_construction=64);--> statement-breakpoint
CREATE INDEX "library_passages_search_vector" ON "library_passages" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "library_passages_scope" ON "library_passages" USING btree ("corpus","language","work");--> statement-breakpoint
CREATE INDEX "library_passages_chapter" ON "library_passages" USING btree ("book","chapter");