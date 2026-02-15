# Brakit — Build Plan

Multi-dimensional code security scanner. Detects compound vulnerabilities across
Security, Reliability, Performance, and Privacy pillars.

Target stack: Next.js + Prisma + Supabase + Auth. TypeScript only. Fully open source.

Zero config: `npx brakit scan` auto-detects your stack, loads plugins, produces results.

---

## Architecture

```
ScanInput → [Layer 2: AST + Roles] → [Layer 1: Patterns] → [Layer 4: Correlation] → [Scorer] → ScanResult
```

- **Typed Pipeline** — Each layer is a pure function with strict input/output types. Testable in isolation.
- **Capability Registry** — Plugins register file roles, patterns, compound rules. Core is stack-agnostic.
- **Auto-detection** — Reads package.json, maps dependencies to built-in plugins. No config file needed.
- **Plugin helpers** — `definePattern()`, `defineFileRole()`, `defineCompoundRule()` minimize boilerplate.

---

## Phases

### Phase 0 — Project Scaffolding `[DONE]`

> Repo builds, tests run, CLI responds.

**Files created:**
- [x] `package.json` — ESM, bin field, deps (@swc/core, citty, picocolors, fast-glob, yaml)
- [x] `tsconfig.json` — strict, ESNext, bundler resolution
- [x] `tsup.config.ts` — entries: src/index.ts + bin/brakit.ts, ESM, dts, shebang injection
- [x] `vitest.config.ts` — globals, path aliases
- [x] `.gitignore`
- [x] `LICENSE` — MIT
- [x] `bin/brakit.ts` — citty CLI with scan + info subcommands
- [x] `src/index.ts` — public API stub
- [x] `src/cli/commands/scan.ts` — scan command stub
- [x] `src/cli/commands/info.ts` — info command stub

**Verified:**
- [x] `npm install` — clean install, 0 vulnerabilities
- [x] `npm run build` — produces dist/ with .js + .d.ts
- [x] `node dist/bin/brakit.js --version` — prints `0.1.0`
- [x] `node dist/bin/brakit.js --help` — prints usage with scan/info commands
- [x] `node dist/bin/brakit.js scan` — responds with placeholder message
- [x] `node dist/bin/brakit.js info` — responds with placeholder message

---

### Phase 1 — Core Contracts `[DONE]`

> Define every type and interface. The "kernel" that everything plugs into.
> No implementation logic — just the shapes that enforce the architecture.

**Files to create:**

`src/core/types/findings.ts`
- `Severity` — `'critical' | 'high' | 'medium' | 'low' | 'info'`
- `Confidence` — `'certain' | 'firm' | 'tentative'`
- `Pillar` — `'security' | 'reliability' | 'performance' | 'privacy'`
- `Finding` — single atomic issue (id, patternId, source, pillar, severity, confidence, message, filePath, line, metadata)
- `CompoundFinding` — cross-pillar correlation result (ruleId, severity, confidence, constituentFindings, rationale)

`src/core/types/analysis.ts`
- `FileRole` — union: `'api-route' | 'page' | 'layout' | 'middleware' | 'server-action' | 'db-query' | 'db-schema' | 'auth-config' | 'component' | 'utility' | 'config' | 'test' | 'unknown'`
- `FileAnalysis` — per-file result (filePath, roles, ast summary, annotations)
- `ASTSummary` — exports, imports, functions, directives
- `FunctionInfo`, `ImportInfo`, `ExportInfo`

`src/core/types/score.ts`
- `BrakitScore` — overall (0-100) + per-category breakdown
- `ScoreCategory` — name, score, weight, finding count
- `ScoreStats` — totals, by-severity, by-plugin

`src/core/types/config.ts`
- `BrakitConfig` — plugins, minSeverity, exclude, pluginOptions
- `ScanConfig` — resolved internal config
- `DEFAULT_CONFIG` — sensible defaults (exclude node_modules, dist, .next, tests)

`src/core/types/context.ts`
- `ProjectContext` — rootDir, framework, orm, auth, baas, packageManager, typescript, dependencies
- `StackInfo` — name, version, detected details (e.g., app vs pages router)

