import { createHash } from 'node:crypto';

import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { sessions, users, type SlotlyFlowDatabase } from '@slotlyflow/database';

export interface AuthenticatedSessionUser {
  readonly id: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly emailNormalized: string;
  readonly emailVerifiedAt: Date | null;
  readonly passwordAuthenticationEnabled: boolean;
}

/** Shared opaque-session resolution used by Business and platform routes. */
export async function resolveAuthenticatedSession(
  db: SlotlyFlowDatabase,
  token: string | undefined,
): Promise<AuthenticatedSessionUser | undefined> {
  if (token === undefined) return undefined;
  const tokenHash = createHash('sha256').update(token).digest('base64url');
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(
      eq(sessions.tokenHash, tokenHash),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, new Date()),
    ));
  if (session === undefined) return undefined;

  const [user] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      emailNormalized: users.emailNormalized,
      emailVerifiedAt: users.emailVerifiedAt,
      passwordAuthenticationEnabled: sql<boolean>`${users.passwordHash} is not null`,
    })
    .from(users)
    .where(eq(users.id, session.userId));
  if (user !== undefined) {
    await db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, session.id));
  }
  return user;
}
