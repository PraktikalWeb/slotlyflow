import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { botConversationStates, type SlotlyFlowDatabase } from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type {
  HandoverTestBotState,
  HandoverTestCommittedTransition,
  HandoverTestTransitionDecision,
  TrustedInboundBotRuntimeContext,
  WansatiBotState,
  WansatiTransitionDecision,
} from './built-in-bot-runtime.types.js';

export interface BotConversationStateRepository {
  transition(
    context: TrustedInboundBotRuntimeContext,
    decide: (state: HandoverTestBotState) => HandoverTestTransitionDecision,
  ): Promise<HandoverTestCommittedTransition>;
  markHandover(context: TrustedInboundBotRuntimeContext): Promise<void>;
  transitionWansati(
    context: TrustedInboundBotRuntimeContext,
    decide: (state: WansatiBotState) => WansatiTransitionDecision,
  ): Promise<WansatiTransitionDecision>;
}

@Injectable()
export class DrizzleBotConversationStateRepository implements BotConversationStateRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async transition(
    context: TrustedInboundBotRuntimeContext,
    decide: (state: HandoverTestBotState) => HandoverTestTransitionDecision,
  ): Promise<HandoverTestCommittedTransition> {
    return this.db.transaction(async (tx) => {
      await tx.insert(botConversationStates).values({
        ...executionContext(context),
        state: 'INITIAL',
      }).onConflictDoNothing({
        target: [
          botConversationStates.organizationId,
          botConversationStates.conversationId,
          botConversationStates.botDeploymentId,
          botConversationStates.botVersionId,
        ],
      });

      const [current] = await tx.select().from(botConversationStates).where(stateContext(context)).for('update');
      if (current === undefined || !isHandoverTestState(current.state)) {
        throw new Error('Bot conversation state is unavailable or invalid.');
      }
      const stateBefore = current.state;
      const decision = decide(stateBefore);
      if (!isHandoverTestState(decision.stateAfter)) throw new Error('Bot state transition is invalid.');
      if (decision.stateAfter !== stateBefore) {
        await tx.update(botConversationStates).set({
          state: decision.stateAfter,
          updatedAt: new Date(),
        }).where(eq(botConversationStates.id, current.id));
      }
      return { stateBefore, ...decision };
    });
  }

  async markHandover(context: TrustedInboundBotRuntimeContext): Promise<void> {
    const [updated] = await this.db.update(botConversationStates).set({
      state: 'HANDOVER',
      updatedAt: new Date(),
    }).where(stateContext(context)).returning({ id: botConversationStates.id });
    if (updated === undefined) throw new Error('Bot handover state could not be persisted.');
  }

  async transitionWansati(
    context: TrustedInboundBotRuntimeContext,
    decide: (state: WansatiBotState) => WansatiTransitionDecision,
  ): Promise<WansatiTransitionDecision> {
    return this.db.transaction(async (tx) => {
      await tx.insert(botConversationStates).values({
        ...executionContext(context),
        state: 'INITIAL',
      }).onConflictDoNothing({
        target: [
          botConversationStates.organizationId,
          botConversationStates.conversationId,
          botConversationStates.botDeploymentId,
          botConversationStates.botVersionId,
        ],
      });
      const [current] = await tx.select().from(botConversationStates).where(stateContext(context)).for('update');
      if (current === undefined || !isAnswerRecord(current.data)) throw new Error('Bot conversation state is unavailable or invalid.');
      const decision = decide({ node: current.state, answers: current.data });
      if (decision.stateAfter.node.length === 0 || decision.stateAfter.node.length > 64 || !isAnswerRecord(decision.stateAfter.answers)) {
        throw new Error('Bot state transition is invalid.');
      }
      await tx.update(botConversationStates).set({
        state: decision.stateAfter.node,
        data: { ...decision.stateAfter.answers },
        updatedAt: new Date(),
      }).where(and(eq(botConversationStates.id, current.id), stateContext(context)));
      return decision;
    });
  }
}

function isAnswerRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 32
    && entries.every(([key, answer]) => /^[a-z][a-z0-9_]{0,63}$/.test(key) && typeof answer === 'string' && answer.length <= 4_096);
}

function executionContext(context: TrustedInboundBotRuntimeContext): {
  readonly organizationId: string;
  readonly whatsappConnectionId: string;
  readonly conversationId: string;
  readonly botDeploymentId: string;
  readonly botVersionId: string;
} {
  return {
    organizationId: context.organizationId,
    whatsappConnectionId: context.whatsappConnectionId,
    conversationId: context.conversationId,
    botDeploymentId: context.deployment.deploymentId,
    botVersionId: context.deployment.botVersionId,
  };
}

function stateContext(context: TrustedInboundBotRuntimeContext) {
  return and(
    eq(botConversationStates.organizationId, context.organizationId),
    eq(botConversationStates.whatsappConnectionId, context.whatsappConnectionId),
    eq(botConversationStates.conversationId, context.conversationId),
    eq(botConversationStates.botDeploymentId, context.deployment.deploymentId),
    eq(botConversationStates.botVersionId, context.deployment.botVersionId),
  );
}

function isHandoverTestState(value: string): value is HandoverTestBotState {
  return value === 'INITIAL'
    || value === 'MAIN_MENU'
    || value === 'GENERAL_ENQUIRY'
    || value === 'TEST_INFORMATION'
    || value === 'HANDOVER';
}
