# MFA for Admin & Owner

TOTP-based two-factor authentication (Google Authenticator / Authy) for `ADMIN` and `OWNER` roles.

## Requirements

- **Mandatory setup** before accessing `/admin/*` or `/owner/*`
- **Required at login** when MFA is enabled (email + password flow)
- Pi login blocked for privileged accounts with MFA enabled (`MFA_USE_EMAIL`)

## Flow

### Setup (`/admin/security/mfa`)

1. `POST /api/mfa/setup` — generates TOTP secret + QR code (pending 10 min)
2. User scans QR and enters 6-digit code
3. `POST /api/mfa/enable` — verifies code, saves encrypted secret + backup codes
4. Session updated with `mfaEnabled: true`, `mfaVerified: true`

### Login

1. `POST /api/auth/mfa/prelogin` — validates email/password
2. If `mfaRequired` → user enters TOTP or backup code
3. `POST /api/auth/mfa/verify` — returns one-time `signInToken`
4. `signIn('mfa-token', { token, userId })` — completes session with `mfaVerified: true`

## Middleware

Privileged routes redirect to:

- `/admin/security/mfa` — MFA not configured
- `/login?mfa=required` — MFA enabled but session not verified

## Storage

| Field | Purpose |
|-------|---------|
| `users.mfaEnabled` | TOTP active |
| `users.mfaSecret` | AES-256-GCM encrypted (key derived from `NEXTAUTH_SECRET`) |
| `users.mfaBackupCodes` | bcrypt-hashed one-time recovery codes |

## Files

- `src/lib/mfa/*` — TOTP, tokens, session flags
- `src/app/api/mfa/*` — setup/enable/status
- `src/app/api/auth/mfa/*` — login challenge
- `src/components/mfa/MfaSetupPanel.tsx`
- `src/app/admin/security/mfa/page.tsx`
