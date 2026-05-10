# Example Project State

This is an example of project truth that Hyperlock can validate AI proposals against.

The format is intentionally simple for early validation.

---

## Product

Name: Hyperlock

Category: AI Drift Guard for Dev Teams

Positioning:

> Hyperlock detects when AI coding agents contradict locked architecture decisions, reintroduce removed modules, or mutate project state without approval.

---

## Active Scope

- deterministic state validation
- AI proposal checking
- locked decision enforcement
- removed component detection
- audit log
- human override

---

## Locked Decisions

### LOCK-001: Hyperlock is not an AI agent

Hyperlock is a governance and validation layer.

It may work with agents, but it is not positioned as another agent.

---

### LOCK-002: LLM output is not project truth

AI-generated output must be treated as a proposal until validated.

---

### LOCK-003: State changes must go through the State Engine

No UI component, agent, or service should mutate accepted project state directly.

---

### LOCK-004: Guardian OS is a separate product concept

Guardian OS / AI Agent OS should not be merged into Hyperlock unless explicitly approved by a human.

---

## Removed Components

### REMOVED-001: legacy-memory-sync

The old legacy memory sync module was removed.

Reason:

It allowed uncontrolled memory updates without validation.

Rule:

Do not reintroduce this module or depend on it.

---

### REMOVED-002: supervisor-branding

The product should not be branded as Cognitive Supervisor.

Reason:

The name can sound like a human management/surveillance tool instead of a technical validation layer.

Rule:

Do not use Cognitive Supervisor as the primary public product name.

---

## Open Assumptions

### ASSUMPTION-001: First ICP

The first ICP may be small technical teams using AI coding agents.

Status: unvalidated

---

### ASSUMPTION-002: First wedge

The first commercial wedge may be AI Drift Guard for Dev Teams.

Status: needs validation

---

## Resolved Decisions

### RESOLVED-001: Primary product name

The active product name is Hyperlock.

Do not rename the product without explicit human override.

---

## Validation Rule Summary

- proposals reintroducing removed components should be blocked
- proposals violating locked decisions should be blocked or flagged
- proposals changing product scope should be flagged
- proposals involving open assumptions should be marked as unvalidated
- human overrides must be explicit and audited
