CREATE TABLE "strong_lexicon_morphology_code_translations" (
	"publication_id" integer NOT NULL,
	"morphology_code_id" integer NOT NULL,
	"language" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_morphology_code_translations_primary" PRIMARY KEY("publication_id","morphology_code_id","language")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_morphology_codes" (
	"publication_id" integer NOT NULL,
	"morphology_code_id" integer NOT NULL,
	"code" text NOT NULL,
	"normalized_code" text NOT NULL,
	"language" text NOT NULL,
	"scope" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_morphology_codes_primary" PRIMARY KEY("publication_id","morphology_code_id")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_relation_kinds" (
	"publication_id" integer NOT NULL,
	"relation_kind_id" integer NOT NULL,
	"kind" text NOT NULL,
	"label_en" text NOT NULL,
	"label_fr" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_relation_kinds_primary" PRIMARY KEY("publication_id","relation_kind_id")
);
