/** Layout dimensions and waterfall chart configuration. */

// Waterfall chart
export const WF_LABEL_WIDTH_PX = 180;
export const WF_DUR_WIDTH_PX = 56;
export const WF_TICK_COUNT = 5;
export const WF_MIN_REQ_BAR_PCT = 0.5;
export const WF_MIN_SUB_BAR_PCT = 1.5;

/**
 * When detecting whether sub-event timestamps share the same time base as
 * their parent request, we check if the first sub-event's timestamp is
 * within this factor of the request duration. A large difference indicates
 * the sub-event uses Date.now() while the request uses performance.now().
 */
export const WF_TIME_BASE_TOLERANCE = 10;

/** Maximum left% for a sub-event bar to prevent edge overflow. */
export const WF_MAX_LEFT_PCT = 95;

/** Spread factor for proportional positioning when time bases differ. */
export const WF_PROPORTIONAL_SPREAD = 85;

// Scatter chart (performance view)
export const SCATTER_CHART_HEIGHT_PX = 240;
export const RECENT_REQUESTS_LIMIT = 50;
export const CLICK_TOLERANCE_PX = 16;
