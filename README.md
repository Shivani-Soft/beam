This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

1. Copy your Supabase project's URL and anon key into `.env.local` (placeholders are there by default):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Milestone 1: Supabase Realtime signaling

This milestone proves out the signaling layer (Supabase Realtime Broadcast) that
Milestone 2 will layer WebRTC on top of. No `RTCPeerConnection` code exists yet —
two tabs just exchange arbitrary broadcast messages over a shared room channel.

- `lib/supabase.ts` — Supabase client singleton
- `lib/roomId.ts` — generates a 6-character, unambiguous room code
- `hooks/useSignalingChannel.ts` — subscribes to `room-<id>` and exposes
  `sendMessage`, `onMessage`, `status`, and `disconnect`
- `app/page.tsx` — sender/create-room view
- `app/join/page.tsx` — receiver/join-room view

### Manual test: two-tab signaling flow

1. Open the app in two browser tabs (Tab A and Tab B).
2. In **Tab A**, click **Create Room**. Note the 6-character room ID shown, or
   use the **Copy** button.
3. In **Tab B**, go to **Join a room** (`/join`), paste the room ID, and click
   **Join**.
4. Tab B should show **"Connected to room `<id>`"**. Tab A should flip from
   **"Waiting for peer..."** to **"Peer connected"** shortly after.
5. Type a message in Tab A's input and click **Send** — it should appear in
   Tab B's message list within a second or two, and vice versa.
6. Close Tab B, then reopen `/join` and re-enter the same room ID — it should
   reconnect successfully and Tab A should see "Peer connected" fire again.
7. In a fresh tab, go to `/join` and enter a made-up/invalid room ID. This
   should **not** crash the app — it will report as "connected" to an empty
   channel (see note below), since Supabase Realtime channels don't require
   a room to be pre-created. If Supabase itself is unreachable (bad URL/key,
   network issue), the status will show a clear **"Connection error"** state
   instead of hanging on "Connecting...".

> **Note on room validity:** Supabase Realtime broadcast channels are created
> implicitly on subscribe — there's no server-side concept of a room
> "existing" yet. So joining a room nobody created will still show as
> "connected," it just won't receive any messages. Real room-existence
> validation (e.g. a `rooms` table, or Presence to detect whether the sender
> is actually there) is deferred to Milestone 6 — see the comment in
> `hooks/useSignalingChannel.ts`.

## Milestone 2: WebRTC peer connection

This milestone adds the actual WebRTC layer on top of Milestone 1's signaling.
An `RTCPeerConnection` is established using the existing Supabase signaling
channel to exchange the SDP offer/answer and ICE candidates, resulting in an
open `RTCDataChannel` between the two browsers. Once that DataChannel opens,
the signaling channel is disconnected — everything after that is direct
peer-to-peer, no server involved.

- `lib/webrtc-config.ts` — `RTCConfiguration` with a public STUN server (no
  TURN yet — see Milestone 6)
- `hooks/usePeerConnection.ts` — wraps `useSignalingChannel` to run the
  offer/answer/ICE handshake and exposes `connectionState`, `sendData`,
  `onData`, `disconnect`
- `app/page.tsx` / `app/join/page.tsx` — updated to use `usePeerConnection`
  instead of raw signaling broadcasts for the test message box

### Manual test: two-tab P2P handshake

1. Open the app in two browser tabs (Tab A and Tab B) on the same network.
2. In **Tab A**, click **Create Room**. It should move through **"Waiting for
   peer..."** → **"Connecting (WebRTC handshake)..."**.
3. In **Tab B**, go to **Join a room**, paste the room ID, and click **Join**.
4. Both tabs should reach **"Connected (P2P)"**, each showing the note that
   the signaling server has disconnected.
5. In browser dev tools (Network tab, WS filter), confirm the Supabase
   WebSocket connection for that room is closed/unsubscribed once connected.
6. Type a message in Tab A's input and send it — it should appear in Tab B's
   message list (and vice versa), with the Supabase channel already
   disconnected, proving the data is going peer-to-peer and not through the
   server.
7. Repeat on two different physical devices on the same Wi-Fi network (not
   just two tabs on one machine) to confirm real P2P behavior.
8. Refresh either tab — it should require re-doing the room join flow from
   scratch (no auto-reconnect yet; that's Milestone 6).

> **Note on STUN-only connectivity:** only a public STUN server is configured
> right now. If either side is behind a strict/symmetric NAT or a corporate
> firewall, the handshake can hit a **"Connection failed"** state — that's
> expected until Milestone 6 adds a TURN server.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
