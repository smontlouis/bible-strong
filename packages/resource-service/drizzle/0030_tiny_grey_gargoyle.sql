ALTER TABLE "strong_lexicon_entity_relations" DROP CONSTRAINT "strong_lexicon_entity_relations_to_fk";
--> statement-breakpoint
ALTER TABLE "strong_lexicon_entity_relations" ADD CONSTRAINT "strong_lexicon_entity_relations_to_fk" FOREIGN KEY ("publication_id","to_entity_id") REFERENCES "public"."strong_lexicon_entities"("publication_id","entity_id") ON DELETE cascade ON UPDATE no action;