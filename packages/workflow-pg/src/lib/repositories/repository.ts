import { DatabasePoolConnectionType, IdentifierSqlTokenType } from 'slonik';

export type Repository = {
  i: (table: string) => IdentifierSqlTokenType;
  pool: DatabasePoolConnectionType;
  ttlInMinutes: number;
};
