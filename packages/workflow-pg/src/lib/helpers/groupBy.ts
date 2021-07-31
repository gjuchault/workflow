export function groupBy<Item>(
  items: readonly Item[],
  iteratee: (value: Item) => string
): Map<string, Item[]> {
  return groupByWith(items, iteratee, (item) => item);
}

export function groupByWith<Item, TransformedItem>(
  items: readonly Item[],
  iteratee: (value: Item) => string,
  transformer: (value: Item) => TransformedItem
): Map<string, TransformedItem[]> {
  const result = new Map<string, TransformedItem[]>();

  for (const item of items) {
    const key = iteratee(item);

    const currentSet = result.get(key) ?? [];

    result.set(key, [...currentSet, transformer(item)]);
  }

  return result;
}
