# AGENTS.md

This file defines the working context for AI assistants, coding agents, and automated contributors operating inside this repository.

## Product

The product name is **Hyperlock**.

Hyperlock is a deterministic governance layer for AI systems. It exists to prevent workflow drift, contradiction, and state corruption in AI-assisted development and agentic execution.

## Core Thesis

LLMs are powerful generators, but they are not reliable sources of deterministic project truth.

Hyperlock separates:

- AI-generated proposals
- deterministic validation
- accepted project state
- human override
- audit history

The model proposes. Hyperlock validates.

## Naming Rules

Use **Hyperlock** as the primary product name.

Do not use the following as primary product names:

- Project Memory Controller
- Cognitive Supervisor
- Memory Integrity Layer
- Guardian OS
- AI Agent OS

These may appear only as historical, internal, or comparative references when explicitly needed.

Important distinction:

- **Hyperlock** = deterministic governance / validation / state integrity layer
- **Guardian OS / AI Agent OS** = separate cockpit/runtime concept for agents

Do not merge these products unless a human explicitly decides to do so.

## Product Category

Hyperlock should be framed as one of the following, depending on context:

- deterministic governance layer for AI systems
- state integrity layer for AI workflows
- validation layer for agentic development
- control plane for AI project truth

Avoid vague descriptions like:

- another AI agent
- memory app
- chatbot tool
- project management app

## Architecture Direction

Expected core components:

- State Engine
- Validation Engine
- Policy Layer
- Conflict Detector
- Memory Registry
- Decision Locking
- Human Override Layer
- Audit Log

The architecture must preserve deterministic state integrity. Do not implement features that make the LLM the source of truth.

## Development Rules

When generating code or documentation:

1. Keep product boundaries clear.
2. Preserve the Hyperlock naming direction.
3. Do not reintroduce removed or deprecated concepts as active architecture.
4. Separate speculation from validated decisions.
5. Prefer small, auditable files over large vague documents.
6. Prioritize validation, clarity, and commercial usefulness.
7. Treat this repository as early-stage but serious.

## Current Validation Focus

The main validation question is:

> Is this painful enough that teams will budget for it?

Current materials should support conversations with technical founders, AI product teams, engineering leads, and teams experimenting with agent workflows.

Key validation assets:

- one-line positioning
- first ICP hypothesis
- uncertain assumptions
- concrete workflow break examples
- technical foundation

## Output Style

Use precise language. Avoid empty hype.

Good tone:

- clear
- technical
- sharp
- commercially aware
- founder-ready

Bad tone:

- corporate filler
- overclaiming
- sci-fi abstraction
- vague AI buzzwords

## Non-Negotiable Principle

LLMs generate possibilities.

Hyperlock protects truth.
