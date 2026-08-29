import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  packageMobileStrongBibles,
  type MobileStrongBibleSource
} from "./packageMobileStrongBibles.js";
import { projectEnglishStrongMobileJsonl } from "./projectEnglishStrongMobileJsonl.js";

const OUTPUT_DIR = "outputs/releases/bible-strong-english-mobile-v7-candidate";

export async function packageEnglishStrongMobileBibles(
  options: {
    root?: string;
    outputDir?: string;
    generatedAt?: string;
  } = {}
) {
  const root = path.resolve(options.root ?? process.cwd());
  const projections = await projectEnglishStrongMobileJsonl({ root });
  const sources: MobileStrongBibleSource[] = projections.map((projection) => ({
    applicationVersionId: projection.applicationVersionId,
    datasetId: projection.datasetId,
    sourceVersion: projection.moduleName,
    relativePath: path.relative(root, projection.outputPath)
  }));
  return packageMobileStrongBibles({
    root,
    outputDir: options.outputDir ?? OUTPUT_DIR,
    generatedAt: options.generatedAt,
    sources
  });
}

async function main(): Promise<void> {
  const result = await packageEnglishStrongMobileBibles();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  await main();
}
