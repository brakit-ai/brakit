/** Minimal interface for a pg query config object */
export interface PgQueryConfig {
  text: string;
  values?: unknown[];
}

/** Minimal interface for pg query result with EventEmitter */
export interface PgQueryResult {
  on(event: string, fn: (result: { rowCount?: number }) => void): void;
}

/** Generic module shape — handles both default and named exports */
export interface LibraryModule {
  default?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Configuration for wrapQueryMethod to adapt per-driver differences */
export interface QueryPatchConfig {
  driver: string;
  extractSql: (args: unknown[]) => string | undefined;
  extractRowCount?: (result: unknown) => number | undefined;
  supportsEventEmitter?: boolean;
}
