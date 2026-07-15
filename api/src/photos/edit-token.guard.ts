//Guards the write endpoints with a single shared passphrase.
//Clients send it as "Authorization: Bearer <token>"; the server reads the
//expected value from the PHOTO_EDIT_TOKEN environment variable.
//This is intentionally simple: a handful of trusted editors, one secret,
//rotated by changing the env var and restarting the app.

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class EditTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.PHOTO_EDIT_TOKEN || '';
    if (!expected) {
      throw new ServiceUnavailableException(
        'PHOTO_EDIT_TOKEN is not configured on the server',
      );
    }
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'] || '';
    const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('bad passphrase');
    }
    return true;
  }
}
