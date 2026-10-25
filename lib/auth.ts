import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByMobile,
  findUserByUsername,
  type AuthUser,
} from "./db";
import { normalizeBangladeshMobile } from "./auth-schemas";
import { accessTokenCookieName, accessTokenLifetimeSeconds, createTokenPair, refreshTokenCookieName, refreshTokenLifetimeSeconds, verifyAccessToken, verifyRefreshToken, type TokenUser } from "./auth-tokens";

export const authCookieName = accessTokenCookieName;

export function toSafeUser(user: { id: number; username: string; email: string; mobile: string; createdAt: string }): AuthUser {
  return { id: user.id, username: user.username, email: user.email, mobile: user.mobile, createdAt: user.createdAt };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function findUserByIdentifier(identifier: string) {
  const normalized = normalizeBangladeshMobile(identifier);
  if (normalized) return findUserByMobile(normalized);
  const value = identifier.trim().toLowerCase();
  return findUserByEmail(value) || findUserByUsername(value);
}

export async function setAuthCookies(user: AuthUser) {
  const { accessToken, refreshToken } = await createTokenPair(user);
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  } as const;
  cookieStore.set(accessTokenCookieName, accessToken, { ...cookieOptions, maxAge: accessTokenLifetimeSeconds });
  cookieStore.set(refreshTokenCookieName, refreshToken, { ...cookieOptions, maxAge: refreshTokenLifetimeSeconds });
}

export const createJwtCookie = setAuthCookies;

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(accessTokenCookieName)?.value;
  if (!token) return undefined;

  const tokenUser = await verifyAccessToken(token);
  if (!tokenUser) return undefined;
  const user = findUserById(tokenUser.id);
  return user ? toSafeUser(user) : undefined;
}

export async function refreshAuthCookies() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(refreshTokenCookieName)?.value;
  if (!refreshToken) return undefined;

  const tokenUser = await verifyRefreshToken(refreshToken);
  if (!tokenUser) return undefined;
  const user = findUserById(tokenUser.id);
  if (!user) return undefined;

  const safeUser = toSafeUser(user);
  await setAuthCookies(safeUser);
  return safeUser;
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  const cookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 } as const;
  cookieStore.set(accessTokenCookieName, "", cookieOptions);
  cookieStore.set(refreshTokenCookieName, "", cookieOptions);
  cookieStore.set("pulsedesk_session", "", cookieOptions);
}

export const clearLoginSession = clearAuthCookies;

export { createUser };
export { accessTokenCookieName, refreshTokenCookieName } from "./auth-tokens";
export type { TokenUser };
