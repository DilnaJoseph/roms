/** HttpOnly cookie carrying the HS256 JWT (SRS 2.4 — 8h session). */
export const SESSION_COOKIE_NAME = "roms_session";

/** Browser `sessionStorage` mirror for `Authorization: Bearer` on fetch (kitchen API). */
export const ACCESS_TOKEN_STORAGE_KEY = "roms_access_token";

/** bcrypt cost factor — SRS / DB Design: minimum 10. */
export const BCRYPT_COST = 10;
