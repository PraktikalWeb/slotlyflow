import { Logger } from '@nestjs/common';

import type {
  BuiltInBotRuntimeOutcome,
  BotReplyOption,
  HandoverTestBotCapabilities,
  HandoverTestBotState,
  HandoverTestTransitionDecision,
  NormalizedBotInput,
  StructuredBotOutput,
  TrustedInboundBotRuntimeContext,
} from './built-in-bot-runtime.types.js';

const mainMenuOptions: readonly BotReplyOption[] = [
  { id: 'GENERAL_ENQUIRY', label: 'General enquiry' },
  { id: 'TEST_INFORMATION', label: 'Test information' },
  { id: 'HANDOVER', label: 'Speak to a person' },
];
const submenuOptions: readonly BotReplyOption[] = [
  { id: 'MAIN_MENU', label: 'Back to main menu' },
  { id: 'HANDOVER', label: 'Speak to a person' },
];
const mainMenu: StructuredBotOutput = {
  type: 'interactive',
  body: 'Hi 👋 Welcome.\n\nPlease choose an option:',
  options: mainMenuOptions,
};
const handoverAcknowledgement: StructuredBotOutput = {
  type: 'text',
  text: 'Thanks. A member of the team will take over from here.',
};

/**
 * Reviewed, compiled implementation for HANDOVER_TEST_V1. It receives only
 * trusted context from the verified inbound persistence path and delegates
 * all assignment, notification, delivery, and provider work to the existing
 * platform capabilities.
 */
export class HandoverTestBot {
  private readonly logger = new Logger(HandoverTestBot.name);

  constructor(private readonly capabilities: HandoverTestBotCapabilities) {}

  async execute(context: TrustedInboundBotRuntimeContext): Promise<BuiltInBotRuntimeOutcome> {
    this.log('handover_test_bot_started', context);

    try {
      if (await this.capabilities.hasHandover(context)) {
        this.log('handover_test_bot_existing_handover_suppressed', context);
        return 'SKIPPED_HUMAN_HANDOVER';
      }

      const transition = await this.capabilities.transition(
        context,
        (state) => decideTransition(state, context.input),
      );
      this.log('handover_test_bot_state_transitioned', context, {
        normalized_input_type: context.input.type,
        state_before: transition.stateBefore,
        state_after: transition.stateAfter,
      });

      if (transition.stateBefore === 'HANDOVER') {
        this.log('handover_test_bot_existing_handover_suppressed', context);
        return 'SKIPPED_HUMAN_HANDOVER';
      }

      if (transition.handoverRequested) {
        this.log('handover_test_bot_handover_requested', context);
        const handover = await this.capabilities.establishHandover(context);
        if (handover === undefined) {
          this.log('handover_test_bot_handover_failed', context);
          return 'FAILED';
        }

        // The handover repository has transaction-level uniqueness protection.
        // A concurrent inbound message that created the assignment owns the acknowledgement.
        if (!handover.created) {
          this.log('handover_test_bot_existing_handover_suppressed', context);
          return 'SKIPPED_HUMAN_HANDOVER';
        }

        await this.capabilities.markHandover(context);
        this.log('handover_test_bot_handover_established', context, { handover_assignment_id: handover.assignmentId });
        this.log('handover_test_bot_acknowledgement_requested', context);
        try {
          await this.capabilities.reply(
            context,
            handoverAcknowledgement,
            // A durable reservation prevents duplicate provider sends across
            // webhook retries and process restarts.
            `bot_handover_ack:${context.deployment.deploymentId}:${handover.assignmentId}`,
          );
        } catch (error) {
          // A durable handover must never be rolled back merely because the
          // provider acknowledgement failed or its outcome was ambiguous.
          this.log('handover_test_bot_acknowledgement_failed', context, safeFailure(error));
          return 'FAILED';
        }

        this.log('handover_test_bot_acknowledgement_sent', context);
        return 'EXECUTED';
      }

      if (transition.output === null) return 'SKIPPED_HUMAN_HANDOVER';
      await this.capabilities.reply(
        context,
        transition.output,
        `bot_reply:${context.deployment.deploymentId}:${context.inboundMessageId}`,
      );
      return 'EXECUTED';
    } catch {
      // Keep the signed webhook pipeline stable when optional automation
      // dependencies are temporarily unavailable.
      this.log('handover_test_bot_execution_failed', context);
      return 'FAILED';
    }
  }

