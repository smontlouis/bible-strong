"""Bounded public-page acquisition. Gold metadata never enters predictor files."""
from __future__ import annotations

import argparse
import datetime
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
import urllib.request


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save_json(file: Path, value: object) -> None:
    file.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()
    if file.exists():
        if file.read_bytes() != encoded:
            raise ValueError(f"immutable-output-drift:{file}")
    else:
        file.write_bytes(encoded)


class VerseParser(HTMLParser):
    """Parse one number-delimited verse, including poetic continuation lines.

    The public HTML contains unmatched closing spans on continuation lines.
    Container repair is tolerant; nested or unclosed word annotations fail.
    Offsets are UTF-16 code units, matching JavaScript.
    """

    def __init__(self, number: int) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, dict[str, str]]] = []
        self.verse = {"verse": number, "rawText": "", "tags": [], "notesSkipped": 0}
        self.word: dict | None = None

    def text_offset(self) -> int:
        return len(self.verse["rawText"].encode("utf-16-le")) // 2

    def ignored(self) -> bool:
        return any(t in {"script", "style", "sup", "button", "nav", "h1", "h2", "h3", "h4", "h5", "h6"}
                   or a.get("role") == "button"
                   or set(a.get("class", "").split()) & {"note", "notes", "footnote", "footnotes", "note-link", "titles", "material-symbols-outlined", "btn"}
                   for t, a in self.stack)

    def handle_starttag(self, tag: str, attrs: list) -> None:
        attr = dict(attrs)
        if tag in {"p", "br", "blockquote"} and not self.ignored():
            self.verse["rawText"] += " "
        if tag in {"meta", "link", "br", "hr", "img", "input", "source", "wbr"}:
            return
        self.stack.append((tag, attr))
        if tag == "w" and not self.ignored():
            if self.word:
                raise ValueError("nested-word-tags")
            empty = any("strong-untranslated" in a.get("class", "").split() for _, a in self.stack)
            self.word = {"start": self.text_offset(), "end": None, "pa": attr.get("data-pa", ""),
                         "ns": attr.get("data-ns", ""), "empty": empty,
                         "lemma": attr.get("data-lm", ""), "locution": attr.get("data-loc", "")}

    def handle_data(self, data: str) -> None:
        if self.ignored() or any("strong-untranslated" in a.get("class", "").split() for _, a in self.stack):
            return
        if self.word is None and any(c.isalnum() for c in data):
            raise ValueError("unwrapped-lexical-text-requires-import-review")
        self.verse["rawText"] += data.replace("◎", "")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"meta", "link", "br", "hr", "img", "input", "source", "wbr"}:
            return
        if self.word and tag != "w" and (not self.stack or self.stack[-1][0] != tag):
            raise ValueError(f"unbalanced-word-html:{tag}")
        if tag == "w" and self.word:
            self.word["end"] = self.text_offset()
            self.verse["tags"].append(self.word)
            self.word = None
        found = next((i for i in range(len(self.stack)-1, -1, -1) if self.stack[i][0] == tag), None)
        if found is not None:
            del self.stack[found:]
        if tag in {"p", "blockquote"} and not self.ignored():
            self.verse["rawText"] += " "


def parse_chapter(html: str) -> dict:
    starts = list(re.finditer(r'<sup\b[^>]*class="numverse"[^>]*id="v(\d+)"[^>]*>[\s\S]*?</sup>', html))
    if not starts:
        raise ValueError("page-without-complete-verses")
    verses = []
    for i, match in enumerate(starts):
        end = starts[i+1].start() if i+1 < len(starts) else html.find('<div class="clearfix">', match.end())
        if end < 0:
            # Useful for synthetic fixtures; real acquisition requires this marker.
            end = len(html)
        parser = VerseParser(int(match[1]))
        parser.feed(html[match.end():end])
        if parser.word:
            raise ValueError("unclosed-word")
        verses.append(parser.verse)
    refs = [v["verse"] for v in verses]
    if len(refs) != len(set(refs)):
        raise ValueError("duplicate-verse")
    annotations = sum(bool(re.search(r"\d+/[hga]\d*[1-9]\d*", t["pa"], re.I))
                      for v in verses for t in v["tags"])
    if not annotations:
        raise ValueError("page-without-strong-annotations")
    copyright_text = re.findall(r'[^<>]*(?:Copyright|affectés)[^<>]*', html)
    return {"verses": verses, "copyright": copyright_text, "annotatedTags": annotations,
            "parserVersion": "number-delimited-reader-only-v3"}


def acquire(url: str, file: Path, delay: float) -> bytes:
    receipt = file.with_suffix(".receipt.json")
    if file.exists():
        data = file.read_bytes()
        meta = json.loads(receipt.read_text())
        if meta["url"] != url or meta["sha256"] != digest(data):
            raise ValueError(f"cache-drift:{file}")
        return data
    time.sleep(delay)
    request = urllib.request.Request(url, headers={"User-Agent": "BibleStrong research; bounded chapter comparison"})
    with urllib.request.urlopen(request, timeout=45) as response:
        if response.status != 200 or response.url != url:
            raise ValueError(f"unexpected-response:{response.status}:{response.url}")
        data = response.read()
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)
        save_json(receipt, {"url": url, "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                            "sha256": digest(data), "status": response.status, "contentType": response.headers.get("Content-Type")})
        return data


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--root", type=Path, default=Path("outputs/strong-concordance-night/final-v2"))
    cli.add_argument("--delay", type=float, default=1.5)
    args = cli.parse_args()
    if args.delay < 1:
        raise ValueError("minimum-one-second-between-public-requests")
    plan = json.loads((args.root / "plan.json").read_text())
    receipts = []
    for page in ["faq", "versification", "bibles"]:
        acquire(f"https://concordance.bible/pages/{page}/", args.root / "acquisition" / f"{page}.html", args.delay)
    for edition in plan["editions"]:
        for chapter in plan["chapters"]:
            book, number = chapter["ref"].split(".")
            url = f"https://concordance.bible/{edition}/{book}/{number}/"
            file = args.root / "acquisition" / f"{edition}-{book}-{number}.html"
            html = acquire(url, file, args.delay).decode("utf-8")
            if '<div class="clearfix">' not in html:
                raise ValueError(f"missing-public-chapter-end:{url}")
            parsed = parse_chapter(html)
            if len(re.findall(r'<w\b', html)) != sum(len(v["tags"]) for v in parsed["verses"]):
                raise ValueError(f"word-elements-not-conserved:{url}")
            out = {"edition": edition, **chapter, "sourceUrl": url, "htmlSha256": digest(file.read_bytes()), **parsed}
            save_json(args.root / "evaluator-only" / f"{edition}-{chapter['ref']}.json", out)
            summary = {"edition": edition, "chapter": chapter["ref"], "verses": len(parsed["verses"]),
                       "annotationsPresent": parsed["annotatedTags"] > 0, "htmlSha256": out["htmlSha256"]}
            receipts.append(summary)
            print(json.dumps(summary), flush=True)
    save_json(args.root / "acquisition-manifest.json", receipts)


if __name__ == "__main__":
    main()
