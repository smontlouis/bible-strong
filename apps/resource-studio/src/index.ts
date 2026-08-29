import { readdir } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();

async function listFiles(
  directory: string,
  extension: string
): Promise<string[]> {
  const entries = await readdir(path.join(rootDir, directory), {
    withFileTypes: true
  });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

async function main(): Promise<void> {
  const [bibles, strongs] = await Promise.all([
    listFiles("data/bibles", ".json"),
    listFiles("data/strongs", ".csv")
  ]);

  console.log(`Found ${bibles.length} Bible files.`);
  console.log(`Found ${strongs.length} Strong files.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
