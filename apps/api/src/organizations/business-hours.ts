import type { OrganizationSettings } from './organization.types.js';

const dayByShortName = {
  Mon: 'MONDAY', Tue: 'TUESDAY', Wed: 'WEDNESDAY', Thu: 'THURSDAY', Fri: 'FRIDAY', Sat: 'SATURDAY', Sun: 'SUNDAY',
} as const;

/** Null means hours were not configured or the timezone could not be evaluated safely. */
export function evaluateOrganizationBusinessHours(settings: OrganizationSettings, at: Date): boolean | null {
  if (!settings.businessHours.some((day) => day.enabled)) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: settings.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at);
    const weekday = parts.find((part) => part.type === 'weekday')?.value;
    const hour = parts.find((part) => part.type === 'hour')?.value;
    const minute = parts.find((part) => part.type === 'minute')?.value;
    if (weekday === undefined || !(weekday in dayByShortName) || hour === undefined || minute === undefined) return null;
    const day = dayByShortName[weekday as keyof typeof dayByShortName];
    const entry = settings.businessHours.find((candidate) => candidate.day === day);
    if (entry === undefined || !entry.enabled || entry.opensAt === null || entry.closesAt === null) return false;
    const currentTime = `${hour}:${minute}`;
    return currentTime >= entry.opensAt && currentTime < entry.closesAt;
  } catch {
    return null;
  }
}

export function describeOrganizationBusinessHours(settings: OrganizationSettings): string | null {
  const openDays = settings.businessHours.filter((day) => day.enabled && day.opensAt !== null && day.closesAt !== null);
  if (openDays.length === 0) return null;
  return `${openDays.map((day) => `${day.day.charAt(0)}${day.day.slice(1).toLowerCase()} ${day.opensAt}–${day.closesAt}`).join('; ')} (${settings.timezone})`;
}
