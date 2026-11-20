/**
 * A UUID-shaped name derived from the image bytes. The same bytes always
 * produce the same name, so republishing can find the already-uploaded Media
 * instead of uploading a duplicate.
 */
export async function imageUuidName(
  originalName: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const extension = originalName.split(".").pop()?.toLocaleLowerCase() ?? "";
  const uuid = formatUuid(await digest(bytes));
  return extension ? `${uuid}.${extension}` : uuid;
}

async function digest(bytes: ArrayBuffer): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const hash = await subtle.digest("SHA-256", bytes);
      return new Uint8Array(hash).slice(0, 16);
    } catch {
      // Fall through to the deterministic fallback below.
    }
  }
  return fallbackDigest(new Uint8Array(bytes));
}

/**
 * A small deterministic 128-bit hash, used only when Web Crypto is not
 * available. It keeps the same name for the same bytes.
 */
function fallbackDigest(bytes: Uint8Array): Uint8Array {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  let c = 0x85ebca6b;
  let d = 0xc2b2ae35;

  for (let index = 0; index < bytes.length; index += 1) {
    const value = bytes[index] ?? 0;
    a = Math.imul(a ^ value, 0x01000193);
    b = Math.imul(b ^ (value + index), 0x85ebca6b);
    c = Math.imul(c ^ (value ^ (index << 3)), 0xc2b2ae35);
    d = Math.imul(d ^ (value + (index << 8)), 0x27d4eb2f);
  }

  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  view.setUint32(0, a >>> 0);
  view.setUint32(4, b >>> 0);
  view.setUint32(8, c >>> 0);
  view.setUint32(12, d >>> 0);
  return out;
}

function formatUuid(bytes: Uint8Array): string {
  const value = bytes.slice(0, 16);
  value[6] = ((value[6] ?? 0) & 0x0f) | 0x40;
  value[8] = ((value[8] ?? 0) & 0x3f) | 0x80;

  const hex = [...value]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
