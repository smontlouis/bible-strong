#!/usr/bin/env python3
"""Download and losslessly inventory Strong-tagged SWORD Bible modules.

The output is an authoring/source layer, not the mobile payload. Every verse
keeps the exact OSIS fragment returned by the unlocked module. Presentation
features are inventoried so a later canonical projection can fail closed
instead of silently dropping unsupported markup.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import urllib.request
import zipfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from pysword.modules import SwordModules


CATALOG_FORMAT = "bible-strong-sword-source-catalog"
OUTPUT_FORMAT = "bible-strong-rich-source-jsonl"
MANIFEST_FORMAT = "bible-strong-rich-source-manifest"
SCHEMA_VERSION = 1
CANONICAL_BOOK_IDS = (
    "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr "
    "Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos "
    "Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom "
    "1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas "
    "1Pet 2Pet 1John 2John 3John Jude Rev"
).split()
CANONICAL_BOOK_NUMBER = {
    book_id: index + 1 for index, book_id in enumerate(CANONICAL_BOOK_IDS)
}
TAG_PATTERN = re.compile(r"<\s*/?\s*([A-Za-z_][\w:.-]*)\b", re.UNICODE)
ATTRIBUTE_PATTERN = re.compile(
    r"""\s([A-Za-z_][\w:.-]*)\s*=\s*(?:"[^"]*"|'[^']*')""", re.UNICODE
)
STRONG_PATTERN = re.compile(r"\bstrong:([HG]\d+[A-Za-z]?)\b", re.IGNORECASE)
WORDS_OF_JESUS_PATTERN = re.compile(
    r"""<q\b[^>]*\bwho\s*=\s*["']Jesus["']""", re.IGNORECASE
)
PARAGRAPH_PATTERN = re.compile(
    r"""<(?:p\b|(?:milestone|div)\b[^>]*(?:type|subType)\s*=\s*["'][^"']*x-(?:p|pm|extra-p)\b)""",
    re.IGNORECASE,
)
ITALIC_PATTERN = re.compile(
    r"""<(?:transChange\b|hi\b[^>]*\btype\s*=\s*["'](?:italic|italics)["'])""",
    re.IGNORECASE,
)
POETRY_PATTERN = re.compile(
    r"""<(?:l\b|milestone\b[^>]*(?:type|subType)\s*=\s*["'][^"']*x-poetry\b)""",
    re.IGNORECASE,
)
TITLE_PATTERN = re.compile(
    r"""<title\b(?P<attributes>[^>]*)>(?P<body>.*?)</title\s*>""",
    re.IGNORECASE | re.DOTALL,
)
TAG_STRIP_PATTERN = re.compile(r"<[^>]*>", re.DOTALL)
PERICOPE_TYPES = {
    "",
    "section",
    "subsection",
    "majorsection",
    "chapter",
    "sub",
}


@dataclass(frozen=True)
class Source:
    id: str
    application_version_id: str
    dataset_id: str
    module_name: str
    archive_name: str
    url: str
    sha256: str


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_catalog(path: Path) -> list[Source]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if (
        value.get("format") != CATALOG_FORMAT
        or value.get("schemaVersion") != SCHEMA_VERSION
        or not isinstance(value.get("sources"), list)
    ):
        raise ValueError(f"invalid source catalog: {path}")
    sources = []
    for item in value["sources"]:
        sources.append(
            Source(
                id=item["id"],
                application_version_id=item["applicationVersionId"],
                dataset_id=item["datasetId"],
                module_name=item["moduleName"],
                archive_name=item["archiveName"],
                url=item["url"],
                sha256=item["sha256"],
            )
        )
    if len({source.id for source in sources}) != len(sources):
        raise ValueError("duplicate source id")
    if any(source.application_version_id == "KJVS" for source in sources):
        raise ValueError("KJVS is intentionally forbidden")
    return sources


