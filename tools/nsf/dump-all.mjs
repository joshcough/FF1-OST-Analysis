// Dump every FF1 song from the NSF into chip/: <song>.notes.txt (analysis)
// and <song>.mid (playable in Night Roll, for verification against the
// transcriptions). Track numbers from the Zophar m3u; meter per song from
// the corresponding MIDI; tempo auto-fitted to the chip's own timing.
// Run: node tools/nsf/dump-all.mjs reference/ff1.nsf
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseNSF, runNSF } from "./nsf.mjs";
import { reconstruct, toNotesTxt, fitBpm, detectLoop } from "./notes.mjs";
import { makeMidi } from "./midi-write.mjs";
import { createApp } from "../../tests/harness.mjs";

// Verified loop lengths IN BARS (Josh's analyses + earlier MIDI trims): the
// chip's frame-exact period ÷ this count gives the TRUE tempo. Songs absent
// here fall back to the grid fit.
const PERIOD_BARS = {
  ff1prelude: 16, ff1prologue: 24, ff1overworld: 16, ff1ship: 24,
  ff1airship: 16, ff1town: 8, ff1corneliacastle: 8, ff1gurguvolcano: 21,
  ff1matouyascave: 20, ff1cave: 30, ff1chaostemple: 16,
  ff1underwaterpalace: 16, ff1shop: 21, ff1battle: 26, ff1menu: 8,
  ff1gameover: 8, ff1victory: 6,
};

const TRACKS = [ // [nsf track, repo name, seconds to capture — ≥ intro + 2 loops]
  [1,  "ff1prelude", 170],
  [2,  "ff1prologue", 85],
  [3,  "ff1epilogue", 270], // through-composed, ~256s of music + final held chord — no loop to trim
  [4,  "ff1overworld", 60],
  [5,  "ff1ship", 90],
  [6,  "ff1airship", 45],
  [7,  "ff1town", 45],
  [8,  "ff1corneliacastle", 40],
  [9,  "ff1gurguvolcano", 65],
  [10, "ff1matouyascave", 65],
  [11, "ff1cave", 50],           // the chip has ONE track for cave/dungeon
  [12, "ff1chaostemple", 55],
  [13, "ff1floatingcastle", 65],
  [14, "ff1underwaterpalace", 55],
  [15, "ff1shop", 55],
  [16, "ff1battle", 90],
  [17, "ff1menu", 35],
  [18, "ff1gameover", 45],
  [19, "ff1victory", 30],
];

function meterOf(repoName) { // meter + bpm seed + bar count from the transcription MIDI
  try {
    const app = createApp();
    app.context.midiBytes = [...readFileSync("midi/" + repoName + ".mid")];
    const info = JSON.parse(app.run(
      "JSON.stringify((() => { const r = parseMidi(new Uint8Array(midiBytes).buffer); const bt = r.timesig[0] * 4 / r.timesig[1] * r.ppq; let end = 0; r.tracks.forEach(t => t.notes.forEach(n => end = Math.max(end, n.t + n.d))); return {ts: r.timesig, bpm: Math.round(6e7 / r.tempos[0].usq), bars: Math.ceil(end / bt - 0.05)}; })())"));
    return {tsNum: info.ts[0], tsDen: info.ts[1], seedBpm: info.bpm, midiBars: info.bars};
  } catch (err) {
    return {tsNum: 4, tsDen: 4, seedBpm: 120, midiBars: null};
  }
}

const nsfPath = process.argv[2] || "reference/ff1.nsf";
const nsf = parseNSF(readFileSync(nsfPath));
console.log(`${nsf.name} — ${nsf.artist}; ${nsf.songs} tracks in file`);

