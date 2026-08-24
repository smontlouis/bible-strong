CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
TRUNCATE TABLE "thematic_topic_embeddings";--> statement-breakpoint
ALTER TABLE "thematic_topic_embeddings" ALTER COLUMN "embedding" SET DATA TYPE vector(1024) USING "embedding"::text::vector;--> statement-breakpoint
ALTER TABLE "thematic_topic_embeddings" ADD COLUMN "contract" text NOT NULL;--> statement-breakpoint
ALTER TABLE "thematic_topic_embeddings" ADD COLUMN "input_sha256" text NOT NULL;--> statement-breakpoint
ALTER TABLE "thematic_topic_embeddings" DROP CONSTRAINT "thematic_topic_embeddings_primary";
--> statement-breakpoint
ALTER TABLE "thematic_topic_embeddings" ADD CONSTRAINT "thematic_topic_embeddings_primary" PRIMARY KEY("topic_id","model","contract");
--> statement-breakpoint
DROP FUNCTION IF EXISTS topic_cosine_similarity(real[], real[]);
