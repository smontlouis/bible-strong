import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/**
 * Puts files in the public media bucket (ADR-0089) through the operator's wrangler session, for the
 * portraits and the cards. Nothing here deletes.
 */

const execFileAsync = promisify(execFile);

const RESOURCE_SERVICE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../packages/resource-service"
);
const UPLOADS_IN_FLIGHT = 6;

// A picture never changes under its address: a new one gets a new hash.
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
// A catalog is the only object that changes; the application reads it at most once a day.
export const CATALOG_CACHE_CONTROL = "public, max-age=3600";

export type MediaUpload = {
  key: string;
  file: string;
  sha256: string;
  url: string;
};

export const wranglerPut = (
  bucket: string,
  key: string,
  file: string,
  mediaType: string,
  cacheControl: string
) =>
  execFileAsync(
    "yarn",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      "--file",
      file,
      "--content-type",
      mediaType,
      "--cache-control",
      cacheControl,
      "--remote"
    ],
    { cwd: RESOURCE_SERVICE_DIR, maxBuffer: 16 * 1024 * 1024 }
  );

const inParallel = async <T>(items: T[], run: (item: T) => Promise<void>) => {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: UPLOADS_IN_FLIGHT }, async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        await run(next);
      }
    })
  );
};

/**
 * The files whose bytes the bucket does not hold yet, by the ledger kept in `ledgerPath` (one per
 * bucket): an interrupted upload resumes where it stopped.
 */
export const pendingUploads = async (
  copies: MediaUpload[],
  ledgerPath: string
): Promise<MediaUpload[]> => {
  const ledger: Record<string, string> = existsSync(ledgerPath)
    ? JSON.parse(await readFile(ledgerPath, "utf8"))
    : {};
  return copies.filter((copy) => ledger[copy.key] !== copy.sha256);
};

/** Puts the immutable copies, six at a time, writing the ledger as it goes. */
export const putImmutableCopies = async (
  bucket: string,
  uploads: MediaUpload[],
  ledgerPath: string,
  mediaType: string
): Promise<number> => {
  const ledger: Record<string, string> = existsSync(ledgerPath)
    ? JSON.parse(await readFile(ledgerPath, "utf8"))
    : {};
  let done = 0;
  const left = () => uploads.length - done;
  try {
    await inParallel(uploads, async (next) => {
      await wranglerPut(
        bucket,
        next.key,
        next.file,
        mediaType,
        IMMUTABLE_CACHE_CONTROL
      );
      ledger[next.key] = next.sha256;
      done += 1;
      if (done % 50 === 0) {
        console.log(`${done} uploaded, ${left()} to go`);
        await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
      }
    });
  } finally {
    await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  }
  return done;
};

/** The addresses that do not answer: a catalog must never name a picture its address does not serve. */
export const unreachableAddresses = async (
  urls: string[]
): Promise<string[]> => {
  const unreachable: string[] = [];
  await inParallel(urls, async (url) => {
    const answer = await fetch(url, { method: "HEAD" });
    if (!answer.ok) unreachable.push(`${answer.status} ${url}`);
  });
  return unreachable;
};
