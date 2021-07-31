export function rejectUnexpectedValue(name: string, value: never): never {
  throw new Error(`Non-expected value for ${name}: ${value}`);
}
