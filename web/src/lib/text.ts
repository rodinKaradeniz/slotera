export function plural(
  count: number,
  singular: string,
  pluralForm?: string,
): string {
  const word = count === 1 ? singular : pluralForm ?? `${singular}s`;
  return `${count} ${word}`;
}
