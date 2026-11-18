# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Home assignment (Memcyco): a full-stack **scheduling system**. The repo currently holds only the spec, `Home Assessment_ Scheduling System.pdf`, which is the source of truth for requirements. No code has been written yet. Update this file (especially **Commands**) as the projects are scaffolded.

## Required layout and stack (from the spec; don't deviate)

- `/frontend`: React UI
- `/backend`: Java + Spring Boot, using **Quartz Scheduler** for execution
- `/docker`: a Dockerfile per component and one `docker-compose.yml` that runs the whole system (frontend, backend, DB)
- Database: our choice (e.g. PostgreSQL). It must persist all relevant data.
- Root `README.md` must cover: how to run, design decisions, assumptions, and **which AI tools were used and how** (mandatory).

## Domain model and architecture

- **Task**: predefined, **read-only** (never created or edited via the API/UI). Defined in backend code and exposed via a read-only endpoint so the UI can list them. Required: a **Log task** (writes a message to the app log). Add 1–2 more, e.g. a dummy email sender or a DB query task.
- **Parameter schema per task** (bonus, planned): name, type (string, number, …), required flag. The UI renders the inputs dynamically from the schema. Required params are enforced in **both** UI and backend validation.
- **Scheduling**: the CRUD entity (one row in the UI table). It links a task + timing config + parameter values. Parameter values must reach the task at execution time (e.g. via the Quartz `JobDataMap`).
- **Timing types** to support: one-time, recurring interval (every X minutes/hours), weekly (days of week + time), and cron expression. Each maps to a Quartz trigger (`SimpleTrigger` / `CronTrigger` / `DailyTimeIntervalTrigger` or a generated cron).
- **Consistency**: every create, update or delete of a Scheduling must make the matching change to the Quartz job/trigger in the same transaction, so the DB and Quartz never diverge. Prefer Quartz's JDBC JobStore on the same DB so schedules survive restarts.
- **Frontend**: a table of all schedulings, plus create/edit/delete via a form with task select → dynamic parameter fields → timing config.

## Testing expectations

Unit tests and integration tests with reasonable coverage, on both backend and frontend. Evaluation criteria: code quality, system design, completeness, UI/UX, test quality and coverage.

## Security (org policy: OWASP Top 10:2025)

Every spec proposal or major implementation must address each OWASP Top 10:2025 item explicitly. Project-specific hot spots:
- **A05 Injection**: a "DB query" task must not run arbitrary user SQL. Use fixed, parameterized queries only. Validate cron expressions and all parameter values against the task schema server-side. Never log raw user input unescaped.
- **A01 Broken Access Control**: tasks are read-only, so expose no write endpoints for them. Lock down CORS to the frontend origin.
- **A02 Security Misconfiguration**: no default DB credentials in compose or config. Keep secrets in env vars or a `.env` that is git-ignored. Don't expose Actuator or H2 consoles.
- **A03 Supply Chain**: pin dependency and base-image versions.
- **A10 Mishandling of Exceptional Conditions**: use a global exception handler, return no stack traces to clients, and make job failures not crash the scheduler.
- Never commit, print or request secrets inline.

## Commands

_None yet: add build, run, lint and test commands (including how to run a single test) once `/backend` and `/frontend` are scaffolded._
