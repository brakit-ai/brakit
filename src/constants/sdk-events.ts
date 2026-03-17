/** SDK event type identifiers received from Python/external SDKs via the ingest API. */

export const SDK_EVENT_REQUEST = "request" as const;
export const SDK_EVENT_DB_QUERY = "db.query" as const;
export const SDK_EVENT_FETCH = "fetch" as const;
export const SDK_EVENT_LOG = "log" as const;
export const SDK_EVENT_ERROR = "error" as const;
export const SDK_EVENT_AUTH_CHECK = "auth.check" as const;
