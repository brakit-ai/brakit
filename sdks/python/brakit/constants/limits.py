"""Numeric limits, transport configuration, and network/environment constants."""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Capture and storage limits
# ---------------------------------------------------------------------------
MAX_STORE_ENTRIES: int = 1_000
MAX_BODY_CAPTURE: int = 10_240
MAX_SQL_LENGTH: int = 2_000
MAX_HEALTH_ERRORS: int = 10

# Bounded capacity for the async task -> request-ID lookup dict. Prevents
# unbounded memory growth if tasks are never cleaned up.
MAX_TASK_CONTEXT_ENTRIES: int = 2_000

# Sanitization: minimum header value length before masking, and how many
# leading characters to leave visible in the masked output.
MASK_MIN_LENGTH: int = 8
MASK_VISIBLE_CHARS: int = 4

# ---------------------------------------------------------------------------
# Transport and forwarding configuration
# ---------------------------------------------------------------------------

# Flush when 20 events have accumulated. Balances between latency (smaller =
# faster delivery) and overhead (larger = fewer HTTP round-trips).
BATCH_SIZE: int = 20

# Flush every 100ms regardless of batch size, ensuring events appear in the
# dashboard within ~100ms even under low traffic.
FLUSH_INTERVAL_S: float = 0.1

TRANSPORT_TIMEOUT_S: int = 2
MAX_QUEUE_SIZE: int = 10_000

# Retry port discovery 30 times at 0.5s intervals (total ~15s). The Node.js
# server writes its port file on first request, which typically happens within
# a few seconds of startup.
PORT_RETRY_COUNT: int = 30
PORT_RETRY_INTERVAL_S: float = 0.5

# ---------------------------------------------------------------------------
# Port discovery and environment detection
# ---------------------------------------------------------------------------
BRAKIT_DIR_NAME: str = ".brakit"
PORT_FILE_NAME: str = "port"
ENV_PORT_KEY: str = "BRAKIT_PORT"
# Walk up to 10 parent directories when searching for the .brakit/port file.
# Most monorepo nesting depths are under 5; 10 covers extreme cases without
# unbounded filesystem traversal.
MAX_PARENT_DEPTH: int = 10

ENV_DISABLE_KEY: str = "BRAKIT_DISABLE"

PRODUCTION_SIGNALS: tuple[str, ...] = (
    "FLASK_ENV", "ENVIRONMENT", "NODE_ENV", "APP_ENV", "DJANGO_SETTINGS_MODULE",
)
# Tuple preserves insertion order for logging/display.
PRODUCTION_VALUES: tuple[str, ...] = ("production", "staging", "prod")
# Frozen set for O(1) membership tests in environment guards.
PRODUCTION_VALUES_SET: frozenset[str] = frozenset(PRODUCTION_VALUES)

CI_SIGNALS: tuple[str, ...] = (
    "CI", "GITHUB_ACTIONS", "GITLAB_CI", "JENKINS_URL", "CIRCLECI",
    "TRAVIS", "BUILDKITE", "CODEBUILD_BUILD_ID", "TF_BUILD",
    "BITBUCKET_BUILD_NUMBER", "DRONE", "SEMAPHORE",
)

CLOUD_SIGNALS: tuple[str, ...] = (
    "VERCEL", "VERCEL_ENV", "NETLIFY", "AWS_LAMBDA_FUNCTION_NAME",
    "AWS_EXECUTION_ENV", "ECS_CONTAINER_METADATA_URI", "GOOGLE_CLOUD_PROJECT",
    "GCP_PROJECT", "K_SERVICE", "AZURE_FUNCTIONS_ENVIRONMENT",
    "WEBSITE_SITE_NAME", "FLY_APP_NAME", "RAILWAY_ENVIRONMENT", "RENDER",
    "HEROKU_APP_NAME", "DYNO", "CF_INSTANCE_GUID", "CF_PAGES",
    "KUBERNETES_SERVICE_HOST",
)
