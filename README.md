# Brakit

Multi-dimensional code security scanner that detects compound vulnerabilities.

Most scanners find individual issues. Brakit correlates findings across Security, Reliability, Performance, and Privacy to surface vulnerabilities that only exist when multiple weaknesses combine.

## Quick Start

```bash
npx brakit scan
```

Zero config. Auto-detects your stack and loads the right plugins.

## Supported Stacks

- Next.js (App Router + Pages Router)
- Prisma
- Supabase
- NextAuth / Clerk

More coming soon.

## How It Works

```
Source Code → AST Parsing → File Role Classification → Pattern Analysis → Cross-Pillar Correlation → Score
```

Each layer builds on the one below. Layers 1-5 are free (static analysis). No data leaves your machine.

## License

MIT
