// Stage 2: APU register log -> note events, channel identity intact.
// Discovery-mode rules: pitch, time, duration, channel. Nothing interpretive.
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
export function toNotesTxt(events, {frames, frameSec, bpm, tsNum = 4, tsDen = 4, title = "nsf"}) {
  const beatSec = 60 / bpm;
  const beatsPerBar = tsNum * 4 / tsDen;
  const q = x => Math.round(x * 4) / 4; // 16th-note grid
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
      const startBeat = e.startFrame * frameSec / beatSec;
      const durBeats = q((e.endFrame - e.startFrame) * frameSec / beatSec);
      if (durBeats <= 0) continue;
      const bar = Math.floor(startBeat / beatsPerBar) + 1;
      const beat = q(startBeat - (bar - 1) * beatsPerBar) + 1;
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
