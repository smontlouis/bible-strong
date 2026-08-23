CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bible_search_normalize(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        replace(lower(public.unaccent('public.unaccent', input)), 'ς', 'σ'),
        '[֑-ׇ]',
        '',
        'g'
      ),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  )
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bible_verses_normalized_fts
  ON bible_verses
  USING gin (to_tsvector('simple', bible_search_normalize(text)));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bible_verses_normalized_trigram
  ON bible_verses
  USING gin (bible_search_normalize(text) gin_trgm_ops);
