CREATE TABLE "strong_lexicon_entities" (
	"publication_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"unique_name" text NOT NULL,
	"u_strong" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_entities_primary" PRIMARY KEY("publication_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_entity_places" (
	"publication_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_entity_places_primary" PRIMARY KEY("publication_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_entity_refs" (
	"publication_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"book" text NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"suffix" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_entity_refs_primary" PRIMARY KEY("publication_id","entity_id","book","chapter","verse","suffix")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_entity_relations" (
	"publication_id" integer NOT NULL,
	"relation_id" integer NOT NULL,
	"from_entity_id" integer NOT NULL,
	"to_entity_id" integer,
	"relation" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_entity_relations_primary" PRIMARY KEY("publication_id","relation_id")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_entity_translations" (
	"publication_id" integer NOT NULL,
	"translation_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"language" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_entity_translations_primary" PRIMARY KEY("publication_id","translation_id")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_entries" (
	"publication_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"language" text NOT NULL,
	"e_strong" text NOT NULL,
	"d_strong" text NOT NULL,
	"u_strong" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_entries_primary" PRIMARY KEY("publication_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_entry_identities" (
	"publication_id" integer NOT NULL,
	"step_entry_id" integer NOT NULL,
	"step_code" text NOT NULL,
	CONSTRAINT "strong_lexicon_entry_identities_primary" PRIMARY KEY("publication_id","step_entry_id")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_relations" (
	"publication_id" integer NOT NULL,
	"relation_id" integer NOT NULL,
	"from_entry_id" integer NOT NULL,
	"to_entry_id" integer,
	"relation_kind_id" integer,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_relations_primary" PRIMARY KEY("publication_id","relation_id")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_resource_translations" (
	"publication_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"language" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_resource_translations_primary" PRIMARY KEY("publication_id","resource_id","language")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_resources" (
	"publication_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"step_entry_id" integer NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_resources_primary" PRIMARY KEY("publication_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "strong_lexicon_translations" (
	"publication_id" integer NOT NULL,
	"step_entry_id" integer NOT NULL,
	"language" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_translations_primary" PRIMARY KEY("publication_id","step_entry_id","language")
);
--> statement-breakpoint
ALTER TABLE "strong_lexicon_entity_places" ADD CONSTRAINT "strong_lexicon_entity_places_entity_fk" FOREIGN KEY ("publication_id","entity_id") REFERENCES "public"."strong_lexicon_entities"("publication_id","entity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_lexicon_entity_refs" ADD CONSTRAINT "strong_lexicon_entity_refs_entity_fk" FOREIGN KEY ("publication_id","entity_id") REFERENCES "public"."strong_lexicon_entities"("publication_id","entity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_lexicon_entity_relations" ADD CONSTRAINT "strong_lexicon_entity_relations_from_fk" FOREIGN KEY ("publication_id","from_entity_id") REFERENCES "public"."strong_lexicon_entities"("publication_id","entity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_lexicon_entity_relations" ADD CONSTRAINT "strong_lexicon_entity_relations_to_fk" FOREIGN KEY ("publication_id","to_entity_id") REFERENCES "public"."strong_lexicon_entities"("publication_id","entity_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_lexicon_entity_translations" ADD CONSTRAINT "strong_lexicon_entity_translations_entity_fk" FOREIGN KEY ("publication_id","entity_id") REFERENCES "public"."strong_lexicon_entities"("publication_id","entity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_lexicon_entries" ADD CONSTRAINT "strong_lexicon_entries_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_lexicon_entry_identities" ADD CONSTRAINT "strong_lexicon_entry_identities_entry_fk" FOREIGN KEY ("publication_id","step_entry_id") REFERENCES "public"."strong_lexicon_entries"("publication_id","entry_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_lexicon_relations" ADD CONSTRAINT "strong_lexicon_relations_from_entry_fk" FOREIGN KEY ("publication_id","from_entry_id") REFERENCES "public"."strong_lexicon_entries"("publication_id","entry_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_lexicon_relations" ADD CONSTRAINT "strong_lexicon_relations_to_entry_fk" FOREIGN KEY ("publication_id","to_entry_id") REFERENCES "public"."strong_lexicon_entries"("publication_id","entry_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_lexicon_resource_translations" ADD CONSTRAINT "strong_lexicon_resource_translations_resource_fk" FOREIGN KEY ("publication_id","resource_id") REFERENCES "public"."strong_lexicon_resources"("publication_id","resource_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_lexicon_translations" ADD CONSTRAINT "strong_lexicon_translations_entry_fk" FOREIGN KEY ("publication_id","step_entry_id") REFERENCES "public"."strong_lexicon_entries"("publication_id","entry_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "strong_lexicon_entities_unique_name" ON "strong_lexicon_entities" USING btree ("publication_id","unique_name");--> statement-breakpoint
CREATE INDEX "strong_lexicon_entities_ustrong_lookup" ON "strong_lexicon_entities" USING btree ("publication_id","u_strong");--> statement-breakpoint
CREATE INDEX "strong_lexicon_entity_refs_chapter_lookup" ON "strong_lexicon_entity_refs" USING btree ("publication_id","book","chapter");--> statement-breakpoint
CREATE INDEX "strong_lexicon_entries_code_lookup" ON "strong_lexicon_entries" USING btree ("publication_id","e_strong","d_strong","u_strong");--> statement-breakpoint
CREATE UNIQUE INDEX "strong_lexicon_entry_identities_code_unique" ON "strong_lexicon_entry_identities" USING btree ("publication_id","step_code");
