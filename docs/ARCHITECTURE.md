# H.A.I.V.A. Architecture

## Current Baseline

The current application is a browser-based voice assistant. The main flow is:

`Voice → Assistant → Router → Skills/API → Response`

This baseline remains intact during the migration.

## Target Architecture

H.A.I.V.A. is evolving toward an agentic automation core:

`Voice/Chat → HAIVA Core → Understand → Plan → Orchestrate → Tools → Execute → Verify → Diagnose/Fix → Report`

## Core Layers

### 1. Brain
Responsible for understanding the user's goal, intent detection, reasoning, planning, and decisions.

### 2. Agent
Responsible for turning a goal into tasks, coordinating execution, tracking task state, and enforcing approval boundaries.

### 3. Tools
Executable capabilities such as repository access, filesystem operations, terminal commands, research, API calls, and deployment operations.

### 4. Project Intelligence
Responsible for scanning repositories, understanding architecture and dependencies, identifying important files, building project context, and identifying risks.

### 5. Verification
Responsible for tests, builds, linting, runtime checks, diagnostics, and evidence-based verification.

### 6. Memory
Responsible for conversation context, project knowledge, task state, and architectural decisions.

### 7. Interface
Voice and UI are interfaces to the core. They should not contain the core decision-making or automation logic.

## Migration Strategy

Migration is incremental:

1. Freeze the current baseline.
2. Establish engineering rules and architecture documentation.
3. Add the agent orchestration layer without removing existing routing.
4. Add a centralized tool registry.
5. Add repository/project intelligence.
6. Add controlled execution.
7. Add verification and diagnostics.
8. Expand memory into project/task/decision memory.
9. Gradually route voice and UI through the new core.
10. Remove obsolete paths only after replacement behavior is verified.

## Safety Model

### Safe autonomous actions

- Read and inspect code.
- Analyze repositories.
- Create plans.
- Run tests and diagnostics.
- Create development branches.
- Generate reports.

### Controlled actions

- Modify source code.
- Install dependencies.
- Create commits or pull requests.
- Preview deployments.

These actions should remain traceable and verified.

### Human approval required

- Production deployment.
- Destructive resource deletion.
- Irreversible database operations.
- Critical credential changes.
- Other irreversible or high-impact actions.
