import { customAlphabet } from "nanoid";

// Excludes visually ambiguous characters (0/O, 1/I) so codes are easy to read and type aloud.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const nanoid = customAlphabet(ALPHABET, 6);

export function generateRoomId(): string {
  return nanoid();
}
