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

// ---- period → pitch, tested through the real reconstruct() path ----------
// Expected values come from first principles, never from the code under test:
// A440 equal temperament, octave 4 written out to two decimals so a human can
// check it against any tuning chart, other octaves by doubling/halving.
const CLOCK = 1789773; // NTSC 2A03 CPU clock, Hz
const FREQ4 = [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00,
               415.30, 440.00, 466.16, 493.88]; // C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4
const freqOfMidi = m => FREQ4[m % 12] * 2 ** (Math.floor(m / 12) - 5); // 69 → 440
function nearestMidi(f) { // closest tempered note by log distance
  // range extends past MIDI 127: ultrasonic triangle periods (2-6, ~9-18kHz)
  // legitimately derive numbers up to ~134 — the pipeline doesn't clamp, and
  // no FF1 capture goes there, but the sweep must agree on those edges too
  let best = 0, bestD = Infinity;
  for (let m = 0; m < 144; m++) {
    const d = Math.abs(Math.log2(f / freqOfMidi(m)));
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}
// one isolated note per period: set period, sound it, silence, next
function pulseLog(periods) {
  let frame = 0;
  const log = [{frame: frame++, addr: 0x4015, value: 0x01}];
  for (const p of periods) {
    log.push({frame, addr: 0x4000, value: 0x1F});            // constant volume, level 15
    log.push({frame, addr: 0x4002, value: p & 0xFF});
    log.push({frame, addr: 0x4003, value: (p >> 8) & 7});
    frame += 2;
    log.push({frame: frame++, addr: 0x4000, value: 0x10});   // level 0: silence
  }
  return {log, frames: frame + 1};
}
function triLog(periods) {
  let frame = 0;
  const log = [{frame: frame++, addr: 0x4015, value: 0x04}];
  for (const p of periods) {
    log.push({frame, addr: 0x4008, value: 0x7F});            // linear counter on
    log.push({frame, addr: 0x400A, value: p & 0xFF});
    log.push({frame, addr: 0x400B, value: (p >> 8) & 7});
    frame += 2;
    log.push({frame: frame++, addr: 0x4008, value: 0x00});   // linear 0: silence
  }
  return {log, frames: frame + 1};
}

test("period → pitch: canonical Nesdev anchor periods derive from the same physics", () => {
  // hand-checkable against the standard NTSC period table
  assert.equal(Math.round(CLOCK / (16 * 440)) - 1, 0x0FD);    // A4 (pulse)
  assert.equal(Math.round(CLOCK / (16 * 110)) - 1, 0x3F8);    // A2 (pulse)
  assert.equal(Math.round(CLOCK / (16 * 55)) - 1, 0x7F1);     // A1 (pulse)
});

test("period → pitch: every pulse period in the audible range maps to the nearest tempered note", () => {
  const periods = [];
  for (let p = 8; p < 0x800; p++) periods.push(p);            // the guard's own range
  const {log, frames} = pulseLog(periods);
  const events = reconstruct(log, frames, 1 / 60);
  assert.equal(events.length, periods.length, "one note per period");
  events.forEach((e, i) => {
    const f = CLOCK / (16 * (periods[i] + 1));
    assert.equal(e.midi, nearestMidi(f), `pulse period ${periods[i]} (${f.toFixed(2)} Hz)`);
  });
});

test("period → pitch: every triangle period maps an octave below the same pulse period", () => {
  const periods = [];
  for (let p = 2; p < 0x800; p++) periods.push(p);            // triangle guard: period > 1
  const {log, frames} = triLog(periods);
  const events = reconstruct(log, frames, 1 / 60);
  assert.equal(events.length, periods.length, "one note per period");
  events.forEach((e, i) => {
    const f = CLOCK / (32 * (periods[i] + 1));                // triangle divisor: 32, not 16
    assert.equal(e.midi, nearestMidi(f), `triangle period ${periods[i]} (${f.toFixed(2)} Hz)`);
  });
  // known landmark: pulse $0FD is A4, triangle $0FD is A3
  const {log: l2, frames: f2} = triLog([0x0FD]);
  assert.equal(pitchName(reconstruct(l2, f2, 1 / 60)[0].midi), "A3");
});

test("period → pitch boundaries: guard floors and ceilings", () => {
  // pulse floor: period 7 is silent, 8 sounds
  assert.equal(reconstruct(pulseLog([7]).log, 10, 1 / 60).length, 0);
  assert.equal(reconstruct(pulseLog([8]).log, 10, 1 / 60).length, 1);
  // pulse ceiling: $7FF (the deepest reachable period) → 54.63 Hz → A1
  const low = reconstruct(pulseLog([0x7FF]).log, 10, 1 / 60);
  assert.equal(pitchName(low[0].midi), "A1");
  // triangle floor: period 1 is silent, 2 sounds
  assert.equal(reconstruct(triLog([1]).log, 10, 1 / 60).length, 0);
  assert.equal(reconstruct(triLog([2]).log, 10, 1 / 60).length, 1);
  // triangle depth: $7FF → 27.32 Hz → A0, the bass floor Josh reads
  const deep = reconstruct(triLog([0x7FF]).log, 10, 1 / 60);
  assert.equal(pitchName(deep[0].midi), "A0");
});
