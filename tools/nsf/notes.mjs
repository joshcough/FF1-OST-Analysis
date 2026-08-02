// Stage 2: APU register log -> note events, channel identity intact.
// Discovery-mode rules: pitch, time, duration, channel. Nothing interpretive.
import { snapBeat } from "./midi-write.mjs";
const CLOCK = 1_789_773; // NTSC CPU Hz

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function pitchName(midi) { return NAMES[midi % 12] + (Math.floor(midi / 12) - 1); }

function midiFromFreq(f) { return Math.round(69 + 12 * Math.log2(f / 440)); }

// Reconstruct per-channel note events from the write log.
// A channel sounds when: enabled in $4015, its volume is audible, and its
// period is in range. A new note begins when the derived MIDI pitch changes
// or the channel comes back from silence.
export function reconstruct(apuLog, frames, frameSec) {
  const ch = {
    pulse1: {base: 0x4000, on: false, midi: null, vol: 0, period: 0, enabled: false},
    pulse2: {base: 0x4004, on: false, midi: null, vol: 0, period: 0, enabled: false},
    triangle: {base: 0x4008, on: false, midi: null, vol: 1, period: 0, enabled: false, linear: 0},
    noise: {base: 0x400C, on: false, midi: null, vol: 0, period: 0, enabled: false},
  };
  const events = []; // {channel, startFrame, endFrame|null, midi, periodValue}
  const open = {};   // channel -> event

  const freqOf = (name, c) => {
    if (name === "triangle") return CLOCK / (32 * (c.period + 1));
    return CLOCK / (16 * (c.period + 1)); // pulses
  };
  const audible = (name, c) => {
    if (!c.enabled) return false;
    if (name === "triangle") return c.linear > 0 && c.period > 1;
    if (name === "noise") return c.vol > 0;
    return c.vol > 0 && c.period > 7 && c.period < 0x800;
  };

  const update = (name, c, frame) => {
    const isOn = audible(name, c);
    let midi = null;
    if (isOn && name !== "noise") midi = midiFromFreq(freqOf(name, c));
    if (isOn && name === "noise") midi = c.period & 0x0F; // noise "pitch" = period index, not a MIDI note
    const cur = open[name];
    if (cur && (!isOn || cur.midi !== midi)) { cur.endFrame = frame; delete open[name]; }
    if (isOn && !open[name]) {
      open[name] = {channel: name, startFrame: frame, endFrame: null, midi, periodValue: c.period};
      events.push(open[name]);
    }
  };

  for (const w of apuLog) {
    const {addr, value, frame} = w;
    if (addr === 0x4015) {
      ch.pulse1.enabled = !!(value & 1);
      ch.pulse2.enabled = !!(value & 2);
      ch.triangle.enabled = !!(value & 4);
      ch.noise.enabled = !!(value & 8);
      for (const [name, c] of Object.entries(ch)) update(name, c, frame);
      continue;
    }
    for (const [name, c] of Object.entries(ch)) {
      const r = addr - c.base;
      if (r < 0 || r > 3) continue;
      if (r === 0) {
        if (name === "triangle") c.linear = value & 0x7F;
        else c.vol = value & 0x0F; // constant-volume field; envelope users still write nonzero here
      } else if (r === 2) {
        c.period = (c.period & 0x700) | value;
      } else if (r === 3) {
        if (name !== "noise") c.period = (c.period & 0xFF) | ((value & 7) << 8);
        // length-counter load also (re)starts the note; treat as potential boundary
        if (open[name]) { open[name].endFrame = frame; delete open[name]; }
      } else if (r === 1 && name === "noise") {
        c.period = value & 0x0F;
      }
      update(name, c, frame);
    }
  }
  for (const name of Object.keys(open)) open[name].endFrame = frames;
  for (const e of events) if (e.endFrame === null) e.endFrame = frames;
  return events.filter(e => e.endFrame > e.startFrame);
}

