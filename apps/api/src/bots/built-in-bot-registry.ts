import type {
  HandoverTestBotCapabilities,
  TrustedBuiltInBotHandler,
} from './built-in-bot-runtime.types.js';
import { HandoverTestBot } from './handover-test-bot.js';
import type { TrustedBotImplementationKey } from './trusted-bot-implementations.js';

/** One allow-listed registry shared by production and side-effect-free preview. */
export function createBuiltInBotRegistry(
  capabilities: HandoverTestBotCapabilities,
): Readonly<Record<TrustedBotImplementationKey, TrustedBuiltInBotHandler>> {
  return {
    HANDOVER_TEST_V1: new HandoverTestBot(capabilities),
  };
}
