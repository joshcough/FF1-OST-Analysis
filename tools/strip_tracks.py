#!/usr/bin/env python3
"""Delete tracks from a MIDI by app-visible index (counting only tracks
that contain notes, in file order — the same numbering Night Roll shows).

    python3 tools/strip_tracks.py file.mid 3,4,5 [file.mid 2 ...]

Rewrites in place, updating the header's track count. Note-less chunks
(conductor/tempo tracks) are always kept.
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


def chunks(d, hlen):
    magics = [k for k in range(8 + hlen, len(d) - 3) if d[k:k + 4] == b"MTrk"]
    out = []
    for n, k in enumerate(magics):
        declared = k + 8 + struct.unpack(">I", d[k + 4:k + 8])[0]
        nxt = magics[n + 1] if n + 1 < len(magics) else len(d)
        out.append((k, min(declared, nxt)))
    return out


def has_notes(d, start, end):
    j, running = start + 8, None
    try:
        while j < end:
            _, j = read_varlen(d, j)
            b = d[j]
            if b == 0xFF:
                if d[j + 1] == 0x2F:
                    return False
                ln, k = read_varlen(d, j + 2)
                j = k + ln
            elif b in (0xF0, 0xF7):
                ln, k = read_varlen(d, j + 1)
                j = k + ln
            else:
                if b & 0x80:
                    running = b
                    j += 1
                st = running & 0xF0
                if st == 0x90 and d[j + 1] > 0:
                    return True
                j += 1 if st in (0xC0, 0xD0) else 2
    except IndexError:
        pass
    return False


def strip(path, drop):
    d = open(path, "rb").read()
    assert d[0:4] == b"MThd", path + ": not a MIDI file"
    hlen = struct.unpack(">I", d[4:8])[0]
    cs = chunks(d, hlen)
    app_idx = -1
    keep = []
    for (s, e) in cs:
        if has_notes(d, s, e):
            app_idx += 1
            if app_idx in drop:
                continue
        keep.append((s, e))
    if app_idx + 1 <= max(drop):
        sys.exit(f"{path}: only {app_idx + 1} note tracks, can't drop {sorted(drop)}")
    out = bytearray(d[:8 + hlen])
    struct.pack_into(">H", out, 10, len(keep))
    for s, e in keep:
        body = d[s + 8:e]
        out.extend(b"MTrk")
        out.extend(struct.pack(">I", len(body)))
        out.extend(body)
    open(path, "wb").write(out)
    print(f"{path}: dropped note-tracks {sorted(drop)}, "
          f"{len(cs)} -> {len(keep)} chunks, {len(d)} -> {len(out)} bytes")


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 2 or len(args) % 2:
        sys.exit(__doc__)
    for p, idxs in zip(args[::2], args[1::2]):
        strip(p, {int(x) for x in idxs.split(",")})
