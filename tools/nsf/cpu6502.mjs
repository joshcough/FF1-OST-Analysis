// Minimal instruction-accurate 6502 core for NSF playback logging.
// Cycle timing is deliberately coarse (per-instruction constant) — the NSF
// pipeline needs the ORDER of APU register writes at frame resolution, not
// cycle-exact audio. All official opcodes implemented; illegal opcodes throw.
export class CPU6502 {
  constructor(bus) {
    this.bus = bus; // {read(addr) -> byte, write(addr, byte)}
    this.a = 0; this.x = 0; this.y = 0;
    this.sp = 0xFD;
    this.pc = 0;
    this.c = 0; this.z = 0; this.i = 1; this.d = 0; this.v = 0; this.n = 0;
    this.halted = false;
  }
  flags() { return (this.n << 7) | (this.v << 6) | 0x20 | (this.d << 3) | (this.i << 2) | (this.z << 1) | this.c; }
  setFlags(p) {
    this.n = (p >> 7) & 1; this.v = (p >> 6) & 1; this.d = (p >> 3) & 1;
    this.i = (p >> 2) & 1; this.z = (p >> 1) & 1; this.c = p & 1;
  }
  rd(a) { return this.bus.read(a & 0xFFFF) & 0xFF; }
  wr(a, v) { this.bus.write(a & 0xFFFF, v & 0xFF); }
  rd16(a) { return this.rd(a) | (this.rd(a + 1) << 8); }
  push(v) { this.wr(0x100 + this.sp, v); this.sp = (this.sp - 1) & 0xFF; }
  pop() { this.sp = (this.sp + 1) & 0xFF; return this.rd(0x100 + this.sp); }
  nz(v) { v &= 0xFF; this.z = v === 0 ? 1 : 0; this.n = (v >> 7) & 1; return v; }

  // addressing modes return an address (or null for accumulator/implied)
  imm() { return this.pc++; }
  zp() { return this.rd(this.pc++); }
  zpx() { return (this.rd(this.pc++) + this.x) & 0xFF; }
  zpy() { return (this.rd(this.pc++) + this.y) & 0xFF; }
  abs() { const a = this.rd16(this.pc); this.pc += 2; return a; }
  abx() { return (this.abs() + this.x) & 0xFFFF; }
  aby() { return (this.abs() + this.y) & 0xFFFF; }
  izx() { const z = (this.rd(this.pc++) + this.x) & 0xFF; return this.rd(z) | (this.rd((z + 1) & 0xFF) << 8); }
  izy() { const z = this.rd(this.pc++); return ((this.rd(z) | (this.rd((z + 1) & 0xFF) << 8)) + this.y) & 0xFFFF; }
  ind() { // JMP ($xxxx) with the 6502 page-wrap bug
    const a = this.abs();
    const lo = this.rd(a);
    const hi = this.rd((a & 0xFF00) | ((a + 1) & 0xFF));
    return lo | (hi << 8);
  }
  rel() { const off = this.rd(this.pc++); return off < 0x80 ? off : off - 0x100; }

  branch(cond) { const off = this.rel(); if (cond) this.pc = (this.pc + off) & 0xFFFF; }

  adc(v) {
    const sum = this.a + v + this.c;
    this.v = (~(this.a ^ v) & (this.a ^ sum) & 0x80) ? 1 : 0;
    this.c = sum > 0xFF ? 1 : 0;
    this.a = this.nz(sum);
  }
  sbc(v) { this.adc(v ^ 0xFF); }
  cmp(r, v) { const t = (r - v) & 0x1FF; this.c = r >= v ? 1 : 0; this.nz(t & 0xFF); }
  asl(v) { this.c = (v >> 7) & 1; return this.nz((v << 1) & 0xFF); }
  lsr(v) { this.c = v & 1; return this.nz(v >> 1); }
  rol(v) { const c = this.c; this.c = (v >> 7) & 1; return this.nz(((v << 1) | c) & 0xFF); }
  ror(v) { const c = this.c; this.c = v & 1; return this.nz((v >> 1) | (c << 7)); }
  bit(v) { this.z = (this.a & v) === 0 ? 1 : 0; this.n = (v >> 7) & 1; this.v = (v >> 6) & 1; }

