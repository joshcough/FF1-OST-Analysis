// End-to-end test of the NSF pipeline against a synthetic, self-assembled
// NSF (no copyrighted data): 6502 emulation -> APU write log -> note
// reconstruction -> .notes.txt emission.
import test from "node:test";
import assert from "node:assert/strict";
import { makeTestNSF } from "../tools/nsf/make-test-nsf.mjs";
import { parseNSF, runNSF } from "../tools/nsf/nsf.mjs";
import { reconstruct, toNotesTxt, pitchName } from "../tools/nsf/notes.mjs";

test("NSF pipeline: synthetic tune comes back note-perfect with channel identity", () => {
  const nsf = parseNSF(makeTestNSF().buffer);
  assert.equal(nsf.songs, 1);
  assert.equal(nsf.name, "Night Roll test tune");

  const {apuLog, frames, frameSec} = runNSF(nsf, 1, 3); // 3 seconds ≈ 180 frames
  assert.ok(apuLog.length > 0, "APU writes were logged");

  const events = reconstruct(apuLog, frames, frameSec);
  const pulse1 = events.filter(e => e.channel === "pulse1").map(e => pitchName(e.midi));
  assert.deepEqual(pulse1, ["C4", "E4", "G4", "C5"]);

  const tri = events.filter(e => e.channel === "triangle");
  assert.equal(tri.length, 1);
  assert.equal(pitchName(tri[0].midi), "C3");
  assert.ok(tri[0].startFrame <= 1, "triangle pedal starts at init");

  // quarter notes at 120bpm = 30 frames each
  const durations = events.filter(e => e.channel === "pulse1")
    .map(e => e.endFrame - e.startFrame);
  for (const d of durations.slice(0, 3)) {
    assert.ok(Math.abs(d - 30) <= 1, "note duration ≈ 30 frames, got " + d);
  }

  const txt = toNotesTxt(events, {frames, frameSec, bpm: 120, title: "test"});
  assert.match(txt, /## channel pulse1/);
  assert.match(txt, /## channel triangle/);
  assert.match(txt, /C4 1/);
  assert.match(txt, /no key is stated/);
});
