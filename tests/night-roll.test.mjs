// Unit tests for Night Roll's pure logic (index.html inline script).
// Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./harness.mjs";

const app = createApp();
const run = (code) => app.run(code);
// vm results live in another realm (different Array prototype breaks deepEqual);
// JSON round-trip localizes them
const val = (code) => JSON.parse(run(`JSON.stringify(${code})`));

// A minimal 4/4 song so functions that read `song` work. ppq 480; second
// tempo doubles the speed at tick 960 (sec computed the way parseMidi does).
function installSong() {
  run(`
    song = {ppq: 480, timesig: [4, 4],
            tempos: [{tick: 0, usq: 500000, sec: 0}, {tick: 960, usq: 250000, sec: 1}],
            tracks: []};
    songKey = "midi/test.mid";
    keyRegions = [];
    previewSf = null;
    playCursor = 0;
  `);
}

test("script loads: core functions exist", () => {
  for (const fn of ["parseMidi", "parseRollnotes", "serializeRollnotes", "keyNameToSf",
                    "nameChord", "durationPieces", "tickToSec", "secToTick", "sfAt"]) {
    assert.equal(run(`typeof ${fn}`), "function", fn);
  }
});

test("keyNameToSf: majors, minors map to relative major, invalid → null", () => {
  const cases = {C: 0, G: 1, D: 2, F: -1, Bb: -2, "F#": 6, Db: -5,
                 Am: 0, Em: 1, Bbm: -5, Dm: -1};
  for (const [name, sf] of Object.entries(cases)) {
    assert.equal(run(`keyNameToSf(${JSON.stringify(name)})`), sf, name);
  }
  assert.equal(run(`keyNameToSf("H")`), null);
  assert.equal(run(`keyNameToSf("")`), null);
});

test("parseRollnotes: anchors, ranges, sections, key directives, comments dropped", () => {
  const text = [
    "# header comment", "",
    "[3.1]", "hello", "world", "",
    "[7.1 - 8.4]", "range note", "",
    "[1.1 - 4.4]", "section: A — G home", "",
    "[9.1]", "key: Bb", "",
    "[2.5]", "fractional beat", "",
  ].join("\n");
  const notes = val(`parseRollnotes(${JSON.stringify(text)})`);
  assert.equal(notes.length, 5);
  const [a, b, c, d, e] = notes;
  assert.deepEqual([a.b1, a.q1, a.b2, a.text], [3, 1, null, "hello\nworld"]);
  assert.deepEqual([b.b1, b.q1, b.b2, b.q2], [7, 1, 8, 4]);
  assert.equal(c.section, true);
  assert.equal(c.text, "A — G home");
  assert.equal(d.keydir, -2);
  assert.equal(d.text, "key: Bb");
  assert.deepEqual([e.b1, e.q1], [2, 5]);
  assert.ok(!notes.some(n => n.text.includes("comment")));
});

test("rollnotes round-trip: parse → serialize → parse is stable", () => {
  installSong();
  const text = [
    "[1.1 - 4.4]", "section: A", "",
    "[3.1]", "a note", "",
    "[5.1]", "key: G", "",
    "[6.1]", "key: Gm", "",
    "[6.2.5]", "off-beat", "",
  ].join("\n");
  run(`rollnotes = parseRollnotes(${JSON.stringify(text)}).map(resolveNote);`);
  const once = run(`serializeRollnotes()`);
  run(`rollnotes = parseRollnotes(${JSON.stringify(once)}).map(resolveNote);`);
  const twice = run(`serializeRollnotes()`);
  assert.equal(twice, once);
  assert.match(once, /\[1\.1 - 4\.4\]\nsection: A/);
  assert.match(once, /\[5\.1\]\nkey: G\n/);
  assert.match(once, /\[6\.1\]\nkey: Gm\n/); // minor tonic survives the round-trip
  assert.equal(run(`rollnotes.find(n => n.text === "key: Gm").keydir`), -2); // Gm = 2 flats
});

