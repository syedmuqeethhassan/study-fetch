import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import type { JWTPayload } from 'jose';

const ENC_ALG = 'HS256';
const COOKIE_NAME = 'session';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

export type AuthTokenPayload = {
  uid: string;
  sid?: string;
  email?: string;
  name?: string;
} & JWTPayload;

export async function signAuthToken(payload: AuthTokenPayload, expiresInSeconds: number) {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ENC_ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secret);
  return jwt;
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, { algorithms: [ENC_ALG] });
    return payload as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function getCookieName() {
  return COOKIE_NAME;
}

export function getCookieOptions(expires: Date) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    expires,
  };
}

export async function readAuthFromRequest(request: NextRequest): Promise<AuthTokenPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifyAuthToken(token);
}


