// CLI: NSF -> .notes.txt (discovery mode: pitch/time/duration/channel only).
//   node tools/nsf/dump.mjs song.nsf --bpm 130 [--song 3] [--seconds 60]
//                                    [--ts 4/4] [--title overworld]
import { readFileSync } from "node:fs";
import { parseNSF, runNSF } from "./nsf.mjs";
import { reconstruct, toNotesTxt } from "./notes.mjs";

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const opt = (name, dflt) => {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : dflt;
};
if (!file || !opt("bpm")) {
  console.error("usage: node tools/nsf/dump.mjs song.nsf --bpm N [--song N] [--seconds N] [--ts 4/4] [--title name]");
  process.exit(1);
}
const nsf = parseNSF(readFileSync(file));
console.error(`# ${nsf.name} — ${nsf.artist} (${nsf.songs} songs, banked: ${nsf.banked})`);
const song = +opt("song", nsf.startSong);
const seconds = +opt("seconds", 60);
const [tsNum, tsDen] = opt("ts", "4/4").split("/").map(Number);
const {apuLog, frames, frameSec} = runNSF(nsf, song, seconds);
const events = reconstruct(apuLog, frames, frameSec);
process.stdout.write(toNotesTxt(events, {
  frames, frameSec,
  bpm: +opt("bpm"),
  tsNum, tsDen,
  title: opt("title", `${nsf.name} song ${song}`),
}));
