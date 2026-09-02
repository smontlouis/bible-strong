import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

export interface PreparedResourcePublicationBundle<Result> {
  readonly bundleDir: string;
  readonly outputDir: string;
  readonly result: Result;
}

export interface PrepareResourcePublicationBundleOptions<Result> {
  outputDir: string;
  build: (bundleDir: string) => Promise<Result>;
  validate: (bundleDir: string) => Promise<unknown>;
}

export async function prepareResourcePublicationBundle<Result>({
  outputDir,
  build,
  validate
}: PrepareResourcePublicationBundleOptions<Result>): Promise<
  PreparedResourcePublicationBundle<Result>
> {
  const resolvedOutputDir = path.resolve(outputDir);
  const bundleDir = `${resolvedOutputDir}.tmp-${process.pid}-${randomUUID()}`;
  await mkdir(path.dirname(resolvedOutputDir), { recursive: true });
  await mkdir(bundleDir, { recursive: false });

  try {
    const result = await build(bundleDir);
    await rm(path.join(bundleDir, "work"), { recursive: true, force: true });
    await validate(bundleDir);
    return { bundleDir, outputDir: resolvedOutputDir, result };
  } catch (error) {
    await rm(bundleDir, { recursive: true, force: true });
    throw error;
  }
}

export async function discardPreparedResourcePublicationBundle(
  prepared: Pick<PreparedResourcePublicationBundle<unknown>, "bundleDir">
): Promise<void> {
  await rm(prepared.bundleDir, { recursive: true, force: true });
}
