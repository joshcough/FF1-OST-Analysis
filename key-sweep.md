# Key Sweep — every song's opening key

Started 2026-08-01. Scope: the **opening** key of each song only — songs
change keys; tracking every change is out of scope for this pass. Rationale:
determining the key is the first step of every song's analysis anyway, so
this is work pulled forward, and doing it ~20 times in a row builds the
routine and shows the range of ways a key gets established.

**Protocol:** (1) predict from the first bass note, written down first;
(2) determine the key from the music — and record **the path, not just the
verdict** ("Key: X" is worth little in a month; "Key: X because A, then B"
survives); (3) verify with the dial. Determining the key from the music
first keeps the hypothesis test non-circular.

## Hypothesis under test

**The first bass note of a song is likely to be the tonic** (mode
ambiguous). Josh's framing: "probably not always true, but I bet in many of
these it is."

Status after 6 songs: **6 for 6** — upgraded from untested conjecture to
*usable weak evidence*. Two caveats attached:
- A song whose key was decided *using* the rule can't also count as a
  confirmation of it — mark those unscored.
- The sample isn't random: looping game themes must establish tonality
  within seconds, so the rule may capture a genre convention rather than
  anything specific to Uematsu.

## Tally

| Song | Key | First bass note | Scored | Derivation |
| --- | --- | --- | --- | --- |
| ff1overworld | G major | G | hit | overworld.md |
| ff1corneliacastle | D major | D | hit | cornelia-castle.md |
| ff1airship | F major | F | hit | airship.md |
| ff1battle | G minor | G | hit* | battle.md |
| ff1cave | C minor | C | hit | cave.md |
| ff1chaostemple | E minor | E | hit | chaos-temple.md |
| ff1dungeon | (= cave, C minor) | — | excluded (duplicate) | cave.md |
| ff1elfland | | | | |
| ff1epilogue | | | | |
| ff1floatingcastle | | | | |
| ff1gameover | | | | |
| ff1gurguvolcano | | | | |
| ff1matouyascave | | | | |
| ff1menu | | | | |
| ff1prelude | | | | |
| ff1prologue | | | | |
| ff1ship | | | | |
| ff1shop | | | | |
| ff1town | | | | |
| ff1underwaterpalace | | | | |
| ff1victory | | | | |

\* battle's bass track starts in bar 2 — hit under "first note in the bass
track" only; see open questions.

## Open questions (sweep-wide)

- **Definition of "first bass note":** first note in the bass track, first
  low note sounding, or first note on a downbeat? These diverge on battle
  (bass enters bar 2 behind another track's flourish). Decide the
  convention, apply retroactively.
- **Third outcome category:** expect results besides hit/miss — right
  letter wrong mode, bass not starting in bar 1, genuinely ambiguous
  openings. "Unclear" is a real result; log it rather than forcing a
  verdict.
- **Duplicate audit:** dungeon = cave was caught by accident. Before
  sweeping the rest, check for other duplicate pairs (cheap: compare bar
  counts × tempo × total length, then diff melody tracks).
