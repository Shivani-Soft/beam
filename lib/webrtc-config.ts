/**
 * ICE server configuration for the RTCPeerConnection.
 *
 * - STUN servers just tell a peer its own public IP/port so both sides can
 *   try to connect to each other directly — they never see the actual data.
 * - TURN servers relay traffic between peers when a direct path can't be
 *   found (symmetric NAT, restrictive corporate firewalls, etc). We don't
 *   have one yet, so connections across networks like that will fail until
 *   Milestone 6 adds TURN support.
 */
export const webrtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // TODO (Milestone 6): add a TURN server here, e.g.
    // { urls: "turn:turn.example.com:3478", username: "...", credential: "..." },
  ],
};
