import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ErrorParameter } from '../types/common.types';

@Injectable()
export class NanobotAuthGuard implements CanActivate {

  canActivate(
    context: ExecutionContext,
  ): boolean {

    const request = context.switchToHttp().getRequest<Request>();

    const expectedToken = process.env.NANOBOT_SERVICE_TOKEN || "";
    const authorization = request.headers["authorization"] || "";

    if (expectedToken && authorization === `Bearer ${expectedToken}`) {
      return true;
    }

    const response: ErrorParameter = {
      message: "Unauthorized",
      returnMessage: "Unauthorized",
      statusCode: 401,
      context: NanobotAuthGuard.name
    }

    throw new UnauthorizedException(response);
  }
}
