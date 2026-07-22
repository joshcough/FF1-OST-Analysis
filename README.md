# FF1 OST Analysis

Track-by-track harmonic and melodic analysis of the Final Fantasy 1 (NES) soundtrack by Nobuo Uematsu. Goal: extract reusable composition devices — how melody, arpeggio, and bass share three monophonic channels, and the harmonic moves that make these loops work.

## Method

Each song gets:
- A MIDI transcription (`<song>.mid`) as the source of truth
- An analysis doc (`<song>.md`): chord progression with Roman numerals, note-by-note melody analysis, arpeggio and bass track breakdowns, form summary
- New devices appended to the **Devices Log** in the analysis (running list of steal-able techniques across the OST)

## Tracks

| Song | MIDI | Analysis | Status |
|------|------|----------|--------|
| Cornelia Castle | [cornelia-castle.mid](cornelia-castle.mid) | [cornelia-castle.md](cornelia-castle.md) | ✅ Done |
| Prelude | — | — | Planned |
| Opening Theme | — | — | Planned |
| Town | — | — | Planned |
| Matoya's Cave | — | — | Planned |
| Chaos Shrine (Temple of Fiends) | — | — | Planned |
| Main Theme (Overworld) | — | — | Planned |
| Battle Theme | — | — | Planned |

## Key findings so far (Cornelia Castle)

- Melody lands a chord tone on every chord-arrival downbeat — zero exceptions; 3rd is the favorite landing note
- Bass is line-first: chromatic descent chosen before the chords; inversions exist to serve the line
- Complementary motion: at any moment exactly one voice does stepwise motion while the other holds
- Chromatic events are isolated: one voice carries the out-of-key note prominently, others vacate
- Skeleton is the Pachelbel/romanesca schema with every joint upgraded (secondary dominants, borrowed iv, inversions)

Full devices log at the bottom of [cornelia-castle.md](cornelia-castle.md).
