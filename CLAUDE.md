# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Home assignment (Memcyco): a full-stack scheduling system. The spec (`Home Assessment_ Scheduling System.pdf`) is git-ignored. `README.md` documents run steps, design decisions, assumptions and the OWASP review; keep it in sync with behavior changes.

- `/backend`: Java 21, Spring Boot 4.1, Quartz (JDBC store), JPA, Flyway, Postgres
- `/frontend`: Next.js 16 App Router, React 19, Ant Design 6, TanStack Query, Vitest
- `/docker`: `docker-compose.yml`, plus `docker-compose.dev.yml`, which publishes Postgres on 127.0.0.1:5432 for local dev

## Commands

The `java` on PATH is Java 8, so always set `JAVA_HOME="$HOME/.jdks/ms-21.0.12.1"` before `./mvnw`. The DB password lives in the git-ignored `docker/.env`: never print it, and source it as shown.

```bash
# Backend (tests need Docker running: Testcontainers starts postgres:17-alpine)
cd backend && ./mvnw verify                         # all tests + JaCoCo (target/site/jacoco)
cd backend && ./mvnw test -Dtest=TriggerFactoryTest # single class (-Dtest=Class#method for one test)
cd backend && set -a && . ../docker/.env && set +a && DB_PASSWORD="$POSTGRES_PASSWORD" ./mvnw spring-boot:run

# Frontend
cd frontend && npm run dev | npm test | npm run test:coverage | npm run lint | npm run typecheck | npm run build
cd frontend && npx vitest run src/components/SchedulingsTable.test.tsx   # single file

# Full stack (UI on http://localhost:3000; only the frontend is published)
cd docker && docker compose up --build
cd docker && docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db   # DB only, for local dev
```

`mvnw spring-boot:run` forks a JVM. Stopping the shell can leave it listening on :8080, so kill that PID.

## Architecture (cross-file essentials)

- **Write path:** `SchedulingController` → `SchedulingService` (`@Transactional`) validates everything up front:
  - task exists in `TaskRegistry`
  - `ParameterValidator` checks the task schema
  - `TriggerFactory.validate` checks the schedule

  It then saves the entity and calls `QuartzJobManager.schedule`. Quartz's JDBC store shares the Spring transaction (`LocalDataSourceJobStore`), so the DB row and the job/trigger are atomic. Keep Quartz calls inside the service transaction.
- **`QuartzJobManager.schedule`** does `deleteJob` and then `scheduleJob(replace=false)` on purpose. `replace=true` breaks when the trigger type changes (cron ↔ simple) in the JDBC store.
- **Execution:** one generic durable `TaskExecutionJob` per scheduling (`JobKey(schedulingId, "schedulings")`). Its JobDataMap holds strings only (`useProperties=true`): `schedulingId`, `taskKey`, and parameters as JSON. To add a task, add a `@Component` implementing `ScheduledTask`. Its `parameters()` schema drives both the UI form and backend validation.
- **`ScheduleSpec`** is a sealed interface with record subtypes. Jackson polymorphism is via an explicit `@JsonSubTypes` allow-list. It's stored as JSON text through `ScheduleSpecConverter`, using `common/Json`, a static Jackson 3 mapper (`tools.jackson.*`; the annotations stay in `com.fasterxml.jackson.annotation`). All schedule rules live in `TriggerFactory` (Clock-injected): min frequency 1 minute, future one-time, valid zone and cron.
- **Errors:** `GlobalExceptionHandler` returns ProblemDetail with `errors: {"parameters.x" | "schedule.x" | field: message}`. The frontend maps these keys onto form fields, so keep the key format stable.
- **Frontend → backend:** the browser calls same-origin `/api/*`. `next.config.ts` rewrites it to `BACKEND_URL`, which is read at **build time** (a Docker build arg). There's no CORS on the backend.
- **Schema:** Flyway owns all DDL (V1 = the official Quartz Postgres tables, V2 = `scheduling`). Hibernate is `ddl-auto=validate`.

## Gotchas

- The Next.js 16 APIs differ from older versions. Read `frontend/node_modules/next/dist/docs/` before Next-specific changes (see `frontend/AGENTS.md`).
- Git autocrlf is on for this machine. `.gitattributes` forces LF (needed for `mvnw` inside Linux containers).
- Bash heredocs on this machine can mangle `\\` in Java sources. Prefer the Write/Edit tools for code containing escapes.

## Security (org policy: OWASP Top 10:2025)

Every spec proposal or major change must address each OWASP Top 10:2025 item. The README has the current table. Project hot spots:
- **DB_REPORT:** allow-listed fixed SQL only. Never accept SQL from users.
- **Logging:** sanitize logged user input with `LogSanitizer`.
- **Exposure:** keep only the frontend published.
- **Secrets:** never put secrets in compose or config defaults.
