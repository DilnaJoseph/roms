import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "./constants";

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_COST);
}

export async function verifyPassword(
  plainText: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainText, passwordHash);
}
