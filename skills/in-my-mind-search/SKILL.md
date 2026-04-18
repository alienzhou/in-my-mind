---
name: in-my-mind-search
description: "Search the user's personal external knowledge base (GitHub stars, Twitter/X saves, browser bookmarks) indexed by QMD. Use when the user asks about tools, libraries, or frameworks they may have saved, says 'I remember seeing...', is doing tech research, or asks 'what do I know about X'. Do NOT use for questions about the user's own code, personal affairs, or when they explicitly want web search."
---

# in-my-mind Search

Search the user's external knowledge base — a unified index of bookmarks, stars, and saves from across the internet.

> **IMPORTANT:** Never hallucinate — only answer from search results. Always cite the source (platform + item). If nothing is found, say so explicitly.

## What This Library Is

in-my-mind is the user's **external knowledge base**: content they saw, found valuable, and saved — but didn't study deeply. It collects from:

- **GitHub Stars** — repos the user found interesting or useful
- **Twitter/X saves** — tweets, threads, opinions the user resonated with
- **Browser bookmarks** — pages the user wanted to revisit
- (More sources are added over time)

This is NOT the user's core knowledge base (that's Obsidian — deep research, personal thinking). This is the **breadth layer**: things they've seen, had an impression of, and might need again someday.

The content is raw — original READMEs, web pages, tweets converted to Markdown. No user annotations, no deep analysis. But every item represents a signal: **the user once thought this was worth saving**.

## When to Search

### High-value triggers — search proactively

- User asks about **tools, libraries, or frameworks** → likely starred or bookmarked
- User says "I remember seeing something about..." or "I saved something on..." → direct recall request
- User is doing **tech research or comparing solutions** → their past saves are relevant context
- User discusses an **open-source project or technical concept** → may have starred related repos
- User asks "what do I know about X" or "have I seen anything about X" → explicit knowledge query

### Low-value triggers — don't bother searching

- Purely personal questions (schedule, feelings, relationships)
- Questions about the user's own code or current project (use the codebase, not this library)
- General knowledge questions with no connection to the user's interests
- When the user explicitly says they want web search results, not personal saves

### The judgment call

Ask yourself: **"Would the user's past browsing and saving behavior contain useful signal for this question?"** If yes, search. If unclear, a quick search costs little — do it. If clearly no, skip it.

## How to Search

The index is powered by QMD (index name: `in-my-mind`). Run `qmd --help` for full CLI reference.

### Common commands

**Primary search — use this by default:**

```bash
qmd --index in-my-mind query "your question in natural language"
```

Hybrid search (keyword + vector + auto expansion + reranking). Best for most questions. Understands intent, not just keywords.

**Keyword search — for exact names and terms:**

```bash
qmd --index in-my-mind search "tokio"
```

Pure BM25. Use when looking for a specific project name, library name, or person. Faster, no LLM involved.

**Filter by source — narrow to one platform:**

```bash
qmd --index in-my-mind query "state management" -c github
qmd --index in-my-mind query "AI agents" -c twitter
```

The `-c` flag filters by collection (= source). Use when you know which platform is likely relevant, or when results are too noisy.

**Read full document — after finding a relevant result:**

```bash
qmd --index in-my-mind get raw/github/2025-03-15/some-project.md
```

Search returns snippets. Use `get` to load the full page when a snippet confirms relevance and you need more context.

**Check index health:**

```bash
qmd --index in-my-mind status
```

Use when search results seem off or incomplete. Shows collection stats, embedding coverage, and last update time.

### Search strategy by question type


| Question type                 | Command               | Why                                     |
| ----------------------------- | --------------------- | --------------------------------------- |
| Specific tool/project by name | `search` (keyword)    | Exact match, no ambiguity               |
| Conceptual exploration        | `query` (hybrid)      | Needs semantic understanding            |
| "What have I saved about X"   | `query`, then broaden | May need multiple angles                |
| Only GitHub projects          | `query -c github`     | Filter noise from other sources         |
| Only tweets/opinions          | `query -c twitter`    | Tweets have different signal than repos |


### Multi-angle search

When the first query doesn't surface enough, try:

1. Rephrase with synonyms or related terms
2. Search for the technology/concept name directly
3. Search for known authors or sources the user follows
4. Switch between `query` (semantic) and `search` (keyword) to cover different angles
5. Broaden or narrow scope with `-c` collection filters

## How to Interpret Results

### Source signals

Every result comes from a specific source. The source tells you the **nature of the save**:


| Source          | What it means                                                 |
| --------------- | ------------------------------------------------------------- |
| `github`        | User starred this repo — found the project noteworthy         |
| `twitter` / `x` | User saved this tweet — found the opinion/insight interesting |
| `bookmarks`     | User bookmarked this page — wanted to read or revisit later   |


### What results mean — and don't mean

- A result means **the user noticed this and thought it was worth saving**
- It does NOT mean the user deeply studied it, agrees with it, or is an expert on it
- GitHub stars especially: many are "looks cool, might use someday" — not endorsements
- Twitter saves: the user found the take interesting, but may not fully agree
- Treat results as **"the user has been exposed to this"**, not as the user's own opinion

### Presenting results

**Do:**

- Attribution: "Based on a GitHub project you starred..." / "From a tweet you saved..."
- Connect: relate what you found to the user's current question
- Synthesize: if multiple results are relevant, weave them into a coherent answer
- Suggest: "You starred several projects in this space — want me to compare them?"

**Don't:**

- Dump raw search results as a list
- Claim "you think X" based on a saved item — it's "you've seen X"
- Hallucinate details that aren't in the search results
- Present saves as authoritative expert opinions

## Priority Relative to Other Sources

When the user has multiple knowledge sources available:

1. **User's direct statements** — highest authority (what they tell you right now)
2. **Core knowledge base** (Obsidian) — the user's deep, curated thinking
3. **in-my-mind (this library)** — the user's broad exposure and interests
4. **Web search** — the open internet, no personal signal

in-my-mind sits between the user's own thinking and the open web. It's not as authoritative as their notes, but more personally relevant than a generic search.

## Quality Rules

- **Never hallucinate.** If the library doesn't have it, say so. "I didn't find anything in your saves about X" is a valid answer.
- **Cite the source.** Always tell the user where the result came from (which platform, which item).
- **Flag staleness.** Saved content may be outdated — a starred repo from 2 years ago might be archived. Note this when relevant.
- **Respect the gap.** The library only has what was saved. Absence of results doesn't mean the user doesn't know about something — they might know it from other channels.

## Tools Used

- `qmd --index in-my-mind query` — hybrid search (primary, recommended for most questions)
- `qmd --index in-my-mind search` — keyword BM25 search (for exact names/terms)
- `qmd --index in-my-mind get` — read a specific document in full
- `qmd --index in-my-mind status` — check index health and collection stats

