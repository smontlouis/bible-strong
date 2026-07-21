import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

export const STRONG_JSONL_RELEASE_SCHEMA_VERSION = 1;
export type StrongJsonlReleaseView = "reader" | "permissive";

interface ReleaseSource {
  id: string;
  label: string;
  version: string;
  sourceType: "generated" | "reference-witness";
  artifactPath: string;
  manifestPath: string;
  manifestArtifactFile?: string;
}

interface SourceArtifact {
  sha256: string;
  sizeBytes: number;
  verseCount: number;
}

export interface StrongJsonlReleaseEntry extends SourceArtifact {
  id: string;
  label: string;
  version: string;
  sourceType: ReleaseSource["sourceType"];
  view: StrongJsonlReleaseView;
  file: string;
  manifest: string;
}

export interface StrongJsonlReleaseCatalog {
  schemaVersion: number;
  format: "strong-jsonl-release";
  view: StrongJsonlReleaseView;
  generatedAt: string;
  artifactCount: number;
  totalSizeBytes: number;
  artifacts: StrongJsonlReleaseEntry[];
}

export interface StrongJsonlReleaseResult {
  outputDir: string;
  catalogPath: string;
  catalogSha256: string;
  artifactCount: number;
  totalSizeBytes: number;
}

function releaseSources(view: StrongJsonlReleaseView): ReleaseSource[] {
  const generated = [
    generatedSource("ost", "Ostervald", "OST", view),
    generatedSource("nvs78p", "NVS78P", "NVS78P", view),
    generatedSource("neg79", "Nouvelle Édition de Genève 1979", "NEG79", view),
    generatedSource("fmar", "Martin", "FMAR", view),
    generatedSource("nbs", "Nouvelle Bible Segond", "NBS", view)
  ];
  if (view === "permissive") return generated;
  return [
    ...generated,
    referenceSource("darby", "Darby", "DARBY"),
    referenceSource("darbyr", "Darby révisée", "DARBYR"),
    referenceSource("sg1910", "Louis Segond 1910", "SG1910")
  ];
}

function generatedSource(
  id: string,
  label: string,
  version: string,
  view: StrongJsonlReleaseView
): ReleaseSource {
  const root = view === "reader" ? "strong-jsonl" : "strong-jsonl-permissive";
  return {
    id,
    label,
    version,
    sourceType: "generated",
    artifactPath: `outputs/${root}/${id}/bible-${id}-strong.jsonl`,
    manifestPath: `outputs/${root}/${id}/manifest.json`
  };
}

function referenceSource(
  id: string,
  label: string,
  version: string
): ReleaseSource {
  const file = `bible-${id}-strong.jsonl`;
  return {
    id,
    label,
    version,
    sourceType: "reference-witness",
    artifactPath: `outputs/strong-references-jsonl-step/${file}`,
    manifestPath: "outputs/strong-references-jsonl-step/manifest.json",
    manifestArtifactFile: file
  };
}

