import assert from "node:assert/strict";
import test from "node:test";
import { unparsedSourceRow } from "../src/strongSourceCoverage.js";
const row = (ref: string) =>
  `${ref}\tχάρις\tgrace\tG5485=N-NSF\tχάρις=grace\tNA28\t\t\t\t\t\tG5485`;
test("inventories square and brace reference notations without choosing the alternate verse", () => {
  for (const ref of ["Rom.16.25{14.24}#01=NKO", "2Co.13.13[13.14]#01=NKO"]) {
    const item = unparsedSourceRow(row(ref), "TAGNT.txt", 42)!;
    assert.equal(item.state, "unresolved-source-notation");
    assert.equal(item.absenceEstablished, false);
    assert.equal(item.rawReference, ref);
    assert.equal(item.possibleReferences.length, 2);
    assert.deepEqual(item.primaryCodes, ["G5485"]);
    assert.equal(item.line, 42);
  }
});
test("does not duplicate accepted source records or treat commentary as a source occurrence", () => {
  assert.equal(
    unparsedSourceRow(row("Rom.1.1#01=NKO"), "TAGNT.txt", 1),
    undefined
  );
  assert.equal(
    unparsedSourceRow(row("Rom.1.1(1.2)#01=NKO"), "TAGNT.txt", 1),
    undefined
  );
  assert.equal(
    unparsedSourceRow(row("# Rom.16.25{14.24}#01=NKO"), "TAGNT.txt", 1),
    undefined
  );
});