def ensure_archive(source: Source, archive_dir: Path, download: bool) -> Path:
    path = archive_dir / source.archive_name
    archive_dir.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        if not download:
            raise FileNotFoundError(
                f"missing {path}; rerun with --download to fetch the pinned source"
            )
        temporary = path.with_suffix(path.suffix + ".part")
        temporary.unlink(missing_ok=True)
        with urllib.request.urlopen(source.url) as response, temporary.open(
            "wb"
        ) as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        temporary.replace(path)
    actual_sha256 = sha256_file(path)
    if actual_sha256 != source.sha256:
        raise ValueError(
            f"source checksum mismatch for {source.id}: "
            f"{actual_sha256} != {source.sha256}"
        )
    with zipfile.ZipFile(path) as archive:
        bad_member = archive.testzip()
        if bad_member:
            raise ValueError(f"corrupt source archive {path}: {bad_member}")
    return path


def conf_text(archive_path: Path) -> str:
    with zipfile.ZipFile(archive_path) as archive:
        names = [name for name in archive.namelist() if name.endswith(".conf")]
        if len(names) != 1:
            raise ValueError(f"expected exactly one module conf in {archive_path}")
        return archive.read(names[0]).decode("utf-8-sig")


def parse_conf(text: str) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith("["):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key in values:
            current = values[key]
            values[key] = current + [value] if isinstance(current, list) else [
                current,
                value,
            ]
        else:
            values[key] = value
    return values


def parse_attributes(source: str) -> dict[str, str]:
    attributes = {}
    for match in re.finditer(
        r"""([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')""", source
    ):
        attributes[match.group(1)] = html.unescape(
            match.group(2) if match.group(2) is not None else match.group(3)
        )
    return attributes


def extract_headings(fragment: str) -> tuple[list[dict[str, Any]], bool]:
    well_formed = True
    try:
        ElementTree.fromstring(f"<root>{fragment}</root>")
    except ElementTree.ParseError:
        # Some valid SWORD modules use list/poetry milestones that begin in one
        # verse and end in another. The exact fragment is still retained.
        well_formed = False
    headings = []
    for order, match in enumerate(TITLE_PATTERN.finditer(fragment)):
        attributes = parse_attributes(match.group("attributes"))
        heading_type = attributes.get("type", "")
        normalized_type = heading_type.lower()
        headings.append(
            {
                "order": order,
                "type": heading_type or "unspecified",
                **(
                    {"subType": attributes["subType"]}
                    if "subType" in attributes
                    else {}
                ),
                "isPericope": normalized_type in PERICOPE_TYPES,
                "text": html.unescape(
                    TAG_STRIP_PATTERN.sub("", match.group("body"))
                ),
                "sourceMarkup": match.group(0),
            }
        )
    return headings, well_formed


def update_inventory(
    fragment: str,
    headings: list[dict[str, Any]],
    tag_counts: Counter[str],
    attribute_counts: Counter[str],
    feature_counts: Counter[str],
) -> None:
    for match in TAG_PATTERN.finditer(fragment):
        tag_counts[match.group(1)] += 1
    for match in ATTRIBUTE_PATTERN.finditer(fragment):
        attribute_counts[match.group(1)] += 1
    strong_codes = STRONG_PATTERN.findall(fragment)
    feature_counts["strongIdentityCount"] += len(strong_codes)
    feature_counts["strongWordCount"] += len(
        re.findall(r"<w\b[^>]*\blemma\s*=\s*[\"'][^\"']*\bstrong:", fragment)
    )
    feature_counts["morphologyElementCount"] += len(
        re.findall(r"<w\b[^>]*\bmorph\s*=", fragment)
    )
    feature_counts["noteCount"] += len(re.findall(r"<note\b", fragment))
    feature_counts["crossReferenceCount"] += len(
        re.findall(r"<reference\b", fragment)
    )
    feature_counts["redLetterSpanCount"] += len(
        WORDS_OF_JESUS_PATTERN.findall(fragment)
    )
    feature_counts["paragraphMilestoneCount"] += len(
        PARAGRAPH_PATTERN.findall(fragment)
    )
    feature_counts["italicOrAddedSpanCount"] += len(
        ITALIC_PATTERN.findall(fragment)
    )
    feature_counts["divineNameSpanCount"] += len(
        re.findall(r"<divineName\b", fragment)
    )
    feature_counts["poetryLineCount"] += len(POETRY_PATTERN.findall(fragment))
    feature_counts["headingCount"] += len(headings)
    feature_counts["pericopeCount"] += sum(
        1 for heading in headings if heading["isPericope"]
    )


