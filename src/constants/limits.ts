export const MAX_REQUEST_ENTRIES = 1_000;
export const DEFAULT_MAX_BODY_CAPTURE = 10_240;
export const DEFAULT_API_LIMIT = 500;
export const MAX_TELEMETRY_ENTRIES = 1_000;
export const MAX_TAB_NAME_LENGTH = 32;
export const MAX_INGEST_BYTES = 10_485_760;
export const TERMINAL_TRUNCATE_LENGTH = 80;
export const SENSITIVE_MASK_MIN_LENGTH = 8;
export const SENSITIVE_MASK_VISIBLE_CHARS = 4;
export const MAX_JSON_BODY_BYTES = 65_536;
export const ANALYSIS_DEBOUNCE_MS = 300;
export const ISSUE_ID_HASH_LENGTH = 16;
export const ISSUES_DATA_VERSION = 2;
export const SENSITIVE_MASK_PLACEHOLDER = "****";

/** Length of the hex prefix used to hash project paths for data directories. */
export const PROJECT_HASH_LENGTH = 8;

/** Maximum array elements to scan in the exposed-secret rule. */
export const SECRET_SCAN_ARRAY_LIMIT = 5;

/** Maximum array elements to scan in PII detection (email/list traversal). */
export const PII_SCAN_ARRAY_LIMIT = 10;

/** Minimum string length to consider a value as a potential secret. */
export const MIN_SECRET_VALUE_LENGTH = 8;

/**
 * A response with this many top-level fields likely represents a full database
 * record (e.g. user profile) rather than a simple acknowledgment.
 */
export const FULL_RECORD_MIN_FIELDS = 5;

/** Minimum items in a list endpoint that must contain PII to flag. */
export const LIST_PII_MIN_ITEMS = 2;

/** Hard ceiling for the `limit` query parameter on API endpoints. */
export const MAX_API_LIMIT = 500;