test("chop: start/end directives trim the displayed song and renumber", () => {
  installSong();
  run(`
    song.tracks = [{name: "t", notes: []}];
    song.rawNotes = [[
      {t: 0,    d: 480, p: 60},   // bar 1 (chopped)
      {t: 1920, d: 480, p: 62},   // bar 2 → displayed bar 1
      {t: 1680, d: 480, p: 63},   // straddles the cut: clipped to start
      {t: 5760, d: 480, p: 64},   // bar 4 (chopped by end)
    ]];
    chopS = 0; chopE = null; appliedChop = null;
    declaredTs = null;
    rollnotes = parseRollnotes("[2.1]\\nchop: start\\n\\n[4.1]\\nchop: end\\n\\n[1.1 - 1.4]\\nchord: C\\n").map(resolveNote);
    finalizeNotes();
  `);
  assert.equal(run(`chopS`), 1920);
  assert.equal(run(`chopE`), 5760);
  const notes = val(`song.tracks[0].notes.map(n => ({t: n.t, d: n.d, p: n.p}))`);
  assert.deepEqual(notes, [
    {t: 0, d: 480, p: 62},        // slid left by one bar
    {t: 0, d: 240, p: 63},        // straddler clipped at the cut
  ]);
  assert.equal(run(`songEndTick`), 1920); // one displayed bar survives
  // the chord annotation stays in displayed coords: bar 1 as written
  assert.equal(val(`rollnotes.find(n => n.chord)`).start, 0);
  // round-trip: directives serialize verbatim in raw coords
  const once = run(`serializeRollnotes()`);
  assert.match(once, /\[2\.1\]\nchop: start\n/);
  assert.match(once, /\[4\.1\]\nchop: end\n/);
  // shiftAnchors: removing the start chop moves displayed anchors right one bar
  run(`shiftAnchors(1920); rollnotes = rollnotes.filter(n => n.chopdir !== "start"); finalizeNotes();`);
  const c = val(`rollnotes.find(n => n.chord)`);
  assert.deepEqual([c.b1, c.b2], [2, 2]);
  assert.equal(run(`chopS`), 0);
  assert.equal(val(`song.tracks[0].notes.length`), 3); // bar-1 note restored
});

test("6/8: beats are eighths — anchors, defaults, re-bar conversion", () => {
  installSong();
  const text = [
    "[1.1]", "timesig: 6/8", "",
    "[1.1 - 1.3]", "chord: Bb", "",
    "[1.4 - 1.6]", "chord: F7", "",
    "[2.1]", "a note", "",
  ].join("\n");
  run(`declaredTs = null; rollnotes = parseRollnotes(${JSON.stringify(text)}).map(resolveNote); finalizeNotes();`);
  assert.deepEqual(val(`effTs()`), [6, 8]);
  assert.equal(run(`beatTicks()`), 240);           // eighth at ppq 480
  assert.equal(run(`barTicks()`), 1440);           // 6 eighths = 3 quarters
  const bb = val(`rollnotes.find(n => n.text === "Bb")`);
  assert.equal(bb.start, 0);
  assert.equal(bb.end, 720);                       // first half of the bar (3 eighths)
  const f7 = val(`rollnotes.find(n => n.text === "F7")`);
  assert.equal(f7.start, 720);                     // second half starts mid-bar
  assert.equal(f7.end, 1440);
  assert.equal(val(`rollnotes.find(n => n.text === "a note")`).start, 1440); // bar 2 = one 6/8 bar in
  // serialize keeps eighth-counted anchors
  assert.match(run(`serializeRollnotes()`), /\[1\.4 - 1\.6\]\nchord: F7\n/);
  // re-bar 6/8 → 4/4 preserves absolute positions: eighth 4 of bar 1 = quarter 2.5
  run(`convertAnchors([6, 8], [4, 4]); declaredTs = null;
       rollnotes = rollnotes.filter(n => !n.tsdir); finalizeNotes();`);
  const f74 = val(`rollnotes.find(n => n.text === "F7")`);
  assert.equal(f74.b1, 1);
  assert.equal(f74.q1, 2.5);
  assert.equal(f74.start, 720); // same tick as before
});

