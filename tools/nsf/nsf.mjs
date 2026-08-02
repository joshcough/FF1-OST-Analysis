// NSF loader + playback driver: runs a song's init routine, then calls the
// play routine at the header's rate, logging every APU register write with
// a (frame, order-within-frame) timestamp. No audio is rendered — the log
// IS the output.
import { CPU6502 } from "./cpu6502.mjs";

export function parseNSF(buf) {
  const d = new Uint8Array(buf);
  const magic = String.fromCharCode(...d.subarray(0, 5));
  if (magic !== "NESM\x1a") throw new Error("not an NSF file");
  const str = (off, len) => {
    let s = "";
    for (let i = off; i < off + len && d[i]; i++) s += String.fromCharCode(d[i]);
    return s;
  };
  const u16 = o => d[o] | (d[o + 1] << 8);
  const banks = [...d.subarray(0x70, 0x78)];
  return {
    version: d[5],
    songs: d[6],
    startSong: d[7],           // 1-based
    loadAddr: u16(0x08),
    initAddr: u16(0x0A),
    playAddr: u16(0x0C),
    name: str(0x0E, 32),
    artist: str(0x2E, 32),
    copyright: str(0x4E, 32),
    playSpeedNTSC: u16(0x6E) || 16639, // microseconds between play calls
    banks,
    banked: banks.some(b => b !== 0),
    data: d.subarray(0x80),
  };
}

export function runNSF(nsf, songIndex1Based, seconds) {
  const ram = new Uint8Array(0x800);
  const sram = new Uint8Array(0x2000);        // $6000-$7FFF
  const rom = new Uint8Array(0x8000);         // $8000-$FFFF (non-banked view)
  const bankRegs = new Uint8Array(8);
  const apuLog = [];                          // {frame, order, addr, value}
  let frame = 0, order = 0;

  if (nsf.banked) {
    for (let i = 0; i < 8; i++) bankRegs[i] = nsf.banks[i];
  } else {
    rom.set(nsf.data.subarray(0, Math.min(nsf.data.length, 0x10000 - nsf.loadAddr)), nsf.loadAddr - 0x8000);
  }
  const bankRead = a => { // banked: $8000+ divided into 8 x 4K banks
    const slot = (a - 0x8000) >> 12;
    const off = bankRegs[slot] * 0x1000 + (a & 0xFFF);
    // banked data is offset by loadAddr's low 12 bits (padding convention)
    const idx = off - (nsf.loadAddr & 0xFFF) >= 0 ? off - (nsf.loadAddr & 0xFFF) : -1;
    return idx >= 0 && idx < nsf.data.length ? nsf.data[idx] : 0;
  };

  const bus = {
    read(a) {
      if (a < 0x2000) return ram[a & 0x7FF];
      if (a === 0x4015) return 0x0F; // all channels report active
      if (a >= 0x6000 && a < 0x8000) return sram[a - 0x6000];
      if (a >= 0x8000) return nsf.banked ? bankRead(a) : rom[a - 0x8000];
      return 0;
    },
    write(a, v) {
      if (a < 0x2000) { ram[a & 0x7FF] = v; return; }
      if (a >= 0x4000 && a <= 0x4017) { apuLog.push({frame, order: order++, addr: a, value: v}); return; }
      if (a >= 0x5FF8 && a <= 0x5FFF) { bankRegs[a - 0x5FF8] = v; return; }
      if (a >= 0x6000 && a < 0x8000) { sram[a - 0x6000] = v; return; }
      // writes to ROM space ignored
    },
  };

  const cpu = new CPU6502(bus);
  const SENTINEL = 0x5555; // return address that halts execution
  const callsub = (addr, a, x) => {
    cpu.halted = false;
    cpu.a = a; cpu.x = x; cpu.y = 0;
    cpu.sp = 0xFD;
    const ret = (SENTINEL - 1) & 0xFFFF;
    cpu.push(ret >> 8); cpu.push(ret & 0xFF);
    cpu.pc = addr;
    let guard = 0;
    while (cpu.pc !== SENTINEL && !cpu.halted && guard++ < 2_000_000) cpu.step();
    if (guard >= 2_000_000) throw new Error("runaway subroutine at frame " + frame);
  };

  callsub(nsf.initAddr, songIndex1Based - 1, 0); // A = song, X = 0 (NTSC)
  const frames = Math.round(seconds * 1_000_000 / nsf.playSpeedNTSC);
  for (frame = 1; frame <= frames; frame++) {
    order = 0;
    callsub(nsf.playAddr, 0, 0);
  }
  return {apuLog, frames, frameSec: nsf.playSpeedNTSC / 1_000_000};
}
