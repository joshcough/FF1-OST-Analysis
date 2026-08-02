# NSF pipeline — analysis-grade note data from the actual chip

Scoped 2026-08-01 (Josh + Claude session). A build task, not analysis.

**Status 2026-08-02 (later): REAL CAPTURES DONE.** All 19 songs dumped from
the Zophar FF1 NSF (`midi/*.chip.notes.txt`, via `tools/nsf/dump-all.mjs`;
the .nsf itself is gitignored). The chip confirms dungeon=cave at the
source: one track, "Dungeon". Trust levels: **pitch, note order, durations,
and channel identity are solid** (Overworld's triangle gallop matches
Josh's bass analysis rhythm-for-rhythm). The **fitted bpm — and therefore
bar numbering — is approximate on some songs**: the grid-snap fit can land
on a rescaling (Overworld fitted 112.5 vs MIDI 130 with identical musical
rhythm). Known fix, not yet built: calibrate tempo by matching chip onsets
against the corresponding MIDI's onsets instead of a blind grid. Cornelia
(100.00) and Ship (150.06) locked to their MIDI tempos exactly.

**Status 2026-08-02: stages 1–3 BUILT and tested.** `tools/nsf/` holds a
6502 core (instruction-accurate; register-write order is what matters, not
cycles), an NSF loader/driver (banked + non-banked), note reconstruction
with channel identity, and a CLI (`node tools/nsf/dump.mjs song.nsf --bpm N
[--song N] [--seconds N] [--ts N/D]`). Verified end-to-end against a
synthetic, self-assembled NSF (tests/nsf.test.mjs) — no copyrighted data
involved. **Waiting on: the actual FF1 NSF file, Josh's to obtain** (archive
download or own-cartridge dump). Expect note-on/off heuristics to need
iteration against the real driver's register habits once it arrives.

## Why

The MIDIs in `midi/` are arrangements, not captures. Confirmed on
`ff1cave.mid` (five simultaneous pitched voices against the NES's ceiling of
two pulses + triangle), then audited across the catalog:

| File | Max simultaneous pitched voices |
| --- | --- |
| ff1elfland | 17 |
| ff1epilogue | 16 |
| ff1town | 9 |
| ff1airship | 8 |
| ff1chaostemple, ff1corneliacastle, ff1dungeon, ff1gameover, ff1prologue, ff1ship, ff1underwaterpalace | 7 |
| ff1battle, ff1cave, ff1matouyascave, ff1menu, ff1overworld | 6 |
| ff1floatingcastle, ff1gurguvolcano | 4 |
| **ff1prelude, ff1shop, ff1victory** | **3 — within NES limits** |

(Drum/percussion tracks excluded; CHORD tracks included, which accounts for
some but nowhere near all of the excess. Only 3 of 21 files could be actual
chip data.)

The project's stated goal is understanding how melody, arpeggio and bass
share three monophonic channels. **Any voice-leading conclusion drawn from
an arranged file measures the arranger, not Uematsu.** Key determination is
largely unaffected; channel-sharing analysis is not. This pipeline fixes it
at the source.

## Source format: NSF, not ROM

NSF is the NES sound driver plus music data — actual 6502 code and APU
register writes. That is ground truth. Don't hunt a game ROM; NSF is both
the correct format and the smaller target. (A dump from Josh's own cartridge
is a separate hardware question — Retrode, INLretro, etc.)

## The build

1. **Register logger** — emulate 6502 + APU, log every APU write with a
   timestamp. Prior art: NSFPlay's debug logging, various nsf2midi
   converters. Write our own rather than adapt (below).
2. **Note reconstruction** — per channel, derive note-on/off from period and
   volume registers. Emit per event: channel identity (pulse 1, pulse 2,
   triangle, noise, DPCM), start tick, duration, period value, derived
   pitch, duty cycle, volume/envelope state.
3. **Emit `.notes.txt`** in the existing format so it drops straight into
   the current tooling with no reader changes.

## Why existing NSF→MIDI tools aren't good enough

They optimize for *playback*: they merge channels, quantize aggressively,
and discard channel identity — the single most valuable field for this
project. We want a per-channel event log with hardware structure intact.

## CRITICAL design constraint — two modes; the intermediate stays dumb

The part most likely to be got wrong. **Do not enrich the note data.** The
mechanically sharp spelling in `.notes.txt` is deliberate — it is *neutral*
and commits to nothing. The moment a file writes Eb instead of D#, someone
has already decided the key, and deciding the key is the work Josh is doing.
Same for every interpretive layer:

- **Key signature** — gives away the sweep in the first glyph.
- **Beaming** — implies metrical grouping.
- **Voice separation** — hands over the compound-line finding Josh
  discovered independently in three songs.
- **Enharmonic spelling** — is itself an analytical claim.

| Mode | Contains | Source |
| --- | --- | --- |
| **Discovery** | pitch, time, duration, channel identity. Nothing interpretive. | NSF extraction |
| **Rendering** | spelled, beamed, voiced, signature applied | Josh's own annotations |

Night Roll already works this way (`keydir` drives spelling and comes from
the key Josh sets — the score renders *his analysis back to him*). This note
makes the architecture explicit so the NSF work doesn't violate it by
"helpfully" spelling notes correctly.

**The one addition worth making: channel identity.** Which pulse, which
triangle. Hardware fact, not interpretation — and exactly what the arranged
MIDIs destroyed. It is the whole reason for doing this.

## Out of scope for now

SNES (SPC) and PS1 (PSF) — SPC is sample-based, so "what note is playing" is
genuinely murkier. Defer until the NES pipeline works. Long-term motivation:
hold the composer roughly constant, vary the hardware — FF1 (NES) → FF4
(SNES) → FF7 (PS1) — and see which conventions were the hardware talking.
Testable prediction on the table: if compound lines are a workaround for the
three-voice ceiling, they should thin out as channels become available; if
they don't, it was style, not workaround. Confound: fifteen years also means
a composer improving, different teams, different game scale.
