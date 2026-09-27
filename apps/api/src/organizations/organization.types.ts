export type OrganizationMemberRole = 'OWNER' | 'ADMIN' | 'AGENT';
export type OrganizationMemberStatus = 'active' | 'invited' | 'disabled';

export interface OrganizationSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export type OrganizationBusinessDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface OrganizationBusinessHour {
  readonly day: OrganizationBusinessDay;
  readonly enabled: boolean;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

export interface OrganizationSettings extends OrganizationSummary {
  readonly businessEmail: string | null;
  readonly contactNumber: string | null;
  readonly website: string | null;
  readonly timezone: string;
  readonly businessHours: readonly OrganizationBusinessHour[];
}

export interface UpdateOrganizationSettingsCommand {
  readonly name: string;
  readonly businessEmail: string | null;
  readonly contactNumber: string | null;
  readonly website: string | null;
  readonly timezone: string;
  readonly businessHours: readonly OrganizationBusinessHour[];
}

export interface ResolvedOrganizationMembership {
  readonly organization: OrganizationSummary;
  readonly role: OrganizationMemberRole;
  readonly status: OrganizationMemberStatus;
}

export interface CreateOrganizationCommand {
  readonly name: string;
  readonly slug: string;
}

export interface CreatedOrganization {
  readonly organization: OrganizationSummary;
  readonly membership: ResolvedOrganizationMembership;
}

/** Values are derived only from an authenticated user and a persisted active membership. */
export interface TrustedOrganizationContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly role: OrganizationMemberRole;
  readonly status: 'active';
  readonly organization: OrganizationSummary;
}

/** Organization-scoped membership data. It is never resolved by membership ID alone. */
export interface OrganizationScopedMembership {
  readonly id: string;
  readonly organizationId: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
  };
  readonly role: OrganizationMemberRole;
  readonly status: OrganizationMemberStatus;
}

export type MembershipMutation =
  | { readonly kind: 'role'; readonly role: OrganizationMemberRole }
  | { readonly kind: 'deactivate' };

export type MembershipMutationResult =
  | { readonly outcome: 'not_found' }
  | { readonly outcome: 'forbidden' }
  | { readonly outcome: 'last_active_owner' }
  | { readonly outcome: 'updated'; readonly membership: OrganizationScopedMembership };
