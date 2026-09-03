# H.A.I.V.A. Security Policy

## Secrets

- Never commit API keys, tokens, private keys, credentials, or production environment files.
- Store runtime secrets in the deployment environment or GitHub Actions secrets.
- Keep `.env*`, credential directories, and key material out of version control.
- If a secret is exposed, revoke/rotate it immediately and remove the exposed value from the repository history where appropriate.

## Execution boundaries

H.A.I.V.A. uses three action levels:

- **Safe:** read, inspect, analyze, plan, test, diagnose, report.
- **Controlled:** write, modify, create, install, commit, pull request, preview deploy.
- **Approval:** production deploy, delete/destructive delete, database migration, credential changes.

Risk metadata on a tool must never bypass the agent approval gate.

## CI security

Security tests run automatically on pushes and pull requests to `haiva-core-vnext`. Workflows should request the minimum permissions required; the security test workflow uses read-only repository contents access.

## Change discipline

- Inspect before editing.
- Make the smallest safe change.
- Preserve verified behavior.
- Run automated tests after meaningful changes.
- Do not claim success without test evidence.

## Incident response

1. Stop the affected workflow or deployment if necessary.
2. Revoke or rotate compromised credentials.
3. Identify the affected commits and systems.
4. Remove sensitive material from tracked files/history as appropriate.
5. Re-run the security and regression test suite.
6. Document the corrective action without recording the secret itself.