test("chord directives: parse, attached note, round-trip", () => {
  installSong();
  const text = [
    "[1.1 - 4.4]", "section: A", "",
    "[1.1 - 1.2]", "chord: C", "",
    "[1.3 - 1.4]", "chord: G7/B", "no 5th — the bass supplies it", "",
    "[2.1]", "plain note", "",
  ].join("\n");
  run(`rollnotes = parseRollnotes(${JSON.stringify(text)}).map(resolveNote); finalizeNotes();`);
  assert.equal(run(`rollnotes.filter(n => n.chord).length`), 2);
  assert.equal(run(`rollnotes.find(n => n.chord && n.b1 === 1 && n.q1 === 1).text`), "C");
  const g7 = val(`rollnotes.find(n => n.text === "G7/B")`);
  assert.equal(g7.chord, true);
  assert.equal(g7.cnote, "no 5th — the bass supplies it");
  assert.equal(run(`rollnotes.find(n => n.text === "C").cnote`), undefined);
  // chords band like sections: nested inside A, one level down
  assert.equal(g7.depth, 1);
  assert.equal(val(`rollnotes.find(n => n.section).depth`), 0);
  // sections stay sections, chords stay chords
  assert.ok(!g7.section);
  const once = run(`serializeRollnotes()`);
  assert.match(once, /\[1\.3 - 1\.4\]\nchord: G7\/B\nno 5th — the bass supplies it\n/);
  assert.match(once, /chord: C\n/);
  run(`rollnotes = parseRollnotes(${JSON.stringify(once)}).map(resolveNote); finalizeNotes();`);
  assert.equal(run(`serializeRollnotes()`), once);
});

test("modal keys: tonic + mode names map to the relative major's signature", () => {
  installSong();
  assert.equal(run(`keyNameToSf("D dorian")`), 0);   // D dorian shares C major's signature
  assert.equal(run(`keyNameToSf("F dorian")`), -3);  // F dorian shares Eb major's
  assert.equal(run(`keyNameToSf("Bb lydian")`), -1); // Bb lydian shares F major's
  assert.equal(run(`keyNameToSf("E phrygian")`), 0);
  assert.equal(run(`keyNameToSf("G mixolydian")`), 0);
  assert.equal(run(`keyNameToSf("Gm")`), -2);        // legacy minor suffix still works
  assert.equal(run(`chosenKeyName(0, "dorian")`), "D dorian");
  assert.equal(run(`chosenKeyName(-3, "dorian")`), "F dorian");
  assert.equal(run(`chosenKeyName(-2, "minor")`), "Gm");
  assert.equal(run(`chosenKeyName(1, "major")`), "G");
  // round-trip through rollnotes: the modal name survives and carries its signature
  run(`rollnotes = parseRollnotes("[1.1]\\nkey: D dorian\\n").map(resolveNote); finalizeNotes();`);
  assert.equal(run(`rollnotes[0].keydir`), 0);
  assert.match(run(`serializeRollnotes()`), /key: D dorian\n/);
});

test("tickToSec/secToTick: piecewise tempo map, mutual inverses", () => {
  installSong();
  assert.equal(run(`tickToSec(song, 480)`), 0.5);
  assert.equal(run(`tickToSec(song, 960)`), 1);
  assert.equal(run(`tickToSec(song, 1440)`), 1.25); // after the tempo doubles
  for (const tick of [0, 100, 480, 960, 1440, 5000]) {
    assert.ok(Math.abs(run(`secToTick(song, tickToSec(song, ${tick}))`) - tick) < 1e-6, "tick " + tick);
  }
});

