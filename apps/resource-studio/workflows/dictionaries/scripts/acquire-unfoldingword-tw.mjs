#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { normalizeSmithHeadword } from "./audit-smith-overlap.mjs";
import { writeDictionarySourceSqlite } from "./source-sqlite.mjs";

const execFileAsync = promisify(execFile);
const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workspaceRoot = path.resolve(workflowRoot, "../../../..");
const RELEASE = "v90";
const ARCHIVE_URL = `https://git.door43.org/unfoldingWord/en_tw/archive/${RELEASE}.zip`;
const ARCHIVE_SHA256 =
  "c3f68316628cc9cc0f719992d939c21040c84894e8a1c05813e802c2e3b0bfcd";

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");

const escapeAttribute = (value) => escapeHtml(value).replace(/"/gu, "&quot;");

const formatText = (value) =>
  escapeHtml(value)
    .replace(/`([^`]+)`/gu, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/gu, "<strong>$1$2</strong>")
    .replace(/\*([^*]+)\*/gu, "<em>$1</em>");

const bibleRc = /^rc:\/\/en\/tn\/help\/([a-z\d]{3})\/(\d{2,3})\/(\d{2,3})/iu;

export const renderTranslationWordsInline = ({
  value,
  currentPath,
  titles
}) => {
  let output = "";
  let cursor = 0;
  for (const match of String(value).matchAll(/\[([^\]]+)\]\(([^)]+)\)/gu)) {
    output += formatText(String(value).slice(cursor, match.index));
    const label = formatText(match[1]);
    const href = match[2];
    const relativeTarget = href.endsWith(".md")
      ? path.posix.normalize(
          path.posix.join(path.posix.dirname(currentPath), href)
        )
      : "";
    const wordTarget = titles.get(relativeTarget);
    if (wordTarget) {
      output += `<a class="word" href="${escapeAttribute(wordTarget)}">${label}</a>`;
    } else if (bibleRc.test(href) && !href.includes("/obs/")) {
      output += `<a class="verse" href="${escapeAttribute(match[1])}">${label}</a>`;
    } else {
      output += label;
    }
    cursor = match.index + match[0].length;
  }
  return output + formatText(String(value).slice(cursor));
};

export const renderTranslationWordsMarkdown = ({
  markdown,
  currentPath,
  titles
}) => {
  const lines = String(markdown).replace(/\r/gu, "").split("\n");
  const html = [];
  let list;
  const closeList = () => {
    if (!list) return;
    html.push(`</${list}>`);
    list = undefined;
  };
  for (const line of lines) {
    if (/^#\s+/u.test(line)) continue;
    const heading = /^#{2,6}\s+(.+)$/u.exec(line);
    if (heading) {
      closeList();
      html.push(
        `<h3>${renderTranslationWordsInline({ value: heading[1].replace(/:\s*$/u, ""), currentPath, titles })}</h3>`
      );
      continue;
    }
    const bullet = /^\s*\*\s+(.+)$/u.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/u.exec(line);
    if (bullet || ordered) {
      const desired = bullet ? "ul" : "ol";
      if (list !== desired) {
        closeList();
        html.push(`<${desired}>`);
        list = desired;
      }
      html.push(
        `<li>${renderTranslationWordsInline({ value: (bullet ?? ordered)[1], currentPath, titles })}</li>`
      );
      continue;
    }
    closeList();
    if (line.trim())
      html.push(
        `<p>${renderTranslationWordsInline({ value: line.trim(), currentPath, titles })}</p>`
      );
  }
  closeList();
  return html.join("\n");
};

const markdownFiles = async (root, relative = "") => {
  const files = [];
  for (const item of await readdir(path.join(root, relative), {
    withFileTypes: true
  })) {
    const itemRelative = path.posix.join(relative, item.name);
    if (item.isDirectory())
      files.push(...(await markdownFiles(root, itemRelative)));
    else if (item.isFile() && item.name.endsWith(".md"))
      files.push(itemRelative);
  }
  return files;
};

export const buildTranslationWordsEntries = async (bibleRoot) => {
  const files = (await markdownFiles(bibleRoot)).sort();
  const sources = [];
  const titles = new Map();
  for (const relativePath of files) {
    const markdown = await readFile(path.join(bibleRoot, relativePath), "utf8");
    const title = /^#\s+(.+)$/mu.exec(markdown)?.[1]?.trim();
    if (!title)
      throw new Error(`translation-words-title-missing:${relativePath}`);
    titles.set(relativePath, title);
    sources.push({ relativePath, markdown, title });
  }
  const grouped = new Map();
  for (const source of sources) {
    const normalizedWord = normalizeSmithHeadword(source.title);
    if (!grouped.has(normalizedWord))
      grouped.set(normalizedWord, { word: source.title, definitions: [] });
    grouped.get(normalizedWord).definitions.push(
      renderTranslationWordsMarkdown({
        markdown: source.markdown,
        currentPath: source.relativePath,
        titles
      })
    );
  }
  return [...grouped.values()]
    .sort((left, right) => left.word.localeCompare(right.word, "en"))
    .map((entry, index) => ({
      id: index + 1,
      word: entry.word,
      normalizedWord: normalizeSmithHeadword(entry.word),
      definition: entry.definitions
        .map((definition, definitionIndex) =>
          definitionIndex === 0
            ? definition
            : `<h3>Additional article</h3>\n${definition}`
        )
        .join("\n")
    }));
};

const download = async (destination) => {
  const response = await fetch(ARCHIVE_URL, {
    headers: { "user-agent": "BibleStrongResourceStudio/1.0" },
    signal: AbortSignal.timeout(120_000)
  });
  if (!response.ok)
    throw new Error(`translation-words-download-http-${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  return bytes;
};

