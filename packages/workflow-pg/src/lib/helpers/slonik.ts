import {
  ListSqlTokenType,
  QueryResultRowType,
  sql,
  TaggedTemplateLiteralInvocationType,
  TypeNameIdentifierType,
  UnnestSqlTokenType,
  ValueExpressionType,
} from 'slonik';

export type Fragment = TaggedTemplateLiteralInvocationType<QueryResultRowType>;

export type JsonPrimitive =
  | string
  | number
  | boolean
  | Date
  | JsonObject
  | JsonArray
  | null
  | undefined;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface JsonObject extends Record<string, JsonPrimitive> {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface JsonArray extends Array<JsonPrimitive> {}

type SlonikValueExpressionTypeOrJson =
  | ValueExpressionType
  | Date
  | JsonPrimitive;

export type ColumnDefinition<TRecord> = [keyof TRecord, TypeNameIdentifierType];

export const prepareBulkInsert = <
  TDatabaseRecord extends Record<string, SlonikValueExpressionTypeOrJson>,
  TRecord
>(
  columnDefinitions: readonly ColumnDefinition<TDatabaseRecord>[],
  records: readonly TRecord[],
  iteratee: (record: TRecord, i: number) => TDatabaseRecord
): {
  columns: ListSqlTokenType;
  rows: UnnestSqlTokenType;
} => {
  const headers = ensureStringArray(
    columnDefinitions.map(([columnName]) => columnName)
  );
  const columnTypes = columnDefinitions.map(([_, columnType]) => columnType);

  const rows = records.map((record, i) => {
    const databaseRecord = iteratee(record, i);
    return columnDefinitions.map(([columnName, columnType]) => {
      if (columnType === 'json' && databaseRecord[columnName]) {
        return JSON.stringify(databaseRecord[columnName]);
      }

      if (columnType === 'timestamptz' && databaseRecord[columnName]) {
        const date = new Date(
          ensureDateStringOrNumber(databaseRecord[columnName])
        );
        return date.toISOString();
      }

      return databaseRecord[columnName];
    });
  });

  return {
    columns: joinHeaders(headers),
    rows: sql.unnest(rows, columnTypes),
  };
};

function joinHeaders(headers: string[]): ListSqlTokenType {
  return sql.join(
    headers.map((header) => sql.identifier([header])),
    sql`, `
  );
}

function ensureStringArray(input: unknown): string[] {
  if (
    Array.isArray(input) &&
    input.every((input): input is string => typeof input === 'string')
  ) {
    return input;
  }

  throw new TypeError(`Expected string[], got ${typeof input}`);
}

function ensureDateStringOrNumber(input: unknown): string | number | Date {
  if (
    input instanceof Date ||
    typeof input === 'string' ||
    typeof input === 'number'
  ) {
    return input;
  }

  throw new TypeError(`Expected string | number | Date, got ${typeof input}`);
}