test("parseMidi: header, tempo, notes, running status", () => {
  // MThd (fmt 0, 1 track, ppq 480) + one track:
  // tempo 500000; C4 on; D4 on via running status; both off (off also running)
  const bytes = [
    0x4D,0x54,0x68,0x64, 0,0,0,6, 0,0, 0,1, 0x01,0xE0,
    0x4D,0x54,0x72,0x6B, 0,0,0,26,
    0x00, 0xFF,0x51,0x03, 0x07,0xA1,0x20,
    0x00, 0x90,0x3C,0x64,
    0x00, 0x3E,0x64,
    0x83,0x60, 0x80,0x3C,0x40,
    0x00, 0x3E,0x40,
    0x00, 0xFF,0x2F,0x00,
  ];
  const s = val(`parseMidi(new Uint8Array([${bytes}]).buffer)`);
  assert.equal(s.ppq, 480);
  assert.equal(s.tempos[0].usq, 500000);
  assert.equal(s.tracks.length, 1);
  const notes = s.tracks[0].notes;
  assert.equal(notes.length, 2);
  assert.deepEqual(notes.map(n => [n.t, n.d, n.p, n.v]), [[0, 480, 60, 100], [0, 480, 62, 100]]);
});

test("durationPieces: whole, dotted, composite splits", () => {
  const P = 480;
  const pieces = (t) => val(`durationPieces(${t}, ${P})`).map(p => p.dur + ".".repeat(p.dots));
  assert.deepEqual(pieces(4 * P), ["w"]);
  assert.deepEqual(pieces(1.5 * P), ["q."]);
  assert.deepEqual(pieces(P), ["q"]);
  assert.deepEqual(pieces(1.25 * P), ["q", "16"]);
  assert.deepEqual(pieces(0.5 * P), ["8"]);
});

test("nameChord: triads, sevenths, inversions, dyads, missing 5th, flat keys", () => {
  installSong();
  const chord = (ps, sf) => run(`nameChord([${ps}], ${sf})`);
  assert.equal(chord([60, 64, 67], 0), "C");
  assert.equal(chord([64, 67, 72], 0), "C/E");
  assert.equal(chord([57, 60, 64, 67], 0), "Am7");
  assert.equal(chord([60, 67], 0), "C5");
  assert.equal(chord([60, 64, 70], 0), "C7 (no 5th)");
  assert.equal(chord([61, 65, 68], -2), "Db"); // spelled per key: Db, not C#
});

test("keySpelling via spellPc: signature notes and chromatic defaults", () => {
  installSong();
  assert.equal(run(`spellPc(6, 1)`), "F#");   // G major's sharp
  assert.equal(run(`spellPc(10, -1)`), "Bb"); // F major's flat
  assert.equal(run(`spellPc(1, 0)`), "C#");   // chromatic: leading-tone-ish → sharp
  assert.equal(run(`spellPc(3, 0)`), "Eb");   // chromatic: borrowed → flat
});

test("sfAt: open keys, ranged keys revert, preview overrides", () => {
  installSong();
  run(`keyRegions = [
    {start: 0, sf: 1, end: null},
    {start: 960, sf: -2, end: 1920},
  ];`);
  assert.equal(run(`sfAt(0)`), 1);
  assert.equal(run(`sfAt(1000)`), -2); // inside the ranged key
  assert.equal(run(`sfAt(2000)`), 1);  // ranged key ended: surrounding key resumes
  run(`previewSf = 3;`);
  assert.equal(run(`sfAt(1000)`), 3);  // dial preview wins
  run(`previewSf = null;`);
});

test("beatLabel: 1e&a counting with fractional fallback", () => {
  const label = (b) => run(`beatLabel(${b})`);
  assert.equal(label(1), "1");
  assert.equal(label(2.25), "2e");
  assert.equal(label(3.5), "3&");
  assert.equal(label(4.75), "4a");
  assert.equal(label(1.33), "1.33");
});

