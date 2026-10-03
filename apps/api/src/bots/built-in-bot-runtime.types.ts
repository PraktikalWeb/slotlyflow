import type { ResolvedBotRuntimeMetadata } from './bot-deployment.types.js';
import type { InboundWhatsAppMessageType } from '../whatsapp/inbound-whatsapp-message.types.js';
import type { OrganizationSettings } from '../organizations/organization.types.js';
import type { TrustedAutomationHandoverContext } from '../notifications/handover-context.types.js';

export type NormalizedBotInput =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'interactive_reply'; readonly optionId: string };

export interface BotReplyOption {
  readonly id: string;
  readonly label: string;
}

export type StructuredBotOutput =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'interactive'; readonly body: string; readonly options: readonly BotReplyOption[] };

export type HandoverTestBotState =
  | 'INITIAL'
  | 'MAIN_MENU'
  | 'GENERAL_ENQUIRY'
  | 'TEST_INFORMATION'
  | 'HANDOVER';

export interface HandoverTestTransitionDecision {
  readonly stateAfter: HandoverTestBotState;
  readonly output: StructuredBotOutput | null;
  readonly handoverRequested: boolean;
}

export interface HandoverTestCommittedTransition extends HandoverTestTransitionDecision {
  readonly stateBefore: HandoverTestBotState;
}

export type BuiltInBotRuntimeOutcome =
  | 'EXECUTED'
  | 'SKIPPED_NO_DEPLOYMENT'
  | 'SKIPPED_UNPUBLISHED'
  | 'SKIPPED_HUMAN_HANDOVER'
  | 'SKIPPED_UNSUPPORTED_MESSAGE'
  | 'UNKNOWN_IMPLEMENTATION'
  | 'FAILED';

/**
 * Every value originates from the verified webhook persistence path or the
 * server-side active deployment resolver. This is deliberately not a request
 * or provider payload type.
 */
export interface TrustedInboundBotRuntimeContext {
  readonly organizationId: string;
  readonly whatsappConnectionId: string;
  readonly conversationId: string;
  readonly inboundMessageId: string;
  readonly providerMessageId: string;
  readonly receivedAt: Date;
  readonly customerWhatsAppId: string;
  readonly messageType: InboundWhatsAppMessageType;
  readonly input: NormalizedBotInput;
  readonly deployment: ResolvedBotRuntimeMetadata;
}

export interface TrustedBuiltInBotHandler {
  execute(context: TrustedInboundBotRuntimeContext): Promise<BuiltInBotRuntimeOutcome>;
}

/**
 * The reviewed Bot implementation owns the workflow decision while these
 * capabilities decide whether execution has production or preview effects.
 */
export interface HandoverTestBotCapabilities {
  hasHandover(context: TrustedInboundBotRuntimeContext): Promise<boolean>;
  establishHandover(context: TrustedInboundBotRuntimeContext): Promise<{
    readonly created: boolean;
    readonly assignmentId: string;
  } | undefined>;
  transition(
    context: TrustedInboundBotRuntimeContext,
    decide: (state: HandoverTestBotState) => HandoverTestTransitionDecision,
  ): Promise<HandoverTestCommittedTransition>;
  markHandover(context: TrustedInboundBotRuntimeContext): Promise<void>;
  reply(
    context: TrustedInboundBotRuntimeContext,
    output: StructuredBotOutput,
    idempotencyKey: string,
  ): Promise<void>;
}

/** Durable answers are keyed by reviewed collection-node IDs, not inferred from message text. */
export interface WansatiBotState {
  readonly node: string;
  readonly answers: Readonly<Record<string, string>>;
}

export interface WansatiTransitionDecision {
  readonly stateAfter: WansatiBotState;
  readonly output: StructuredBotOutput | null;
  readonly handoverRequested: boolean;
  readonly requestType?: string;
}

export interface WansatiBotCapabilities {
  hasHandover(context: TrustedInboundBotRuntimeContext): Promise<boolean>;
  establishHandover(context: TrustedInboundBotRuntimeContext, details: TrustedAutomationHandoverContext): Promise<{ readonly created: boolean; readonly assignmentId: string } | undefined>;
  transition(context: TrustedInboundBotRuntimeContext, decide: (state: WansatiBotState) => WansatiTransitionDecision): Promise<WansatiTransitionDecision>;
  getSettings(context: TrustedInboundBotRuntimeContext): Promise<OrganizationSettings | undefined>;
  reply(context: TrustedInboundBotRuntimeContext, output: StructuredBotOutput, idempotencyKey: string): Promise<void>;
}
