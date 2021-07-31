export function rejectUnexpectedValue(label: string, input: never): never {
  throw new Error(`Unexpected value for ${label}, got: ${input}`);
}
