## Changes

### 1. Donor list sorted by total amount donated
Update `listDonors` in `src/lib/donations.functions.ts` to sum each donor's approved donation amounts and sort by that total (descending). The public list still hides individual amounts — only the order changes. Public donor wall in `src/routes/donate.tsx` continues showing name + donation count.

### 2. Multiple chat rooms with admin moderation
**Database** (migration):
- New `chat_rooms` table: `id`, `name`, `slug`, `description`, `created_by`, `is_archived`, timestamps
- Add `room_id` column to `chat_messages` (FK to `chat_rooms`)
- Seed a default "General" room and backfill existing messages to it
- RLS:
  - `chat_rooms`: authenticated users SELECT non-archived rooms; admins manage (insert/update/delete)
  - `chat_messages`: authenticated SELECT/INSERT scoped to a valid non-archived room; users delete own messages; admins delete any message
- Enable realtime publication on `chat_rooms`

**Server functions** (`src/lib/chat.functions.ts`, new):
- `listRooms` — auth users get list of active rooms
- `createRoom`, `renameRoom`, `archiveRoom`, `deleteRoom` — admin only
- `deleteMessage` — admin can delete any message; users can delete their own (uses existing RLS)

**UI**:
- `src/routes/_authenticated/chat.tsx`: room sidebar/selector at top, switches subscription per room, admins see a delete button on every message
- `src/routes/_authenticated/admin.tsx`: new "Chat rooms" section with create/rename/archive/delete controls

### 3. Super admin role for adeyigbeminiyi414@gmail.com
**Database** (same migration):
- Extend `app_role` enum with `super_admin`
- Update `handle_new_user()` trigger so that email also gets `super_admin` (in addition to `admin`)
- Backfill: insert `super_admin` row for the existing account if present
- Add helper policy pattern: super admins implicitly have admin powers (every `has_role(..., 'admin')` check passes when the user is super_admin) — implement by updating `has_role` to return true when the user holds `super_admin` and the requested role is `admin`, OR by inserting both roles for that user. Simpler approach: always insert both `admin` and `super_admin` rows so existing admin policies keep working unchanged.
- Super-admin-only capability: only super admins can grant/revoke `admin` role (tighten `user_roles` policies — currently any admin can manage roles)

**Server functions**:
- Update `promoteToAdmin` in `src/lib/admin.functions.ts` to require super_admin
- Add `revokeAdmin` (super_admin only)
- Add `assertSuperAdmin` helper

**UI**:
- In `src/routes/_authenticated/admin.tsx`, show the "Promote admin" / "Revoke admin" controls only when current user is super_admin (fetch role from new `getMyRoles` server fn)

## Technical notes
- Backfilling existing chat messages into the default room requires the room to exist first, so the migration creates the room with a fixed UUID, sets `chat_messages.room_id` default to it temporarily, backfills, then drops the default and adds NOT NULL.
- Donor sorting needs the amount, which is currently hidden from the public response — the server fn computes the sum server-side and only returns name + count + rank (no amounts leak to the client).
- Realtime subscription in chat must re-subscribe when the active room changes; tear down the old channel in the effect cleanup.
