export function getDateIn(from: Date, minutes: number) {
  return new Date(from.getDate() + minutes * 60 * 1000).toISOString();
}
