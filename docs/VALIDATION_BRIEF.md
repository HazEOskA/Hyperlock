# Hyperlock Validation Brief

## Purpose

This document prepares Hyperlock for early validation conversations with technical founders, AI product builders, engineering leads, and teams actively using AI agents or coding assistants.

The goal is not to prove that Hyperlock is technically interesting.

The goal is to learn whether the pain is urgent, repeated, expensive, and budget-worthy.

---

## Current One-Line Positioning

**Hyperlock is a deterministic governance layer that prevents AI agents from drifting, contradicting locked decisions, or corrupting project state.**

Alternative shorter version:

**Hyperlock protects project truth in AI-assisted workflows.**

---

## Why This Exists

AI tools are becoming better at generating code, plans, decisions, and execution steps.

But generation is not governance.

In real workflows, teams need AI systems to respect prior decisions, understand what is already solved, avoid reintroducing removed components, and preserve a consistent state of truth across sessions and agents.

Today, much of this is handled manually by humans.

Hyperlock exists to make that control layer explicit, deterministic, and auditable.

---

## First ICP Hypothesis

### Primary ICP

Small technical teams building with AI coding agents or multi-agent workflows.

Likely profiles:

- AI-native startup founders
- technical founders using tools like Cursor, Claude, Codex, Lovable, Replit, or custom agents
- engineering teams experimenting with agentic software development
- teams building internal AI automation workflows

### Why They May Feel the Pain First

These teams move fast, rely heavily on AI-generated output, and often lack formal process around decision tracking, architecture locks, or memory integrity.

They are more likely to experience:

- repeated context drift
- duplicated decisions
- inconsistent agent behavior
- accidental reintroduction of removed logic
- lack of trust in autonomous execution

---

## Possible Later ICPs

- platform teams managing internal AI tooling
- AI agent framework companies
- enterprise AI governance teams
- devtool companies adding agent safety controls
- teams building regulated AI workflows

These may be valuable later, but the first validation should stay closer to fast-moving technical builders with immediate pain.

---

## Top Assumptions To Validate

### 1. The pain is frequent enough

Do teams experience AI workflow drift often enough that they care?

Signals to look for:

- repeated frustration with AI forgetting decisions
- manual docs created to control AI behavior
- engineers re-explaining context repeatedly
- agents breaking previously accepted architecture

### 2. The pain is expensive enough

Does drift create real cost, or is it just annoying?

Signals to look for:

- wasted engineering hours
- broken builds or regressions
- incorrect implementations
- review overhead
- loss of trust in agentic tools

### 3. The buyer is clear

Who would actually pay?

Options:

- technical founder
- head of engineering
- AI platform lead
- devtools buyer
- individual power user

The fastest path may be founder-led teams before enterprise governance.

### 4. The wedge is narrow enough

Hyperlock cannot start by solving all AI governance.

Possible initial wedge:

- deterministic project state for AI coding workflows
- architecture decision locking
- agent conflict detection
- AI memory validation before execution

### 5. The product should be workflow-native

The product must fit where users already work.

Possible integrations:

- GitHub
- Cursor
- Claude/Codex workflows
- local repo files
- CI checks
- agent orchestration pipelines

---

## Early Workflow Break Examples

### Example 1: Removed module returns

A team removes a legacy authentication module.

A few prompts later, an AI coding assistant suggests or recreates code that depends on that removed module.

Hyperlock should detect that the module is marked as removed and block or flag the proposal.

---

### Example 2: Locked architecture gets ignored

The team decides that all state changes must go through a single State Engine.

Later, an AI agent adds direct state mutation inside a UI component or service.

Hyperlock should detect that the proposal violates a locked architecture decision.

---

### Example 3: Solved issue gets reopened

A bug is fixed and marked resolved in project state.

A later agent session treats it as unresolved and starts rebuilding around the old problem.

Hyperlock should preserve the resolved status unless a human explicitly reopens it.

---

### Example 4: Multi-agent contradiction

One agent updates documentation saying Feature A is deprecated.

Another agent generates implementation work assuming Feature A is still active.

Hyperlock should detect the contradiction before the output is accepted.

---

### Example 5: Silent assumption injection

An AI agent assumes a product should support enterprise SSO, even though the current scope is CLI-first validation.

Hyperlock should flag this as an unvalidated assumption rather than allowing it to become project truth.

---

## Validation Questions For Friday

1. Have you seen AI agents or coding assistants contradict prior project decisions?
2. Where does this show up most often: code, architecture, documentation, product scope, or task execution?
3. What do teams currently do to prevent this?
4. Is this painful enough to pay for, or just a workflow annoyance?
5. Who owns this problem inside a team?
6. Would a deterministic state file, validation engine, or CI-style guardrail be the most natural first wedge?
7. What would make this feel immediately useful rather than abstract?
8. What existing workflow should Hyperlock plug into first?

---

## What We Want To Learn

By the end of the validation conversation, we should know:

- whether the problem is recognized instantly
- which examples resonate most
- who feels the pain strongest
- whether the language is clear
- whether the product should start as CLI, GitHub integration, local repo guardrail, or agent runtime layer
- what a credible MVP would need to prove

---

## Current Position

Hyperlock is not being positioned as another agent.

It is the layer that keeps agents aligned with validated truth.

> LLMs generate possibilities.  
> Hyperlock protects truth.
