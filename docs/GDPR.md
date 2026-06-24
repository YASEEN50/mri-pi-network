# GDPR — Data Export & Account Deletion

MRI supports **Article 15 (access)** and **Article 17 (erasure)** via self-service tools in Profile → Settings.

## Export my data

```
GET /api/account/export
Authorization: session cookie
```

Returns `application/json` attachment with:

- Account metadata (no password hash)
- Role-specific profiles
- Appointments, reviews, notifications, transactions, premios
- Medical records (metadata + authenticated file download paths)
- Chat rooms/messages, referrals, publications (doctors)

## Delete my account

```
POST /api/account/delete
{ "confirmPhrase": "DELETE", "password": "..." }
```

- `confirmPhrase` must be exactly `DELETE`
- `password` required when the account has a password hash
- **Blocked** for `OWNER` and `ADMIN` roles

### What happens on deletion

1. Medical record files removed from storage; records soft-deleted and scrubbed
2. Client/doctor/facility profiles anonymized and soft-deleted
3. Chat messages from user replaced with `[deleted]`
4. Notifications and sessions removed
5. User row soft-deleted: `deletedAt`, `isActive: false`, PII tombstoned
6. Activity log entry `DELETE_USER` with `{ selfService: true }`

Transactional records (appointments, payments) may remain for legal/financial compliance but are no longer linked to identifiable PII on the deleted profile.

## UI

- `src/components/profile/PrivacyDataCard.tsx` — export + delete in Profile settings tab
- `src/lib/privacy/*` — server logic

## Files

| File | Purpose |
|------|---------|
| `src/lib/privacy/export-user-data.ts` | Build export payload |
| `src/lib/privacy/delete-user-account.ts` | Erasure workflow |
| `src/app/api/account/export/route.ts` | Download endpoint |
| `src/app/api/account/delete/route.ts` | Deletion endpoint |
