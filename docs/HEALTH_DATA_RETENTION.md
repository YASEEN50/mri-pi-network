# Health Data Retention Policy

MRI applies automated retention to sensitive health-related data. Defaults align with common healthcare/GDPR practice; override via environment variables.

## Retention windows (defaults)

| Data | Default | Env override |
|------|---------|--------------|
| Soft-deleted medical records | 30 days → hard delete + file removal | `RETENTION_SOFT_DELETED_MEDICAL_RECORDS_DAYS` |
| Chat messages (CLOSED/ARCHIVED rooms) | 90 days → deleted | `RETENTION_CLOSED_CHAT_MESSAGES_DAYS` |
| Medical-record audit logs | 365 days → deleted | `RETENTION_MEDICAL_RECORD_AUDIT_DAYS` |
| Expired record shares | Immediate revoke on cron run | — |

Active (non-deleted) medical records are **not** auto-deleted while the patient account exists. Account self-deletion (GDPR) runs immediate scrub — see `docs/GDPR.md`.

## Cron job

```
GET /api/cron/health-retention
Authorization: Bearer <CRON_SECRET>
```

Scheduled weekly in `vercel.json` (Sunday 03:00 UTC).

Implementation: `src/lib/retention/health-data-retention.ts`

## Manual run (production)

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://mri-yaseen2.vercel.app/api/cron/health-retention
```

## What is preserved

- Appointments and billing records (compliance / disputes)
- Active medical records and in-progress chats
- Verification/fraud data (separate policy — `fraud-cleanup` cron)
