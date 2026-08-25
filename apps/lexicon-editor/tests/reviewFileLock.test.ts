import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { withReviewFileLock } from "../src/reviewFileLock.js";

test("review file lock serializes concurrent writers", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "review-file-lock-"));
  const lockPath = path.join(root, "write.lock");
  const events: string[] = [];
  try {
    const first = withReviewFileLock(
      async () => {
        events.push("first-start");
        await new Promise((resolve) => setTimeout(resolve, 30));
        events.push("first-end");
      },
      { lockPath, retryMs: 5 }
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = withReviewFileLock(
      async () => {
        events.push("second-start");
        events.push("second-end");
      },
      { lockPath, retryMs: 5 }
    );

    await Promise.all([first, second]);
    assert.deepEqual(events, [
      "first-start",
      "first-end",
      "second-start",
      "second-end"
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("stale recovery is atomic across concurrent contenders", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "review-stale-lock-"));
  const lockPath = path.join(root, "write.lock");
  const events: string[] = [];
  try {
    await mkdir(lockPath);
    await writeFile(
      path.join(lockPath, "owner.json"),
      JSON.stringify({
        pid: 99_999_999,
        hostname: os.hostname(),
        token: "dead-owner",
        acquiredAt: "2000-01-01T00:00:00.000Z"
      }),
      "utf8"
    );
    const old = new Date(Date.now() - 10_000);
    await utimes(lockPath, old, old);

    const contender = (name: string) =>
      withReviewFileLock(
        async () => {
          events.push(`${name}-start`);
          await new Promise((resolve) => setTimeout(resolve, 15));
          events.push(`${name}-end`);
        },
        {
          lockPath,
          retryMs: 1,
          staleAfterMs: 10,
          timeoutMs: 2_000
        }
      );
    await Promise.all([contender("one"), contender("two")]);

    assert.equal(events.length, 4);
    assert.match(events[0]!, /-start$/u);
    assert.equal(events[1], `${events[0]!.replace(/-start$/u, "")}-end`);
    assert.match(events[2]!, /-start$/u);
    assert.equal(events[3], `${events[2]!.replace(/-start$/u, "")}-end`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("recovers an abandoned recovery mutex after a crashed contender", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "review-recovery-lock-"));
  const lockPath = path.join(root, "write.lock");
  const recoveryPath = `${lockPath}.recovery`;
  let entered = false;
  try {
    await mkdir(recoveryPath);
    await writeFile(
      path.join(recoveryPath, "owner.json"),
      JSON.stringify({
        pid: 99_999_999,
        hostname: os.hostname(),
        token: "dead-recovery-owner",
        acquiredAt: "2000-01-01T00:00:00.000Z"
      }),
      "utf8"
    );
    const old = new Date(Date.now() - 10_000);
    await utimes(recoveryPath, old, old);

    await withReviewFileLock(
      async () => {
        entered = true;
      },
      {
        lockPath,
        retryMs: 1,
        staleAfterMs: 10,
        timeoutMs: 2_000
      }
    );

    assert.equal(entered, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
