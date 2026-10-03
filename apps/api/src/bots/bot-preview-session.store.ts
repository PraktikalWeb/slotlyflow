import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';

import type { HandoverTestBotState, WansatiBotState } from './built-in-bot-runtime.types.js';

const previewSessionTtlMilliseconds = 20 * 60 * 1_000;
const maximumPreviewSessions = 500;

export interface BotPreviewSession {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly botDeploymentId: string;
  readonly botVersionId: string;
  state: HandoverTestBotState;
  wansatiState: WansatiBotState;
  handover: boolean;
  expiresAt: number;
  busy: boolean;
}

@Injectable()
export class BotPreviewSessionStore {
  private readonly sessions = new Map<string, BotPreviewSession>();

  async run<Result>(input: {
    readonly previewSessionId: string | null;
    readonly organizationId: string;
    readonly userId: string;
    readonly botDeploymentId: string;
    readonly botVersionId: string;
  }, operation: (session: BotPreviewSession) => Promise<Result>): Promise<{
    readonly previewSessionId: string;
    readonly result: Result;
  }> {
    const now = Date.now();
    this.prune(now);
    const session = input.previewSessionId === null
      ? this.create(input, now)
      : this.resolve({
        previewSessionId: input.previewSessionId,
        organizationId: input.organizationId,
        userId: input.userId,
        botDeploymentId: input.botDeploymentId,
        botVersionId: input.botVersionId,
      }, now);
    if (session.busy) throw new ConflictException({ code: 'BOT_PREVIEW_SESSION_BUSY' });
    session.busy = true;
    try {
      const result = await operation(session);
      session.expiresAt = Date.now() + previewSessionTtlMilliseconds;
      return { previewSessionId: session.id, result };
    } finally {
      session.busy = false;
    }
  }

  reset(input: { readonly previewSessionId: string; readonly organizationId: string; readonly userId: string }): void {
    this.prune(Date.now());
    const session = this.sessions.get(input.previewSessionId);
    if (session === undefined) return;
    if (session.organizationId !== input.organizationId || session.userId !== input.userId) {
      throw new ConflictException({ code: 'BOT_PREVIEW_SESSION_UNAVAILABLE' });
    }
    if (session.busy) throw new ConflictException({ code: 'BOT_PREVIEW_SESSION_BUSY' });
    this.sessions.delete(session.id);
  }

  private create(input: {
    readonly organizationId: string;
    readonly userId: string;
    readonly botDeploymentId: string;
    readonly botVersionId: string;
  }, now: number): BotPreviewSession {
    this.ensureCapacity();
    const session: BotPreviewSession = {
      id: randomUUID(),
      organizationId: input.organizationId,
      userId: input.userId,
      botDeploymentId: input.botDeploymentId,
      botVersionId: input.botVersionId,
      state: 'INITIAL',
      wansatiState: { node: 'INITIAL', answers: {} },
      handover: false,
      expiresAt: now + previewSessionTtlMilliseconds,
      busy: false,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  private resolve(input: {
    readonly previewSessionId: string;
    readonly organizationId: string;
    readonly userId: string;
    readonly botDeploymentId: string;
    readonly botVersionId: string;
  }, now: number): BotPreviewSession {
    const session = this.sessions.get(input.previewSessionId);
    if (
      session === undefined
      || session.expiresAt <= now
      || session.organizationId !== input.organizationId
      || session.userId !== input.userId
      || session.botDeploymentId !== input.botDeploymentId
      || session.botVersionId !== input.botVersionId
    ) {
      throw new ConflictException({ code: 'BOT_PREVIEW_SESSION_UNAVAILABLE' });
    }
    return session;
  }

  private ensureCapacity(): void {
    if (this.sessions.size < maximumPreviewSessions) return;
    const oldest = [...this.sessions.values()]
      .filter((session) => !session.busy)
      .sort((left, right) => left.expiresAt - right.expiresAt)[0];
    if (oldest === undefined) throw new ConflictException({ code: 'BOT_PREVIEW_CAPACITY_REACHED' });
    this.sessions.delete(oldest.id);
  }

  private prune(now: number): void {
    for (const [id, session] of this.sessions) {
      if (!session.busy && session.expiresAt <= now) this.sessions.delete(id);
    }
  }
}

export const botPreviewSessionTtlMinutes = previewSessionTtlMilliseconds / 60_000;
export const botPreviewSessionMaximum = maximumPreviewSessions;
