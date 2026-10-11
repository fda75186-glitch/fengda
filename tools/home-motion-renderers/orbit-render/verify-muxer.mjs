// Container smoke test only: not a website UI audit or a camera visual test.
// Usage: node verify-muxer.mjs input.ivf output.webm
import { readFile, writeFile } from 'node:fs/promises';
import { muxVideoWebM } from './webm-muxer.mjs';
const source = await readFile(process.argv[2]);
if (source.toString('ascii', 0, 4) !== 'DKIF') throw new Error('Expected an IVF fixture');
const codec = source.toString('ascii', 8, 12);
const width = source.readUInt16LE(12);
const height = source.readUInt16LE(14);
const rate = source.readUInt32LE(16);
const scale = source.readUInt32LE(20);
const frames = [];
let offset = source.readUInt16LE(6);
while (offset + 12 <= source.length) {
  const size = source.readUInt32LE(offset);
  const pts = Number(source.readBigUInt64LE(offset + 4));
  const data = new Uint8Array(source.subarray(offset + 12, offset + 12 + size));
  const timestamp = Math.round(pts * scale / rate * 1e6);
  frames.push({ timestamp, type: frames.length % 60 === 0 ? 'key' : 'delta', data });
  offset += 12 + size;
}
const fps = rate / scale;
const blob = muxVideoWebM({ frames, width, height, fps, durationSeconds: frames.length / fps, codec: codec === 'VP90' ? 'V_VP9' : 'V_VP8' });
await writeFile(process.argv[3], Buffer.from(await blob.arrayBuffer()));
console.log(JSON.stringify({ frames: frames.length, fps, duration: frames.length / fps, bytes: blob.size }));