`src/core/plugin/types.ts`
- `BrakitPlugin` — name, version, fileRoles?, patterns?, compoundRules?, scoring?
- `FileRoleRule` — fileGlob, classify(context) => FileRole[]
- `FileRoleContext` — filePath, relativePath, contents, extension
- `AnalysisPattern` — description, fileGlob, pillar, severity, confidence, analyze(context) => Finding[]
- `PatternContext` — filePath, relativePath, contents, extension, roles, ast, fileAnalysis
- `CompoundRule` — description, requires (string[]), severity, correlate(context) => CompoundFinding[]
- `CompoundContext` — findingsByPattern, fileAnalyses, ruleId
- `ScoringContribution` — category, weight

`src/core/plugin/helpers.ts`
- `definePattern(opts)` — returns `AnalysisPattern` with defaults filled
- `defineFileRole(opts)` — returns `FileRoleRule`
- `defineCompoundRule(opts)` — returns `CompoundRule`

`src/core/pipeline/types.ts`
- `ScanInput` — rootDir, filePaths, fileContents (ReadonlyMap), config
- `Layer2Result` — input + fileAnalyses + fileAnalysisMap
- `Layer1Result` — Layer2Result + findings
- `Layer4Result` — Layer1Result + compoundFindings
- `ScanResult` — Layer4Result + score + metadata

**Verified:**
- [x] `npm run typecheck` passes — zero errors, no circular dependencies
- [x] Types are importable and IDE autocomplete works
- [x] Test: construct Finding, CompoundFinding, FileAnalysis, ScanResult — 9 tests pass
- [x] Plugin helpers (definePattern, defineFileRole, defineCompoundRule) fill defaults correctly
- [x] `npm run build` succeeds

---

### Phase 2 — Registry + Auto-Detection `[DONE]`

> Plugin system works. Plugins register, resolve, and auto-detect from package.json.

**Files to create:**

`src/core/plugin/registry.ts`
- `RegistryBuilder` class
  - `addPlugin(plugin: BrakitPlugin)` — register, throw on duplicate name
  - `resolve(): ResolvedRegistry` — qualify all IDs (e.g., `'raw-query'` → `'prisma:raw-query'`), validate compound rule requirements, freeze
- `ResolvedRegistry` — immutable maps: plugins, fileRoles, patterns, compoundRules, scoring

`src/core/plugin/auto-detect.ts`
- `detectPlugins(rootDir: string): Promise<BrakitPlugin[]>`
- Reads package.json dependencies
- Maps known packages to built-in plugins:
  - `next` → nextjs plugin
  - `@prisma/client` / `prisma` → prisma plugin
  - `@supabase/supabase-js` → supabase plugin
  - `next-auth` / `@clerk/nextjs` / `@auth/core` → auth plugin
- Always loads compound rules plugin
- Returns only plugins for detected stack

`src/core/types/context.ts` — implement `detectProjectContext()`
- Read + parse package.json
- Detect framework (Next.js version, app vs pages router via directory check)
- Detect ORM (Prisma — find schema path)
- Detect auth provider
- Detect BaaS (Supabase)
- Detect package manager (lock file)
- Detect TypeScript (tsconfig.json)

`src/cli/commands/info.ts` — real implementation
- Run detectProjectContext, print results

`tests/core/registry.test.ts`
- Register mock plugins → resolve → IDs are qualified
- Compound rule with valid requirements → included
- Compound rule with missing requirements → warned, skipped
- Duplicate plugin name → throws

**Verify:**
- [x] `npm test` — 22 tests pass (7 registry + 6 auto-detect + 9 types)
- [x] `npm run build && node dist/bin/brakit.js info` — detects full stack in fixture project
- [x] Auto-detect returns correct plugins for nextjs-app and minimal-next fixtures

---

### Phase 3 — Layer 2: AST Parsing + File Roles `[DONE]`

> Parse every file, classify its role, extract structure.
> Produces FileAnalysis[] that all downstream layers depend on.

**Files to create:**

`src/core/layers/layer2-ast/parser.ts`
- `parseFile(filePath, source): Module | null`
- SWC `parseSync` — handles .ts, .tsx, .js, .jsx
- Returns null on parse failure (log warning, never crash)

`src/core/layers/layer2-ast/extractors/functions.ts`
- `extractFunctions(ast: Module): FunctionInfo[]`
- Walk AST: function declarations, arrow functions assigned to variables, exported functions, async functions

`src/core/layers/layer2-ast/extractors/imports.ts`
- `extractImports(ast: Module): ImportInfo[]`
- Named imports, default imports, namespace imports, source paths

