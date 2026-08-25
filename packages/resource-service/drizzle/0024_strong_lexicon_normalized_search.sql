DROP INDEX "strong_lexicon_entries_search";
--> statement-breakpoint
CREATE INDEX "strong_lexicon_entries_search"
  ON "strong_lexicon_entries"
  USING gin (
    bible_search_normalize(
      coalesce("payload"->>'original', '') || ' ' ||
      coalesce(nullif("payload"->>'classicTransliteration', ''), "payload"->>'transliteration', '') || ' ' ||
      coalesce("payload"->>'gloss', '') || ' ' ||
      "e_strong" || ' ' || "d_strong" || ' ' || "u_strong"
    ) gin_trgm_ops
  );