const parseArguments = (values) => {
  const options = {
    root: path.join(workflowRoot, ".local/unfoldingword-tw"),
    output: path.join(
      workspaceRoot,
      "apps/resource-studio/outputs/dictionary-sources/unfoldingword-translation-words"
    )
  };
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`Valeur absente : ${key}`);
    if (key === "--root") options.root = path.resolve(value);
    else if (key === "--output-dir") options.output = path.resolve(value);
    else throw new Error(`Argument inconnu : ${key}`);
  }
  return options;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const archivePath = path.join(options.root, `en_tw_${RELEASE}.zip`);
  const sourceRoot = path.join(options.root, "source");
  await Promise.all([
    mkdir(options.root, { recursive: true }),
    mkdir(sourceRoot, { recursive: true })
  ]);
  const archive = (await exists(archivePath))
    ? await readFile(archivePath)
    : await download(archivePath);
  const digest = createHash("sha256").update(archive).digest("hex");
  if (digest !== ARCHIVE_SHA256)
    throw new Error(`translation-words-archive-digest-mismatch:${digest}`);
  await execFileAsync("unzip", ["-oq", archivePath, "-d", sourceRoot]);
  const repositoryRoot = path.join(sourceRoot, "en_tw");
  const [license, manifest] = await Promise.all([
    readFile(path.join(repositoryRoot, "LICENSE.md"), "utf8"),
    readFile(path.join(repositoryRoot, "manifest.yaml"), "utf8")
  ]);
  if (
    !/Creative Commons Attribution-ShareAlike 4\.0 International License/iu.test(
      license
    )
  )
    throw new Error("translation-words-license-mismatch");
  if (
    !/^\s*version:\s*['"]?90['"]?\s*$/mu.test(manifest) ||
    !/^\s*rights:\s*CC BY-SA 4\.0\s*$/mu.test(manifest)
  )
    throw new Error("translation-words-manifest-mismatch");
  const sourceFiles = await markdownFiles(path.join(repositoryRoot, "bible"));
  const entries = await buildTranslationWordsEntries(
    path.join(repositoryRoot, "bible")
  );
  const sqlitePath = await writeDictionarySourceSqlite({
    outputDir: options.output,
    fileName: "unfoldingword-translation-words.sqlite",
    entries
  });
  const manifestOutput = {
    generatedAt: new Date().toISOString(),
    work: "unfoldingword-translation-words",
    source: {
      provider: "unfoldingWord",
      repository: "unfoldingWord/en_tw",
      release: RELEASE,
      issued: "2026-08-14",
      archiveUrl: ARCHIVE_URL,
      archiveSha256: digest,
      license: "CC BY-SA 4.0"
    },
    adaptation: {
      changes:
        "Converted Markdown to safe Bible Strong dictionary HTML; converted relative article links to dictionary links; normalized Bible references with the Bible Strong BCV parser; grouped articles with identical headings.",
      trademark:
        "The derivative resource is titled Translation Words and does not use the unfoldingWord registered trademark as its own product mark.",
      attribution:
        "The original work by unfoldingWord is available from https://www.unfoldingword.org/utw"
    },
    counts: {
      sourceFiles: sourceFiles.length,
      entries: entries.length,
      mergedDuplicateFiles: sourceFiles.length - entries.length
    },
    sqlitePath
  };
  await writeFile(
    path.join(options.output, "manifest.json"),
    `${JSON.stringify(manifestOutput, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(manifestOutput, null, 2)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
