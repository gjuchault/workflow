export type Enqueue = (
  name: string,
  input: unknown,
  options?: EnqueueOptions
) => Promise<string | undefined>;

export type EnqueueOptions = {
  readonly processAt?: Date;
};
