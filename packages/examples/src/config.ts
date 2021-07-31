let postgresConnectionUri = "postgres://root:root@127.0.0.1/workflow";

if (process.env.POSTGRES_CONNECTION_URI) {
  postgresConnectionUri = process.env.POSTGRES_CONNECTION_URI;
}

if (
  process.env.POSTGRES_HOST &&
  process.env.POSTGRES_PORT &&
  process.env.POSTGRES_USER &&
  process.env.POSTGRES_PASSWORD &&
  process.env.POSTGRES_DB
) {
  postgresConnectionUri = [
    "postgres://",
    process.env.POSTGRES_USER,
    ":",
    process.env.POSTGRES_PASSWORD,
    "@",
    process.env.POSTGRES_HOST,
    ":",
    process.env.POSTGRES_PORT,
    "/",
    process.env.POSTGRES_DB,
  ].join("");
}

export { postgresConnectionUri };