`src/core/layers/layer2-ast/extractors/exports.ts`
- `extractExports(ast: Module): ExportInfo[]`
- Named exports, default exports, re-exports

`src/core/layers/layer2-ast/role-classifier.ts`
- `classifyFile(filePath, contents, ast, registry): FileRole[]`
- Run all FileRoleRule entries from registry against the file
- Merge results (a file can have multiple roles)

`src/core/layers/layer2-ast/index.ts`
- Layer 2 entry: `runLayer2(input: ScanInput, registry: ResolvedRegistry): Promise<Layer2Result>`
- For each file: read → parse → classify → extract → build FileAnalysis
- Build fileAnalysisMap (Map<string, FileAnalysis>) for O(1) lookups

`src/plugins/nextjs/index.ts` — file role rules only (patterns come in Phase 4)
- `api-route`: path matches `app/**/route.{ts,js}` or `pages/api/**`
- `page`: path matches `app/**/page.{tsx,jsx}`
- `layout`: path matches `app/**/layout.{tsx,jsx}`
- `middleware`: path matches `middleware.{ts,js}` at root
- `server-action`: file contains `'use server'` directive
- `client-component`: file contains `'use client'` directive

`src/plugins/prisma/index.ts` — file role rules only
- `db-query`: file imports from `@prisma/client`
- `db-schema`: file is `.prisma`

`src/plugins/supabase/index.ts` — file role rules only
- `db-query`: file imports from `@supabase/supabase-js`

`src/plugins/auth/index.ts` — file role rules only
- `auth-config`: file imports from `next-auth` / `@clerk/nextjs` / `@auth/core`

`tests/core/layer2.test.ts`
- Parse .ts file → valid AST, functions extracted
- Parse .tsx file → valid AST, JSX handled
- Parse invalid file → returns null, no crash
- Classify `app/api/users/route.ts` → includes `api-route`
- Classify `middleware.ts` → includes `middleware`
- Classify file with `'use client'` → includes `client-component`
- Classify file importing `@prisma/client` → includes `db-query`
- Extract functions: named, arrow, async, exported
- Extract imports: named, default, source paths

**Verify:**
- [x] `npm test` — 50 tests pass (28 layer2 + 7 registry + 6 auto-detect + 9 types)
- [x] `npm run typecheck` — no type errors
- [x] Layer 2 runs standalone: ScanInput → Layer2Result with classified files
- [x] Behavior-first classification: files classified by imports/exports/directives, not path conventions
- [x] FileRoleContext enriched with ASTSummary for accurate classification
- [x] Plugin factories accept ProjectContext for version-aware configuration

---

### Phase 4 — Layer 1: Pattern Engine + Plugins `[DONE]`

> Pattern engine runs registered patterns against files. Each plugin contributes patterns.
> This is the heart of brakit — where vulnerabilities are actually detected.
> External analyzers (npm-audit, semgrep, eslint) deferred to later phase.

**Files created:**

`src/core/layers/layer1-static/pattern-runner.ts`
- `runPatterns(layer2Result, registry): Finding[]`
- For each pattern in registry: filter files by fileGlob via picomatch
- Run `pattern.analyze()`, inflate PatternMatch → Finding with qualified patternId
- Counter-based unique IDs

`src/core/layers/layer1-static/deduplicator.ts`
- `deduplicateFindings(findings): Finding[]`
- Key: `patternId:filePath:line` → keeps highest confidence

`src/core/layers/layer1-static/index.ts`
- Layer 1 entry: `runLayer1(layer2Result, registry): Layer1Result`
- Runs patterns, deduplicates, extends Layer2Result with findings

`src/core/plugin/types.ts` — added `PatternMatch` interface
- Lighter return type for pattern authors (title, message, line, optional overrides)
- Engine inflates to full Finding with id, patternId, source, defaults

`src/plugins/nextjs/patterns.ts` — 8 patterns:
- `unprotected-route` — SEC/high: API route without auth check
- `unvalidated-input` — SEC/high: request.json()/searchParams without validation
- `dangerous-html` — SEC/high: dangerouslySetInnerHTML usage (confidence: certain)
- `no-error-handling` — REL/medium: async API route without try/catch
- `missing-use-client` — REL/medium: client hooks without 'use client' directive
- `server-import-in-client` — SEC/critical: server-only imports in 'use client' files
- `exposed-env` — SEC/medium: NEXT_PUBLIC_ with sensitive names
- `large-client-component` — PERF/low: 'use client' file > 200 lines

