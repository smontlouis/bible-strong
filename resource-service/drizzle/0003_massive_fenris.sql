CREATE TABLE "strong_bible_identities" (
	"publication_id" integer NOT NULL,
	"identity_id" integer NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	CONSTRAINT "strong_bible_identities_publication_id_primary" PRIMARY KEY("publication_id","identity_id")
);
--> statement-breakpoint
CREATE TABLE "strong_bible_lexemes" (
	"publication_id" integer NOT NULL,
	"lexeme_id" integer NOT NULL,
	"lemma" text NOT NULL,
	"part_of_speech" text NOT NULL,
	CONSTRAINT "strong_bible_lexemes_publication_id_primary" PRIMARY KEY("publication_id","lexeme_id")
);
--> statement-breakpoint
CREATE TABLE "strong_bible_span_identities" (
	"publication_id" integer NOT NULL,
	"book" integer NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"identity_order" integer NOT NULL,
	"identity_id" integer NOT NULL,
	CONSTRAINT "strong_bible_span_identities_publication_location_primary" PRIMARY KEY("publication_id","book","chapter","verse","ordinal","identity_order")
);
--> statement-breakpoint
CREATE TABLE "strong_bible_spans" (
	"publication_id" integer NOT NULL,
	"book" integer NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"start_offset" integer NOT NULL,
	"length" integer NOT NULL,
	"is_aligned" boolean NOT NULL,
	"lexeme_id" integer,
	"step_token_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "strong_bible_spans_publication_location_primary" PRIMARY KEY("publication_id","book","chapter","verse","ordinal")
);
--> statement-breakpoint
CREATE TABLE "strong_bible_verses" (
	"publication_id" integer NOT NULL,
	"book" integer NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	CONSTRAINT "strong_bible_verses_publication_location_primary" PRIMARY KEY("publication_id","book","chapter","verse")
);
--> statement-breakpoint
ALTER TABLE "strong_bible_identities" ADD CONSTRAINT "strong_bible_identities_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_bible_lexemes" ADD CONSTRAINT "strong_bible_lexemes_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_bible_span_identities" ADD CONSTRAINT "strong_bible_span_identities_span_fk" FOREIGN KEY ("publication_id","book","chapter","verse","ordinal") REFERENCES "public"."strong_bible_spans"("publication_id","book","chapter","verse","ordinal") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_bible_span_identities" ADD CONSTRAINT "strong_bible_span_identities_identity_fk" FOREIGN KEY ("publication_id","identity_id") REFERENCES "public"."strong_bible_identities"("publication_id","identity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_bible_spans" ADD CONSTRAINT "strong_bible_spans_verse_fk" FOREIGN KEY ("publication_id","book","chapter","verse") REFERENCES "public"."strong_bible_verses"("publication_id","book","chapter","verse") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_bible_spans" ADD CONSTRAINT "strong_bible_spans_lexeme_fk" FOREIGN KEY ("publication_id","lexeme_id") REFERENCES "public"."strong_bible_lexemes"("publication_id","lexeme_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strong_bible_verses" ADD CONSTRAINT "strong_bible_verses_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "strong_bible_identities_code_unique" ON "strong_bible_identities" USING btree ("publication_id","kind","code");--> statement-breakpoint
CREATE INDEX "strong_bible_lexemes_label_lookup" ON "strong_bible_lexemes" USING btree ("publication_id","lemma","part_of_speech");--> statement-breakpoint
CREATE INDEX "strong_bible_span_identities_lookup" ON "strong_bible_span_identities" USING btree ("publication_id","identity_id","book","chapter","verse");--> statement-breakpoint
CREATE INDEX "strong_bible_spans_chapter_lookup" ON "strong_bible_spans" USING btree ("publication_id","book","chapter","verse","ordinal");--> statement-breakpoint
CREATE INDEX "strong_bible_spans_lexeme_lookup" ON "strong_bible_spans" USING btree ("publication_id","lexeme_id");--> statement-breakpoint
CREATE INDEX "strong_bible_verses_chapter_lookup" ON "strong_bible_verses" USING btree ("publication_id","book","chapter","verse");