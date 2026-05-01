import { Request } from 'express';
import { jwtDecode } from 'jwt-decode';
import { createHash } from 'crypto';

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

export function getTokenPayloadFromRequest(
  request: Request
): TokenPayload | null {
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

function toHeaderValue(headerValue: string | string[] | undefined): string {
  if (!headerValue) {
    return '';
  }

  return Array.isArray(headerValue) ? headerValue.join(',') : headerValue;
}

function resolveClientIp(request: Request): string {
  const forwardedFor = toHeaderValue(request.headers['x-forwarded-for']);
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? '';
  }

  return request.ip || '';
}

function buildAnonymousUserIdFromRequest(request: Request): string {
  const clientIp = resolveClientIp(request);
  const userAgent = toHeaderValue(request.headers['user-agent']);
  const acceptLanguage = toHeaderValue(request.headers['accept-language']);
  const fingerprint = `${clientIp}|${userAgent}|${acceptLanguage}`;
  const digest = createHash('sha256')
    .update(fingerprint)
    .digest('hex')
    .slice(0, 24);

  return `anonymous:${digest}`;
}

export function resolveLogUserIdFromRequest(request: Request): string {
  return (
    getTokenPayloadFromRequest(request)?.id ??
    buildAnonymousUserIdFromRequest(request)
  );
}
