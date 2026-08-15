/**
 * 纯 Node 生成应用图标：resources/icon.png + resources/icon.ico（PNG 内嵌格式）。
 * 不依赖任何第三方包：手写 PNG 编码（zlib + CRC32）+ ICO 头。
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIZE = 256;

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}
function encodePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    pixels.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
function inCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

const R = (v) => Math.max(0, Math.min(255, Math.round(v)));
const lerp = (a, b, t) => a + (b - a) * t;

// 绘制：深色圆角底 + 蓝→青渐变面板 + 白色对话圆点 + 气泡小尾巴
const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    if (inRoundedRect(x, y, 4, 4, SIZE - 5, SIZE - 5, 48)) {
      r = 15; g = 23; b = 42; a = 255; // #0f172a 深色底
    }
    if (inRoundedRect(x, y, 36, 40, SIZE - 36, SIZE - 44, 34)) {
      const t = (y - 40) / (SIZE - 84);
      r = R(lerp(37, 56, t)); g = R(lerp(99, 189, t)); b = R(lerp(235, 248, t)); a = 255;
    }
    if (inCircle(x, y, 128, 112, 28)) {
      r = 248; g = 250; b = 252; a = 255; // 白色圆点
    }
    if (y >= 132 && y <= 162 && Math.abs(x - 128) <= (24 * (162 - y)) / 30 + 0.5) {
      r = 248; g = 250; b = 252; a = 255; // 气泡尾巴
    }
    const i = (y * SIZE + x) * 4;
    pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = a;
  }
}

const png = encodePng(SIZE, SIZE, pixels);

// ICO 文件（Vista+ 支持内嵌 PNG）
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count
const entry = Buffer.alloc(16);
entry[0] = 0; entry[1] = 0; // 256×256
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bpp
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12); // offset
const ico = Buffer.concat([header, entry, png]);

mkdirSync(path.join(__dirname, "..", "resources"), { recursive: true });
writeFileSync(path.join(__dirname, "..", "resources", "icon.png"), png);
writeFileSync(path.join(__dirname, "..", "resources", "icon.ico"), ico);
console.log(`已生成 resources/icon.png (${png.length} B) + resources/icon.ico (${ico.length} B)`);
