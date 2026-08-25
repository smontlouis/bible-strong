CREATE TABLE "thematic_import_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"source_versions" jsonb NOT NULL,
	"source_sha256" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"report" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thematic_topic_aliases" (
	"topic_id" text NOT NULL,
	"language" text NOT NULL,
	"alias" text NOT NULL,
	"normalized_alias" text NOT NULL,
	"method" text NOT NULL,
	"validation_status" text NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	CONSTRAINT "thematic_topic_aliases_primary" PRIMARY KEY("topic_id","language","normalized_alias")
);
--> statement-breakpoint
CREATE TABLE "thematic_topic_embeddings" (
	"topic_id" text NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"embedding" real[] NOT NULL,
	CONSTRAINT "thematic_topic_embeddings_primary" PRIMARY KEY("topic_id","model")
);
--> statement-breakpoint
CREATE TABLE "thematic_topic_passages" (
	"topic_id" text NOT NULL,
	"source" text NOT NULL,
	"book" integer NOT NULL,
	"chapter_start" integer NOT NULL,
	"verse_start" integer NOT NULL,
	"chapter_end" integer NOT NULL,
	"verse_end" integer NOT NULL,
	"source_score" double precision,
	"source_votes" integer,
	"provenance" jsonb NOT NULL,
	CONSTRAINT "thematic_topic_passages_primary" PRIMARY KEY("topic_id","source","book","chapter_start","verse_start","chapter_end","verse_end")
);
--> statement-breakpoint
CREATE TABLE "thematic_topic_relations" (
	"topic_id" text NOT NULL,
	"related_topic_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "thematic_topic_relations_primary" PRIMARY KEY("topic_id","related_topic_id","relation_type","source")
);
--> statement-breakpoint
CREATE TABLE "thematic_topic_sources" (
	"topic_id" text NOT NULL,
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"source_version" text NOT NULL,
	"original_name" text NOT NULL,
	"provenance" jsonb NOT NULL,
	CONSTRAINT "thematic_topic_sources_primary" PRIMARY KEY("source","source_key")
);
--> statement-breakpoint
CREATE TABLE "thematic_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"parent_id" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "thematic_topic_aliases" ADD CONSTRAINT "thematic_topic_aliases_topic_id_thematic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."thematic_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thematic_topic_embeddings" ADD CONSTRAINT "thematic_topic_embeddings_topic_id_thematic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."thematic_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thematic_topic_passages" ADD CONSTRAINT "thematic_topic_passages_topic_id_thematic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."thematic_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thematic_topic_relations" ADD CONSTRAINT "thematic_topic_relations_topic_id_thematic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."thematic_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thematic_topic_relations" ADD CONSTRAINT "thematic_topic_relations_related_topic_id_thematic_topics_id_fk" FOREIGN KEY ("related_topic_id") REFERENCES "public"."thematic_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thematic_topic_sources" ADD CONSTRAINT "thematic_topic_sources_topic_id_thematic_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."thematic_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "thematic_import_runs_completed" ON "thematic_import_runs" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "thematic_topic_aliases_exact_lookup" ON "thematic_topic_aliases" USING btree ("language","normalized_alias");--> statement-breakpoint
CREATE INDEX "thematic_topic_aliases_fts" ON "thematic_topic_aliases" USING gin (to_tsvector('simple', bible_search_normalize("alias")));--> statement-breakpoint
CREATE INDEX "thematic_topic_aliases_trigram" ON "thematic_topic_aliases" USING gin (bible_search_normalize("alias") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "thematic_topic_passages_topic_lookup" ON "thematic_topic_passages" USING btree ("topic_id","source","source_score");--> statement-breakpoint
CREATE INDEX "thematic_topic_passages_reference_lookup" ON "thematic_topic_passages" USING btree ("book","chapter_start","verse_start");--> statement-breakpoint
CREATE INDEX "thematic_topic_relations_topic_lookup" ON "thematic_topic_relations" USING btree ("topic_id","relation_type");--> statement-breakpoint
CREATE INDEX "thematic_topic_sources_topic_lookup" ON "thematic_topic_sources" USING btree ("topic_id","source");--> statement-breakpoint
CREATE UNIQUE INDEX "thematic_topics_normalized_name_unique" ON "thematic_topics" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "thematic_topics_name_search" ON "thematic_topics" USING gin (to_tsvector('simple', bible_search_normalize("canonical_name")));--> statement-breakpoint
CREATE INDEX "thematic_topics_name_trigram" ON "thematic_topics" USING gin (bible_search_normalize("canonical_name") gin_trgm_ops);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION topic_cosine_similarity(left_vector real[], right_vector real[])
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(sum(left_value * right_vector[ordinality]), 0)::double precision
  FROM unnest(left_vector) WITH ORDINALITY AS values(left_value, ordinality)
  WHERE ordinality <= cardinality(right_vector)
$$;
