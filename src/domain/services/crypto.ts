import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getPlatform } from "../../infrastructure/platform/index.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

let masterKey: Buffer | null = null;

function getKeyPath(): string {
  const platform = getPlatform();
  const dataDir = platform.dataDir("database-mcp");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return join(dataDir, "master.key");
}

export function loadOrCreateKey(): Buffer {
  if (masterKey) return masterKey;

  const keyPath = getKeyPath();
  if (existsSync(keyPath)) {
    masterKey = readFileSync(keyPath);
  } else {
    masterKey = randomBytes(KEY_LENGTH);
    writeFileSync(keyPath, masterKey, { mode: 0o600 });
  }
  return masterKey;
}

export function encrypt(plaintext: string): string {
  const key = loadOrCreateKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (all base64)
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decrypt(ciphertext: string): string {
  const key = loadOrCreateKey();
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(":");

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}
