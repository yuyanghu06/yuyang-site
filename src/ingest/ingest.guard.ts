import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";

/**
 * IngestGuard
 * -----------
 * Protects ingest routes with a static key comparison.
 * The client sends the key in the `x-admin-key` header;
 * the guard compares it against the ADMIN_INGEST_KEY env var.
 */
@Injectable()
export class IngestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request  = context.switchToHttp().getRequest<Request>();
    const provided = request.headers["x-admin-key"] as string | undefined;
    const expected = process.env.ADMIN_INGEST_KEY;

    if (!expected) {
      throw new UnauthorizedException("ADMIN_INGEST_KEY not configured on server");
    }

    if (!provided || provided !== expected) {
      throw new UnauthorizedException("Invalid admin key");
    }

    return true;
  }
}
