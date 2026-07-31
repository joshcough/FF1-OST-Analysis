#!/usr/bin/env python3
"""Detect each MIDI's key (Krumhansl-Schmuckler, duration-weighted) and
rewrite its key-signature meta events so notation software opens it in the
right key instead of the C-major default. Usage:

    python3 tools/fix_keysigs.py [--dry-run] file.mid ...
"""
import sys, struct

MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
NOTE = "C C# D Eb E F F# G Ab A Bb B".split()


def read_varlen(d, i):
    v = 0
    while True:
        b = d[i]; i += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, i


def parse_tracks(d):
    """Yield (track_start, track_end, events) where events are
    (abs_offset, kind, payload); kind 'keysig' offsets point at the FF 59 byte."""
    hlen = struct.unpack(">I", d[4:8])[0]
    ntrk = struct.unpack(">H", d[10:12])[0]
    ppq = struct.unpack(">H", d[12:14])[0]
    # Track boundaries by MTrk magic scan — some files (ff1battle) have
    # corrupt track-length headers, so declared lengths can't be trusted.
    magics = []
    k = 8 + hlen
    while True:
        k = d.find(b"MTrk", k)
        if k < 0:
            break
        magics.append(k)
        k += 4
    tracks = []
    for mi_, i in enumerate(magics):
        declared_end = i + 8 + struct.unpack(">I", d[i+4:i+8])[0]
        next_magic = magics[mi_+1] if mi_ + 1 < len(magics) else len(d)
        end = min(declared_end, next_magic)
        j = i + 8
        t = 0
        run = None
        name = ""
        notes = []            # (start_tick, dur, pitch, ch) — dur filled on note-off
        open_notes = {}
        keysig_offsets = []   # absolute offset of the 0xFF byte
        try:
            j, t, run, name, keysig_offsets = _parse_body(d, j, end, notes, open_notes)
        except IndexError:
            pass  # truncated track — keep what parsed
        tracks.append({"name": name, "notes": notes, "keysigs": keysig_offsets,
                       "start": i, "end": end})
    return ppq, tracks


def _parse_body(d, j, end, notes, open_notes):
    t = 0
    run = None
    name = ""
    keysig_offsets = []
    while j < end:
        dt, j = read_varlen(d, j)
        t += dt
        b = d[j]
        if b == 0xFF:
            mtype = d[j+1]
            if mtype == 0x2F:  # end of track — anything after is junk (corrupt files)
                break
            if mtype == 0x59:
                keysig_offsets.append(j)
            mlen, k = read_varlen(d, j + 2)
            if mtype == 0x03 and not name:
                name = d[k:k+mlen].decode("latin1", "replace")
            j = k + mlen
        elif b in (0xF0, 0xF7):
            mlen, k = read_varlen(d, j + 1)
            j = k + mlen
        else:
            if b & 0x80:
                run = b
                j += 1
            st = run & 0xF0
            ch = run & 0x0F
            if st in (0x80, 0x90, 0xA0, 0xB0, 0xE0):
                p1, p2 = d[j], d[j+1]
                j += 2
                if st == 0x90 and p2 > 0:
                    open_notes.setdefault(p1, []).append(t)
                elif st in (0x80, 0x90) and open_notes.get(p1):
                    t0 = open_notes[p1].pop(0)
                    notes.append((t0, t - t0, p1, ch))
            else:
                j += 1
    return j, t, run, name, keysig_offsets


def detect_key(tracks):
    pitched = [tr for tr in tracks
               if tr["notes"] and "drum" not in tr["name"].lower()
               and not all(n[3] == 9 for n in tr["notes"])]
    if not pitched:
        return None
    # bass track = lowest average pitch; its notes count triple (roots anchor keys)
    def avg_pitch(tr):
        return sum(n[2] for n in tr["notes"]) / len(tr["notes"])
    bass = min(pitched, key=avg_pitch)
    hist = [0.0] * 12
    for tr in pitched:
        w = 3.0 if tr is bass else 1.0
        for t0, dur, p, ch in tr["notes"]:
            if ch == 9:
                continue
            hist[p % 12] += w * max(dur, 1)
    norm = max(hist) or 1
    hist = [h / norm for h in hist]
    # cadence evidence: these are loops — first and last bass notes lean tonic
    bnotes = sorted(bass["notes"])
    first_pc = bnotes[0][2] % 12
    last_pc = bnotes[-1][2] % 12
    best = None
    for mode, profile in (("major", MAJ), ("minor", MIN)):
        pnorm = max(profile)
        for tonic in range(12):
            score = sum(profile[(pc - tonic) % 12] / pnorm * hist[pc] for pc in range(12))
            if tonic == first_pc:
                score *= 1.12
            if tonic == last_pc:
                score *= 1.06
            if best is None or score > best[0]:
                best = (score, tonic, mode)
    _, tonic, mode = best
    rel_major = tonic if mode == "major" else (tonic + 3) % 12
    sf = (rel_major * 7) % 12
    if sf > 6:
        sf -= 12
    return tonic, mode, sf


# Keys established by analysis override detection (path suffix -> (tonic, mode)).
KNOWN = {
    "ff1overworld.mid": ("G", "major"),
    "ff1corneliacastle.mid": ("D", "major"),
    "KeyChangeTest-07-26.mid": ("G", "major"),
    "CM6-G7b9.mid": ("C", "major"),
}


def patch(path, dry):
    d = bytearray(open(path, "rb").read())
    ppq, tracks = parse_tracks(bytes(d))
    known = next((v for k, v in KNOWN.items() if path.endswith(k)), None)
    if known:
        tonic, mode = NOTE.index(known[0]), known[1]
        rel_major = tonic if mode == "major" else (tonic + 3) % 12
        sf = (rel_major * 7) % 12
        if sf > 6:
            sf -= 12
        key = (tonic, mode, sf)
    else:
        key = detect_key(tracks)
    if key is None:
        print(f"{path}: no pitched notes, skipped")
        return
    tonic, mode, sf = key
    mi = 1 if mode == "minor" else 0
    label = f"{NOTE[tonic]} {mode} (sf={sf:+d})"
    patched = 0
    for tr in tracks:
        for off in tr["keysigs"]:
            # FF 59 02 sf mi
            d[off+3] = sf & 0xFF
            d[off+4] = mi
            patched += 1
    inserted = 0
    if patched == 0:
        # insert "00 FF 59 02 sf mi" right after the first track's MTrk header
        tr = tracks[0]
        ins = tr["start"] + 8
        ev = bytes([0x00, 0xFF, 0x59, 0x02, sf & 0xFF, mi])
        d[ins:ins] = ev
        tlen = struct.unpack(">I", d[tr["start"]+4:tr["start"]+8])[0]
        d[tr["start"]+4:tr["start"]+8] = struct.pack(">I", tlen + len(ev))
        inserted = 1
    if not dry:
        open(path, "wb").write(d)
    print(f"{path}: {label} — {patched} keysig(s) rewritten, {inserted} inserted"
          + (" [dry-run]" if dry else ""))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry = "--dry-run" in sys.argv
    for p in args:
        try:
            patch(p, dry)
        except Exception as e:
            print(f"{p}: SKIPPED ({type(e).__name__}: {e})")
