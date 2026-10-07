import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
export async function raw(file: string): Promise<Buffer> {
  return existsSync(file)
    ? readFile(file)
    : gunzipSync(await readFile(file + ".gz"));
}
export async function save(file: string, value: unknown, compressed = false) {
  await mkdir(path.dirname(file), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  await writeFile(
    file + (compressed ? ".gz" : ""),
    compressed ? gzipSync(bytes, { level: 1 }) : bytes
  );
}
