// Ported from admin-shared.jsx — initials + deterministic gradient.

const GRADIENTS: Array<[string, string]> = [
  ["#E7EDE3", "#3D5A3D"],
  ["#F4E9D6", "#B47B2B"],
  ["#F2DDD8", "#A33B2A"],
  ["#E1E7EE", "#3F5670"],
  ["#ECE8E0", "#3B3B33"],
  ["#E7EDE3", "#2A3F2A"],
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarGradientFor(name: string): [string, string] {
  return GRADIENTS[hash(name) % GRADIENTS.length];
}
