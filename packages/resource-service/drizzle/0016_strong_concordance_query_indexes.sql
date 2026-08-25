CREATE INDEX "strong_bible_span_identities_concordance_cursor" ON "strong_bible_span_identities" USING btree ("publication_id","identity_id","book","chapter","verse","ordinal");--> statement-breakpoint
CREATE INDEX "strong_bible_spans_lexeme_location_lookup" ON "strong_bible_spans" USING btree ("publication_id","lexeme_id","book","chapter","verse","ordinal");
