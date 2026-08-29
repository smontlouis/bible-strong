import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

import {
  FrenchEntityRemediationChildSupervisor,
  mapFrenchEntityRemediationConcurrent
} from "../scripts/runLexiconV3FrenchEntityRemediationRound.js";

test("remediation waits for active siblings and stops distributing after a failure", async () => {
  let signalSiblingStarted: (() => void) | undefined;
  const siblingStarted = new Promise<void>((resolve) => {
    signalSiblingStarted = resolve;
  });
  let releaseSibling: (() => void) | undefined;
  const siblingRelease = new Promise<void>((resolve) => {
    releaseSibling = resolve;
  });
  const firstFailure = new Error("first-remediation-worker-failed");
  const started: string[] = [];
  let siblingCompleted = false;
  let mapSettled = false;

  const run = mapFrenchEntityRemediationConcurrent(
    ["fail", "sibling", "must-not-start"],
    2,
    async (value) => {
      started.push(value);
      if (value === "fail") {
        await siblingStarted;
        throw firstFailure;
      }
      if (value === "sibling") {
        signalSiblingStarted?.();
        await siblingRelease;
        siblingCompleted = true;
      }
    }
  );
  const rejection = assert.rejects(
    run,
    (error: unknown) => error === firstFailure
  );
  void run.then(
    () => {
      mapSettled = true;
    },
    () => {
      mapSettled = true;
    }
  );

  await siblingStarted;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(mapSettled, false);
  assert.deepEqual(started, ["fail", "sibling"]);

  releaseSibling?.();
  await rejection;
  assert.equal(siblingCompleted, true);
  assert.equal(mapSettled, true);
  assert.deepEqual(started, ["fail", "sibling"]);
});

test("remediation terminates and waits for a detached child on shutdown", async () => {
  const supervisor = new FrenchEntityRemediationChildSupervisor();
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    detached: process.platform !== "win32",
    stdio: "ignore"
  });
  await once(child, "spawn");
  const pid = child.pid;
  assert.ok(pid);
  supervisor.track(child);

  supervisor.requestShutdown("SIGTERM");
  await supervisor.terminateAndWait();

  assert.throws(() => supervisor.assertRunning(), /interrupted:SIGTERM/u);
  assert.throws(
    () => process.kill(process.platform === "win32" ? pid : -pid, 0),
    (error: unknown) => (error as NodeJS.ErrnoException).code === "ESRCH"
  );
});
