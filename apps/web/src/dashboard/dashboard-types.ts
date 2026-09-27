export interface DashboardUser {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly passwordAuthenticationEnabled?: boolean;
  readonly firstName?: string;
  readonly lastName?: string;
}

export interface DashboardBusinessMembership {
  readonly organization: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  };
  readonly role: 'OWNER' | 'ADMIN' | 'AGENT';
  readonly status: 'active' | 'invited' | 'disabled';
}

export function activeBusinessMemberships(
  memberships: readonly DashboardBusinessMembership[],
): readonly DashboardBusinessMembership[] {
  return memberships.filter((membership) => membership.status === 'active');
}

export function dashboardDisplayName(user: DashboardUser): string {
  const name = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => part !== undefined && part !== '')
    .join(' ');
  return name || user.email;
}

export function dashboardUserInitials(user: DashboardUser): string {
  const namedParts = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => part !== undefined && part !== '');
  if (namedParts.length > 0) return namedParts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  const emailName = user.email.split('@')[0] ?? user.email;
  const emailParts = emailName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const initials = emailParts.length > 1
    ? emailParts.slice(0, 2).map((part) => part[0]).join('')
    : emailName.slice(0, 2);
  return initials.toUpperCase() || 'U';
}

export function businessInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'B';
}
