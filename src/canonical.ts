import { createHash } from "node:crypto";
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(source).filter((key) => source[key] !== undefined).sort().map((key) => [key, normalize(source[key])]));
  }
  return value;
}
export function canonicalJson(value: unknown): string { return JSON.stringify(normalize(value)); }
export function sha256(value: string | Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
export function hashCanonical(value: unknown): string { return sha256(canonicalJson(value)); }
