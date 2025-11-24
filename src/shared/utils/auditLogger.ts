import { Request } from 'express';
import { prisma } from '../db/prisma';
import { logger } from './logger';

export type AuditActor = {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type AuditEvent = {
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

export const getRequestActor = (req: Request): AuditActor => {
  const userId = (req.headers['x-user-id'] as string) || undefined;
  const userEmail = (req.headers['x-user-email'] as string) || undefined;
  const userName = (req.headers['x-user-name'] as string) || undefined;

  return {
    userId: userId ?? null,
    userEmail: userEmail ?? null,
    userName: userName ?? null,
    ip: (req.headers['x-forwarded-for'] as string) || req.ip || null,
    userAgent: (req.headers['user-agent'] as string) || null,
  };
};

export const logAuditEvent = async (event: AuditEvent, actor: AuditActor) => {
  try {
    await prisma.auditLog.create({
      data: {
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        description: event.description ?? null,
        before: event.before as any,
        after: event.after as any,
        metadata: {
          ...event.metadata,
          ip: actor.ip,
          userAgent: actor.userAgent,
        },
        userId: actor.userId ?? null,
        userEmail: actor.userEmail ?? null,
        userName: actor.userName ?? null,
      },
    });
  } catch (error) {
    logger.error('Error guardando auditoría', error);
  }
};
