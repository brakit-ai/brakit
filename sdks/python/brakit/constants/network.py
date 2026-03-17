"""Port discovery and environment detection."""
from __future__ import annotations

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
