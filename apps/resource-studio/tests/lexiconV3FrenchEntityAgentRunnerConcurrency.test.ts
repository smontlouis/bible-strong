import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

import {
  FrenchEntityAgentChildSupervisor,
  mapConcurrent
} from "../scripts/runLexiconV3FrenchEntityAgents.js";

test("waits for sibling workers before propagating the first failure", async () => {
  let signalSiblingStarted: (() => void) | undefined;
  const siblingStarted = new Promise<void>((resolve) => {
    signalSiblingStarted = resolve;
  });
  let releaseSibling: (() => void) | undefined;
  const siblingRelease = new Promise<void>((resolve) => {
    releaseSibling = resolve;
  });
  const firstFailure = new Error("first-worker-failed");
  const started: string[] = [];
  let siblingCompleted = false;
  let mapSettled = false;

  const run = mapConcurrent(
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

test("terminates and waits for an active detached agent child on shutdown", async () => {
  const supervisor = new FrenchEntityAgentChildSupervisor();
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    detached: process.platform !== "win32",
    stdio: "ignore"
  });
  await once(child, "spawn");
  const pid = child.pid;
  assert.ok(pid);
  supervisor.track(child);

  supervisor.requestShutdown("SIGINT");
  await supervisor.terminateAndWait();

  assert.throws(() => supervisor.assertRunning(), /interrupted:SIGINT/u);
  assert.throws(
    () => process.kill(process.platform === "win32" ? pid : -pid, 0),
    (error: unknown) => (error as NodeJS.ErrnoException).code === "ESRCH"
  );
});
