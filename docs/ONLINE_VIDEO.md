# Online Video Consultations (Jitsi)

> **Phase 3.3** — مواعيد `ONLINE` مع غرف فيديو Jitsi

## Overview

When a client books an **ONLINE** appointment and the doctor **confirms** it, both parties can join a private Jitsi room at:

`/appointments/[id]/video`

## Access rules

| Rule | Value |
|------|--------|
| Appointment type | `ONLINE` |
| Status | `CONFIRMED` |
| Early join | 15 minutes before `scheduledAt` |
| Late join | Up to 15 minutes after end (`duration`) |
| Who can join | Client + assigned doctor (+ admin/owner) |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ONLINE_APPOINTMENTS_ENABLED` | `true` | Set to `false` to disable booking and video |
| `NEXT_PUBLIC_ONLINE_APPOINTMENTS_ENABLED` | `true` | Hides ONLINE option in booking UI when `false` |
| `JITSI_SERVER_URL` | `https://meet.jit.si` | Self-hosted Jitsi base URL (optional) |

## Files

- `src/lib/appointments/online-video.ts` — room naming, access window, embed URL
- `src/app/api/appointments/[id]/video/route.ts` — authorized session info
- `src/app/appointments/[id]/video/page.tsx` — Jitsi iframe page
- `src/components/appointments/VideoJoinButton.tsx` — join CTA on dashboards

## Disable online temporarily

Set both env vars to `false`:

```env
ONLINE_APPOINTMENTS_ENABLED=false
NEXT_PUBLIC_ONLINE_APPOINTMENTS_ENABLED=false
```

Existing `ONLINE` appointments remain in the database but new bookings are rejected.
