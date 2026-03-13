/** Request category constants used for filtering and grouping. */

export const CATEGORY_POLLING = "polling";
export const CATEGORY_STATIC = "static";
export const CATEGORY_AUTH_HANDSHAKE = "auth-handshake";
export const CATEGORY_AUTH_CHECK = "auth-check";
export const CATEGORY_MIDDLEWARE = "middleware";

/** Categories to skip when analyzing flow insights (auth/middleware noise). */
export const AUTH_SKIP_CATEGORIES: Record<string, number> = {
  [CATEGORY_AUTH_HANDSHAKE]: 1,
  [CATEGORY_AUTH_CHECK]: 1,
  [CATEGORY_MIDDLEWARE]: 1,
};