export async function packageStrongJsonlRelease(
  options: {
    root?: string;
    outputDir?: string;
    generatedAt?: string;
    view?: StrongJsonlReleaseView;
  } = {}
): Promise<StrongJsonlReleaseResult> {
  const root = path.resolve(options.root ?? process.cwd());
  const view = options.view ?? "reader";
  const outputDir = path.resolve(
    root,
    options.outputDir ??
      (view === "reader"
        ? "outputs/releases/strong-jsonl"
        : "outputs/releases/strong-jsonl-permissive")
  );
  if (existsSync(outputDir)) {
    throw new Error(`strong-jsonl-release-already-exists:${outputDir}`);
  }

  const temporaryDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const manifestDir = path.join(temporaryDir, "manifests");
  await mkdir(manifestDir, { recursive: true });
  const artifacts: StrongJsonlReleaseEntry[] = [];

  try {
    for (const source of releaseSources(view)) {
      const sourceArtifactPath = path.join(root, source.artifactPath);
      const sourceManifestPath = path.join(root, source.manifestPath);
      const sourceManifest = await readJson(sourceManifestPath);
      const expected = sourceArtifactFromManifest(source, sourceManifest, view);
      const [actualSha256, actualStat, sourceManifestSha256] =
        await Promise.all([
          sha256File(sourceArtifactPath),
          stat(sourceArtifactPath),
          sha256File(sourceManifestPath)
        ]);
      if (actualSha256 !== expected.sha256) {
        throw new Error(
          `strong-jsonl-release-artifact-hash-mismatch:${source.id}:${expected.sha256}:${actualSha256}`
        );
      }
      if (actualStat.size !== expected.sizeBytes) {
        throw new Error(
          `strong-jsonl-release-artifact-size-mismatch:${source.id}:${expected.sizeBytes}:${actualStat.size}`
        );
      }

      const file = `bible-${source.id}-strong.jsonl`;
      const manifest = `manifests/${source.id}.json`;
      const destinationPath = path.join(temporaryDir, file);
      await copyFile(sourceArtifactPath, destinationPath);
      const copiedSha256 = await sha256File(destinationPath);
      if (copiedSha256 !== expected.sha256) {
        throw new Error(
          `strong-jsonl-release-copy-hash-mismatch:${source.id}:${expected.sha256}:${copiedSha256}`
        );
      }

      const entry: StrongJsonlReleaseEntry = {
        id: source.id,
        label: source.label,
        version: source.version,
        sourceType: source.sourceType,
        view,
        file,
        manifest,
        ...expected
      };
      artifacts.push(entry);
      await writeJson(path.join(temporaryDir, manifest), {
        schemaVersion: STRONG_JSONL_RELEASE_SCHEMA_VERSION,
        format: "strong-jsonl-release-manifest",
        ...entry,
        source: {
          artifactPath: source.artifactPath,
          manifestPath: source.manifestPath,
          manifestSha256: sourceManifestSha256
        },
        sourceManifest
      });
    }

    const catalog: StrongJsonlReleaseCatalog = {
      schemaVersion: STRONG_JSONL_RELEASE_SCHEMA_VERSION,
      format: "strong-jsonl-release",
      view,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      artifactCount: artifacts.length,
      totalSizeBytes: artifacts.reduce(
        (total, artifact) => total + artifact.sizeBytes,
        0
      ),
      artifacts
    };
    const temporaryCatalogPath = path.join(temporaryDir, "catalog.json");
    await writeJson(temporaryCatalogPath, catalog);
    const catalogSha256 = await sha256File(temporaryCatalogPath);
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(temporaryDir, outputDir);
    return {
      outputDir,
      catalogPath: path.join(outputDir, "catalog.json"),
      catalogSha256,
      artifactCount: catalog.artifactCount,
      totalSizeBytes: catalog.totalSizeBytes
    };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

function sourceArtifactFromManifest(
  source: ReleaseSource,
  manifest: unknown,
  view: StrongJsonlReleaseView
): SourceArtifact {
  if (!isObject(manifest)) {
    throw new Error(`strong-jsonl-release-invalid-manifest:${source.id}`);
  }
  if (source.sourceType === "generated") {
    if (
      manifest.status !== "validated-full-artifact" ||
      manifest.scope !== "all" ||
      manifest.bible !== source.id ||
      manifest.version !== source.version ||
      manifest.view !== view ||
      !isObject(manifest.artifact) ||
      !isObject(manifest.metrics)
    ) {
      throw new Error(
        `strong-jsonl-release-unvalidated-generated-manifest:${source.id}`
      );
    }
    return parseSourceArtifact(source.id, {
      sha256: manifest.artifact.sha256,
      sizeBytes: manifest.artifact.sizeBytes,
      verseCount: manifest.metrics.verseCount
    });
  }

  if (!Array.isArray(manifest.artifacts)) {
    throw new Error(
      `strong-jsonl-release-invalid-reference-manifest:${source.id}`
    );
  }
  const artifact = manifest.artifacts.find(
    (candidate) =>
      isObject(candidate) && candidate.file === source.manifestArtifactFile
  );
  if (
    !isObject(artifact) ||
    artifact.version !== source.version ||
    !isObject(artifact.metrics)
  ) {
    throw new Error(
      `strong-jsonl-release-missing-reference-artifact:${source.id}`
    );
  }
  return parseSourceArtifact(source.id, {
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
    verseCount: artifact.metrics.verseCount
  });
}

function parseSourceArtifact(
  id: string,
  value: Record<string, unknown>
): SourceArtifact {
  if (
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.sha256) ||
    !Number.isSafeInteger(value.sizeBytes) ||
    Number(value.sizeBytes) <= 0 ||
    !Number.isSafeInteger(value.verseCount) ||
    Number(value.verseCount) <= 0
  ) {
    throw new Error(`strong-jsonl-release-invalid-artifact:${id}`);
  }
  return {
    sha256: value.sha256,
    sizeBytes: Number(value.sizeBytes),
    verseCount: Number(value.verseCount)
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx"
  });
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function optionalArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const allowed = new Set(["--output-dir", "--view"]);
  for (let index = 2; index < process.argv.length; index += 2) {
    const argument = process.argv[index];
    const value = process.argv[index + 1];
    if (!argument || !allowed.has(argument) || !value) {
      throw new Error(`invalid-argument:${argument ?? "missing"}`);
    }
  }
  const requestedView = optionalArg("--view") ?? "reader";
  if (requestedView !== "reader" && requestedView !== "permissive") {
    throw new Error(`invalid-strong-jsonl-release-view:${requestedView}`);
  }
  const result = await packageStrongJsonlRelease({
    outputDir: optionalArg("--output-dir"),
    view: requestedView
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname)
) {
  await main();
}
