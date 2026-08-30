import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  validateDictionaryResourcePublication,
  type DictionaryResourcePublicationManifest
} from "../src/packageDictionaryResourcePublications.js";

const parseRoot = () => {
  const args = process.argv.slice(2);
  const index = args.indexOf("--root");
  const value =
    index >= 0 ? args[index + 1] : process.env.DICTIONARY_PUBLICATION_ROOT;
  if (!value || value.startsWith("--")) {
    throw new Error(
      "dictionary-publication-smoke-root-missing: use --root <build-dir> or DICTIONARY_PUBLICATION_ROOT"
    );
  }
  return path.resolve(value);
};

const expectRejected = async (
  label: string,
  operation: () => Promise<unknown>
) => {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`smoke:rejected:${label}:${message}`);
    return;
  }
  throw new Error(`dictionary-publication-smoke-accepted-invalid-${label}`);
};

const mutateManifest = async (
  sourceDir: string,
  targetDir: string,
  mutate: (manifest: DictionaryResourcePublicationManifest) => void
) => {
  await cp(sourceDir, targetDir, { recursive: true });
  const manifestPath = path.join(targetDir, "manifest.json");
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8")
  ) as DictionaryResourcePublicationManifest;
  mutate(manifest);
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
};

const main = async () => {
  const root = parseRoot();
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "dictionary-publication-smoke-")
  );
  try {
    const manifests: DictionaryResourcePublicationManifest[] = [];
    const works = await readdir(root);
    for (const work of works.sort()) {
      const languages = await readdir(path.join(root, work));
      for (const language of languages.sort()) {
        const bundleDir = path.join(root, work, language);
        const manifest = await validateDictionaryResourcePublication(bundleDir);
        if (
          manifest.identity.work !== work ||
          manifest.identity.language !== language ||
          manifest.counts.entries <= 0
        ) {
          throw new Error(
            `dictionary-publication-smoke-manifest-invalid:${work}:${language}`
          );
        }
        manifests.push(manifest);
        console.log(
          `smoke:validated:${work}:${language}:revision=${manifest.revision}:entries=${manifest.counts.entries}:anchors=${manifest.counts.verseAnchors}`
        );

        const badCounts = path.join(
          temporaryRoot,
          `${work}-${language}-bad-counts`
        );
        await mutateManifest(bundleDir, badCounts, (manifestCopy) => {
          manifestCopy.counts.entries += 1;
        });
        await expectRejected(`${work}-${language}-counts`, () =>
          validateDictionaryResourcePublication(badCounts)
        );

        const badChecksum = path.join(
          temporaryRoot,
          `${work}-${language}-bad-checksum`
        );
        await mutateManifest(bundleDir, badChecksum, (manifestCopy) => {
          manifestCopy.offlineArtifact.sha256 = "0".repeat(64);
        });
        await expectRejected(`${work}-${language}-checksum`, () =>
          validateDictionaryResourcePublication(badChecksum)
        );
      }
    }
    console.log(
      `smoke:ok:dictionary:identities=${manifests
        .map(
          (manifest) =>
            `${manifest.identity.work}:${manifest.identity.language}`
        )
        .join(",")}`
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};

await main();