`src/plugins/prisma/patterns.ts` — 3 patterns:
- `raw-query` — SEC/critical: $queryRaw/$executeRaw usage (confidence: certain)
- `no-pagination` — PERF/medium: findMany() without take/skip
- `select-all` — PRIV/medium: findMany/findFirst/findUnique without select

`src/plugins/supabase/patterns.ts` — 2 patterns:
- `service-role-client` — SEC/critical: service_role/SUPABASE_SERVICE_ROLE_KEY in source
- `no-rls` — SEC/medium: .from() queries without auth helper imports

`src/plugins/auth/patterns.ts` — 2 patterns:
- `hardcoded-secret` — SEC/critical: hardcoded JWT/secret strings (long base64, key patterns)
- `missing-session-check` — SEC/high: API route without session validation

`tests/core/layer1.test.ts` — 23 tests:
- Each pattern tested with vulnerable + safe code (false positive checks)
- Deduplicator: removes duplicates on same line, keeps different patterns
- Integration: multi-plugin scan detects cross-cutting vulnerabilities
- Safe code produces zero findings

**Verified:**
- [x] `npm test` — 73 tests pass (23 layer1 + 28 layer2 + 7 registry + 6 auto-detect + 9 types)
- [x] `npm run typecheck` — no type errors
- [x] `npm run build` — succeeds
- [x] Layer 1 runs standalone: Layer2Result → Layer1Result with findings
- [x] All 15 patterns correctly flag vulnerable code and pass safe code

---

### Phase 5 — Layer 4: Correlation + Scorer `[TODO]`

> Cross-plugin compound findings + Brakit Score calculation.
> This is brakit's differentiator — the "compound vulnerability" concept.

**Files to create:**

`src/core/layers/layer4-correlation/grouper.ts`
- `groupByPatternId(findings): Map<string, Finding[]>`
- `groupByFile(findings): Map<string, Finding[]>`

`src/core/layers/layer4-correlation/matcher.ts`
- `matchCompoundRules(findings, fileAnalyses, registry): CompoundFinding[]`
- For each compound rule: check if ALL required patternIds have at least one finding
- If yes: build CompoundContext, call rule.correlate()
- Skip rules where requirements can't be met

`src/core/layers/layer4-correlation/index.ts`
- Layer 4 entry: `runLayer4(input: Layer1Result, registry): Promise<Layer4Result>`

`src/core/layers/scorer/calculator.ts`
- Severity deduction weights: critical=15, high=8, medium=3, low=1, info=0
- Pillar weights: security=0.35, reliability=0.25, performance=0.20, privacy=0.20
- Compound multiplier: 1.5x
- `calculateScore(findings, compounds): BrakitScore`
- Per-pillar: 100 - sum(deductions), clamped to [0, 100]
- Overall: weighted average of pillar scores

`src/core/layers/scorer/index.ts`
- Scorer entry: `runScorer(input: Layer4Result): ScanResult`

`src/plugins/compounds/index.ts` — 5 cross-plugin compound rules:
- `unprotected-raw-query` — CRITICAL: nextjs:unprotected-route + prisma:raw-query in same file
- `unvalidated-db-write` — CRITICAL: nextjs:unvalidated-input + prisma:raw-query in same file
- `unprotected-no-rls` — HIGH: nextjs:unprotected-route + supabase:no-rls in same file
- `no-auth-db-access` — HIGH: auth:missing-session-check + prisma:select-all in same file
- `exposed-service-key` — CRITICAL: supabase:service-role-client (standalone escalation, any file)

`src/plugins/compounds/__tests__/compounds.test.ts`
- Two findings in same file matching rule → compound produced
- Two findings in different files → no compound
- Missing required pattern → rule skipped silently

`tests/core/layer4.test.ts`
- Matcher with mock findings + rules
- Grouper produces correct groups

`tests/core/scorer.test.ts`
- 0 findings → score 100
- 1 critical finding → score ~85
- 1 compound critical → score ~78
- Multiple findings across pillars → weighted correctly
- Score never below 0

**Verify:**
- [ ] `npm test` — all correlation and scorer tests pass
- [ ] Compound rules correctly correlate findings from different plugins
- [ ] Missing plugin → compound rule silently skipped (no crash)
- [ ] Score math is deterministic and correct

---

### Phase 6 — Pipeline + CLI + Output `[TODO]`

