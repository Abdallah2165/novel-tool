import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

const IV_LENGTH = 12;

function deriveKey() {
  return createHash("sha256").update(env.ENCRYPTION_KEY).digest();
}

export function encryptString(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptString(payload: string) {
  const input = Buffer.from(payload, "base64");
  const iv = input.subarray(0, IV_LENGTH);
  const authTag = input.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = input.subarray(IV_LENGTH + 16);
  const key = deriveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function encryptRecord(record: Record<string, string>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, encryptString(value)]));
}

export function decryptRecord(record: unknown) {
  if (!record || typeof record !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).map(([key, value]) => [key, decryptString(String(value))]),
  );
}
