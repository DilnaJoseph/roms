import type { UserRole } from "./roles";

/** Mirrors `USERS` row shape until MySQL is wired (SRS U10 / DB Design). */
export type AuthUserRecord = {
  userId: string;
  email: string;
  /** bcrypt hash — never store plaintext (SRS S1). */
  passwordHash: string;
  role: UserRole;
};

/**
 * Dev seed users — password for all: `RomS2026!`
 * Hash: bcrypt cost 10, generated with bcryptjs.
 * Replace with DB lookup in production.
 */
const SHARED_DEV_HASH =
  "$2b$10$pUCkUh2aZi5Kkl6dzNzqN.l2uiiJaXoAlIamWBve5PHFPWlYu9KWu";

export const SEED_USERS: AuthUserRecord[] = [
  {
    userId: "a0000000-0000-4000-8000-000000000001",
    email: "admin@roms.local",
    passwordHash: SHARED_DEV_HASH,
    role: "admin",
  },
  {
    userId: "a0000000-0000-4000-8000-000000000002",
    email: "staff@roms.local",
    passwordHash: SHARED_DEV_HASH,
    role: "staff",
  },
  {
    userId: "a0000000-0000-4000-8000-000000000003",
    email: "kitchen@roms.local",
    passwordHash: SHARED_DEV_HASH,
    role: "kitchen",
  },
];

export function findUserByEmail(email: string): AuthUserRecord | undefined {
  const normalized = email.trim().toLowerCase();
  return SEED_USERS.find((u) => u.email === normalized);
}
