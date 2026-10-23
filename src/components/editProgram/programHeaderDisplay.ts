export function ScreenProgram_rangeForDisplay(values: number[]): string {
  if (values.length === 0) {
    return "0";
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${min}` : `${min}~${max}`;
}
