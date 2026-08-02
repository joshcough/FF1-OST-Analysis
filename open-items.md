# Open Items

Standing list of things agreed but not done, and questions asked but not
answered. Prune as items close; add as they appear. (Claude: check this at
session start alongside the quiz.)

## Questions awaiting Josh

0. **Key sweep in progress — see [key-sweep.md](albums/final-fantasy-i/analysis/key-sweep.md).** 6 songs
   done (6/6 for the first-bass-note rule), ~14 to go, dungeon excluded as
   a duplicate of cave. Open sweep-wide questions live there (the "first
   bass note" definition; the "unclear" outcome category; duplicate audit).
   **Convention change (Josh, 2026-08-01): per-song open questions now live
   in each song's own doc** (battle.md, airship.md, cave.md,
   chaos-temple.md, overworld.md, cornelia-castle.md all have Open
   Questions sections) — this global list keeps only cross-song and
   tooling items.

1. **Baseball/Beach song:** where did the B–D–F–Ab voicing come from — ear,
   hands, or something you read? Did you know it forms a diminished 7th?
2. **Baseball/Beach song:** the bass never sits on G under the "G7♭9" — it
   creeps chromatically around it. Did you notice you'd done that?
3. **The owed quiz** (from the 2026-07-22 concepts — 5 questions):
   modulation recipe; C-major pivot chord's Roman numeral in G and in F;
   why C7 signals F harder than a C triad; V7 resolving to major vs minor
   tonic; key-distance → melodic difficulty. Never taken; still on deck.
4. **Title decision:** Baseball Song or Beach Song (dropdown says
   "Baseball / Beach Song" until you pick).
5. **"Seventh-side resolution"** is a working name, yours to rename.

## Composition exercises owed

- **F-minor (or Bb-minor) half of the key-change exercise.** KeyChangeTest's
  two halves are identical; the dark version was the original assignment.
  Bb-minor route: one Db does the darkening (the bare-octave bar 9 socket).
- **E♮ hypothesis test:** same chords, but feed F its leading tone (E♮ in
  the melody leaning into F) — does F hold the throne this time?
- **Melody revision pass** on KeyChangeTest after studying how Uematsu's
  Overworld melody sustains phrases (bars 1–3 are riff; make them sing).

## Analysis queue

- **Overworld melody (tr1) + counter (tr2)** — bass done, upper tracks never
  opened. Pending verifications listed in overworld.md: bar 10 D major or
  minor; bar 12's predicted G#; tr2's C-natural in bar 4 (D7?); Josh's
  "melody sounds like E minor" instinct.
- **Baseball/Beach song** — Josh annotates his own hearing first (rollnotes
  from bed), then joint session.

## Tooling to-do

- **NSF pipeline** (scoped 2026-08-01, **built 2026-08-02**): extract
  analysis-grade note data from the actual chip — see
  [reference/nsf-pipeline-plan.md](albums/final-fantasy-i/reference/nsf-pipeline-plan.md).
  Emulator + logger + reconstruction + CLI all working, tested against a
  synthetic NSF. **Blocked on Josh supplying the FF1 NSF file** (archive
  or own-cartridge dump — his call). Motivation confirmed by audit: only
  3 of 21 MIDIs (prelude, shop, victory) stay within the NES's
  3-pitched-voice ceiling; the rest are arrangements, so voice-leading
  analysis on them measures the arranger.
- **Fixed 2026-08-02 from Josh's session notes:** key writer now records
  mode (major/minor toggle; `key: Gm` not `key: Bb`) and the three
  affected rollnotes were corrected; "Commit all changed" syncs every
  dirty song; audio should now survive app-switching on iOS (resume
  unconditional + awaited, visibilitychange revival, closed-context
  rebuild) — **Josh should confirm on the iPad**.
- **Duplicate-song audit — RESOLVED 2026-08-02 by the chip migration:**
  the NSF is the authoritative track list (19 songs). dungeon (=cave) and
  elfland (absent from the NSF — likely not FF1 at all) were deleted with
  Josh's sign-off; no annotations existed on either.

