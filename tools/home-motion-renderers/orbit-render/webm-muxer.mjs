// Minimal, finite-length WebM video muxer. Matroska/WebM element IDs follow
// https://www.webmproject.org/docs/container/ and the CELLAR element registry.
// VP8/VP9 video only, one non-laced SimpleBlock per encoded frame.
const utf8 = new TextEncoder();

function concat(parts) {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result;
}

function unsigned(value) {
  let remaining = BigInt(value);
  const bytes = [];
  do { bytes.unshift(Number(remaining & 255n)); remaining >>= 8n; } while (remaining > 0n);
  return Uint8Array.from(bytes);
}

function sizeVint(value) {
  const size = BigInt(value);
  let length = 1;
  while (size >= (1n << BigInt(7 * length)) - 1n) length++;
  if (length > 8) throw new Error('EBML element is too large');
  const result = new Uint8Array(length);
  let remaining = size;
  for (let i = length - 1; i >= 0; i--) { result[i] = Number(remaining & 255n); remaining >>= 8n; }
  result[0] |= 1 << (8 - length);
  return result;
}

function element(id, payload) {
  return concat([unsigned(id), sizeVint(payload.byteLength), payload]);
}

function uint(id, value) { return element(id, unsigned(value)); }
function string(id, value) { return element(id, utf8.encode(value)); }
function master(id, elements) { return element(id, concat(elements)); }
function float64(id, value) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, false);
  return element(id, bytes);
}

function simpleBlock(frame, clusterTimeMs) {
  const relative = Math.round(frame.timestamp / 1000) - clusterTimeMs;
  if (relative < -32768 || relative > 32767) throw new Error('WebM cluster time range exceeded');
  const header = new Uint8Array(4);
  header[0] = 0x81; // EBML VINT track number 1.
  new DataView(header.buffer).setInt16(1, relative, false);
  header[3] = frame.type === 'key' ? 0x80 : 0;
  return element(0xa3, concat([header, frame.data]));
}

export function muxVideoWebM({ frames, width, height, fps, durationSeconds, codec }) {
  if (!frames.length || frames[0].type !== 'key') throw new Error('WebM must begin with a keyframe');
  if (codec !== 'V_VP9' && codec !== 'V_VP8') throw new Error('This muxer only supports VP8/VP9');
  const ordered = [...frames].sort((a, b) => a.timestamp - b.timestamp);
  if (ordered[0].timestamp !== 0) throw new Error('WebM timestamps must begin at zero');
  const ebml = master(0x1a45dfa3, [
    uint(0x4286, 1), uint(0x42f7, 1), uint(0x42f2, 4), uint(0x42f3, 8),
    string(0x4282, 'webm'), uint(0x4287, 4), uint(0x4285, 2),
  ]);
  const info = master(0x1549a966, [
    uint(0x2ad7b1, 1_000_000), // TimecodeScale: one millisecond.
    float64(0x4489, durationSeconds * 1000),
    string(0x4d80, 'Starwhisper WebCodecs'), string(0x5741, 'Starwhisper Moon Camera Renderer'),
  ]);
  const tracks = master(0x1654ae6b, [master(0xae, [
    uint(0xd7, 1), uint(0x73c5, 1), uint(0x83, 1), uint(0x9c, 0),
    string(0x86, codec), string(0x536e, 'Moon camera orbit'),
    uint(0x23e383, Math.round(1_000_000_000 / fps)),
    master(0xe0, [uint(0xb0, width), uint(0xba, height), uint(0x9a, 0)]),
  ])]);
  const clusters = [];
  let clusterTime = 0;
  let blocks = [];
  for (const frame of ordered) {
    const frameTime = Math.round(frame.timestamp / 1000);
    const nextClusterTime = Math.floor(frameTime / 2000) * 2000;
    if (blocks.length && nextClusterTime !== clusterTime) {
      clusters.push(master(0x1f43b675, [uint(0xe7, clusterTime), ...blocks]));
      blocks = [];
    }
    clusterTime = nextClusterTime;
    blocks.push(simpleBlock(frame, clusterTime));
  }
  if (blocks.length) clusters.push(master(0x1f43b675, [uint(0xe7, clusterTime), ...blocks]));
  const segment = master(0x18538067, [info, tracks, ...clusters]);
  return new Blob([ebml, segment], { type: 'video/webm' });
}
