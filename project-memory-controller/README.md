# Project Memory Controller

Deterministic project state layer for AI-assisted development workflows.

LLMs can think. They should not rewrite history.

## Problem

AI-assisted projects drift because LLMs do not maintain deterministic project truth.
They may reintroduce removed components, break locked decisions, or reopen resolved issues.

## Solution

PMC keeps project truth inside a structured `project.state.md` file and validates every proposed state mutation before it becomes permanent.

## MVP Scope

PMC v0.1 is a CLI-first tool that:

- reads `project.state.md`
- accepts a proposed `STATE_UPDATE`
- validates deterministic rules
- blocks contradictions
- allows explicit human override
- writes an auditable change log

## Core Pipeline

```txt
User Input
↓
Manager LLM
↓
Proposed STATE_UPDATE
↓
Deterministic Parser
↓
Rule-Based Validator
↓
Human Override if needed
↓
Persist project.state.md
```

## Killer Demo

If a component exists in `REMOVED_COMPONENTS` and an LLM tries to add it back to `ACTIVE_COMPONENTS`, PMC blocks the change unless the human explicitly overrides it.

## Status

Raw architecture scaffold. Implementation starts from parser + validator.
