# Hyperlock Terminology

This document defines the working language for Hyperlock.

The goal is to keep the product precise, narrow, and commercially understandable during validation.

---

## Hyperlock

Hyperlock is a deterministic governance layer for AI-assisted workflows.

It validates AI-generated proposals against accepted project truth before those proposals are treated as safe, correct, or actionable.

Short version:

> Hyperlock protects project truth in AI-assisted workflows.

---

## Project Truth

Project Truth is the accepted state of a project.

It includes:

- locked architecture decisions
- removed components
- deprecated concepts
- approved scope
- open assumptions
- resolved issues
- current implementation direction

Project Truth must be explicit, reviewable, and deterministic.

It should not live only inside an LLM context window.

---

## Deterministic Governance

Deterministic Governance means that project rules are enforced by explicit state and validation logic, not by hoping an AI model remembers everything correctly.

Example:

If a component is marked as `removed`, an AI proposal that reintroduces it should be flagged or blocked.

---

## AI Drift

AI Drift happens when an AI assistant or agent gradually moves away from accepted project truth.

Examples:

- reintroducing removed components
- ignoring locked decisions
- reopening solved problems
- inventing assumptions
- contradicting current architecture
- changing scope without approval

---

## Proposal

A Proposal is any AI-generated output that attempts to change or influence the project.

Examples:

- code suggestion
- architecture plan
- documentation update
- task plan
- implementation strategy
- state update

A proposal is not automatically truth.

It must be validated first.

---

## Accepted State

Accepted State is the validated version of project truth.

Only accepted state should guide future execution.

AI output can suggest state changes, but Hyperlock decides whether they are valid.

---

## Locked Decision

A Locked Decision is a project decision that cannot be changed silently by an AI agent.

Examples:

- all state changes must go through the State Engine
- the product starts CLI-first
- Guardian OS is a separate product, not part of Hyperlock
- removed modules cannot be reintroduced without override

Locked decisions require explicit human override to change.

---

## Removed Component

A Removed Component is a concept, module, feature, or dependency that has been intentionally removed from the project.

If an AI agent tries to use it again, Hyperlock should detect the violation.

---

## Human Override

A Human Override is an intentional decision to bypass or change a validation rule.

Overrides must be explicit and audited.

An override should include:

- what changed
- who approved it
- why it was approved
- when it happened

---

## Audit Log

The Audit Log records important validation events.

Examples:

- proposal accepted
- proposal blocked
- assumption flagged
- human override applied
- locked decision changed

The audit log exists so humans can understand how project truth evolved.

---

## First Commercial Wedge

Current strongest wedge:

> AI Drift Guard for Dev Teams

This means Hyperlock first focuses on helping dev teams detect when AI coding agents contradict project state, violate locked architecture, or reintroduce removed work.

This wedge is narrower and easier to validate than broad AI governance.

---

## Avoided Language

Avoid describing Hyperlock as:

- another AI agent
- a chatbot
- generic AI memory
- project management software
- enterprise compliance platform

Preferred language:

- deterministic governance layer
- AI drift guard
- state integrity layer
- validation layer for AI workflows
- project truth control layer

---

## Core Sentence

> The model proposes. Hyperlock validates.
