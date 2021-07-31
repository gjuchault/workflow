export function keyBy<Item>(
  items: readonly Item[],
  iteratee: (value: Item) => string
): Map<string, Item> {
  return keyByWith(items, iteratee, (item) => item);
}

export function keyByWith<Item, TransformedItem>(
  items: readonly Item[],
  iteratee: (value: Item) => string,
  transformer: (value: Item) => TransformedItem
): Map<string, TransformedItem> {
  const result = new Map<string, TransformedItem>();

  for (const item of items) {
    result.set(iteratee(item), transformer(item));
  }

  return result;
}