  private log(
    event: string,
    context: TrustedInboundBotRuntimeContext,
    additional: Record<string, string> = {},
  ): void {
    this.logger.log({
      event,
      organization_id: context.organizationId,
      whatsapp_connection_id: context.whatsappConnectionId,
      conversation_id: context.conversationId,
      inbound_message_id: context.inboundMessageId,
      bot_deployment_id: context.deployment.deploymentId,
      bot_version_id: context.deployment.botVersionId,
      ...additional,
    });
  }
}

function decideTransition(
  state: HandoverTestBotState,
  input: NormalizedBotInput,
): HandoverTestTransitionDecision {
  if (state === 'HANDOVER') return { stateAfter: 'HANDOVER', output: null, handoverRequested: false };
  if (state === 'INITIAL') return { stateAfter: 'MAIN_MENU', output: mainMenu, handoverRequested: false };

  const selection = normalizedSelection(state, input);
  if (state === 'MAIN_MENU') {
    if (selection === 'GENERAL_ENQUIRY') {
      return {
        stateAfter: 'GENERAL_ENQUIRY',
        output: submenu('This is a test response for a general enquiry.\n\nPlease choose an option:'),
        handoverRequested: false,
      };
    }
    if (selection === 'TEST_INFORMATION') {
      return {
        stateAfter: 'TEST_INFORMATION',
        output: submenu('This is a test information response.\n\nPlease choose an option:'),
        handoverRequested: false,
      };
    }
    if (selection === 'HANDOVER') return { stateAfter: state, output: null, handoverRequested: true };
    return {
      stateAfter: 'MAIN_MENU',
      output: { type: 'interactive', body: 'Please choose one of the options below:', options: mainMenuOptions },
      handoverRequested: false,
    };
  }

  if (selection === 'MAIN_MENU') return { stateAfter: 'MAIN_MENU', output: mainMenu, handoverRequested: false };
  if (selection === 'HANDOVER') return { stateAfter: state, output: null, handoverRequested: true };
  return {
    stateAfter: state,
    output: { type: 'interactive', body: 'Please choose an option:', options: submenuOptions },
    handoverRequested: false,
  };
}

function normalizedSelection(state: HandoverTestBotState, input: NormalizedBotInput): string {
  if (input.type === 'interactive_reply') return input.optionId;
  const text = input.text.trim();
  if (state === 'MAIN_MENU') {
    if (text === '1') return 'GENERAL_ENQUIRY';
    if (text === '2') return 'TEST_INFORMATION';
    if (text === '3') return 'HANDOVER';
  }
  if (state === 'GENERAL_ENQUIRY' || state === 'TEST_INFORMATION') {
    if (text === '1') return 'MAIN_MENU';
    if (text === '2') return 'HANDOVER';
  }
  return '';
}

function submenu(body: string): StructuredBotOutput {
  return { type: 'interactive', body, options: submenuOptions };
}

function safeFailure(error: unknown): Record<string, string> {
  if (typeof error !== 'object' || error === null) return { exception_type: 'UnknownError' };
  const exceptionType = 'name' in error && typeof error.name === 'string' ? error.name : 'UnknownError';
  if (!('getResponse' in error) || typeof error.getResponse !== 'function') return { exception_type: exceptionType };
  const response: unknown = error.getResponse();
  const code = typeof response === 'object' && response !== null && 'code' in response && typeof response.code === 'string'
    ? response.code
    : undefined;
  return code === undefined ? { exception_type: exceptionType } : { exception_type: exceptionType, failure_code: code };
}