- **"Save Music" missing (2026-08-02):** the canonical album (All Sounds
  of FF I·II) lists a Save Music track we never captured. NSF tracks
  20–23 probed: 21/23 are sub-second sfx blips, 20/22 long+sparse —
  none obviously it. Candidates could be captured for Josh to identify
  by ear if he wants the complete album.
- **Adding music — the standing workflow (Josh, 2026-08-02):** hand files
  to Claude (new Logic compositions as .mid, new soundtracks as .nsf, e.g.
  Mega Man 2 → its own albums/ dir); Claude runs the pipeline/dump tools,
  commits, and it appears in the dropdown. In-app upload UI deliberately
  skipped for now — optimize for analysis throughput, revisit if the tool
  grows beyond personal use.
- **Browser "Load .nsf" in Night Roll** (idea 2026-08-02, Josh: to-do for
  now): the NSF pipeline core (6502 + APU logger + note reconstruction +
  MIDI writer, tools/nsf/) is pure JS with no Node dependencies, so it
  can run in the page: file input → pick a track → capture + auto
  loop-trim → straight into the roll, with .mid export. Would open any
  plain-2A03 NSF (e.g. Mega Man 2). Caveats noted: cold NSFs have no
  transcription reference, so tempo/bar labels start grid-fitted until
  bars are counted by ear; track numbers are discovered by listening;
  new sound drivers may expose new trimmer edge cases.

