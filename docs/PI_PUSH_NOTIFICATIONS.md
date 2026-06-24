# Pi Browser Push Notifications

MRI surfaces new in-app notifications as **Web Notifications** when the app runs inside Pi Browser. Pi SDK does not expose a server-side push API, so delivery is **poll-based** on the client.

## How it works

1. **`PiPushProvider`** (root layout) detects Pi Browser via `isPiBrowser()`.
2. If the user is signed in, a banner prompts for **`Notification.requestPermission()`**.
3. After permission is granted, **`usePiPushNotifications`** polls `GET /api/notifications?since=<ISO>`:
   - **8s** when the tab is visible
   - **3s** when the tab is hidden (background)
4. New items trigger `new Notification(title, { body, tag })` with deep links via `notificationActionPath`.
5. **`NotificationBell`** uses the same 8s interval in Pi Browser for faster in-app badge updates.

## API

```
GET /api/notifications?limit=20&since=2026-05-20T12:00:00.000Z
```

Returns notifications with `createdAt > since`, ordered newest first. Meta includes `latestAt`.

## User preferences (localStorage)

| Key | Purpose |
|-----|---------|
| `mri_push_enabled` | User dismissed or disabled push (`false`) |
| `mri_push_seen_ids` | sessionStorage — IDs already shown this session |

## Limitations

- Requires Pi Browser support for the Web Notifications API.
- No true server push — polling only.
- First enable does **not** backfill old notifications (baseline is set on grant).

## Files

- `src/hooks/usePiPushNotifications.ts`
- `src/components/notifications/PiPushProvider.tsx`
- `src/lib/notifications/push-config.ts`
- `src/app/api/notifications/route.ts` (`since` filter)
