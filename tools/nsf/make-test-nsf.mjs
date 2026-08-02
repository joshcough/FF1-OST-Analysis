// Builds a tiny synthetic NSF: pulse 1 plays C4 E4 G4 C5 (quarter notes at
// 120bpm = one note per 30 NTSC frames) over a constant C3 triangle pedal.
// Hand-assembled 6502 — our own code, no copyrighted data — so the whole
// pipeline can be tested end-to-end.
export function makeTestNSF() {
  const LOAD = 0x8000;
  const code = [];
  const emit = (...bytes) => code.push(...bytes);

  // ---- init ($8000): enable pulse1+triangle, set counters, start triangle C3
  emit(0xA9, 0x0F, 0x8D, 0x15, 0x40); // LDA #$0F / STA $4015
  emit(0xA9, 29, 0x85, 0x00);         // LDA #29  / STA $00 (frame ctr, fires next frame)
  emit(0xA9, 0, 0x85, 0x01);          // LDA #0   / STA $01 (note index)
  emit(0xA9, 0x7F, 0x8D, 0x08, 0x40); // LDA #$7F / STA $4008 (triangle linear on)
  emit(0xA9, 0xAB, 0x8D, 0x0A, 0x40); // period $1AB -> C3
  emit(0xA9, 0x01, 0x8D, 0x0B, 0x40);
  emit(0x60);                         // RTS
  const playOff = code.length;

  // ---- play: every 30 frames, advance through the 4-note table
  emit(0xE6, 0x00);                   // INC $00
  emit(0xA5, 0x00, 0xC9, 30);        // LDA $00 / CMP #30
  const bne1 = code.length; emit(0xD0, 0x00); // BNE done (patched)
  emit(0xA9, 0, 0x85, 0x00);          // reset frame ctr
  emit(0xA5, 0x01, 0xC9, 4);          // LDA $01 / CMP #4
  const beq1 = code.length; emit(0xF0, 0x00); // BEQ done (patched)
  emit(0xAA);                         // TAX
  const loRef = code.length; emit(0xBD, 0x00, 0x00); // LDA lo,X (patched)
  emit(0x8D, 0x02, 0x40);             // STA $4002
  const hiRef = code.length; emit(0xBD, 0x00, 0x00); // LDA hi,X (patched)
  emit(0x8D, 0x03, 0x40);             // STA $4003
  emit(0xA9, 0x3F, 0x8D, 0x00, 0x40); // LDA #$3F / STA $4000 (duty 0, vol 15)
  emit(0xE6, 0x01);                   // INC $01
  const done = code.length;
  emit(0x60);                         // RTS

  // note tables: periods for C4 E4 G4 C5
  const loTab = code.length; emit(0xAB, 0x52, 0x1C, 0xD5);
  const hiTab = code.length; emit(0x01, 0x01, 0x01, 0x00);

  // patch branches (relative to the byte after the branch operand)
  code[bne1 + 1] = done - (bne1 + 2);
  code[beq1 + 1] = done - (beq1 + 2);
  // patch table addresses
  code[loRef + 1] = (LOAD + loTab) & 0xFF; code[loRef + 2] = (LOAD + loTab) >> 8;
  code[hiRef + 1] = (LOAD + hiTab) & 0xFF; code[hiRef + 2] = (LOAD + hiTab) >> 8;

  // ---- NSF header
  const header = new Uint8Array(0x80);
  const magic = "NESM\x1a";
  for (let i = 0; i < 5; i++) header[i] = magic.charCodeAt(i);
  header[5] = 1;  // version
  header[6] = 1;  // songs
  header[7] = 1;  // start song
  header[0x08] = LOAD & 0xFF; header[0x09] = LOAD >> 8;
  header[0x0A] = LOAD & 0xFF; header[0x0B] = LOAD >> 8;           // init
  header[0x0C] = (LOAD + playOff) & 0xFF; header[0x0D] = (LOAD + playOff) >> 8; // play
  const name = "Night Roll test tune";
  for (let i = 0; i < name.length; i++) header[0x0E + i] = name.charCodeAt(i);
  header[0x6E] = 16639 & 0xFF; header[0x6F] = 16639 >> 8; // NTSC play speed

  const out = new Uint8Array(0x80 + code.length);
  out.set(header, 0);
  out.set(code, 0x80);
  return out;
}