- **In-app Claude chat — built but parked on the `claude-chat` branch,
  decision pending** (2026-08-01): a complete chat feature (💬 button,
  per-song conversations, streaming, context injection of
  cursor/rollnotes/lasso, tutor system prompt that won't spoil
  undiscovered keys/chords) is committed on branch `claude-chat` (pushed).
  Blocker: it needs a pay-per-use Anthropic Console API key — Josh's $200
  Max subscription can't fund direct API calls, which frustrated him.
  Options discussed: downgrade Max $200→$100 and fund the API from the
  difference; use the Claude iPad app pointed at this repo (chosen for
  now — albums/final-fantasy-i/songs/*.notes.txt dumps exist so the app can read actual notes);
  or drop the feature. Revisit with Josh; merge the branch if he funds a
  key (it will need a rebase over main's later changes).

- **Two-regime score zoom** (parked 2026-08-01, low priority): pinch
  compresses time down to the engraving floor (current behavior), then
  keeps going by uniformly scaling the whole rendered page — staves,
  glyphs, everything — like stepping back from paper. Discussed and
  deemed workable: uniform scale preserves the shared linear x-axis, and
  the floor-resolution measure cache downscales crisply for free. Cost:
  plumbing a shrink factor through drawing, hit-testing, lasso bands,
  playhead mapping (~an evening). Josh's verdict: not needed now — the
  roll's unlimited zoom-out covers the overview job better anyway (lines
  stay readable where tiny notes wouldn't).

- **Synced-note edits don't survive reload before Sync** (found in 2026-07-31
  code review): editing/deleting a *synced* note then reloading the page
  resurrects the original (edits show as duplicates, deletes revert) because
  localStorage only persists added notes, not tombstones. Sync promptly and
  it's fine. Fix sketch: persist removed-synced tombstones alongside added
  notes and re-apply them in loadNotes.
- **Score cache memory at extreme zoom** (same review): per-measure canvases
  at max pinch zoom are ~9 MB each and the cache caps at 60 *entries*, not
  bytes — iOS Safari may silently blank measures at very high zoom. Fix
  sketch: cap the cache by estimated bytes instead of count.
- **Score view** — DONE, committed 2026-07-31 (see score-view-plan.md for
  known limitations).
- **Score spelling refinement** — Ab in the Baseball song spells as G#
  (static chromatic heuristic); context-aware spelling someday.
- **NES-faithful arrangements** — MOSTLY DONE 2026-08-01: padding tracks
  stripped (tools/strip_tracks.py) from shop (9→3! it was 3 parts × 3
  instrument copies), cave (6→4), airship, town, dungeon, prologue,
  chaostemple, gurgu. Chord tracks kept per Josh (useful when stuck).
  Left alone: elfland (8 tracks) and epilogue (11) — genuinely split
  orchestrations, too tangled to strip safely; battle's brass and
  floatingcastle's twin interlocking arps are real split NES parts, kept.
  If elfland/epilogue bother Josh, hunt leaner transcriptions instead.
  Palette extended to 12 colors so 11-track epilogue no longer repeats.
- **Gurgu Volcano loop "slightly off" to Josh's ear** (2026-08-01): trim
  verified mathematically clean — both passes tick-identical, exactly 42
  bars, no notes crossing the seam. So the seam feel is in the
  transcription itself. Revisit musically if it keeps bothering him.
- **Track visibility variants** — mute now fully hides a track (Josh's
  request); later maybe: dim-but-visible, and audio-mute-only toggles.
- **Lasso later ideas** — cross-staff chord naming conventions, remembering
  reveals per song, maybe a "quiz me" mode built on lasso selections.
- **Mid-song key signature changes** — DONE 2026-07-31: `key:` directives in
  .rollnotes, set from the key dial at the cursor bar; signature drawn at
  change barlines.
- **iPad app** (discussed 2026-07-31, parked — "worth exploring"):
  - Tier 1, ~an hour: web manifest + icon + standalone mode → Add to Home
    Screen gives an app icon, full-screen launch, durable storage; updates
    still flow via git push. Do this first whenever wanted.
  - Tier 2, days + $99/yr: Capacitor/WKWebView wrapper for the App Store.
    Only real feature gain: native MIDI hardware input (play a keyboard
    into the app — iPad Safari has no Web MIDI).
  - Native Swift rewrite: roll/audio/annotations portable in days, but no
    VexFlow equivalent exists — hand-rolling engraving is the months-shaped
    part — and build/sign/install kills the push-and-reload iteration loop
    that built this in six hours. Not worth it.
- **Mid-song time-signature changes** (parked 2026-07-31): a fourth
  annotation type ("Time change") in the type-first editor, like key
  changes. Real work hides underneath: the whole app assumes one meter —
  bar math (ruler numbers, measure boundaries, beat dropdowns, score
  measures, loop end) would need to become region-aware. The MIDI parser
  already sees the 0x58 events; it just keeps only the last one.
- **Enharmonic respelling** (idea, Josh undecided): tap a score note to flip
  G#↔Ab — notehead moves line↔space, choice stored in rollnotes. Maybe
  moot if direction-aware spelling (raise ascending, flatten descending)
  is built first; the static heuristic currently misspells Baseball's Ab
  as G#.
- **Loop passes:** MOSTLY DONE 2026-08-01 — 13 MIDIs with exact repeats
  trimmed to their first pass (tools/trim_loops.py), so anchors now cover
  those songs fully. Battle since rebuilt at 29 bars (3-bar intro +
  26-bar loop). Cornelia had a half-bar of leading silence (whole song
  shifted 2 beats): unshifted + trimmed to its 8-bar loop (2026-08-01) —
  Josh's existing cornelia rollnotes anchors may now sit 2 beats late;
  offer to auto-shift them if they look off.
  Dungeon trimmed to 16 by Josh's ear (2026-08-01). Awaiting cut bars
  for: elfland, epilogue, floatingcastle, prelude, ship, victory.
- **Victory chip loop seam — RESOLVED 2026-08-02:** the "beat 3" reading
  was a trimmer artifact (it sliced mid-way through the loop-seam overlap
  cluster). Fixed detector puts the seam at bar 2 beat 4 — Josh's by-ear
  4& was right within a quarter-beat. Directive now loop: 2.4.
- (Done recently, for orientation: Night Roll player, .rollnotes + sync,
  sections/arrangement lanes, range-select ruler drag, grouped dropdown
  with compositions/, CVD-safe track palette, rewind + Edit toggle.)
