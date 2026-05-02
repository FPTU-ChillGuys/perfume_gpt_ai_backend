import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../Metadata';
import { Reflector } from '@nestjs/core';
import { extractTokenFromHeader } from 'src/infrastructure/domain/utils/extract-token';

interface JwtPayload {
  sub: string;
  id: string;
  email: string;
  role: string;
  jti: string;
  iss: string;
  aud: string;
  [key: string]: unknown;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      // 💡 See this condition
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      // 💡 Here the JWT secret key that's used for verifying the payload
      // is the key that was passsed in the JwtModule
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      // 💡 We're assigning the payload to the request object here
      // so that we can access it in our route handlers
      request['user'] = payload;
      const requiredRole = this.reflector.getAllAndOverride<string[]>('roles', [
        context.getHandler(),
        context.getClass()
      ]);
      if (requiredRole && !requiredRole.includes(payload.role)) {
        throw new UnauthorizedException('Insufficient role');
      }
    } catch (error) {
      console.error('JWT verification failed:', error);
      throw new UnauthorizedException();
    }
    return true;
  }
}