def extract_source(source: Source, archive_path: Path, output_root: Path) -> dict:
    modules = SwordModules(paths=[str(archive_path)])
    metadata = modules.parse_modules()
    if source.module_name not in metadata:
        raise ValueError(
            f"module {source.module_name} absent from {archive_path}; "
            f"found {sorted(metadata)}"
        )
    bible = modules.get_bible_from_module(source.module_name)
    structure = bible.get_structure().get_books()
    output_dir = output_root / source.id
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"bible-{source.id}-source-rich.jsonl"
    tag_counts: Counter[str] = Counter()
    attribute_counts: Counter[str] = Counter()
    feature_counts: Counter[str] = Counter()
    book_summaries = []
    verse_count = 0
    canonical_verse_count = 0
    supplemental_verse_count = 0
    parse_failure_count = 0
    parse_failure_refs = []

    with output_path.open("w", encoding="utf-8", newline="\n") as output:
        native_book_number = 0
        for testament in ("ot", "nt"):
            for book in structure.get(testament, []):
                native_book_number += 1
                book_verse_count = 0
                is_canonical = book.osis_name in CANONICAL_BOOK_NUMBER
                for chapter, expected_verse_count in enumerate(
                    book.chapter_lengths, start=1
                ):
                    fragments = list(
                        bible.get_iter(
                            books=[book.name], chapters=[chapter], clean=False
                        )
                    )
                    if len(fragments) != expected_verse_count:
                        raise ValueError(
                            f"verse count mismatch {source.id} "
                            f"{book.osis_name}.{chapter}: "
                            f"{len(fragments)} != {expected_verse_count}"
                        )
                    for verse, fragment in enumerate(fragments, start=1):
                        headings, parsed = extract_headings(fragment)
                        if not parsed:
                            parse_failure_count += 1
                            if len(parse_failure_refs) < 25:
                                parse_failure_refs.append(
                                    f"{book.osis_name}.{chapter}.{verse}"
                                )
                        update_inventory(
                            fragment,
                            headings,
                            tag_counts,
                            attribute_counts,
                            feature_counts,
                        )
                        record = {
                            "format": OUTPUT_FORMAT,
                            "schemaVersion": SCHEMA_VERSION,
                            "ref": f"{book.osis_name}.{chapter}.{verse}",
                            "version": source.module_name,
                            "applicationVersionId": source.application_version_id,
                            "datasetId": source.dataset_id,
                            "canon": "protestant-66" if is_canonical else "supplemental",
                            "book": CANONICAL_BOOK_NUMBER.get(
                                book.osis_name, native_book_number
                            ),
                            "nativeBook": native_book_number,
                            "bookId": book.osis_name,
                            "chapter": chapter,
                            "verse": verse,
                            "text": fragment,
                            **({"headings": headings} if headings else {}),
                        }
                        output.write(
                            json.dumps(
                                record, ensure_ascii=False, separators=(",", ":")
                            )
                            + "\n"
                        )
                        verse_count += 1
                        book_verse_count += 1
                        if is_canonical:
                            canonical_verse_count += 1
                        else:
                            supplemental_verse_count += 1
                book_summaries.append(
                    {
                        "bookId": book.osis_name,
                        "nativeBook": native_book_number,
                        **(
                            {"canonicalBook": CANONICAL_BOOK_NUMBER[book.osis_name]}
                            if is_canonical
                            else {}
                        ),
                        "canon": "protestant-66" if is_canonical else "supplemental",
                        "chapterCount": book.num_chapters,
                        "verseCount": book_verse_count,
                    }
                )

    module_conf = parse_conf(conf_text(archive_path))
    manifest = {
        "format": MANIFEST_FORMAT,
        "schemaVersion": SCHEMA_VERSION,
        "id": source.id,
        "applicationVersionId": source.application_version_id,
        "datasetId": source.dataset_id,
        "moduleName": source.module_name,
        "source": {
            "url": source.url,
            "archive": source.archive_name,
            "sha256": source.sha256,
            "moduleVersion": module_conf.get("Version"),
            "description": module_conf.get("Description"),
            "sourceType": module_conf.get("SourceType"),
            "versification": module_conf.get("Versification", "KJV"),
            "features": module_conf.get("Feature", []),
            "globalOptionFilters": module_conf.get("GlobalOptionFilter", []),
            "distributionLicense": module_conf.get("DistributionLicense"),
            "textSource": module_conf.get("TextSource"),
        },
        "artifact": {
            "file": output_path.name,
            "sha256": sha256_file(output_path),
            "bytes": output_path.stat().st_size,
        },
        "verseCount": verse_count,
        "canonicalVerseCount": canonical_verse_count,
        "supplementalVerseCount": supplemental_verse_count,
        "fragmentXmlParseFailureCount": parse_failure_count,
        "fragmentXmlParseFailureSamples": parse_failure_refs,
        "featureCounts": dict(sorted(feature_counts.items())),
        "tagCounts": dict(sorted(tag_counts.items())),
        "attributeCounts": dict(sorted(attribute_counts.items())),
        "books": book_summaries,
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest


def write_aggregate_report(output_root: Path, manifests: list[dict]) -> None:
    report = {
        "format": "bible-strong-rich-source-aggregate",
        "schemaVersion": SCHEMA_VERSION,
        "bibleCount": len(manifests),
        "bibles": [
            {
                "id": manifest["id"],
                "applicationVersionId": manifest["applicationVersionId"],
                "moduleVersion": manifest["source"]["moduleVersion"],
                "versification": manifest["source"]["versification"],
                "verseCount": manifest["verseCount"],
                "canonicalVerseCount": manifest["canonicalVerseCount"],
                "supplementalVerseCount": manifest["supplementalVerseCount"],
                "fragmentXmlParseFailureCount": manifest[
                    "fragmentXmlParseFailureCount"
                ],
                "featureCounts": manifest["featureCounts"],
                "artifact": manifest["artifact"],
            }
            for manifest in manifests
        ],
    }
    (output_root / "catalog.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--catalog", default="src/englishStrongSwordSources.json"
    )
    parser.add_argument(
        "--archive-dir",
        default="outputs/imports/english-sword/source-archives",
    )
    parser.add_argument(
        "--output-dir", default="outputs/imports/english-sword/rich-source"
    )
    parser.add_argument("--download", action="store_true")
    parser.add_argument(
        "--only",
        help="comma-separated catalog ids; defaults to every pinned source",
    )
    args = parser.parse_args()
    selected = (
        {item.strip() for item in args.only.split(",") if item.strip()}
        if args.only
        else None
    )
    sources = load_catalog(Path(args.catalog))
    if selected is not None:
        unknown = selected.difference(source.id for source in sources)
        if unknown:
            raise ValueError(f"unknown source ids: {sorted(unknown)}")
        sources = [source for source in sources if source.id in selected]
    output_root = Path(args.output_dir)
    output_root.mkdir(parents=True, exist_ok=True)
    manifests = []
    for source in sources:
        archive_path = ensure_archive(
            source, Path(args.archive_dir), download=args.download
        )
        print(f"Extracting {source.id} from {archive_path}", file=sys.stderr)
        manifests.append(extract_source(source, archive_path, output_root))
    write_aggregate_report(output_root, manifests)
    print(output_root / "catalog.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
