const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** YYYY-MM-DD HH:mm in UTC+8, for anything shown to the user. */
export function formatBeijingTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }
  const shifted = new Date(date.getTime() + BEIJING_OFFSET_MS);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-` +
    `${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:` +
    `${pad(shifted.getUTCMinutes())}`
  );
}

/** Value for an <input type="datetime-local">, in UTC+8. */
export function beijingDateTimeLocalValue(date = new Date()): string {
  const shifted = new Date(date.getTime() + BEIJING_OFFSET_MS);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-` +
    `${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:` +
    `${pad(shifted.getUTCMinutes())}`
  );
}

/** ISO 8601 in UTC+8, for values written into frontmatter. */
export function toBeijingIso(value: string | Date): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed}T00:00:00+08:00`;
    }
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return normalizePublishedAt(trimmed) ?? trimmed;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }
  const shifted = new Date(date.getTime() + BEIJING_OFFSET_MS);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-` +
    `${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:` +
    `${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}+08:00`
  );
}

export function beijingIsoNow(): string {
  return toBeijingIso(new Date());
}

/** Reads a datetime-local value as Beijing time and returns ISO 8601. */
export function beijingInputToIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return undefined;
  }
  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  return `${withSeconds}+08:00`;
}

/**
 * Normalizes a frontmatter date. A date or datetime without an offset is
 * read as Beijing time, not UTC.
 */
export function normalizePublishedAt(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : toBeijingIso(value);
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00+08:00`;
  }

  const withT = trimmed.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(withT)) {
    const withSeconds = withT.length === 16 ? `${withT}:00` : withT;
    return `${withSeconds}+08:00`;
  }

  return withT;
}
