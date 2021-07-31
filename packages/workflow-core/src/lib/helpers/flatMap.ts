export function flatMap<Item, Reshaped>(
  array: Item[],
  callbackfn: (value: Item, index: number, array: Item[]) => Reshaped[]
): Reshaped[] {
  return Array.prototype.concat(...array.map(callbackfn));
}
