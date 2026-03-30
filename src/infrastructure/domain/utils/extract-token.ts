import { Request } from 'express';
import { jwtDecode } from "jwt-decode";

export interface TokenPayload {
  sub: string;
  id: string;
  email: string;
  role: string;
  jti: string;
  iss: string;
  aud: string;
}

export function extractTokenFromHeader(request: Request): string | undefined {
  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' && token ? token : undefined;
}

export function getTokenPayloadFromRequest(request: Request): TokenPayload | null {
  const token = extractTokenFromHeader(request);
  if (!token) {
    return null;
  }

  try {
    const decode = jwtDecode(token);
    return JSON.parse(JSON.stringify(decode)) as TokenPayload;
  } catch (error) {
    console.error('Failed to parse token payload:', error);
    return null;
  }
}


