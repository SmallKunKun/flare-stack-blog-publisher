import { getFrontMatterInfo, parseYaml } from "obsidian";

export interface ParsedNote {
  frontmatter: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
}

export function parseNote(content: string): ParsedNote {
  const info = getFrontMatterInfo(content);
  let frontmatter: Record<string, unknown> = {};

  if (info.exists) {
    try {
      const parsed = parseYaml(info.frontmatter);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        frontmatter = parsed as Record<string, unknown>;
      }
    } catch {
      // A malformed frontmatter block must not stop a publish; the body is
      // still readable, and the plugin writes metadata back as YAML.
    }
  }

  const rawBody = info.exists ? content.slice(info.contentStart) : content;
  return {
    frontmatter,
    body: rawBody.replace(/^\r?\n/, ""),
    hasFrontmatter: info.exists,
  };
}

export function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

export function stringList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of values) {
    const raw = stringValue(item);
    if (!raw) continue;
    for (const part of raw.split(",")) {
      const name = part.trim().replace(/^#/, "");
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(name);
    }
  }

  return result;
}

export function noteTitle(
  frontmatter: Record<string, unknown>,
  fallback: string,
): string {
  return stringValue(frontmatter.title) ?? fallback;
}

export function noteSummary(
  frontmatter: Record<string, unknown>,
): string | undefined {
  return (
    stringValue(frontmatter.summary) ??
    stringValue(frontmatter.description) ??
    undefined
  );
}

export function noteSlug(
  frontmatter: Record<string, unknown>,
): string | undefined {
  return stringValue(frontmatter.slug);
}

export function notePostId(
  frontmatter: Record<string, unknown>,
): number | undefined {
  return numberValue(frontmatter.fsb_post_id);
}

export function noteTags(frontmatter: Record<string, unknown>): string[] {
  const merged = [
    ...stringList(frontmatter.tags),
    ...stringList(frontmatter.tag),
  ];
  const seen = new Set<string>();
  return merged.filter((tag) => {
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function noteCategory(
  frontmatter: Record<string, unknown>,
): string | undefined {
  const category = stringValue(frontmatter.category);
  if (category) return category;

  const categories = frontmatter.categories;
  if (Array.isArray(categories)) return stringValue(categories[0]);
  return stringValue(categories);
}
