// Dump every FF1 song from the NSF to midi/<song>.chip.notes.txt.
// Track numbers and rough durations from the Zophar m3u; meter per song from
// the corresponding MIDI; tempo auto-fitted to the chip's own timing.
// Run: node tools/nsf/dump-all.mjs reference/ff1.nsf
import { readFileSync, writeFileSync } from "node:fs";
import { parseNSF, runNSF } from "./nsf.mjs";
import { reconstruct, toNotesTxt, fitBpm } from "./notes.mjs";
import { createApp } from "../../tests/harness.mjs";

const TRACKS = [ // [nsf track, repo name, seconds to capture]
  [1,  "ff1prelude", 80],
  [2,  "ff1prologue", 80],
  [3,  "ff1epilogue", 120],
  [4,  "ff1overworld", 55],
  [5,  "ff1ship", 80],
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

function meterOf(repoName) { // meter + bpm seed from the transcription MIDI
  try {
    const app = createApp();
    app.context.midiBytes = [...readFileSync("midi/" + repoName + ".mid")];
    const info = JSON.parse(app.run(
      "JSON.stringify((() => { const r = parseMidi(new Uint8Array(midiBytes).buffer); return {ts: r.timesig, bpm: Math.round(6e7 / r.tempos[0].usq)}; })())"));
    return {tsNum: info.ts[0], tsDen: info.ts[1], seedBpm: info.bpm};
  } catch (err) {
    return {tsNum: 4, tsDen: 4, seedBpm: 120};
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
  const {tsNum, tsDen, seedBpm} = meterOf(name);
  const bpm = fitBpm(events, frameSec, seedBpm);
  const txt = toNotesTxt(events, {
    frames, frameSec, bpm, tsNum, tsDen,
    title: name + " (chip capture, NSF track " + track + ", tempo fitted " + bpm + "bpm)",
  });
  writeFileSync("midi/" + name + ".chip.notes.txt", txt);
  console.log(name.padEnd(22) + "track " + String(track).padEnd(3) +
              bpm + "bpm  " + events.length + " notes  " + txt.length + " bytes");
}
