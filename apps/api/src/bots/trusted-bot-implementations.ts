/**
 * Allow-list only. An implementation key is a reference to reviewed server
 * code, never a module path, URL, script, or customer-supplied executable.
 */
export const trustedBotImplementationKeys = ['HANDOVER_TEST_V1'] as const;

export type TrustedBotImplementationKey = (typeof trustedBotImplementationKeys)[number];

export function isTrustedBotImplementationKey(value: string): value is TrustedBotImplementationKey {
  return (trustedBotImplementationKeys as readonly string[]).includes(value);
}