test("loop directive: anchor past target = jump point; else song end; whole song without one", () => {
  installSong();
  run(`rollnotes = parseRollnotes("[25.1]\\nloop: 2.1\\n").map(resolveNote); finalizeNotes();`);
  assert.equal(run(`rollnotes[0].loopTo`), 1920); // bar 2 beat 1 at ppq 480
  run(`songEndTick = 26 * 4 * 480;`);
  const seg = val(`currentLoop()`);
  assert.ok(Math.abs(seg.start - run(`tickToSec(song, 1920)`)) < 1e-9);
  // fires at the [25.1] anchor, not at the song end a bar later
  assert.ok(Math.abs(seg.end - run(`tickToSec(song, 24 * 4 * 480)`)) < 1e-9);
  // anchor at/before the target (auto-written [1.1] files): jump at song end
  run(`rollnotes = parseRollnotes("[1.1]\\nloop: 2.1\\n").map(resolveNote); finalizeNotes();`);
  const seg2 = val(`currentLoop()`);
  assert.ok(Math.abs(seg2.end - run(`tickToSec(song, songEndTick)`)) < 1e-9);
  run(`rollnotes = []; finalizeNotes();`);
  const whole = val(`currentLoop()`);
  assert.equal(whole.start, 0);
  assert.ok(Math.abs(whole.end - run(`tickToSec(song, songEndTick)`)) < 1e-9);
});

test("saveEdits: an added note that was erased is not persisted (regression)", () => {
  installSong();
  run(`
    song.tracks = [{name: "t", notes: [
      {t: 0, d: 480, p: 60, v: 80, added: true, gone: true},
      {t: 480, d: 480, p: 62, v: 80, added: true},
      {t: 960, d: 480, p: 64, v: 80, gone: true},
    ]}];
    saveEdits();
  `);
  const saved = JSON.parse(app.store.get("ff1roll-edits-midi/test.mid"));
  assert.deepEqual(saved.added.map(n => n.p), [62]); // erased added note dropped
  assert.deepEqual(saved.removed, ["0:2"]);          // erased original tracked
});

test("meter: neutral 4/4 until a timesig directive declares one; anchors convert", () => {
  installSong();
  run(`song.timesig = [6, 8];`); // the MIDI's claim
  run(`rollnotes = []; finalizeNotes();`);
  assert.equal(run(`barTicks()`), 4 * 480); // MIDI meter drives nothing: neutral 4/4
  run(`rollnotes = parseRollnotes("[1.1]\\ntimesig: 6/8\\n").map(resolveNote); finalizeNotes();`);
  assert.deepEqual(val(`declaredTs`), [6, 8]);
  assert.equal(run(`barTicks()`), 3 * 480); // declared: 6/8 = 3 quarter-beats per bar
  const once = run(`serializeRollnotes()`);
  assert.match(once, /timesig: 6\/8\n/); // round-trips like any directive
  // conversion: [2.1] under 6/8 (tick 1440 = 3 quarters) re-expressed in 4/4 = bar 1 beat 4
  run(`rollnotes.push(resolveNote({b1: 2, q1: 1, b2: null, q2: null, text: "hi", added: true})); finalizeNotes();`);
  run(`convertAnchors([6, 8], [4, 4]);`);
  const n = val(`rollnotes.find(x => x.text === "hi")`);
  assert.deepEqual([n.b1, n.q1], [1, 4]);
});

