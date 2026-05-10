# PROJECT STATE

## CURRENT_GOAL

Build PMC v0.1: a deterministic state integrity layer for AI-assisted development workflows.

## ACTIVE_COMPONENTS

- project.state.md
- deterministic parser
- rule-based validator
- human override mechanism
- change log

## REMOVED_COMPONENTS

- multi-agent orchestration
- web dashboard
- enterprise permission system
- autonomous governance AI

## LOCKED_CONSTRAINTS

- LLM may propose state changes, but cannot persist them directly.
- State mutations must be explicit.
- Validation logic must be deterministic.
- Human authority is always highest.
- No probabilistic logic inside the control layer.

## OPEN_ISSUES

- Define exact STATE_UPDATE schema.
- Implement markdown state parser.
- Implement REMOVED_REUSE_BLOCK rule.
- Implement LOCKED_CONSTRAINT_BLOCK rule.
- Implement CLI flow.

## RESOLVED

- PMC v0.1 scope is CLI-first.
- project.state.md is the single source of truth.
- MVP focuses on silent contradiction prevention.

## CHANGE_LOG

- 2026-05-10: Initialized raw project state for PMC v0.1.
