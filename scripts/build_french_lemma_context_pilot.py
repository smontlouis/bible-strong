#!/usr/bin/env python3
"""Build a conservative, contextual French-lemma pilot for the LSG SQLite."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import unicodedata
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator, NamedTuple

import stanza

VERSION = "french-lemma-context@2"
ELISIONS = {"c", "d", "j", "l", "m", "n", "qu", "s", "t"}
POS_MAP = {
    "ADJ": "adj",
    "ADP": "prep",
    "ADV": "adv",
    "AUX": "verb",
    "CCONJ": "conj",
    "DET": "det",
    "INTJ": "intj",
    "NOUN": "noun",
    "NUM": "num",
    "PART": "particle",
    "PRON": "pron",
    "PROPN": "name",
    "SCONJ": "conj",
    "VERB": "verb",
}
CONTENT_POS = {
    "ADJ",
    "ADV",
    "AUX",
    "INTJ",
    "NOUN",
    "NUM",
    "PRON",
    "PROPN",
    "VERB",
}


class Candidate(NamedTuple):
    lemma: str
    part_of_speech: str


class Span(NamedTuple):
    verse_id: int
    ordinal: int
    start: int
    length: int
    surface: str
    normalized: str


class Decision(NamedTuple):
    candidate: Candidate | None
    method: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--kaikki", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--model", default="gsd")
    return parser.parse_args()


def normalize_word(value: str) -> str:
    lowered = unicodedata.normalize("NFD", value.lower())
    stripped = "".join(
        character
        for character in lowered
        if unicodedata.category(character) != "Mn"
    )
    stripped = stripped.replace("œ", "oe").replace("æ", "ae")
    stripped = "".join(
        "-" if character in "‐‑‒–—" else character
        for character in stripped
        if character.isalnum() or character in "'’‐‑‒–—-"
    )
    for apostrophe in ("'", "’"):
        if apostrophe in stripped:
            prefix, suffix = stripped.split(apostrophe, 1)
            if prefix in ELISIONS and suffix:
                return suffix
    return stripped


def display_lemma(value: str) -> str:
    return (
        unicodedata.normalize("NFC", value.strip().lower())
        .replace("’", "'")
        .replace("‐", "-")
        .replace("‑", "-")
        .replace("‒", "-")
        .replace("–", "-")
        .replace("—", "-")
    )


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def metadata(connection: sqlite3.Connection, key: str) -> str:
    row = connection.execute(
        "SELECT value FROM ResourceMetadata WHERE key=?", (key,)
    ).fetchone()
    if row is None:
        raise RuntimeError(f"missing-resource-metadata:{key}")
    return str(row[0])


def read_source(
    connection: sqlite3.Connection,
) -> tuple[list[tuple[int, str, list[Span]]], list[Span]]:
    columns = {
        str(row[1]) for row in connection.execute("PRAGMA table_info(WordSpans)")
    }
    if "lexemeId" in columns:
        raise RuntimeError("source-already-enriched")
    if metadata(connection, "schemaVersion") != "2":
        raise RuntimeError("incompatible-schema")
    if metadata(connection, "datasetId") != "LSG":
        raise RuntimeError("incompatible-dataset")

    verses: list[tuple[int, str, list[Span]]] = []
    all_spans: list[Span] = []
    cursor = connection.execute(
        """
        SELECT v.id, v.canonicalText, o.ordinal, o.startOffset, o.length,
               substr(v.canonicalText, o.startOffset + 1, o.length)
        FROM Verses v
        LEFT JOIN WordSpans o ON o.verseId=v.id
        ORDER BY v.id, o.ordinal
        """
    )
    current_id: int | None = None
    current_text = ""
    current_spans: list[Span] = []
    for verse_id, text, ordinal, start, length, surface in cursor:
        verse_id = int(verse_id)
        if current_id is not None and verse_id != current_id:
            verses.append((current_id, current_text, current_spans))
            current_spans = []
        current_id = verse_id
        current_text = str(text)
        if ordinal is not None:
            span = Span(
                verse_id,
                int(ordinal),
                int(start),
                int(length),
                str(surface),
                normalize_word(str(surface)),
            )
            current_spans.append(span)
            all_spans.append(span)
    if current_id is not None:
        verses.append((current_id, current_text, current_spans))
    return verses, all_spans


def kaikk_candidates(
    file_path: Path, target_forms: set[str]
) -> dict[str, tuple[Candidate, ...]]:
    raw: dict[str, set[Candidate]] = defaultdict(set)
    pending = set(target_forms)
    for _ in range(4):
        if not pending:
            break
        read_kaikki_pass(file_path, pending, raw)
        next_pending: set[str] = set()
        for form in pending:
            for candidate in raw.get(form, ()):
                candidate_form = normalize_word(candidate.lemma)
                if (
                    candidate_form
                    and candidate_form != form
                    and candidate_form not in raw
                ):
                    next_pending.add(candidate_form)
        pending = next_pending

    result: dict[str, tuple[Candidate, ...]] = {}
    for form in target_forms:
        if form not in raw:
            continue
        collapsed = {
            expanded
            for candidate in raw[form]
            for expanded in expand_candidate(candidate, raw)
        }
        result[form] = tuple(
            sorted(collapsed, key=lambda item: (item.lemma, item.part_of_speech))
        )
    return result


def read_kaikki_pass(
    file_path: Path,
    target_forms: set[str],
    raw: dict[str, set[Candidate]],
) -> None:
    with file_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("lang_code") != "fr" or not isinstance(
                entry.get("word"), str
            ):
                continue
            form = normalize_word(entry["word"])
            if not form or form not in target_forms:
                continue
            part_of_speech = str(entry.get("pos") or "unknown").strip().lower()
            form_of: set[str] = set()
            for sense in entry.get("senses") or ():
                if not isinstance(sense, dict):
                    continue
                for relation in sense.get("form_of") or ():
                    if isinstance(relation, dict) and isinstance(
                        relation.get("word"), str
                    ):
                        lemma = display_lemma(relation["word"])
                        if lemma:
                            form_of.add(lemma)
            lemmas = form_of or {display_lemma(entry["word"])}
            raw[form].update(
                Candidate(lemma, part_of_speech) for lemma in lemmas if lemma
            )


def expand_candidate(
    candidate: Candidate,
    raw: dict[str, set[Candidate]],
    *,
    depth: int = 0,
    visited: frozenset[str] = frozenset(),
) -> set[Candidate]:
    form = normalize_word(candidate.lemma)
    if not form or depth >= 4 or form in visited:
        return {candidate}
    next_candidates = {
        item
        for item in raw.get(form, ())
        if item.part_of_speech == candidate.part_of_speech
        and normalize_word(item.lemma) != form
    }
    if not next_candidates:
        return {candidate}
    expanded: set[Candidate] = (
        {candidate} if candidate in raw.get(form, set()) else set()
    )
    for item in next_candidates:
        expanded.update(
            expand_candidate(
                item,
                raw,
                depth=depth + 1,
                visited=visited | {form},
            )
        )
    return expanded


def stanza_candidate(document: object, span: Span) -> Candidate | None:
    end = span.start + span.length
    words = [
        word
        for sentence in document.sentences
        for word in sentence.words
        if word.start_char is not None
        and word.end_char is not None
        and word.start_char < end
        and word.end_char > span.start
        and word.upos not in {"PUNCT", "SPACE", "SYM"}
    ]
    if len(words) > 1:
        content = [word for word in words if word.upos in CONTENT_POS]
        if len(content) == 1:
            words = content
    if len(words) != 1:
        return None
    word = words[0]
    lemma = display_lemma(word.lemma or "")
    part_of_speech = POS_MAP.get(word.upos or "", "unknown")
    if not lemma or lemma == "-pron-" or part_of_speech == "unknown":
        return None
    return Candidate(lemma, part_of_speech)


def decide(
    contextual: Candidate | None,
    dictionary: tuple[Candidate, ...],
    normalized_surface: str,
) -> Decision:
    if not normalized_surface:
        return Decision(None, 0)
    if (
        normalized_surface[-1:] in {"'", "’"}
        and normalized_surface[:-1] in ELISIONS
    ):
        return Decision(None, 4)
    if contextual is not None and dictionary:
        if contextual in dictionary:
            return Decision(contextual, 1)
        same_lemma = [
            candidate
            for candidate in dictionary
            if normalize_word(candidate.lemma) == normalize_word(contextual.lemma)
            and candidate.part_of_speech == contextual.part_of_speech
        ]
        if same_lemma:
            return Decision(same_lemma[0], 2)
        same_pos = [
            candidate
            for candidate in dictionary
            if candidate.part_of_speech == contextual.part_of_speech
        ]
        surface_lemmas = [
            candidate
            for candidate in same_pos
            if normalize_word(candidate.lemma) == normalized_surface
        ]
        if len(surface_lemmas) == 1:
            return Decision(surface_lemmas[0], 5)
        if len(same_pos) == 1:
            return Decision(same_pos[0], 5)
        return Decision(None, 3)
    if contextual is not None:
        return Decision(contextual, 6)
    if len(dictionary) == 1:
        return Decision(dictionary[0], 5)
    return Decision(None, 4 if not dictionary else 3)


def build_decisions(
    verses: list[tuple[int, str, list[Span]]],
    candidates: dict[str, tuple[Candidate, ...]],
    model_name: str,
) -> tuple[list[tuple[Span, Decision]], dict[str, str]]:
    pipeline = stanza.Pipeline(
        "fr",
        processors="tokenize,pos,lemma",
        package=model_name,
        use_gpu=False,
        verbose=False,
    )
    model_meta = {
        "stanzaVersion": stanza.__version__,
        "modelName": f"fr_{model_name}",
        "modelProcessors": "tokenize,pos,lemma",
    }
    output: list[tuple[Span, Decision]] = []
    for start in range(0, len(verses), 64):
        batch = verses[start : start + 64]
        documents = pipeline.bulk_process([text for _, text, _ in batch])
        for (_, _, spans), document in zip(batch, documents, strict=True):
            for span in spans:
                contextual = stanza_candidate(document, span)
                output.append(
                    (
                        span,
                        decide(
                            contextual,
                            candidates.get(span.normalized, ()),
                            span.normalized,
                        ),
                    )
                )
        if start == 0 or (start // 64 + 1) % 16 == 0:
            processed = min(start + len(batch), len(verses))
            print(
                f"lemma-context-progress:{processed}/{len(verses)}",
                file=sys.stderr,
                flush=True,
            )
    return output, model_meta


def enrich_database(
    database_path: Path,
    decisions: list[tuple[Span, Decision]],
    model_meta: dict[str, str],
) -> Counter[int]:
    connection = sqlite3.connect(database_path)
    methods: Counter[int] = Counter()
    try:
        connection.executescript(
            """
            ALTER TABLE WordSpans ADD COLUMN lexemeId INTEGER;
            ALTER TABLE WordSpans ADD COLUMN lemmaMethod INTEGER NOT NULL
              DEFAULT 0 CHECK(lemmaMethod BETWEEN 0 AND 7);
            CREATE TABLE FrenchLexemes (
              id INTEGER PRIMARY KEY,
              lemma TEXT NOT NULL,
              partOfSpeech TEXT NOT NULL,
              UNIQUE(lemma, partOfSpeech)
            );
            CREATE TABLE FrenchLemmaMetadata (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            ) WITHOUT ROWID;
            """
        )
        lexeme_ids: dict[Candidate, int] = {}
        with connection:
            for span, decision in decisions:
                methods[decision.method] += 1
                lexeme_id: int | None = None
                if decision.candidate is not None:
                    lexeme_id = lexeme_ids.get(decision.candidate)
                    if lexeme_id is None:
                        cursor = connection.execute(
                            """
                            INSERT INTO FrenchLexemes(lemma, partOfSpeech)
                            VALUES (?, ?)
                            """,
                            decision.candidate,
                        )
                        lexeme_id = int(cursor.lastrowid)
                        lexeme_ids[decision.candidate] = lexeme_id
                if decision.method != 0:
                    connection.execute(
                        """
                        UPDATE WordSpans SET lexemeId=?, lemmaMethod=?
                        WHERE verseId=? AND ordinal=?
                        """,
                        (
                            lexeme_id,
                            decision.method,
                            span.verse_id,
                            span.ordinal,
                        ),
                    )
            metadata_values = {
                "version": VERSION,
                "source": "Stanza contextual French + Kaikki dictionary validation",
                **model_meta,
                "method0": "empty",
                "method1": "context-dictionary-exact-agreement",
                "method2": "context-dictionary-normalized-lemma-and-pos-agreement",
                "method3": "context-dictionary-conflict-unresolved",
                "method4": "unavailable",
                "method5": "unique-dictionary-pos-fallback",
                "method6": "context-only",
                "method7": "alignment-failed",
            }
            connection.executemany(
                "INSERT INTO FrenchLemmaMetadata(key, value) VALUES (?, ?)",
                metadata_values.items(),
            )
        connection.execute("ANALYZE")
        connection.execute("VACUUM")
    finally:
        connection.close()
    return methods


def database_counts(file_path: Path) -> dict[str, int]:
    connection = sqlite3.connect(file_path)
    try:
        return {
            "verses": int(connection.execute("SELECT COUNT(*) FROM Verses").fetchone()[0]),
            "spans": int(connection.execute("SELECT COUNT(*) FROM WordSpans").fetchone()[0]),
            "codes": int(
                connection.execute("SELECT COUNT(*) FROM StrongCodes").fetchone()[0]
            ),
            "links": int(
                connection.execute("SELECT COUNT(*) FROM WordStrongCodes").fetchone()[0]
            ),
        }
    finally:
        connection.close()


def top_lemmas(file_path: Path) -> list[dict[str, object]]:
    connection = sqlite3.connect(file_path)
    connection.row_factory = sqlite3.Row
    try:
        return [
            dict(row)
            for row in connection.execute(
                """
                SELECT l.lemma, l.partOfSpeech, COUNT(*) AS occurrences
                FROM WordSpans o JOIN FrenchLexemes l ON l.id=o.lexemeId
                GROUP BY l.id
                ORDER BY occurrences DESC, l.lemma, l.partOfSpeech
                LIMIT 50
                """
            )
        ]
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    kaikki = Path(args.kaikki).resolve()
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    if not source.exists() or not kaikki.exists():
        raise RuntimeError("source-missing")
    if output.exists() or report_path.exists():
        raise RuntimeError("output-already-exists")
    output.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(
        f"{output.name}.tmp-{os.getpid()}-{uuid.uuid4().hex}"
    )
    shutil.copy2(source, temporary)
    try:
        connection = sqlite3.connect(temporary)
        try:
            verses, spans = read_source(connection)
        finally:
            connection.close()
        target_forms = {span.normalized for span in spans if span.normalized}
        candidates = kaikk_candidates(kaikki, target_forms)
        decisions, model_meta = build_decisions(verses, candidates, args.model)
        methods = enrich_database(temporary, decisions, model_meta)
        source_counts = database_counts(source)
        output_counts = database_counts(temporary)
        if source_counts != output_counts:
            raise RuntimeError(
                f"core-count-mismatch:{source_counts!r}:{output_counts!r}"
            )
        connection = sqlite3.connect(temporary)
        try:
            integrity = str(connection.execute("PRAGMA integrity_check").fetchone()[0])
            lexeme_count = int(
                connection.execute("SELECT COUNT(*) FROM FrenchLexemes").fetchone()[0]
            )
        finally:
            connection.close()
        if integrity != "ok":
            raise RuntimeError(f"integrity-check:{integrity}")
        nonempty = len(spans) - methods[0]
        resolved = sum(methods[index] for index in (1, 2, 5, 6))
        report = {
            "format": "french-lemma-context-report",
            "version": VERSION,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "sourceDatabase": str(source),
            "sourceDatabaseSha256": sha256_file(source),
            "kaikkiSource": str(kaikki),
            "kaikkiSourceSha256": sha256_file(kaikki),
            "outputDatabase": str(output),
            "outputDatabaseSha256": sha256_file(temporary),
            "sourceBytes": source.stat().st_size,
            "outputBytes": temporary.stat().st_size,
            "addedBytes": temporary.stat().st_size - source.stat().st_size,
            "spanCount": len(spans),
            "emptySpanCount": methods[0],
            "nonEmptySpanCount": nonempty,
            "distinctNormalizedForms": len(target_forms),
            "dictionaryCoveredForms": sum(
                1 for form in target_forms if candidates.get(form)
            ),
            "resolvedCount": resolved,
            "resolvedPercent": round(resolved * 100 / nonempty, 2),
            "methodCounts": {str(index): methods[index] for index in range(8)},
            "lexemeCount": lexeme_count,
            "coreCounts": output_counts,
            "integrityCheck": integrity,
            **model_meta,
            "topLemmas": top_lemmas(temporary),
        }
        temporary.replace(output)
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        json.dump(report, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


if __name__ == "__main__":
    main()
