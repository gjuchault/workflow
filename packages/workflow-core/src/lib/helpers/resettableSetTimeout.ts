export type ResettableSetTimeout = {
  readonly run: () => void;
  readonly reset: () => void;
  readonly setHandler: (newHandler: () => void) => void;
};

export function buildResettableSetTimeout({
  delay,
}: {
  delay: number;
}): ResettableSetTimeout {
  let ref: NodeJS.Timeout;

  let handler: () => void;

  function setHandler(newHandler: () => void) {
    handler = newHandler;
  }

  function run() {
    ref = setTimeout(handler, delay);

    return ref;
  }

  function reset() {
    clearTimeout(ref);
    run();
  }

  return { run, setHandler, reset };
}
