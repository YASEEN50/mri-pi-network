# CI & Unit Tests

GitHub Actions runs on every push/PR to `main`:

- `npm run typecheck`
- `npm run lint`
- `npm test` (Vitest)

Workflow: `.github/workflows/ci.yml`

## Local commands

```bash
npm test          # run once
npm run test:watch  # watch mode
```

## Test coverage (Phase 4.4)

| Domain | File | What is tested |
|--------|------|----------------|
| **Appointments** | `src/lib/appointments/slots.test.ts` | Slot generation, overlap, availability |
| **Appointments** | `src/lib/appointments/online-video.test.ts` | Video join window rules |
| **Payments** | `src/lib/payment/appointment-payment.test.ts` | Fee / deposit / policy resolution |
| **Pi payments** | `src/lib/pi/pi-payment-dto.test.ts` | Payment DTO parsing |
| **Auth (MFA)** | `src/lib/mfa/auth.test.ts` | Session flags, challenge tokens |

## Integration E2E (optional, needs DB + server)

```bash
npm run dev   # terminal 1
npm run test:e2e   # terminal 2, requires DATABASE_URL + NEXTAUTH_SECRET
```

E2E is **not** part of CI (requires live database).

## Lockfile / npm version

CI uses **Node 20** (npm 10). Regenerate `package-lock.json` with npm 10 when dependencies change:

```bash
npx npm@10 install --package-lock-only
```

Using npm 11 locally without regenerating the lockfile causes `npm ci` to fail on GitHub with missing packages.
