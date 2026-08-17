CREATE TABLE "interlinear_bible_segment_identities" (
	"publication_id" integer NOT NULL,
	"segment_id" integer NOT NULL,
	"identity_order" integer NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	CONSTRAINT "interlinear_bible_segment_identities_primary" PRIMARY KEY("publication_id","segment_id","identity_order")
);
--> statement-breakpoint
CREATE TABLE "interlinear_bible_segments" (
	"publication_id" integer NOT NULL,
	"segment_id" integer NOT NULL,
	"token_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"start_offset" integer NOT NULL,
	"length" integer NOT NULL,
	"transliteration" text NOT NULL,
	"lemma" text NOT NULL,
	"morphology" text NOT NULL,
	"gloss" text NOT NULL,
	CONSTRAINT "interlinear_bible_segments_publication_id_primary" PRIMARY KEY("publication_id","segment_id")
);
--> statement-breakpoint
CREATE TABLE "interlinear_bible_tokens" (
	"publication_id" integer NOT NULL,
	"token_id" integer NOT NULL,
	"verse_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"start_offset" integer NOT NULL,
	"length" integer NOT NULL,
	CONSTRAINT "interlinear_bible_tokens_publication_id_primary" PRIMARY KEY("publication_id","token_id")
);
--> statement-breakpoint
CREATE TABLE "interlinear_bible_verses" (
	"publication_id" integer NOT NULL,
	"verse_id" integer NOT NULL,
	"book" integer NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	CONSTRAINT "interlinear_bible_verses_publication_id_primary" PRIMARY KEY("publication_id","verse_id")
);
--> statement-breakpoint
ALTER TABLE "interlinear_bible_segment_identities" ADD CONSTRAINT "interlinear_bible_segment_identities_segment_fk" FOREIGN KEY ("publication_id","segment_id") REFERENCES "public"."interlinear_bible_segments"("publication_id","segment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interlinear_bible_segments" ADD CONSTRAINT "interlinear_bible_segments_token_fk" FOREIGN KEY ("publication_id","token_id") REFERENCES "public"."interlinear_bible_tokens"("publication_id","token_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interlinear_bible_tokens" ADD CONSTRAINT "interlinear_bible_tokens_verse_fk" FOREIGN KEY ("publication_id","verse_id") REFERENCES "public"."interlinear_bible_verses"("publication_id","verse_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interlinear_bible_verses" ADD CONSTRAINT "interlinear_bible_verses_publication_id_resource_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."resource_publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interlinear_bible_segment_identities_code_lookup" ON "interlinear_bible_segment_identities" USING btree ("publication_id","kind","code");--> statement-breakpoint
CREATE UNIQUE INDEX "interlinear_bible_segments_token_ordinal_unique" ON "interlinear_bible_segments" USING btree ("publication_id","token_id","ordinal");--> statement-breakpoint
CREATE INDEX "interlinear_bible_segments_token_lookup" ON "interlinear_bible_segments" USING btree ("publication_id","token_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "interlinear_bible_tokens_verse_ordinal_unique" ON "interlinear_bible_tokens" USING btree ("publication_id","verse_id","ordinal");--> statement-breakpoint
CREATE INDEX "interlinear_bible_tokens_verse_lookup" ON "interlinear_bible_tokens" USING btree ("publication_id","verse_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "interlinear_bible_verses_location_unique" ON "interlinear_bible_verses" USING btree ("publication_id","book","chapter","verse");--> statement-breakpoint
CREATE INDEX "interlinear_bible_verses_chapter_lookup" ON "interlinear_bible_verses" USING btree ("publication_id","book","chapter","verse");