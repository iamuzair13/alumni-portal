/**
 * Zero-dependency image dimension parser.
 * Reads PNG IHDR, JPEG SOF, GIF header, and WebP VP8/VP8L/VP8X headers
 * directly from the buffer — no sharp/jimp needed.
 */

export type ImageDimensions = {
  width: number;
  height: number;
  format: "png" | "jpeg" | "gif" | "webp";
};

export function getImageDimensions(buf: Buffer): ImageDimensions | null {
  if (!buf || buf.length < 24) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR width/height at bytes 16-24
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: "png" };
  }

  // GIF: "GIF87a"/"GIF89a", dims little-endian at bytes 6-10
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), format: "gif" };
  }

  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    const chunk = buf.toString("ascii", 12, 16);
    // VP8X extended
    if (chunk === "VP8X" && buf.length >= 30) {
      const width = 1 + buf.readUIntLE(24, 3);
      const height = 1 + buf.readUIntLE(27, 3);
      return { width, height, format: "webp" };
    }
    // VP8 lossy: SOF at byte 20, dims after 3-byte start code at 26-30
    if (chunk === "VP8 " && buf.length >= 30) {
      const width = buf.readUInt16LE(26) & 0x3fff;
      const height = buf.readUInt16LE(28) & 0x3fff;
      return { width, height, format: "webp" };
    }
    // VP8L lossless: signature 0x2f at 21, dims packed at 22-26
    if (chunk === "VP8L" && buf.length >= 26 && buf[21] === 0x2f) {
      const b = buf.readUInt32LE(22);
      const width = (b & 0x3fff) + 1;
      const height = ((b >> 14) & 0x3fff) + 1;
      return { width, height, format: "webp" };
    }
    return null;
  }

  // JPEG: FF D8 ... scan for SOF0/SOF2 (FF C0-FF CF except C4/C8/CC)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let pos = 2;
    while (pos + 9 < buf.length) {
      if (buf[pos] !== 0xff) { pos += 1; continue; }
      const marker = buf[pos + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(pos + 5), width: buf.readUInt16BE(pos + 7), format: "jpeg" };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { pos += 2; continue; }
      const segLen = buf.readUInt16BE(pos + 2);
      if (!segLen || segLen < 2) break;
      pos += 2 + segLen;
    }
    return null;
  }

  return null;
}

export function isPortraitImage(buf: Buffer): { ok: boolean; dims: ImageDimensions | null } {
  const dims = getImageDimensions(buf);
  return { ok: dims != null && dims.height > dims.width, dims };
}