test("instrument panel: degrees vs the recorded tonic, guitar/piano hit maps", () => {
  installSong();
  // degree labels follow the tonic letter of the recorded name (mode-agnostic)
  assert.equal(run(`degreeOf(3, "Bb")`), "4");    // Eb in Bb major
  assert.equal(run(`degreeOf(10, "Gm")`), "♭3");  // Bb in G minor
  assert.equal(run(`degreeOf(11, "Bb")`), "♭2");  // the B natural Josh flagged in menu
  assert.equal(run(`degreeOf(0, null)`), null);   // no declared key → no degrees
  // keyNameAt: ranged key wins inside its span, surrounding key resumes
  run(`keyRegions = [{start: 0, end: null, sf: -2, name: "Bb"},
                     {start: 960, end: 1920, sf: 1, name: "Em"}];`);
  assert.equal(run(`keyNameAt(0)`), "Bb");
  assert.equal(run(`keyNameAt(1000)`), "Em");
  assert.equal(run(`keyNameAt(2000)`), "Bb");
  run(`keyRegions = [];`);
  // guitar: y rows are strings high-e→low-E, x left of the nut = open string
  assert.deepEqual(val(`guitarHit(10, 14, 800, 168)`), {p: 64, si: 0, f: 0});   // open high e
  assert.deepEqual(val(`guitarHit(10, 168, 800, 168)`), {p: 40, si: 5, f: 0});  // open low E
  const g5 = val(`guitarHit(44 + ((800 - 50) / 24) * 2.5, 14, 800, 168)`);      // 3rd fret, high e
  assert.deepEqual(g5, {p: 67, si: 0, f: 3});
  // piano: no song range set here → default C4..B4 octave-aligned keyboard
  run(`song = null;`);
  assert.deepEqual(val(`instRange()`), [60, 71]);
  assert.equal(run(`pianoHit(1, 160, 700, 168)`), 60);          // bottom-left = middle C
  assert.equal(run(`pianoHit(700 / 7 - 2, 10, 700, 168)`), 61); // black-key zone over the C/D seam = C#
});

test("roll zoom-out clamp: floors flush to song extents, fitView lands on them", () => {
  installSong();
  run(`
    RULER_H = 24;
    song.tracks = [{name: "t", notes: [{t: 0, d: 480, p: 60, v: 80},
                                       {t: 7200, d: 480, p: 72, v: 80}]}];
    songEndTick = 16 * 480;
  `);
  // stub viewport 800x600, RULER_W 46: 16 quarters + a ruler-width of right pad = 708/16
  assert.equal(run(`pxqFloor()`), (800 - 92) / 16);
  // 13 pitch rows in 552px = 42.5 → capped at the 32 max row height
  assert.equal(run(`rowHFloor()`), 32);
  run(`fitView();`);
  assert.equal(run(`view.pxq`), (800 - 92) / 16);
  assert.equal(run(`view.x`), 0);
  assert.equal(run(`view.y`), (96 - 72) * 32); // top pitch flush at the top
  run(`view.pxq = 2; view.rowH = 3; clampView();`); // zoomed out too far → floors
  assert.equal(run(`view.pxq`), (800 - 92) / 16);
  assert.equal(run(`view.rowH`), 32);
  run(`song = null;`);
  assert.equal(run(`pxqFloor()`), 8); // no song: permissive defaults
  assert.equal(run(`rowHFloor()`), 6);
});

test("guitar octave fold: off-the-neck pitches fold in, shift records the move", () => {
  // 24-fret neck: E2 (40) .. E6 (88)
  assert.deepEqual(val(`gtrFold(60)`), {p: 60, shift: 0});   // middle C: on the neck
  assert.deepEqual(val(`gtrFold(93)`), {p: 81, shift: -1});  // A6 → A5, true pitch above
  assert.deepEqual(val(`gtrFold(36)`), {p: 48, shift: 1});   // C2 → C3, true pitch below
  assert.deepEqual(val(`gtrFold(101)`), {p: 77, shift: -2}); // two octaves over
});

