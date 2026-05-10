# Hyperlock Architecture

## Architecture Goal

Hyperlock is designed to add deterministic governance to AI-assisted workflows.

The system must ensure that project truth is not silently mutated by probabilistic AI output.

The core architectural rule:

> The LLM may propose changes.  
> Hyperlock decides whether those changes can become accepted state.

---

## High-Level Flow

```text
Human Intent
    ↓
AI / Agent Proposal
    ↓
Hyperlock Validation Layer
    ↓
State Engine
    ↓
Accepted Project Truth
    ↓
Audit Log
```

---

## Core Components

## 1. State Engine

The State Engine stores and updates accepted project truth.

Responsibilities:

- maintain deterministic project state
- track active, deprecated, removed, and locked items
- reject invalid state transitions
- expose state to validation workflows

The State Engine must not rely on an LLM as its source of truth.

---

## 2. Validation Engine

The Validation Engine checks AI proposals against accepted state.

Responsibilities:

- detect contradictions
- identify architecture violations
- block reintroduction of removed concepts
- flag unvalidated assumptions
- determine whether a proposal can proceed

Example:

If `legacy-auth-module` is marked as `removed`, any proposal depending on it should be rejected or flagged.

---

## 3. Policy Layer

The Policy Layer defines the rules that govern validation.

Responsibilities:

- define allowed and forbidden changes
- enforce locked decisions
- specify override requirements
- define severity levels

Example policies:

- removed components cannot be reintroduced without human override
- locked architecture decisions cannot be changed by an agent alone
- unresolved assumptions must be labeled before implementation

---

## 4. Memory Registry

The Memory Registry organizes structured project memory.

Possible memory scopes:

- global memory
- project memory
- task memory
- session memory

The registry should distinguish between:

- accepted truth
- proposed changes
- assumptions
- deprecated decisions
- removed decisions
- open questions

---

## 5. Conflict Detector

The Conflict Detector identifies mismatches between proposals and accepted state.

Conflict examples:

- proposed feature depends on removed component
- generated code violates locked architecture
- documentation contradicts current product scope
- agent output reopens a resolved issue
- two agents propose incompatible state updates

---

## 6. Human Override Layer

Humans must remain able to override the system deliberately.

Responsibilities:

- allow intentional state changes
- require explicit reason for override
- record who/what triggered the override
- preserve auditability

An override is not a silent bypass.

It is an explicit state transition.

---

## 7. Audit Log

The Audit Log records why project truth changed.

Responsibilities:

- track accepted changes
- track rejected proposals
- track overrides
- track source of change
- provide reviewable history

The audit trail is essential for trust.

---

## Minimal MVP Architecture

The first MVP can be simple.

```text
project.state.md / project.state.json
        ↓
validation rules
        ↓
proposal checker
        ↓
pass / warn / block
        ↓
audit log
```

Possible first command-line workflow:

```bash
hyperlock check proposal.md
hyperlock state
hyperlock override <id> --reason "intentional architecture change"
```

---

## Suggested Repository Structure

```text
Hyperlock/
  README.md
  AGENTS.md
  docs/
    VALIDATION_BRIEF.md
    ARCHITECTURE.md
    TERMINOLOGY.md
  examples/
    project.state.md
    proposal.md
    violations.md
  src/
    state-engine/
    validation-engine/
    policy-layer/
    audit-log/
```

This structure may change after validation.

---

## Non-Goals For The First MVP

Hyperlock should not initially try to be:

- a full project management system
- a generic chatbot
- a complete agent runtime
- an enterprise compliance platform
- a replacement for GitHub, Linear, Cursor, or Claude

The first wedge should stay narrow:

> deterministic state validation for AI-assisted project workflows.

---

## Architecture Principle

The architecture should make drift visible before it becomes expensive.

> Generate freely.  
> Validate deterministically.  
> Commit truth intentionally.