for (const [track, name, seconds] of TRACKS) {
  const {apuLog, frames, frameSec} = runNSF(nsf, track, seconds);
  let events = reconstruct(apuLog, frames, frameSec);
  // shift time zero to the first onset so chip bars line up with MIDI bars
  // (caveat: a pickup-intro song like ship starts its pickup at bar 1 beat 1)
  const t0 = Math.min(...events.map(e => e.startFrame));
  events = events.map(e => ({...e, startFrame: e.startFrame - t0, endFrame: e.endFrame - t0}));
  const {tsNum, tsDen, seedBpm, midiBars} = meterOf(name);

  // trim to intro + one loop pass, exactly as the transcriptions were.
  // victory varies articulation per pass; Josh verified its 6-bar period
  // by ear, so hint the detector at ~12.8s
  const HINTS = {ff1victory: 768};
  const loop = detectLoop(events, frames - t0, HINTS[name] || null);
  let keptFrames = frames - t0;
  if (loop) {
    keptFrames = loop.keep;
    events = events.filter(e => e.startFrame < keptFrames)
      .map(e => ({...e, endFrame: Math.min(e.endFrame, keptFrames)}));
  }

  // tempo: exact from the loop length when the transcription's bar count is
  // verified; otherwise fall back to the grid fit
  let bpm, tempoSrc;
  if (loop && PERIOD_BARS[name]) {
    const barSec = loop.period * frameSec / PERIOD_BARS[name];
    bpm = +(60 * (tsNum * 4 / tsDen) / barSec).toFixed(2);
    tempoSrc = "loop-calibrated";
    // sanity: a calibrated tempo wildly off the MIDI's means the detected
    // period disagrees with the verified bar count — flag rather than lie
    if (bpm < seedBpm * 0.65 || bpm > seedBpm * 1.5) {
      bpm = fitBpm(events, frameSec, seedBpm);
      tempoSrc = "grid-fitted (calibration REJECTED — check period)";
    }
  } else {
    bpm = fitBpm(events, frameSec, seedBpm);
    tempoSrc = "grid-fitted";
  }
  const chipBars = keptFrames * frameSec / (60 / bpm * (tsNum * 4 / tsDen));
  const beatSec = 60 / bpm;
  const bpb = tsNum * 4 / tsDen;
  const q = x => Math.round(x * 4) / 4;
  const bq = beats => { // beats-from-zero -> "bar.beat" on the 16th grid
    const bar = Math.floor(q(beats) / bpb) + 1;
    const beat = q(beats) - (bar - 1) * bpb + 1;
    return bar + "." + beat;
  };
  // record the cut so it's never a mystery: where this capture ends and
  // where the loop returns (frame-exact repeat points, Josh-verified rules)
  const cutInfo = loop
    ? "cut at " + bq(loop.keep * frameSec / beatSec) +
      ", loops to " + bq((loop.keep - loop.period) * frameSec / beatSec)
    : "through-composed, no cut";

  const txt = toNotesTxt(events, {
    frames: keptFrames, frameSec, bpm, tsNum, tsDen,
    title: name + " (chip capture, NSF track " + track + ", " + tempoSrc + " " + bpm + "bpm; " + cutInfo + ")",
  });
  writeFileSync("chip/" + name + ".notes.txt", txt);
  writeFileSync("chip/" + name + ".mid", makeMidi(events, {bpm, tsNum, tsDen, frameSec}));

  // when the loop returns somewhere other than the top, that's hardware fact:
  // record it as a loop: directive in the chip song's rollnotes (never
  // overwrite a file Josh may have edited)
  if (loop && !existsSync("chip/" + name + ".rollnotes")) {
    const backBeats = (loop.keep - loop.period) * frameSec / beatSec;
    if (backBeats > 0.4) {
      // anchor = the jump point (capture end), value = the jump target —
      // the player fires the loop at the anchor when it sits past the target
      const anchor = bq(loop.keep * frameSec / beatSec);
      const target = "loop: " + bq(backBeats);
      writeFileSync("chip/" + name + ".rollnotes",
        "# " + name + ".rollnotes — chip capture\n\n[" + anchor + "]\n" + target + "\n");
      console.log("   wrote loop directive: [" + anchor + "] " + target);
    }
  }
  console.log(name.padEnd(22) + "track " + String(track).padEnd(3) +
              (loop ? "keep " + (loop.keep * frameSec).toFixed(1) + "s (P=" +
                      (loop.period * frameSec).toFixed(1) + "s)" : "no-loop").padEnd(24) +
              bpm + "bpm (" + tempoSrc + ")  bars " + chipBars.toFixed(2) +
              (midiBars ? " vs midi " + midiBars : ""));
}
