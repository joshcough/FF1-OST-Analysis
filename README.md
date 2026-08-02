# Night Roll

A single-file web app for studying game soundtracks: piano roll + engraved
score over one shared timeline, NES-voiced playback, and a beat-anchored
annotation system for writing analysis directly onto the music.

**Live:** https://joshcough.github.io/night-roll/ — no build step; `git push`
is deployment. Built for iPad-in-bed ergonomics, works anywhere.

## What it does

- **Two views, one timeline** — canvas piano roll and VexFlow-engraved score,
  sharing the bar ruler, sections, cursor, playhead, and pinch gestures.
- **Playback** — WebAudio NES voices (pulse/pulse/triangle + drum kit),
  per-track mute/solo, loop directives with mid-song jump points, 25–200%
  speed, smooth notehead-to-notehead score playhead.
- **Annotations (`.rollnotes`)** — plain-text sidecar per song: beat-anchored
  notes, section bands, key changes, loop points. Edited in-app (with
  dictation), synced to this repo via the GitHub Contents API.
- **Analysis-first design** — the app never reveals keys or chords on its
  own; signatures and spellings render only what the analyst has recorded.
  Discovery is the point.
- **Chip-true data** — the NSF pipeline in `tools/nsf/` (a 6502 emulator +
  APU register logger + note reconstruction) extracts songs from the actual
  cartridge sound data: real channels, real tempos, frame-exact loops.

## The music

- **[albums/final-fantasy-i/](albums/final-fantasy-i/)** — the FF1 (NES)
  soundtrack, extracted from the NSF, with the analysis work: song docs,
  chord charts, the key sweep, and the verified loop-cut table
  ([CUTS.md](albums/final-fantasy-i/chip/CUTS.md)).
- **[albums/compositions/](albums/compositions/)** — original pieces written
  during the study.

## The learning workflow

Analysis happens in dialogue, not in bulk — see each album's README. Working
docs at the root: [open-items.md](open-items.md) (questions and owed
exercises), [quizzes.md](quizzes.md) (spaced-recall bank),
[supplemental-learning.md](supplemental-learning.md) (session log).

## Development

`make serve` → http://localhost:8000 · `make test` → Node's built-in runner
over `tests/` (the harness runs the app's inline script in a vm, so the app
stays one file). Technical reference: [NIGHT-ROLL.md](NIGHT-ROLL.md).