test("chord challenge: evidence report — present/missing/extra vs the label, pedal shows as extra", () => {
  installSong();
  run(`
    trackState = [{muted: false, solo: false}];
    song.tracks = [{name: "t", notes: [
      {t: 0, d: 960, p: 65, v: 80},   // F4
      {t: 0, d: 960, p: 69, v: 80},   // A4
      {t: 0, d: 960, p: 72, v: 80},   // C5
      {t: 0, d: 960, p: 75, v: 80},   // Eb5
      {t: 0, d: 960, p: 58, v: 80},   // Bb3 — the tonic pedal
    ]}];
    keyRegions = [{start: 0, end: null, sf: -2, name: "Bb"}];
  `);
  const ev = val(`(() => { const e = chordEvidence({text: "F7", start: 0, end: 960});
    return {missing: e.missing, extra: e.extra, namer: e.namer}; })()`);
  assert.deepEqual(ev.missing, []);        // all four F7 tones sound
  assert.deepEqual(ev.extra, [10]);        // the Bb pedal — evidence, not verdict
  // wrong label: F named where the seventh sounds → Eb is "extra", nothing missing
  const ev2 = val(`(() => { const e = chordEvidence({text: "F", start: 0, end: 960});
    return {missing: e.missing, extra: e.extra}; })()`);
  assert.deepEqual(ev2.missing, []);
  assert.deepEqual(ev2.extra.sort((a, b) => a - b), [3, 10]); // Eb + the pedal
  // label with a slash bass: bass pc joins the expected set
  const ev3 = val(`(() => { const e = chordEvidence({text: "F7/A", start: 0, end: 960});
    return {missing: e.missing}; })()`);
  assert.deepEqual(ev3.missing, []);
  // label outside the vocabulary → no tone check, namer still reports
  assert.equal(val(`chordEvidence({text: "Fzzz", start: 0, end: 960}).expected`), null);
  // empty span
  assert.equal(run(`chordEvidence({text: "F7", start: 5000, end: 6000}).err`), "no notes sound in this span");
  run(`keyRegions = [];`);
});

test("chord challenge roles: menu's F7 case — guide tones present, root/5th missing, pedal extra", () => {
  installSong();
  run(`
    trackState = [{muted: false, solo: false}];
    song.tracks = [{name: "t", notes: [
      {t: 0, d: 960, p: 58, v: 80},   // Bb3 — tonic pedal
      {t: 0, d: 960, p: 63, v: 80},   // Eb4 — the 7th
      {t: 0, d: 960, p: 69, v: 80},   // A4  — the 3rd
      {t: 0, d: 960, p: 75, v: 80},   // Eb5
      {t: 0, d: 960, p: 81, v: 80},   // A5
    ]}];
    keyRegions = [{start: 0, end: null, sf: -2, name: "Bb"}];
  `);
  const ev = val(`(() => { const e = chordEvidence({text: "F7", start: 0, end: 960});
    return {missing: e.missing.sort((a,b)=>a-b), extra: e.extra, roles: e.roles, namer: e.namer}; })()`);
  assert.deepEqual(ev.missing, [0, 5]);              // C (5th) and F (root) never sound
  assert.deepEqual(ev.extra, [10]);                  // the Bb pedal
  assert.equal(ev.roles[9], "3rd");                  // A
  assert.equal(ev.roles[3], "7th");                  // Eb
  assert.equal(ev.roles[5], "root");
  assert.equal(ev.roles[0], "5th");
  assert.equal(ev.namer, "no standard chord match"); // honest: a bare tritone + pedal names nothing
  run(`keyRegions = [];`);
});

test("lasso toggle: tap adds, tap again removes, empty selection hides Chord?", () => {
  installSong();
  run(`
    trackState = [{muted: false, solo: false}];
    song.tracks = [{name: "t", notes: [
      {t: 0, d: 480, p: 60, v: 80}, {t: 480, d: 480, p: 64, v: 80}]}];
    multiSel = []; multiSelKey = new Set();
    previewNote = async () => {}; // no AudioContext in the vm
    toggleSel({ti: 0, ni: 0});
    toggleSel({ti: 0, ni: 1});
  `);
  assert.equal(run(`multiSel.length`), 2);
  assert.equal(run(`multiSelKey.has("0:1")`), true);
  run(`toggleSel({ti: 0, ni: 0});`); // tap the first one back out
  assert.equal(run(`multiSel.length`), 1);
  assert.equal(run(`multiSelKey.has("0:0")`), false);
  run(`toggleSel({ti: 0, ni: 1});`);
  assert.equal(run(`multiSel.length`), 0);
});
