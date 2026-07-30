# Supplemental Learning Plan

The song analyses in this repo are the core of the project, but they touch concepts from every level of a college theory sequence at once. This is the supporting practice around them.

## The stack

| Resource | What it's for | Cost |
|----------|--------------|------|
| [Artusi](https://www.artusimusic.com/) | The main workbook substitute: interactive Theory I–IV curriculum with auto-graded exercises, including harmony and part-writing. Used by real college programs. Free for individual self-learners ([pricing](https://www.artusimusic.com/pricing/), [demo](https://www.artusimusic.com/assignments/demo/)). | Free |
| [musictheory.net exercises](https://www.musictheory.net/exercises) | Daily 5-minute drills on fundamentals: intervals, key signatures, chord spelling. For patching potholes (e.g. the up-a-fourth = down-a-fifth confusion from the Overworld bass session). | Free |
| Claude sessions (this repo) | Applied analysis of real Uematsu tracks; each session starts with ~5 retrieval questions from the previous session. Custom problem sets on request. | — |
| [Hooktheory Books I & II](https://www.hooktheory.com/books/pricing) | Optional later addition: interactive books built around melody-over-Roman-numeral-chords in popular music, with self-checking exercises. Closest match to the end goal (writing songs). | ~$35 one-time |
| [8-bit Music Theory](https://www.youtube.com/@8bitMusicTheory) (YouTube) | Companion viewing: deep analyses of video game music, including Uematsu/FF. Good calibration check after finishing a song's own analysis. | Free |

## On textbooks (decision: skipped, mostly)

*Tonal Harmony* (Kostka & Payne) is the standard college text, but the exercise workbook has an instructor-only answer key — bad for self-study — and used copies are often filled in. Decision: do exercises online where they grade themselves. If a reading copy ever feels useful, a used 6th/7th edition (~$10) is equivalent to the $114 current hardcover for these purposes.

## Session log — concepts covered (quiz source material)

**2026-07-21 (Overworld bass):** see "Theory concepts unlocked" in overworld.md — V/ii notation, up-a-fourth = down-a-fifth, ii–V–i, tonicization vs. modulation vs. borrowing.

**2026-07-22 (theory conversation):** secondary dominants can target any diatonic major/minor triad (not diminished); resolution is the payment, deferral allowed but must pay off. Modulation recipe = introduce the new key's dominant, resolve, and stay; pivot chords (C is IV of G *and* V of F) make it smooth; the dominant 7th is unambiguous (C7 exists only in F) while a plain triad is not. V7 resolves equally to major or minor tonic — the dominant is identical either way (promise of destination, not the weather). Key-signature distance predicts melodic difficulty (G→F = 2 steps; G→Fm = 5). Shared opening template found in both songs: home → dominant → minor chord → secondary dominant aiming at a minor target (see chord-charts.md).

**2026-07-22 late (KeyChangeTest analysis):** deceptive resolution — a dominant resolving somewhere unpromised (C7→Bb instead of F); lands soft when the destination is a near relative (C7 = V/V in Bb). Retroactive reinterpretation: the F chord expected to be tonic got demoted to V of Bb by what followed — melody decides the king (phrase endings + emphasis outrank the chart). Key fingerprint test: F major has E♮, Bb major has Eb — one accidental class settles which key. Bare-octave arrivals hide chord quality (Bb octaves = major/minor unproven; **open quiz question: which added note makes it Bb minor?**). Riff vs. melody: stepwise notes don't make a melody — a repeating one-bar cell is an ostinato; a melody needs a phrase arc (build, peak, resolve). Leading tone in the melody sells a turnaround (F#5 over the D chord).

**The seventh-side resolution (Josh's coinage — his to rename):** resolving a dominant 7th to the key of its own *seventh* instead of its promised tonic (C7 → Bb rather than C7 → F). Why it works: the seventh of any V7 is the tonic two stations down the circle of fifths (C → F → Bb), so the destination note is already sounding inside the dominant — pre-planted in the ear, a common-tone modulation in disguise. Official theory has no name for it; it files the move retrospectively as V/V → I and lists it among the stock deceptive resolutions (V7 down a whole step). Discovered by ear in KeyChangeTest-07-26: "the Bb is in there — let's just go to Bb." Caveat from the same discovery: the common tone opens the door, but the melody must then feed the new tonic (phrase endings, emphasis) or the throne doesn't hold. Every V7 carries this secret second destination.

**2026-07-29 (tooling night + Baseball/Beach first look):** built the Night
Roll player up into a real analysis tool (see open-items.md for the feature
list). New piece CM6-G7b9 ("Baseball / Beach Song") parsed but not analyzed
together yet — first-look observations logged as quiz-source concepts:
**extended tonic chord** (C6 = C-E-G-A, the ballpark-organ chord), **altered
dominant** (G7♭9 — the ♭9 Ab as the melody's semitone color), **rootless
voicing** (Josh's chord track spells B-D-F-Ab, no G — which is a **fully
diminished 7th**, symmetric stack of minor 3rds), **chromatic bass creep**
instead of a root pedal under the dominant, and a melody that outlines the
dim7 arpeggio (bars 13–14) before a stepwise scale resolution. Questions
awaiting Josh in open-items.md.

## Current composition exercise (in progress)

Two 8-bar loops: chords from G-land → C7 → F **major** + melody; then the same but resolving to F **minor**. Guidelines agreed: introduce C as plain IV before it returns as C7 (furniture, then door); melody crosses the seam on common tones (C, F, G); chord tone on every chord-arrival downbeat; in the minor version let one prominent note (Ab on the Fm downbeat) carry the darkness; sing before playing; save both versions (MIDI or recording) and bring them back for analysis with the same tools used on Uematsu.

**2026-07-26 attempt (KeyChangeTest-07-26.mid, analyzed 2026-07-22 session):** Josh's first-ever secondary dominant, played in live. What he wrote: G–Am–G/B–C7 twice (bass walks G-A-B-C, line-first), then a deceptive swerve — C7 resolved to **Bb**, not F. Josh heard the section as Bb before the analysis confirmed it (pitch collection = Bb major exactly, zero E naturals; melody phrase-endings crown Bb). Section reads Bb: I–V–IV, then D major (V of G) as an **intentional turnaround** — F# leading tone placed in the melody, Eb→D half-step squeeze against it. Melody verdict: bars 1–3 are a melodic ostinato (riff — one-bar cell, stepwise, only the downbeat anchor changes); bars 11–12 are a real phrase arc (climb, peak F#5, resolve to held D). Still owed: the F-minor half (both halves currently identical), and a revision pass after analyzing Uematsu's Overworld melody track.

## Where the song sessions have placed me so far (2026-07-21)

Material covered in the Cornelia Castle and Overworld (bass) sessions spans Theory I–IV: Roman numerals and chord spelling (I), inversions and bass-line logic (II), secondary dominants and tonicization (III), mode mixture / borrowed chords (IV) — plus the by-ear analysis skill that classrooms teach separately as aural skills. Known weak spot to drill: interval direction arithmetic (fifths vs. fourths).
