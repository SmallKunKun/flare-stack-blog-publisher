const CODE_SEGMENT =
  /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

/**
 * Runs `transform` on the prose between code spans and fenced code blocks,
 * leaving the code itself untouched.
 */
export async function mapOutsideCode(
  input: string,
  transform: (text: string) => Promise<string>,
): Promise<string> {
  const parts = input.split(CODE_SEGMENT);
  for (let index = 0; index < parts.length; index += 2) {
    parts[index] = await transform(parts[index] ?? "");
  }
  return parts.join("");
}
