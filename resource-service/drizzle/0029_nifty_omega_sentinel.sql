ALTER TABLE "strong_lexicon_relations" DROP CONSTRAINT "strong_lexicon_relations_to_entry_fk";
--> statement-breakpoint
ALTER TABLE "strong_lexicon_relations" ADD CONSTRAINT "strong_lexicon_relations_to_entry_fk" FOREIGN KEY ("publication_id","to_entry_id") REFERENCES "public"."strong_lexicon_entries"("publication_id","entry_id") ON DELETE cascade ON UPDATE no action;
