const PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
];

export function generateCategoryColors(values: (string | number)[]): Record<string, string> {
  const unique = Array.from(new Set(values.map((v) => String(v ?? 'None')))).filter(Boolean);
  const colorMap: Record<string, string> = {};

  unique.forEach((val, idx) => {
    colorMap[val] = PALETTE[idx % PALETTE.length];
  });

  return colorMap;
}
