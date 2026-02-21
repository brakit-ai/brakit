# Telemetry

> **TL;DR:** Anonymous usage stats only. No code, no queries, no personal data.
> Opt out: `brakit telemetry off`

Brakit collects **anonymous** telemetry data to understand how the tool is used
and where to focus improvements. Participation is optional and you can opt out
at any time.

## What is collected

| Field | Example | Purpose |
|-------|---------|---------|
| `brakit_version` | `0.6.1` | Track version adoption |
| `node_version` | `v20.11.0` | Ensure compatibility |
| `os` | `darwin-24.6.0` | Platform support |
| `arch` | `arm64` | Platform support |
| `framework` | `nextjs` | Prioritize framework support |
| `package_manager` | `pnpm` | Testing prioritization |
| `is_custom_command` | `false` | Usage patterns |
| `first_session` | `true` | New vs returning users |
| `adapters_detected` | `["prisma", "clerk"]` | Adapter adoption |
| `request_count` | `142` | Usage volume |
| `error_count` | `3` | Error detection effectiveness |
| `query_count` | `87` | Query instrumentation usage |
| `fetch_count` | `24` | Fetch tracking usage |
| `insight_count` | `5` | Detection effectiveness |
| `finding_count` | `2` | Security rule effectiveness |
| `insight_types` | `["n1", "slow"]` | Prioritize insight categories |
| `rules_triggered` | `["exposed-secret"]` | Prioritize security rules |
| `endpoint_count` | `12` | App complexity |
| `avg_duration_ms` | `230` | Performance baselines |
| `slowest_endpoint_bucket` | `"1000-2000ms"` | Performance distribution |
| `tabs_viewed` | `["requests", "queries"]` | Dashboard UX improvements |
| `dashboard_opened` | `true` | Feature adoption |
| `explain_used` | `false` | Feature adoption |
| `session_duration_s` | `1823` | Session patterns |

## What is NEVER collected

- URLs, query strings, or request paths
- SQL queries or database contents
- Request/response bodies
- Source code or file contents
- API keys, tokens, or secrets
- Project names or file paths
- IP addresses (PostHog is configured to discard)
- Personally identifiable information

## How to opt out

**CLI:**

```sh
brakit telemetry off
```

**Environment variable:**

```sh
export BRAKIT_TELEMETRY=false
```

**Verify status:**

```sh
brakit telemetry
```

## How it works

- Data is collected in memory during a session
- A single HTTPS request is sent to PostHog on shutdown
- The request is fire-and-forget (does not block process exit)
- Network failures are silently ignored
- An anonymous UUID is stored in `~/.brakit/config.json`
- No third-party SDK is used — just a single `fetch()` call

## Source code

The telemetry implementation is at [`src/telemetry/index.ts`](src/telemetry/index.ts). It's ~140 lines.
