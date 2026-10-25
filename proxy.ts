import { NextResponse, type NextRequest } from "next/server";
import { accessTokenCookieName, accessTokenLifetimeSeconds, createTokenPair, refreshTokenCookieName, refreshTokenLifetimeSeconds, verifyAccessToken, verifyRefreshToken } from "./lib/auth-tokens";

export async function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();

  const accessToken = request.cookies.get(accessTokenCookieName)?.value;
  if (accessToken && await verifyAccessToken(accessToken)) return NextResponse.next();

  const refreshToken = request.cookies.get(refreshTokenCookieName)?.value;
  if (!refreshToken) return NextResponse.next();

  const tokenUser = await verifyRefreshToken(refreshToken);
  if (!tokenUser) return NextResponse.next();

  const { accessToken: nextAccessToken, refreshToken: nextRefreshToken } = await createTokenPair(tokenUser);
  const response = NextResponse.redirect(request.url);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  response.cookies.set(accessTokenCookieName, nextAccessToken, { ...cookieOptions, maxAge: accessTokenLifetimeSeconds });
  response.cookies.set(refreshTokenCookieName, nextRefreshToken, { ...cookieOptions, maxAge: refreshTokenLifetimeSeconds });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
