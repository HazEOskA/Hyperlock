# Example Hyperlock Validation Result

This file shows how Hyperlock should respond to the example proposal.

Input:

- `examples/project.state.md`
- `examples/proposal.md`

---

## Result

Status: BLOCKED

Reason:

The proposal violates multiple locked decisions and attempts to reintroduce removed components.

---

## Detected Violations

### VIOLATION-001: Product boundary violation

Proposal:

> merge Guardian OS into Hyperlock

Conflict:

`LOCK-004` states that Guardian OS / AI Agent OS is a separate product concept and should not be merged into Hyperlock without explicit human approval.

Severity: high

Action: block unless human override is provided

---

### VIOLATION-002: Product positioning violation

Proposal:

> position Hyperlock as an AI Agent OS

Conflict:

`LOCK-001` states that Hyperlock is not an AI agent. It is a governance and validation layer.

Severity: high

Action: block

---

### VIOLATION-003: State mutation violation

Proposal:

> The frontend can directly update project memory

Conflict:

`LOCK-003` states that state changes must go through the State Engine.

Severity: critical

Action: block

---

### VIOLATION-004: Removed component reintroduced

Proposal:

> bring back the legacy-memory-sync module

Conflict:

`REMOVED-001` states that legacy-memory-sync was removed because it allowed uncontrolled memory updates without validation.

Severity: critical

Action: block unless explicit override is approved

---

### VIOLATION-005: Deprecated branding reintroduced

Proposal:

> use Cognitive Supervisor as the main brand

Conflict:

`REMOVED-002` states that Cognitive Supervisor should not be used as the primary public product name.

Severity: medium

Action: block for public positioning

---

## Suggested Safe Alternative

Instead of merging Guardian OS or expanding into a broad agent operating system, keep the first wedge narrow:

> AI Drift Guard for Dev Teams

Safe proposal:

Hyperlock should focus on detecting when AI coding agents contradict locked architecture decisions, reintroduce removed modules, or mutate project state without approval.

---

## Human Override Example

If a human intentionally wants to merge Guardian OS into Hyperlock, the override must be explicit:

```text
OVERRIDE-ID: OVERRIDE-001
Decision: Merge Guardian OS into Hyperlock
Approved by: human owner
Reason: strategic product consolidation
Date: YYYY-MM-DD
Impact: update LOCK-004 and related product boundaries
```

Without this override, the proposal remains blocked.
