import { jwtVerify, SignJWT, type JWTPayload } from "jose";

export const accessTokenCookieName = "pulsedesk_access_token";
export const refreshTokenCookieName = "pulsedesk_refresh_token";
export const accessTokenLifetimeSeconds = 15 * 60;
export const refreshTokenLifetimeSeconds = 30 * 24 * 60 * 60;

const accessTokenSecret = new TextEncoder().encode(process.env.JWT_SECRET || "pulsedesk-local-development-jwt-secret-change-me");
const refreshTokenSecret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "pulsedesk-local-development-refresh-secret-change-me");

export type TokenUser = {
  id: number;
  username: string;
  email: string;
  mobile: string;
  createdAt: string;
};

type UserTokenPayload = JWTPayload & {
  email: string;
  username: string;
  mobile: string;
  createdAt: string;
  tokenType: "access" | "refresh";
};

function tokenUserPayload(user: TokenUser, tokenType: UserTokenPayload["tokenType"]): UserTokenPayload {
  return {
    email: user.email,
    username: user.username,
    mobile: user.mobile,
    createdAt: user.createdAt,
    tokenType,
  };
}

export async function createAccessToken(user: TokenUser) {
  return new SignJWT(tokenUserPayload(user, "access"))
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${accessTokenLifetimeSeconds}s`)
    .sign(accessTokenSecret);
}

export async function createRefreshToken(user: TokenUser) {
  return new SignJWT(tokenUserPayload(user, "refresh"))
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${refreshTokenLifetimeSeconds}s`)
    .setJti(crypto.randomUUID())
    .sign(refreshTokenSecret);
}

export async function createTokenPair(user: TokenUser) {
  const [accessToken, refreshToken] = await Promise.all([createAccessToken(user), createRefreshToken(user)]);
  return { accessToken, refreshToken };
}

function parseUserPayload(payload: JWTPayload, expectedType: UserTokenPayload["tokenType"]) {
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId < 1) return undefined;
  if (payload.tokenType !== expectedType) return undefined;
  if (typeof payload.email !== "string" || typeof payload.mobile !== "string" || typeof payload.createdAt !== "string") return undefined;
  return {
    id: userId,
    username: typeof payload.username === "string" && payload.username ? payload.username : payload.email.split("@")[0],
    email: payload.email,
    mobile: payload.mobile,
    createdAt: payload.createdAt,
  } satisfies TokenUser;
}

export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, accessTokenSecret, { algorithms: ["HS256"] });
    return parseUserPayload(payload, "access");
  } catch {
    return undefined;
  }
}

export async function verifyRefreshToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, refreshTokenSecret, { algorithms: ["HS256"] });
    return parseUserPayload(payload, "refresh");
  } catch {
    return undefined;
  }
}
