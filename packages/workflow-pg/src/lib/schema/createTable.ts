import {
  DatabaseTransactionConnectionType,
  IdentifierSqlTokenType,
} from 'slonik';

export type CreateTableDependencies = {
  i: (table: string) => IdentifierSqlTokenType;
  trx: DatabaseTransactionConnectionType;
};
