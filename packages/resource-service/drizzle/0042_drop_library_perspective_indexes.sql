-- The partial indexes of 0041 did not improve the assistant's answers and made the search within each
-- perspective slower (ADR-0103, amendment of 2026-11-12): searches use the shared index again.
DROP INDEX "library_passages_adventist_hnsw";--> statement-breakpoint
DROP INDEX "library_passages_catholic_hnsw";--> statement-breakpoint
DROP INDEX "library_passages_patristic_hnsw";--> statement-breakpoint
DROP INDEX "library_passages_jewish_hnsw";--> statement-breakpoint
DROP INDEX "library_passages_evangelical_hnsw";--> statement-breakpoint
DROP INDEX "library_passages_academic_hnsw";--> statement-breakpoint
DROP INDEX "library_passages_reference_hnsw";