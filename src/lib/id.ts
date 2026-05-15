let counter = 0;

export function makeId(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${counter}${rand}`;
}
