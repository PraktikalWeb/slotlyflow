import { Logger } from '@nestjs/common';

import { describeOrganizationBusinessHours, evaluateOrganizationBusinessHours } from '../organizations/business-hours.js';
import type { BuiltInBotRuntimeOutcome, StructuredBotOutput, TrustedInboundBotRuntimeContext, WansatiBotCapabilities } from './built-in-bot-runtime.types.js';
import { decideWansatiTransition } from './wansati-brands-flow.js';

/** Reviewed, deterministic implementation. All tenant and provider effects remain platform-owned. */
export class WansatiBrandsBot {
  private readonly logger = new Logger(WansatiBrandsBot.name);

  constructor(private readonly capabilities: WansatiBotCapabilities) {}

  async execute(context: TrustedInboundBotRuntimeContext): Promise<BuiltInBotRuntimeOutcome> {
    try {
      if (await this.capabilities.hasHandover(context)) return 'SKIPPED_HUMAN_HANDOVER';
      const settings = await this.capabilities.getSettings(context);
      if (settings === undefined) return 'FAILED';
      const configuration = context.deployment.configuration;
      const sizeGuideUrl = configuration !== null && typeof configuration.sizeGuideUrl === 'string'
        ? verifiedHttpsUrl(configuration.sizeGuideUrl)
        : null;
      const website = settings.website === null ? null : verifiedHttpsUrl(settings.website);
      const transition = await this.capabilities.transition(context, (state) => decideWansatiTransition(state, context.input, { website, sizeGuideUrl }));

      if (transition.handoverRequested) {
        if (transition.requestType === undefined) return 'FAILED';
        const duringHours = evaluateOrganizationBusinessHours(settings, context.receivedAt);
        const result = await this.capabilities.establishHandover(context, {
          requestType: transition.requestType,
          answers: transition.stateAfter.answers,
          receivedAt: context.receivedAt.toISOString(),
          receivedDuringBusinessHours: duringHours,
          customerWhatsAppId: context.customerWhatsAppId,
        });
        if (result === undefined) return 'FAILED';
        if (!result.created) return 'SKIPPED_HUMAN_HANDOVER';
        const acknowledgement = handoverAcknowledgement(transition.requestType, duringHours, describeOrganizationBusinessHours(settings));
        await this.capabilities.reply(context, acknowledgement, `bot_handover_ack:${context.deployment.deploymentId}:${result.assignmentId}`);
        return 'EXECUTED';
      }

      if (transition.output === null) return 'FAILED';
      await this.capabilities.reply(context, transition.output, `bot_reply:${context.deployment.deploymentId}:${context.inboundMessageId}`);
      return 'EXECUTED';
    } catch (error) {
      this.logger.warn({
        event: 'wansati_bot_execution_failed',
        organization_id: context.organizationId,
        conversation_id: context.conversationId,
        exception_type: error instanceof Error ? error.name : 'UnknownError',
      });
      return 'FAILED';
    }
  }
}

function verifiedHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '' ? url.toString() : null;
  } catch {
    return null;
  }
}

function handoverAcknowledgement(requestType: string, duringHours: boolean | null, hours: string | null): StructuredBotOutput {
  if (duringHours === true) return { type: 'text', text: requestType === 'existing_matter'
    ? 'Thank you. A Wansati Brands representative will continue assisting you here shortly.'
    : 'Thank you. A Wansati Brands representative will assist you here shortly.' };
  if (duringHours === false && hours !== null) return {
    type: 'text',
    text: `Thank you. Our team is currently unavailable.\n\nOur operating hours are ${hours}.\n\nWe have received your message and a Wansati Brands representative will assist you during our operating hours.`,
  };
  // No invented schedule or availability promise when Business hours are not configured.
  return { type: 'text', text: 'Thank you. We have received your request. A Wansati Brands representative will follow up.' };
}
