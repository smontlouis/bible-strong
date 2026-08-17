CREATE TABLE "strong_lexicon_records" (
	"publication_id" integer NOT NULL,
	"table_name" text NOT NULL,
	"record_key" text NOT NULL,
	"entry_id" integer,
	"language" text,
	"code" text,
	"unique_name" text,
	"payload" jsonb NOT NULL,
	CONSTRAINT "strong_lexicon_records_primary" PRIMARY KEY("publication_id","table_name","record_key")
);
--> statement-breakpoint
ALTER TABLE "strong_lexicon_records" ADD CONSTRAINT "strong_lexicon_records_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "strong_lexicon_records_entry_lookup" ON "strong_lexicon_records" USING btree ("publication_id","table_name","entry_id");--> statement-breakpoint
CREATE INDEX "strong_lexicon_records_code_lookup" ON "strong_lexicon_records" USING btree ("publication_id","table_name","code");--> statement-breakpoint
CREATE INDEX "strong_lexicon_records_unique_name_lookup" ON "strong_lexicon_records" USING btree ("publication_id","table_name","unique_name");