# Claude Skills Guide

Skills are stored in `~/.claude/skills/` and invoked with a `/skill-name` slash command in any Claude Code session. They expand into structured prompts that guide Claude's behavior. Some skills can accept arguments after the command name.

---

## How to Access & Use Skills

**Syntax:**
```
/skill-name             # invoke with no arguments
/skill-name [args]      # invoke with arguments
```

You can also just describe what you want — Claude will recognize when a skill matches and invoke it. Skills are available in any project directory automatically.

---

## Skills Reference & Examples

### 1. `/commit`
Stage and commit current changes with a well-crafted [Conventional Commits](https://www.conventionalcommits.org/) message.

**Examples:**
```
/commit
/commit add payment gateway integration
/commit fix for the auth bug we discussed
```

**What it does:**
- Runs `git status` + `git diff` to understand changes
- Stages appropriate files
- Writes a message like `feat: add stripe payment integration` or `fix: resolve null pointer in auth middleware`
- Keeps subject under 72 characters; adds body if needed

**When to use:** Any time you're ready to commit — replaces manually writing `git add` + `git commit -m "..."`.

---

### 2. `/explain-code`
Explain how code works using analogies, ASCII diagrams, and step-by-step walkthroughs.

**Examples:**
```
/explain-code
/explain-code how does the authentication middleware work?
/explain-code walk me through the data pipeline in src/etl/
```

**What it does:**
1. Opens with an everyday analogy
2. Draws an ASCII flow/structure diagram
3. Walks through execution step-by-step
4. Highlights a common gotcha
5. Suggests potential improvements

**When to use:** Onboarding to a new codebase, understanding a complex module, or teaching someone else.

---

### 3. `/deep-research`
Thoroughly investigate a topic in the codebase — traces data flow, maps dependencies, and produces a structured report.

**Examples:**
```
/deep-research how does user authentication flow end-to-end?
/deep-research where does the order total get calculated?
/deep-research what touches the database connection pool?
```

**What it does:**
- Uses Glob + Grep to find all related files
- Reads and analyzes key implementations
- Traces control/data flow from entry to output
- Returns: **Overview**, **Key Files**, **Architecture**, **Potential Issues**

**When to use:** Before refactoring something you don't fully understand, debugging mysterious behavior, or auditing a subsystem.

---

### 4. `/fix-issue`
Fix a GitHub issue end-to-end: reads the issue, implements a fix, writes tests, and commits.

**Examples:**
```
/fix-issue 142
/fix-issue 87
```

**What it does:**
1. Runs `gh issue view <number>` to read the issue
2. Identifies acceptance criteria and edge cases
3. Researches the codebase for relevant files
4. Implements a minimal, focused fix
5. Writes/updates tests to cover the fix
6. Runs the test suite
7. Commits with format: `fix: description (#142)`

**When to use:** When you have a GitHub issue number and want to go from "open issue" to "committed fix" in one step.

---

### 5. `/pr-summary`
Summarize and review the current pull request with risk assessment and suggestions.

**Examples:**
```
/pr-summary
```
*(No arguments — reads the current branch's open PR automatically)*

**What it does:**
- Fetches `gh pr diff`, `gh pr view --comments`, and changed file list
- Returns:
  1. **Overview**: One-sentence summary
  2. **Changes by area**: Grouped by component/feature
  3. **Key decisions**: Notable architectural choices
  4. **Risk assessment**: Low/medium/high with rationale
  5. **Testing**: Coverage gaps
  6. **Suggestions**: Concerns worth addressing

**When to use:** Before requesting a review, writing a PR description, or doing a quick self-review.

---

### 6. `/simplify-code`
Refactor code to be cleaner, more readable, and less over-engineered — while preserving behavior.

**Examples:**
```
/simplify-code src/utils/dateHelpers.ts
/simplify-code the checkout form validation logic
/simplify-code this function is too nested and hard to follow
```

**What it does:**
1. Identifies nested logic, long functions, repeated patterns, unclear naming
2. Applies: early returns, guard clauses, extracted helpers, better names, removes dead code
3. Preserves the exact same behavior
4. Shows before/after clearly
5. Notes any trade-offs (e.g., if simplification reduces flexibility)

**When to use:** After a feature is working but the code feels messy, or during code review when something is hard to follow.

---

### 7. `/api-review`
Audit REST or GraphQL API endpoints for consistency, security, and best practices.

**Examples:**
```
/api-review src/routes/
/api-review the /users endpoints
/api-review our entire REST API for a security audit
```

**What it checks:**
| Category | Examples |
|---|---|
| **Consistency** | Naming conventions, HTTP methods, pagination patterns |
| **Security** | Auth checks, input validation, sensitive data exposure, CORS |
| **Error handling** | Status codes, error format, helpful messages |
| **Performance** | N+1 queries, missing indexes, caching opportunities |
| **Documentation** | OpenAPI accuracy, request/response examples |

**When to use:** Before shipping a new API, during a security review, or when onboarding new API consumers.

---

### 8. `/codebase-visualizer`
Generate an interactive HTML tree view of your project with collapsible directories and file sizes.

**Examples:**
```
/codebase-visualizer
```
*(Runs from the current project root)*

**What it does:**
- Runs `python ~/.claude/skills/codebase-visualizer/scripts/visualize.py .`
- Creates `codebase-map.html` in the current directory
- Opens it in your default browser
- Shows: collapsible dirs, file sizes, color-coded file types, directory size totals

**When to use:** Exploring a new repo, identifying bloated directories, or getting a bird's-eye view of project structure.

---

## Quick Reference

| Command | Args? | Best for |
|---|---|---|
| `/commit` | optional context | Committing with good messages |
| `/explain-code` | optional target | Understanding unfamiliar code |
| `/deep-research` | topic/question | Investigating implementations |
| `/fix-issue` | issue number | End-to-end issue resolution |
| `/pr-summary` | none | Pre-review PR summaries |
| `/simplify-code` | file or description | Cleaning up messy code |
| `/api-review` | file/path/description | API audits |
| `/codebase-visualizer` | none | Project structure overview |

## Where Skills Live

```
~/.claude/skills/
├── api-review/SKILL.md
├── codebase-visualizer/SKILL.md
├── commit/SKILL.md
├── deep-research/SKILL.md
├── explain-code/SKILL.md
├── fix-issue/SKILL.md
├── pr-summary/SKILL.md
└── simplify-code/SKILL.md
```

Each `SKILL.md` is a plain markdown file with YAML frontmatter. You can open and edit them directly to customize behavior for your workflow.
