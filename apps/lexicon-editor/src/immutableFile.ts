import { randomUUID } from "node:crypto";
import { link, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Publishes a complete JSON file without ever replacing an existing path.
 * The hard-link publish is atomic on the destination filesystem: readers see
 * either no file or the complete file, and concurrent creators fail closed.
 */
export async function writeJsonFileImmutable(
  filePath: string,
  value: unknown
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
    try {
      await link(temporaryPath, filePath);
    } catch (error) {
      if (isAlreadyExists(error)) {
        throw new Error(`immutable-file-already-exists:${filePath}`);
      }
      throw error;
    }
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function isAlreadyExists(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}
