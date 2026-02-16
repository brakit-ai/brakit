# brakit

See what your app is really doing. One command, zero config.

brakit is a runtime request tracer for local development. It sits between your browser and your dev server, captures every request, and shows you exactly what each user action triggers — in plain language, not HTTP jargon.

## Quick Start

```bash
npx brakit dev
```

That's it. brakit auto-detects your framework, starts your dev server, and opens a dashboard at `/__brakit`.

## What You See

```
History Page                         1.6s   40% redundant

   Loaded user data ............. 657ms  ✓
   Loaded user data ............. 185ms  ⚠ duplicate
   Loaded video list ........... 1117ms  ✓
   Loaded video list ............ 273ms  ⚠ duplicate
   Loaded page .................. 128ms  ✓

   ⚠ 2 requests duplicated — same data loaded twice


Prompt Page                          2.3s   ✓ Clean

   Loaded user data ............. 530ms  ✓
   Loaded page ................... 42ms  ✓

   ✓ No issues
```

- **No HTTP methods** — "Loaded user data" not "GET /api/user"
- **No status codes** — ✓ or ✗ with tooltips for the details
- **Redundancy %** — instantly see how much of your page load is wasted
- **Click any row** — expand to see full headers, body, cURL, and replay

## How It Works

```
Browser → brakit (:3000) → Your dev server (:3001)
```

brakit is a transparent HTTP reverse proxy. Every request passes through it, gets captured, and is forwarded to your dev server unchanged. Your app works exactly the same — brakit just watches.

**Smart grouping:** Requests are grouped by origin page using the `referer` header. When you navigate from `/history` to `/prompt`, brakit automatically starts a new action group.

**Duplicate detection:** If the same endpoint is called twice in the same action, brakit flags it as redundant and calculates the waste percentage.

**Polling collapse:** Status polling (e.g., 22 calls to `/api/status`) is collapsed into a single "Polling status (22x, 40.1s)" entry.

## Supported Frameworks

- Next.js (auto-detected)
- Any HTTP dev server (specify port manually)

## Options

```bash
npx brakit dev              # Auto-detect framework and start
npx brakit dev -p 3000      # Custom proxy port
npx brakit dev -t 3001      # Custom target port
```

## License

MIT
