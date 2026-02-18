import crypto from "node:crypto";

export async function hashAdminPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16);

  const N = 16384;
  const r = 8;
  const p = 1;
  const keylen = 64;

  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(plain, salt, keylen, { N, r, p }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}:${N},${r},${p},${keylen}`;
}

export async function verifyAdminPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  const raw = String(stored);
  if (!raw.startsWith("scrypt:")) return false;

  const parts = raw.split(":");
  if (parts.length !== 4) return false;
  const saltB64 = parts[1];
  const keyB64 = parts[2];
  const params = parts[3];

  const [nStr, rStr, pStr, keyLenStr] = params.split(",");
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  const keylen = Number(keyLenStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !Number.isFinite(keylen)) return false;
  if (keylen <= 0 || keylen > 128) return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  if (!salt.length || !expected.length) return false;

  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(plain, salt, keylen, { N, r, p }, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  }).catch(() => null);

  if (!derived) return false;
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}
