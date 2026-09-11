const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// --- CRC32 (standard PNG checksum) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Draws a rounded-square mint glyph on a dark background, RGB, size x size.
function drawIcon(size) {
  const bgR = 0x0b, bgG = 0x0f, bgB = 0x0d;
  const fgR = 0x2f, fgG = 0xe6, fgB = 0xac;
  const raw = Buffer.alloc(size * (1 + size * 3)); // filter byte + RGB per pixel per row
  const cx = size / 2, cy = size / 2;
  const glyphHalf = size * 0.26;
  const barW = size * 0.10;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      // simple dollar-ish glyph: a vertical bar plus a horizontal bar (plus sign / coin slot look), rounded via distance check softened
      const inVert = Math.abs(dx) < barW && Math.abs(dy) < glyphHalf;
      const inHoriz = Math.abs(dy) < barW && Math.abs(dx) < glyphHalf;
      const inRing = (dx * dx + dy * dy) < (glyphHalf * 1.55) * (glyphHalf * 1.55) && (dx * dx + dy * dy) > (glyphHalf * 1.15) * (glyphHalf * 1.15);
      const isFg = inVert || inHoriz || inRing;
      const off = rowStart + 1 + x * 3;
      if (isFg) { raw[off] = fgR; raw[off + 1] = fgG; raw[off + 2] = fgB; }
      else { raw[off] = bgR; raw[off + 1] = bgG; raw[off + 2] = bgB; }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = path.join(__dirname, 'pwa-deploy');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), drawIcon(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), drawIcon(512));
console.log('wrote icon-192.png and icon-512.png to', outDir);
