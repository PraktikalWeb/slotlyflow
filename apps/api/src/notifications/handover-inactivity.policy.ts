export const defaultHandoverInactivityMinutes = 1_440;
export const minimumHandoverInactivityMinutes = 15;
export const maximumHandoverInactivityMinutes = 43_200;

export interface HandoverInactivityPolicy {
  readonly handoverAutoCloseEnabled: boolean;
  readonly handoverInactivityMinutes: number;
}

export function validHandoverInactivityMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
    && value >= minimumHandoverInactivityMinutes && value <= maximumHandoverInactivityMinutes;
}

export function handoverDeadline(activityAt: Date, policy: HandoverInactivityPolicy): Date | null {
  return policy.handoverAutoCloseEnabled
    ? new Date(activityAt.getTime() + policy.handoverInactivityMinutes * 60_000)
    : null;
}