// The chip's true tempo rarely equals the MIDI transcription's round number
// (drivers count frames, not bpm). Fit it: sweep candidates, score how well
// note onsets snap to a 16th-note grid, keep the best.
// Chip loops are frame-exact (identical register writes each pass), so the
// loop is detectable precisely. For a candidate period P, find R = the first
// frame from which everything is pure repetition (every event at t ≥ R has an
// identical partner at t−P). Keep [0, R): intro + one full pass — the same
// cut rule used to trim the transcriptions. Returns {keep: R, period: P} in
// frames, or null (non-looping jingles like the epilogue).
export function detectLoop(events, frames, hint = null) {
  const evs = [...events].sort((a, b) => a.startFrame - b.startFrame);
  if (evs.length < 8) return null;
  const byKey = new Map(); // channel:midi:startFrame -> event
  for (const e of evs) byKey.set(e.channel + ":" + e.midi + ":" + e.startFrame, e);
  const partnerOk = (e, P) => {
    const partner = byKey.get(e.channel + ":" + e.midi + ":" + (e.startFrame - P));
    return partner && (Math.abs((partner.endFrame - partner.startFrame) -
           (e.endFrame - e.startFrame)) <= 2 || e.endFrame >= frames - 2);
  };
  // cheap pre-filter: sample a handful of late events before the full scan
  const samples = evs.filter((_, i) => i % Math.ceil(evs.length / 12) === 0);
  const TOL = 3; // loop-boundary artifacts (restart attack vs shifted song start)
  // a hint (approx period in frames, from a verified by-ear analysis) narrows
  // the search and relaxes the mismatch bound — some songs vary articulation
  // per pass more than the blind threshold tolerates
  const [pLo, pHi, maxBadRatio] = hint
    ? [hint - 8, hint + 8, 0.25]
    : [120, frames * 0.6, 0.15];
  let best = null;
  for (let P = pLo; P <= pHi; P++) {
    let quickBad = 0;
    for (const s of samples) if (s.startFrame >= P && !partnerOk(s, P)) quickBad++;
    if (quickBad > samples.length / 2) continue;
    const bad = [];
    let testable = 0;
    for (const e of evs) {
      if (e.startFrame < P) continue;
      testable++;
      if (!partnerOk(e, P)) bad.push(e);
    }
    if (testable < 20 || bad.length > testable * maxBadRatio) continue;
    bad.sort((a, b) => a.startFrame - b.startFrame);
    let cut = bad.length <= TOL ? 0 : bad[bad.length - TOL - 1].startFrame + 1; // allow TOL stragglers
    // a tight trailing cluster of "stragglers" is a loop-seam overlap (ship's
    // pickup replayed under sustained accompaniment, battle's turnaround run)
    // — real once-only material, so keep through it INCLUDING note tails:
    // cutting at the last onset chops the seam notes mid-sound
    if (cut && bad[bad.length - 1].startFrame - cut < 100) {
      cut = Math.max(...bad.filter(e => e.startFrame >= cut - 100)
                        .map(e => e.endFrame));
    }
    // the backward check is blind to a non-repeating intro SHORTER than P
    // (its events sit at t < P, where nothing is tested — gameover's 2-beat
    // pickup). Forward pass: early events that never recur one period later
    // are intro material, played once; keep = intro + one full period.
    // intro is a PREFIX: stop at the first event that does recur, so per-pass
    // variation deeper in the body can't masquerade as intro
    const badF = [];
    for (const e of evs) {
      if (e.startFrame >= P || e.startFrame >= frames - P - 2) break;
      if (byKey.get(e.channel + ":" + e.midi + ":" + (e.startFrame + P))) break;
      badF.push(e);
    }
    const introEnd = badF.length
      ? Math.max(...badF.map(e => Math.min(e.endFrame, e.startFrame + P)))
      : 0;
    let keep = Math.max(P + introEnd, cut); // repetition can't begin before one period has elapsed
    // let notes straddling the boundary ring out (ship's full-beat A#4 under
    // the seam) — otherwise the last sounds of the pass are chopped mid-note
    keep = Math.max(keep, ...evs.filter(e =>
      e.startFrame < keep && e.startFrame >= keep - 100 && e.endFrame > keep)
      .map(e => Math.min(e.endFrame, frames)));
    // demand a full clean period observed after the repeat point
    if (frames - keep >= P) {
      if (!hint) return {keep, period: P};
      if (!best || bad.length < best.bad) best = {keep, period: P, bad: bad.length};
    }
  }
  return best ? {keep: best.keep, period: best.period} : null;
}

// Seeded ±15% around the transcription's bpm — an open sweep locks onto
// subharmonics (half tempo snaps the same grid), and matching the MIDI's
// bar numbering is the point.
export function fitBpm(events, frameSec, seedBpm) {
  const onsets = events.filter(e => e.channel !== "noise").map(e => e.startFrame * frameSec);
  if (onsets.length < 8) return seedBpm;
  let best = null;
  for (let bpm = seedBpm * 0.85; bpm <= seedBpm * 1.15; bpm += 0.02) {
    const grid = 60 / bpm / 4; // a 16th
    let err = 0;
    for (const t of onsets) {
      const ph = (t / grid) % 1;
      err += Math.min(ph, 1 - ph);
    }
    if (!best || err < best.err) best = {bpm: +bpm.toFixed(2), err};
  }
  return best.bpm;
}

// Stage 3: events -> the repo's .notes.txt format. Bars need a tempo the
// chip doesn't carry — bpm/timesig come from the caller (known per song).
export function toNotesTxt(events, {frames, frameSec, bpm, tsNum = 4, tsDen = 4, title = "nsf", snap = true}) {
  const beatSec = 60 / bpm;
  const beatsPerBar = tsNum * 4 / tsDen;
  // snapped to the grid like the MIDI writer — or, for snap:false songs
  // (tempo changes the grid can't follow), raw time shown to 0.01 beat
  const q = snap ? snapBeat : (x => Math.round(x * 100) / 100);
  const byChannel = {};
  for (const e of events) (byChannel[e.channel] = byChannel[e.channel] || []).push(e);
  const L = [];
  L.push(`# ${title} — ${tsNum}/${tsDen}, ${bpm}bpm, ${Math.ceil(frames * frameSec / (beatSec * beatsPerBar))} bars (from NSF capture)`);
  L.push("# Format: bar N: beat pitch duration-in-quarter-notes");
  L.push("# Channel identity is hardware fact. Pitches use sharp spelling; no key is stated.");
  for (const [name, evs] of Object.entries(byChannel)) {
    L.push("");
    L.push(`## channel ${name}`);
    const rows = {};
    for (const e of evs) {
      const qb = q(e.startFrame * frameSec / beatSec); // quantize FIRST, then
      const durBeats = q((e.endFrame - e.startFrame) * frameSec / beatSec);
      if (durBeats <= 0) continue;
      const bar = Math.floor(qb / beatsPerBar + 1e-9) + 1; // ...assign the bar,
      const beat = qb - (bar - 1) * beatsPerBar + 1; // so no "beat 5" in 4/4
      const label = name === "noise" ? "N" + e.midi : pitchName(e.midi);
      (rows[bar] = rows[bar] || []).push(
        (+beat.toFixed(2)) + " " + label + " " + (+durBeats.toFixed(2)));
    }
    for (const bar of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
      L.push("bar " + bar + ": " + rows[bar].join(", "));
    }
  }
  return L.join("\n") + "\n";
}
