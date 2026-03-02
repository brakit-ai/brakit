# Brakit Design Docs

Technical documentation for brakit contributors and anyone who wants to understand how it works.

## Start here

| Doc | What you'll learn |
|-----|------------------|
| [How Brakit Works](architecture.md) | The big picture — how brakit hooks into your app, captures telemetry, and serves the dashboard |
| [Safety Guarantees](safety.md) | The 5-layer system that ensures brakit never breaks your application |

## Core primitives

These are the foundational patterns that all brakit modules build on.

| Doc | What it covers |
|-----|---------------|
| [EventBus](event-bus.md) | Typed publish-subscribe channels for inter-module communication |
| [ServiceRegistry](service-registry.md) | Typed dependency injection replacing module-level singletons |

## Subsystems

Deep-dives into brakit's major subsystems.

| Doc | What it covers |
|-----|---------------|
| [Analysis Engine](analysis-engine.md) | How raw telemetry becomes actionable insights and security findings |
| [Dashboard](dashboard.md) | The self-contained UI at `/__brakit` — routing, API, SSE, and client architecture |
| [MCP Server](mcp.md) | AI assistant integration via Model Context Protocol |

## Extending brakit

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for step-by-step guides on adding:

- Database adapters (pg, mysql2, prisma, or your own)
- Security rules
- Insight rules
- MCP tools
- Language SDKs
