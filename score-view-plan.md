# Score View Plan — sheet music in Night Roll

**Status: agreed 2026-07-29, not started. Revisit next session.**

Goal: read the songs as engraved notation in Night Roll, not just piano roll —
without losing playback, the cursor, or rollnotes.

## Tier 1 — pre-rendered scores (do first, ~an evening)

Batch-render all 22 MIDIs to SVG with MuseScore's CLI on the Mac, commit the
renders, add a Score/Roll toggle to the player.

- MuseScore also exports a **position map** (.spos/.mpos: beat segment ↔ x,y on
  the page — what musescore.com uses for playback highlighting). This gives us:
  - playhead sweeping the score during playback (beat resolution)
  - tap the score → cursor moves to that beat → Play from there
  - **+ Note works from the score view** — rollnotes anchor to beats, not
    noteheads, so the full bedtime annotation loop is covered
- Audio is untouched: playback always comes from the MIDI data, NES voices.
- Known limits (permanent for this tier):
  - no tap-a-notehead inspector (SVG doesn't know which ink is which note)
  - no pencil editing on the score; pencil-added roll notes don't render on it
  - engraving quirks likely (FF1 MIDIs all claim C major in metadata — key
    signatures may need forcing per song)

## Tier 2 — live engraving (long-term, multi-session, only if tier 1 chafes)

VexFlow vendored into the repo (no CDN at runtime); engrave from the parsed
MIDI in the browser. Full interactivity: tap noteheads for the inspector,
score reflects edits, layout control (solo a staff, transpose display).

- Hard part is not drawing — it's MIDI→notation decisions: rhythm spelling
  (dots/ties), voice separation, enharmonic spelling from an undeclared key.
- In our favor: NES tracks are monophonic and grid-quantized (best case).
  Live-played files (KeyChangeTest) need quantization or they engrave badly.
- Tier 1's beat↔position plumbing carries over.

## Decision rule

Build tier 1, live with it. Start tier 2 when actual annoyance — wanting to
touch the notes themselves on the score — shows up repeatedly, not before.

## Open questions for tomorrow

1. Does MuseScore install/run headless cleanly on the Mac (`brew install musescore`)?
2. Force correct key signatures per song at render time, or accept C-major spelling?
3. Score view on iPad: page-based or one long horizontal strip?
4. Where do renders live — `scores/` directory, one SVG per song (multi-page)?
