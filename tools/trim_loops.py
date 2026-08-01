#!/usr/bin/env python3
"""Trim a MIDI to its first pass: drop every event at or after a bar
boundary, so the app's end-of-song loop replays only unique material.

    python3 tools/trim_loops.py file.mid KEEP_BARS [file.mid KEEP_BARS ...]

KEEP_BARS is how many bars to keep (bar length from the file's first
time-signature meta, else 4/4). Rewrites in place. Notes still sounding
at the cut get note-offs there; running status is expanded on output.
"""
import struct
import sys


def read_varlen(d, i):
    v = 0
    while True:
        b = d[i]
        i += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, i


def write_varlen(v):
    out = [v & 0x7F]
    v >>= 7
    while v:
        out.append((v & 0x7F) | 0x80)
        v >>= 7
    return bytes(reversed(out))


def track_bounds(d, hlen):
    """MTrk chunks by magic scan (catalog has files with corrupt lengths)."""
    magics = [k for k in range(8 + hlen, len(d) - 3) if d[k:k + 4] == b"MTrk"]
    bounds = []
    for n, k in enumerate(magics):
        declared = k + 8 + struct.unpack(">I", d[k + 4:k + 8])[0]
        nxt = magics[n + 1] if n + 1 < len(magics) else len(d)
        bounds.append((k + 8, min(declared, nxt)))
    return bounds


def first_timesig(d, start, end):
    j, t, running = start, 0, None
    while j < end:
        dt, j = read_varlen(d, j)
        t += dt
        b = d[j]
        if b == 0xFF:
            mtype = d[j + 1]
            ln, k = read_varlen(d, j + 2)
            if mtype == 0x58:
                return d[k], 1 << d[k + 1]
            if mtype == 0x2F:
                break
            j = k + ln
        elif b in (0xF0, 0xF7):
            ln, k = read_varlen(d, j + 1)
            j = k + ln
        else:
            if b & 0x80:
                running = b
                j += 1
            st = running & 0xF0
            j += 1 if st in (0xC0, 0xD0) else 2
    return None


def trim_track(d, start, end, cut_tick):
    j, t, running = start, 0, None
    out = bytearray()
    last_t = 0
    open_notes = []  # (channel, pitch)

    def emit(tick, data):
        nonlocal last_t
        out.extend(write_varlen(tick - last_t))
        out.extend(data)
        last_t = tick

    while j < end:
        dt, j = read_varlen(d, j)
        t += dt
        b = d[j]
        if b == 0xFF:
            mtype = d[j + 1]
            ln, k = read_varlen(d, j + 2)
            data = bytes(d[j:k + ln])
            j = k + ln
            if mtype == 0x2F:
                break
            if t < cut_tick:
                emit(t, data)
        elif b in (0xF0, 0xF7):
            ln, k = read_varlen(d, j + 1)
            data = bytes(d[j:k + ln])
            j = k + ln
            if t < cut_tick:
                emit(t, data)
        else:
            if b & 0x80:
                running = b
                j += 1
            st, ch = running & 0xF0, running & 0x0F
            n = 1 if st in (0xC0, 0xD0) else 2
            args = bytes(d[j:j + n])
            j += n
            if t >= cut_tick:
                continue
            if st == 0x90 and args[1] > 0:
                open_notes.append((ch, args[0]))
            elif st == 0x80 or (st == 0x90 and args[1] == 0):
                try:
                    open_notes.remove((ch, args[0]))
                except ValueError:
                    pass
            emit(t, bytes([running]) + args)

    for ch, p in open_notes:
        emit(cut_tick, bytes([0x80 | ch, p, 0x40]))
    emit(cut_tick, b"\xff\x2f\x00")
    return bytes(out)


def trim(path, keep_bars):
    d = open(path, "rb").read()
    assert d[0:4] == b"MThd", path + ": not a MIDI file"
    hlen = struct.unpack(">I", d[4:8])[0]
    ppq = struct.unpack(">H", d[12:14])[0]
    bounds = track_bounds(d, hlen)
    num, den = 4, 4
    for s, e in bounds:
        ts = first_timesig(d, s, e)
        if ts:
            num, den = ts
            break
    cut_tick = int(keep_bars * num * 4 / den * ppq)
    out = bytearray(d[:8 + hlen])
    for s, e in bounds:
        body = trim_track(d, s, e, cut_tick)
        out.extend(b"MTrk")
        out.extend(struct.pack(">I", len(body)))
        out.extend(body)
    open(path, "wb").write(out)
    print(f"{path}: kept {keep_bars} bars (cut at tick {cut_tick}), "
          f"{len(d)} -> {len(out)} bytes")


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 2 or len(args) % 2:
        sys.exit(__doc__)
    for p, bars in zip(args[::2], args[1::2]):
        trim(p, int(bars))