> Wire everything together. `npx brakit scan` produces real results end-to-end.

**Files to create:**

`src/core/pipeline/runner.ts`
- `runPipeline(rootDir, config?): Promise<ScanResult>`
- Full flow:
  1. Load .brakit.yaml config (if exists), merge with defaults
  2. detectProjectContext()
  3. detectPlugins() → auto-load stack plugins
  4. RegistryBuilder.resolve()
  5. fast-glob files, pre-load contents
  6. PARALLEL: Layer 2 + external analyzers (npm-audit, semgrep, eslint)
  7. Layer 1: run patterns using Layer 2 results
  8. Merge all findings
  9. Layer 4: correlation
  10. Scorer
  11. Return ScanResult

`src/cli/index.ts` — wire citty commands

`src/cli/commands/scan.ts` — real implementation
- Parse args: dir, --json, --min-severity, --verbose
- Call runPipeline()
- Render output (terminal or JSON)
- Exit non-zero if score below threshold

`src/cli/output/terminal.ts` — rich terminal output
- Header: brakit version + detected stack
- Analyzer status (which ran, which skipped)
- Score display: overall + 4 pillar bars (colored: green 80+, yellow 50-79, red <50)
- Compound findings section (highlighted prominently)
- Findings grouped by severity
- Summary line: X findings | Y compounds | Z files | duration

`src/cli/output/json.ts`
- JSON.stringify(ScanResult) with date handling

`src/index.ts` — public API
- `scan(rootDir, config?)` — programmatic entry point
- `defineConfig(config)` — config helper
- Re-export all public types

`tests/fixtures/vulnerable-nextjs-app/`
- `package.json` — deps: next, @prisma/client, @supabase/supabase-js, next-auth
- `app/api/users/route.ts` — unprotected, unvalidated, uses $queryRaw
- `app/api/posts/route.ts` — unprotected, no error handling
- `app/dashboard/page.tsx` — 'use client', renders user data
- `lib/db.ts` — prisma findMany without select, no pagination
- `lib/supabase.ts` — service_role key usage
- `middleware.ts` — basic middleware

`tests/integration/scan.test.ts`
- Full scan on fixture → expected number of findings
- Specific patterns detected (unprotected-route, raw-query, etc.)
- Compound findings produced (unprotected-raw-query, etc.)
- Score in expected range
- JSON output is valid

**Verify:**
- [ ] `npm test` — all tests pass including integration
- [ ] `npm run build && node dist/bin/brakit.js scan tests/fixtures/vulnerable-nextjs-app/` — produces findings, compounds, score
- [ ] `node dist/bin/brakit.js scan --json tests/fixtures/vulnerable-nextjs-app/` — valid JSON output
- [ ] `node dist/bin/brakit.js info tests/fixtures/vulnerable-nextjs-app/` — shows detected stack
- [ ] Terminal output is colored and readable
- [ ] `npm run typecheck` — zero errors
- [ ] `npm pack` — produces valid .tgz package

---

## Reference

### Pipeline data flow
```
                    ┌─ npm-audit ──────┐
ScanInput ──┬──→ Layer 2 (AST+Roles) ─┼──→ Layer 1 (Patterns) ──→ Layer 4 (Correlation) ──→ Scorer ──→ ScanResult
            │                          │
            ├─ semgrep (optional) ─────┘
            └─ eslint-security ────────┘
```

### Auto-detection mapping
```
package.json dep          →  Plugin loaded
─────────────────────────────────────────
next                      →  nextjs
@prisma/client | prisma   →  prisma
@supabase/supabase-js     →  supabase
next-auth | @clerk/nextjs →  auth
(always)                  →  compounds
```

### Score formula
```
Per finding:  deduction = severity_weight * confidence_factor
Per compound: deduction = severity_weight * confidence_factor * 1.5

Pillar score  = max(0, 100 - sum_of_deductions)
Overall score = security*0.35 + reliability*0.25 + performance*0.20 + privacy*0.20
```

### Adding a new plugin
```typescript
// src/plugins/express/index.ts
import { defineFileRole, definePattern } from '@/core/plugin/helpers';
import type { BrakitPlugin } from '@/core/plugin/types';

export function express(): BrakitPlugin {
  return {
    name: 'express',
    version: '0.1.0',
    fileRoles: { /* ... */ },
    patterns: { /* ... */ },
  };
}
// Then add to auto-detect.ts: "express" → express()
```
