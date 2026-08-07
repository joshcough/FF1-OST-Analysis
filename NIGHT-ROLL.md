# Night Roll — Technical Reference

The complete map of the player (`index.html`) for anyone (especially future
Claude sessions) continuing work. User-facing feature list also lives in the
in-app help sheet (? button). History: git log tells the build story.

Live: https://joshcough.github.io/night-roll/ (GitHub Pages, main
branch, root). Single file app + `vendor/vexflow.js`. No build step —
git push is deployment (~1 min propagation; iPad may need a hard reload).

Tests: `make test` (runs `node --test tests/*.test.mjs` — zero deps, Node's
built-in runner). `make serve` hosts the app at localhost:8000 (fetch needs
http, so file:// won't work). `tests/harness.mjs` extracts the inline `<script>` from index.html
and runs it in a vm with a stub DOM, so the app stays one file. Covers the
pure logic: MIDI parse, rollnotes parse/serialize round-trip, key math,
chord namer, duration decomposition, tempo maps, edit persistence. Run them
before committing player changes; add cases when touching that logic.
(2026-07-31 review verdict, second-opinioned: keep single-file until ~4–5k
lines — splitting adds Pages cache-skew risk for no payoff at this size.)

## Feature inventory

**Views:** piano roll (canvas) and engraved score (VexFlow → per-measure
cached canvases), toggled in the header, persisted. On song load the roll
auto-fits the whole song and its pitch range to the screen (fitView). Both share one
time-linear x-axis, the bar ruler, sections, markers, cursor, playhead,
subtitles, and gestures. Pinch zooms per axis (horizontal = time; vertical
= pitch rows, roll only). Roll zoom-out clamps to the song's own extents
(2026-08-07, Josh's spec): per-axis floors (pxqFloor/rowHFloor) flush to
the chop-trimmed bars and sounding pitch range, no padding — once time
fits, pinch-out only reveals pitch; once everything fits, it stops, and
the view snaps flush. fitView lands on the same floors, so the load view
IS the zoom-out limit. Score extras: intro column (clef/key/time) left
of bar 1; signatures redraw at key changes with cancellation naturals;
rests break beams; playhead/cursor interpolate notehead-to-notehead
(scoreTickToX), hopping glyphs only at key changes; zoom-out floor
computed from the densest measure (scoreModel.pxqMin — relaxes when dense
tracks are muted).

**Playback:** WebAudio. Pulse/pulse/triangle voices by track index; drum
tracks (name match or channel 10) get a synthesized kit. Per-track gain
nodes make mute/solo instant mid-playback. Songs loop at the final bar
(`songEndTick`) or per a "loop:" directive. Rewind ⏮. Speed slider
(25–200%, applies on release, snap-back button when off 100%) scales
tickToSec/secToTick via playRate; persists across songs. Persistent
AudioContext warmed on first touch, declick ramps, notes straddling the
cursor play their remainder (chase). Manual scroll during playback
suspends auto-follow until the playhead re-enters the view.

**Tracks:** chips mute (= fully hide, roll and score) and solo. Score model
rebuilds on toggle.

**Inspection:** tap note → pitch (spelled per active key), bar, beat in
1e&a counting, duration, velocity, track. Lasso mode (footer toggle):
drag-select across notes; pitch list shown; chord name behind a "Chord?"
reveal (templates: triads, 6, 7s, 9s, sus, dim7, power-dyad "5"; slash
inversions; missing-5th tolerance).

**Instrument panel** (2026-08-07, 🎹 in the footer): a piano-keyboard /
guitar-fretboard strip above the footer, so Josh can think with the
instrument instead of purely symbolically. Lasso'd pitches light gold on
both instruments; sounding notes light live during playback in their
track's color (same palette as the roll/fall notes); every key
and fret is tappable (plays through master, so track mutes never silence
it — square voice on piano, triangle on guitar). Labels are the pitch
name spelled per the governing key plus the scale degree when a `key:`
directive governs the cursor (degrees never shown for undeclared keys —
key discovery stays the analyst's job). Piano range = the song's own
extent, octave-aligned. Guitar: standard tuning EADGBE, high-e on top
(tab convention), 15 frets, inlay dots, a lit pitch appears at every
playable position. Open state, tab, and Fall persist in localStorage.

**Fall view** (2026-08-07, ▼ Fall in the panel's tab bar — which sits
BELOW the keys so nothing blocks the landing): Synthesia-style — the
main canvas becomes a vertical drop and notes fall down into the panel's
piano keys, landing on the accent "now" edge the moment they sound (the
keys light via the same live-pitch set). Time maps through seconds
(tickToSec), so tempo maps and the speed slider stay truthful; ~4.5 s of
music fills the drop (FALL_WINDOW). Bar lines ride with numbers, chord
changes ride gold lines with their symbol, black-key lanes are banded,
lasso'd notes keep their gold stroke. Piano-only: enabling Fall forces
the piano tab open; picking Guitar (or closing the panel) returns to
whichever of roll/score was active. Pan/pinch/cursor gestures are
disabled while falling — the view rides the playhead, or sits at the
cursor when stopped — but lasso mode works (finalizeLasso has a fall
branch hit-testing key columns × seconds), so boxed notes light the
keys below.

**Annotations:** see format below. + Note editor is type-first (Text note /
Section / Chord / Key change / Time signature / Loop point) with bar/beat
dropdowns and a 🎤 Speak dictation button (Web Speech API; hidden where
unsupported). Chord type gets a chip widget (root · ♭♮♯ · quality · /bass)
composing into an editable symbol box, plus an optional attached-note text
(✱ on the band). A ruler drag before + Note defaults the type to whichever
of section/chord was saved from a drag last (chord-entry runs stay in chord
mode). ☰ Notes lists everything grouped by type (Key / Meter / Sections /
Chords / Loop / Chop / Text notes; each group's + pre-picks that type),
rows open the editor, Delete works on synced notes too (permanent on Sync).
Chop (2026-08-06, Josh's import-fixup tool): a `chop:` directive
non-destructively trims the displayed song from either end — see the
format spec; implementation is a raw-notes snapshot (`song.rawNotes`)
that applyChop() carves the visible tracks from, so roll, score,
playback, and loop-at-end all follow for free.
Gold ruler flags; subtitle strip follows playback, with a ⊙ toggle that
highlights the active note's span (ambient range tints removed — on a
fully-annotated song they covered everything). The strip is a
constant-height slot (2026-08-07): present for the whole song whenever
the song has text notes, blank between them, long notes scroll inside —
per-note toggling reflowed the layout and made the instrument panel
bounce.

**Meter:** neutral 4/4 grid until a `timesig:` directive declares the
real meter (set via the editor's Time signature type — numerator/
denominator pickers, never free text). Same philosophy as keys: the
rhythmic grouping is the analyst's finding, so the app won't pre-commit
it. Changing meter over existing annotations demands a second Save tap
and converts every anchor (incl. loop directives) to preserve musical
position. cave (2/4) and menu (6/8) carry grandfathered declarations.
**The counted beat is the denominator note** (2026-08-06): X/4 counts
quarters, X/8 counts eighths, X/2 counts halves — so 6/8 bars run
beats 1–6, the way compound meter is actually counted. The roll grid
draws one line per beat, with a medium line every 3 beats in compound
meters (6/8, 9/8, 12/8) marking the big pulses. Anchors, beat
dropdowns, loop targets, and the info strip all use this unit; meter
changes convert anchors across unit changes through absolute time.

**Keys:** display defaults to C until a `key:` annotation exists — key
discovery is Josh's job, by design (the dial previews signatures live; a
major/minor toggle picks the recorded TONIC — "key: Gm", never Bb standing
in for it — and "Set Gm @ bar N" writes the directive at the cursor's bar).
Ranged keys revert automatically. The dropdown label reports the recorded
names: "key: not set (C)" vs "key: Gm ✓". Minor names map to the relative
major's signature for engraving (keyNameToSf). MIDI files carry true key signatures (via
tools/fix_keysigs.py) but the app deliberately ignores them for display.

**Sync:** serializes the full current rollnotes state and commits it to
this repo via the GitHub Contents API (fine-grained token, stored in
browser localStorage, never in the repo). "Commit all changed" syncs every
song with unsynced local notes (one PUT per file; per-song ✓/✗ status;
meter for foreign songs comes from a localStorage stash written on load).
The Sync button shows the dirty-song count. Copy/Download fallbacks. Local
unsynced additions persist in localStorage keyed by song path.

**Robustness:** MIDI parser finds tracks by MTrk magic scan (the original
ff1battle had corrupt length headers — since rebuilt clean, guard kept),
honors end-of-track, clamps note durations to 8
bars, truncates a track at any internal silence > 32 bars (real tacets max
24 in this catalog). ff1ship.mid was truncated at the source
(thefinalfantasy.net serves a 512-byte file); replaced 2026-07-31 with
vgmusic.com's ff1ship2.mid — same transcription, 5 tracks incl. drums.

## .rollnotes format (the spec)

Sidecar file next to each .mid: `<song>.rollnotes`. Plain text blocks:

```
[3.1]              ← anchor: bar 3, beat 1 (beats may be fractional: 2.5)
Free text until the next [anchor]. This is a regular note.

[7.1 - 8.4]        ← range: bars 7–8 inclusive (end beat inclusive)
Range note. Tints its span; active for the subtitle across it.

[1.1 - 4.4]
section: A — G home   ← "section:" prefix = arrangement band in the ruler.
                        Nesting inferred by range containment; same label
                        = same color.

[5.1 - 5.2]
chord: Gm          ← "chord:" prefix = chord band. Renders and nests exactly
                     like a section band (containment = depth; same label =
                     same color) but is a distinct type: grouped separately
                     in the ☰ Notes list, entered via the chord widget.
                     Symbol standard = the lasso chord namer's vocabulary:
                     bare root = major (C), m = minor (Gm), then 7/maj7/m7/
                     m7b5/dim/dim7/aug/6/m6/sus4/sus2/5/9/m9/maj9/add9/7b9,
                     slash bass as /E, "(no 5th)" allowed as qualifier.

[5.3 - 5.4]
chord: G7/B        ← lines after the symbol = attached note (shows as ✱ on
no 5th — bass has it   the band, previewed in the ☰ list, kept on round-trip).

[9.1]
key: Bb            ← "key:" prefix = key directive. Open-ended: applies
                     until the next open key directive.

[2.1 - 4.4]
key: Db            ← ranged key: applies bars 2–4, then the surrounding
                     key resumes (score draws cancellation naturals).

[1.1]
timesig: 6/8       ← meter directive. Until one exists the app runs on a
                     neutral 4/4 ruler — the MIDI's meter meta drives
                     nothing visible (meter is analysis, like keys).
                     Declaring one re-bars the song; the editor converts
                     existing anchors through absolute time (two-tap
                     warning) so annotations keep their musical positions.
                     One per song. Beats in anchors count the DENOMINATOR
                     note: under 6/8, [1.4] = the fourth eighth, and the
                     first half-bar chord is [1.1 - 1.3].

[3.1]
chop: start        ← non-destructive trim, RAW capture coordinates (the one
                     annotation type that is): hides everything before raw
                     3.1 and renumbers — raw 3.1 becomes displayed 1.1.
                     At most one per song; "chop: end" likewise hides
                     everything at/after its anchor. All OTHER annotations
                     live in displayed coordinates; adding/removing a start
                     chop shifts them through absolute time (two-tap
                     warning), so chords stay glued to their music. The
                     hidden material is gone entirely (no ghost); the .mid
                     is untouched — delete the directive to restore.
                     Editor prefills the cut from the cursor; ☰ list shows
                     chop anchors with a "raw" tag.

[25.1]
loop: 2.1          ← "loop:" prefix = loop directive. The anchor is the
                     jump point: when playback reaches bar 25 beat 1 it
                     returns to the target (here bar 2, skipping ship's
                     pickup-intro bar). An anchor at/before the target
                     means the jump fires at song end. One per song.
```

- `#` lines are comments — **dropped on round-trip** (the app rewrites the
  whole file on Sync). Never store important info in comments.
- Key names: C G D A E B F# C# F Bb Eb Ab Db Gb Cb, plus minor as "Em",
  "Bbm" (minor maps to its relative major's signature).
- Every FF song is a chip capture (2026-08-02, extracted from the NSF via
  tools/nsf/), trimmed to intro + one loop pass at the frame-exact repeat
  point — see albums/final-fantasy-i/CUTS.md for the verified cut/loop table. Songs whose
  loop returns past a once-only intro carry a measured `loop:` directive
  in their rollnotes (battle, gameover, overworld, ship, victory).

## Code map (index.html, section comments mark these)

catalog → CATALOG built from albums/manifest.json at boot (run
tools/build_manifest.mjs after adding music; album.json per album holds
title/order/name overrides) + two-level song picker (groups sheet → songs;
opens into the current song's group) ·
midi parse → parseMidi + tempo maps · rollnotes → parse/serialize/regions/
sfAt/subtitle · lasso/chord id · load song → setSong (computes songEndTick;
loadGen guards stale async loads) · track chips · drawing → draw/drawRuler (roll) ·
score → buildScoreModel (quantize 16ths, chord-group, clip overlaps,
measure split with ties, rest fill) / renderMeasure (LRU 60 cache,
geometry + timeMap per measure) / drawScore · gestures → pointer/pinch/
lasso/cursor drag; iOS page-zoom suppressed · audio → NES voices, drumHit,
per-track gains, loop scheduler · note editor (type-first) · notes list ·
sync (GitHub Contents API, 409 retry) · key dial · help sheet.

## Project conventions that govern this code

- Keys/analyses are Josh's discoveries: never pre-fill answers into the UI
  or seed analysis for unanalyzed songs (see memory + open-items.md).
- Commits auto-allowed in this repo only (.claude/settings.local.json hook,
  gitignored; script at .claude/hooks/allow-git-commit-push.py).
- Docs: open-items.md (questions/tasks), quizzes.md (protocol + bank),
  score-view-plan.md (score history/limitations), supplemental-learning.md
  (session log = quiz source material).