  rmw(addr, fn) { const v = this.rd(addr); this.wr(addr, fn.call(this, v)); }

  step() { // executes one instruction; returns approx cycle count (constant 3)
    if (this.halted) return 3;
    const op = this.rd(this.pc++);
    switch (op) {
      // loads
      case 0xA9: this.a = this.nz(this.rd(this.imm())); break;
      case 0xA5: this.a = this.nz(this.rd(this.zp())); break;
      case 0xB5: this.a = this.nz(this.rd(this.zpx())); break;
      case 0xAD: this.a = this.nz(this.rd(this.abs())); break;
      case 0xBD: this.a = this.nz(this.rd(this.abx())); break;
      case 0xB9: this.a = this.nz(this.rd(this.aby())); break;
      case 0xA1: this.a = this.nz(this.rd(this.izx())); break;
      case 0xB1: this.a = this.nz(this.rd(this.izy())); break;
      case 0xA2: this.x = this.nz(this.rd(this.imm())); break;
      case 0xA6: this.x = this.nz(this.rd(this.zp())); break;
      case 0xB6: this.x = this.nz(this.rd(this.zpy())); break;
      case 0xAE: this.x = this.nz(this.rd(this.abs())); break;
      case 0xBE: this.x = this.nz(this.rd(this.aby())); break;
      case 0xA0: this.y = this.nz(this.rd(this.imm())); break;
      case 0xA4: this.y = this.nz(this.rd(this.zp())); break;
      case 0xB4: this.y = this.nz(this.rd(this.zpx())); break;
      case 0xAC: this.y = this.nz(this.rd(this.abs())); break;
      case 0xBC: this.y = this.nz(this.rd(this.abx())); break;
      // stores
      case 0x85: this.wr(this.zp(), this.a); break;
      case 0x95: this.wr(this.zpx(), this.a); break;
      case 0x8D: this.wr(this.abs(), this.a); break;
      case 0x9D: this.wr(this.abx(), this.a); break;
      case 0x99: this.wr(this.aby(), this.a); break;
      case 0x81: this.wr(this.izx(), this.a); break;
      case 0x91: this.wr(this.izy(), this.a); break;
      case 0x86: this.wr(this.zp(), this.x); break;
      case 0x96: this.wr(this.zpy(), this.x); break;
      case 0x8E: this.wr(this.abs(), this.x); break;
      case 0x84: this.wr(this.zp(), this.y); break;
      case 0x94: this.wr(this.zpx(), this.y); break;
      case 0x8C: this.wr(this.abs(), this.y); break;
      // transfers
      case 0xAA: this.x = this.nz(this.a); break;
      case 0xA8: this.y = this.nz(this.a); break;
      case 0x8A: this.a = this.nz(this.x); break;
      case 0x98: this.a = this.nz(this.y); break;
      case 0xBA: this.x = this.nz(this.sp); break;
      case 0x9A: this.sp = this.x; break;
      // stack
      case 0x48: this.push(this.a); break;
      case 0x68: this.a = this.nz(this.pop()); break;
      case 0x08: this.push(this.flags() | 0x10); break;
      case 0x28: this.setFlags(this.pop()); break;
      // arithmetic
      case 0x69: this.adc(this.rd(this.imm())); break;
      case 0x65: this.adc(this.rd(this.zp())); break;
      case 0x75: this.adc(this.rd(this.zpx())); break;
      case 0x6D: this.adc(this.rd(this.abs())); break;
      case 0x7D: this.adc(this.rd(this.abx())); break;
      case 0x79: this.adc(this.rd(this.aby())); break;
      case 0x61: this.adc(this.rd(this.izx())); break;
      case 0x71: this.adc(this.rd(this.izy())); break;
      case 0xE9: this.sbc(this.rd(this.imm())); break;
      case 0xE5: this.sbc(this.rd(this.zp())); break;
      case 0xF5: this.sbc(this.rd(this.zpx())); break;
      case 0xED: this.sbc(this.rd(this.abs())); break;
      case 0xFD: this.sbc(this.rd(this.abx())); break;
      case 0xF9: this.sbc(this.rd(this.aby())); break;
      case 0xE1: this.sbc(this.rd(this.izx())); break;
      case 0xF1: this.sbc(this.rd(this.izy())); break;
      // compares
      case 0xC9: this.cmp(this.a, this.rd(this.imm())); break;
      case 0xC5: this.cmp(this.a, this.rd(this.zp())); break;
      case 0xD5: this.cmp(this.a, this.rd(this.zpx())); break;
      case 0xCD: this.cmp(this.a, this.rd(this.abs())); break;
      case 0xDD: this.cmp(this.a, this.rd(this.abx())); break;
      case 0xD9: this.cmp(this.a, this.rd(this.aby())); break;
      case 0xC1: this.cmp(this.a, this.rd(this.izx())); break;
      case 0xD1: this.cmp(this.a, this.rd(this.izy())); break;
      case 0xE0: this.cmp(this.x, this.rd(this.imm())); break;
      case 0xE4: this.cmp(this.x, this.rd(this.zp())); break;
      case 0xEC: this.cmp(this.x, this.rd(this.abs())); break;
      case 0xC0: this.cmp(this.y, this.rd(this.imm())); break;
      case 0xC4: this.cmp(this.y, this.rd(this.zp())); break;
      case 0xCC: this.cmp(this.y, this.rd(this.abs())); break;
      // inc/dec
      case 0xE6: this.rmw(this.zp(), v => this.nz(v + 1)); break;
      case 0xF6: this.rmw(this.zpx(), v => this.nz(v + 1)); break;
      case 0xEE: this.rmw(this.abs(), v => this.nz(v + 1)); break;
      case 0xFE: this.rmw(this.abx(), v => this.nz(v + 1)); break;
      case 0xC6: this.rmw(this.zp(), v => this.nz(v - 1)); break;
      case 0xD6: this.rmw(this.zpx(), v => this.nz(v - 1)); break;
      case 0xCE: this.rmw(this.abs(), v => this.nz(v - 1)); break;
      case 0xDE: this.rmw(this.abx(), v => this.nz(v - 1)); break;
      case 0xE8: this.x = this.nz(this.x + 1); break;
      case 0xC8: this.y = this.nz(this.y + 1); break;
      case 0xCA: this.x = this.nz(this.x - 1); break;
      case 0x88: this.y = this.nz(this.y - 1); break;
      // logic
      case 0x29: this.a = this.nz(this.a & this.rd(this.imm())); break;
      case 0x25: this.a = this.nz(this.a & this.rd(this.zp())); break;
      case 0x35: this.a = this.nz(this.a & this.rd(this.zpx())); break;
      case 0x2D: this.a = this.nz(this.a & this.rd(this.abs())); break;
      case 0x3D: this.a = this.nz(this.a & this.rd(this.abx())); break;
      case 0x39: this.a = this.nz(this.a & this.rd(this.aby())); break;
      case 0x21: this.a = this.nz(this.a & this.rd(this.izx())); break;
      case 0x31: this.a = this.nz(this.a & this.rd(this.izy())); break;
      case 0x09: this.a = this.nz(this.a | this.rd(this.imm())); break;
      case 0x05: this.a = this.nz(this.a | this.rd(this.zp())); break;
      case 0x15: this.a = this.nz(this.a | this.rd(this.zpx())); break;
      case 0x0D: this.a = this.nz(this.a | this.rd(this.abs())); break;
      case 0x1D: this.a = this.nz(this.a | this.rd(this.abx())); break;
      case 0x19: this.a = this.nz(this.a | this.rd(this.aby())); break;
      case 0x01: this.a = this.nz(this.a | this.rd(this.izx())); break;
      case 0x11: this.a = this.nz(this.a | this.rd(this.izy())); break;
      case 0x49: this.a = this.nz(this.a ^ this.rd(this.imm())); break;
      case 0x45: this.a = this.nz(this.a ^ this.rd(this.zp())); break;
      case 0x55: this.a = this.nz(this.a ^ this.rd(this.zpx())); break;
      case 0x4D: this.a = this.nz(this.a ^ this.rd(this.abs())); break;
      case 0x5D: this.a = this.nz(this.a ^ this.rd(this.abx())); break;
      case 0x59: this.a = this.nz(this.a ^ this.rd(this.aby())); break;
      case 0x41: this.a = this.nz(this.a ^ this.rd(this.izx())); break;
      case 0x51: this.a = this.nz(this.a ^ this.rd(this.izy())); break;
      // shifts/rotates
      case 0x0A: this.a = this.asl(this.a); break;
      case 0x06: this.rmw(this.zp(), this.asl); break;
      case 0x16: this.rmw(this.zpx(), this.asl); break;
      case 0x0E: this.rmw(this.abs(), this.asl); break;
      case 0x1E: this.rmw(this.abx(), this.asl); break;
      case 0x4A: this.a = this.lsr(this.a); break;
      case 0x46: this.rmw(this.zp(), this.lsr); break;
      case 0x56: this.rmw(this.zpx(), this.lsr); break;
      case 0x4E: this.rmw(this.abs(), this.lsr); break;
      case 0x5E: this.rmw(this.abx(), this.lsr); break;
      case 0x2A: this.a = this.rol(this.a); break;
      case 0x26: this.rmw(this.zp(), this.rol); break;
      case 0x36: this.rmw(this.zpx(), this.rol); break;
      case 0x2E: this.rmw(this.abs(), this.rol); break;
      case 0x3E: this.rmw(this.abx(), this.rol); break;
      case 0x6A: this.a = this.ror(this.a); break;
      case 0x66: this.rmw(this.zp(), this.ror); break;
      case 0x76: this.rmw(this.zpx(), this.ror); break;
      case 0x6E: this.rmw(this.abs(), this.ror); break;
      case 0x7E: this.rmw(this.abx(), this.ror); break;
      // bit
      case 0x24: this.bit(this.rd(this.zp())); break;
      case 0x2C: this.bit(this.rd(this.abs())); break;
      // jumps
      case 0x4C: this.pc = this.abs(); break;
      case 0x6C: this.pc = this.ind(); break;
      case 0x20: { const target = this.abs(); const ret = (this.pc - 1) & 0xFFFF; this.push(ret >> 8); this.push(ret & 0xFF); this.pc = target; break; }
      case 0x60: { const lo = this.pop(); const hi = this.pop(); this.pc = (((hi << 8) | lo) + 1) & 0xFFFF; break; }
      case 0x40: { this.setFlags(this.pop()); const lo = this.pop(); const hi = this.pop(); this.pc = (hi << 8) | lo; break; }
      // branches
      case 0x90: this.branch(!this.c); break;
      case 0xB0: this.branch(!!this.c); break;
      case 0xF0: this.branch(!!this.z); break;
      case 0xD0: this.branch(!this.z); break;
      case 0x10: this.branch(!this.n); break;
      case 0x30: this.branch(!!this.n); break;
      case 0x50: this.branch(!this.v); break;
      case 0x70: this.branch(!!this.v); break;
      // flag ops
      case 0x18: this.c = 0; break;
      case 0x38: this.c = 1; break;
      case 0x58: this.i = 0; break;
      case 0x78: this.i = 1; break;
      case 0xB8: this.v = 0; break;
      case 0xD8: this.d = 0; break;
      case 0xF8: this.d = 1; break;
      case 0xEA: break; // NOP
      case 0x00: this.halted = true; break; // BRK: treat as halt (NSF drivers don't BRK)
      default:
        throw new Error("illegal opcode $" + op.toString(16) + " at $" + (this.pc - 1).toString(16));
    }
    return 3;
  }
}
