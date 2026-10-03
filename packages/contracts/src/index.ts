export interface ServiceStatusResponse {
  readonly status: 'ok';
  readonly service: 'api';
}

const postAuthenticationOrigin = 'https://slotlyflow.invalid';

export const defaultPostAuthenticationPath = '/dashboard';

/**
 * Normalizes a post-authentication destination to an internal dashboard path.
 * Values outside that small allow-list never influence navigation.
 */
export function safePostAuthenticationPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048 || !value.startsWith('/')) {
    return defaultPostAuthenticationPath;
  }

  try {
    const parsed = new URL(value, postAuthenticationOrigin);
    if (
      parsed.origin !== postAuthenticationOrigin ||
      parsed.pathname.includes('%') ||
      (parsed.pathname !== '/dashboard' && !parsed.pathname.startsWith('/dashboard/'))
    ) {
      return defaultPostAuthenticationPath;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return defaultPostAuthenticationPath;
  }
}

export interface RegisterRequest {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly password: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface EmailAddressRequest {
  readonly email: string;
}

export interface PasswordResetRequest {
  readonly token: string;
  readonly password: string;
}

export interface UpdateCurrentUserProfileRequest {
  readonly firstName: string;
  readonly lastName: string;
}

export interface ChangeCurrentUserPasswordRequest {
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface TokenRequest {
  readonly token: string;
}

export interface AuthenticatedUserResponse {
  readonly id: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly passwordAuthenticationEnabled: boolean;
}

export interface AuthenticationResponse {
  readonly user: AuthenticatedUserResponse;
}

export interface AuthenticationPendingVerificationResponse {
  readonly status: 'EMAIL_VERIFICATION_REQUIRED';
}

export interface AuthenticationAcceptedResponse {
  readonly status: 'ACCEPTED';
}

export interface CreateOrganizationRequest {
  readonly name: string;
  readonly slug: string;
}

export interface OrganizationResponse {
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

export interface OrganizationBusinessHourResponse {
  readonly day: OrganizationBusinessDay;
  readonly enabled: boolean;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

export interface OrganizationSettingsResponse extends OrganizationResponse {
  readonly businessEmail: string | null;
  readonly contactNumber: string | null;
  readonly website: string | null;
  readonly timezone: string;
  readonly businessHours: readonly OrganizationBusinessHourResponse[];
}

export interface UpdateOrganizationSettingsRequest {
  readonly name: string;
  readonly businessEmail: string | null;
  readonly contactNumber: string | null;
  readonly website: string | null;
  readonly timezone: string;
  readonly businessHours: readonly OrganizationBusinessHourResponse[];
}

export interface UpdateOrganizationSettingsResponse {
  readonly organization: OrganizationSettingsResponse;
}

export interface OrganizationMembershipResponse {
  readonly organization: OrganizationResponse;
  readonly role: 'OWNER' | 'ADMIN' | 'AGENT';
  readonly status: 'active' | 'invited' | 'disabled';
}

export interface CreateOrganizationResponse {
  readonly organization: OrganizationResponse;
  readonly membership: OrganizationMembershipResponse;
}

export interface OrganizationMembershipListResponse {
  readonly organizations: readonly OrganizationMembershipResponse[];
}

export interface OrganizationContextResponse {
  readonly organization: OrganizationSettingsResponse;
  readonly membership: {
    readonly role: 'OWNER' | 'ADMIN' | 'AGENT';
    readonly status: 'active';
  };
}

export interface OrganizationMemberResponse {
  readonly id: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
  };
  readonly role: 'OWNER' | 'ADMIN' | 'AGENT';
  readonly status: 'active' | 'invited' | 'disabled';
}

export interface OrganizationMemberListResponse {
  readonly memberships: readonly OrganizationMemberResponse[];
}

export interface UpdateOrganizationMembershipRoleRequest {
  readonly role: 'OWNER' | 'ADMIN' | 'AGENT';
}

export interface OrganizationMembershipMutationResponse {
  readonly membership: OrganizationMemberResponse;
}

/** Safe WhatsApp connection state for an authorized Business member. */
export interface WhatsAppConnectionResponse {
  readonly connection: {
    readonly id: string;
    readonly provider: 'META';
    readonly connectionSource: 'EXISTING_BUSINESS_APP' | 'NEW_NUMBER' | 'EXISTING_PLATFORM';
    readonly connectionStatus: 'PENDING' | 'VERIFYING' | 'CONNECTED' | 'FAILED' | 'DISCONNECTED' | 'NEEDS_REAUTH' | 'CONFLICT';
    readonly displayPhoneNumber: string | null;
    readonly verificationStatus: 'VERIFIED' | 'CHECK_FAILED' | null;
    readonly lastVerifiedAt: string | null;
  };
}

export type WhatsAppConnectionTestStatus = 'NOT_TESTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';
export type WhatsAppConnectionTestStage = 'WAITING_FOR_MESSAGE' | 'MESSAGE_RECEIVED' | 'REPLY_SENT' | 'PASSED' | 'FAILED';

/** Safe, Business-scoped platform Connection Test state. */
export interface WhatsAppConnectionTestResponse {
  readonly test: {
    readonly id: string | null;
    readonly status: WhatsAppConnectionTestStatus;
    readonly stage: WhatsAppConnectionTestStage | null;
    readonly testSenderPhoneNumber: string | null;
    readonly expiresAt: string | null;
    readonly inboundReceivedAt: string | null;
    readonly replySentAt: string | null;
    readonly completedAt: string | null;
  };
}

export interface StartWhatsAppConnectionTestRequest {
  readonly testPhoneNumber: string;
}

/** M2.1 accepts only the currently supported product onboarding source. */
export interface StartWhatsAppOnboardingRequest {
  readonly source: 'EXISTING_BUSINESS_APP';
}

/** Safe values needed by M2.2's browser-only Meta Embedded Signup integration. */
export interface MetaEmbeddedSignupPublicConfig {
  readonly appId: string;
  readonly embeddedSignupConfigurationId: string;
  readonly graphApiVersion: string;
}

/**
 * A short-lived, durable, server-authorized onboarding attempt. The opaque
 * UUID is only a correlation handle; completion must still verify its actor,
 * Organization, expiry, status, and provider evidence server-side.
 */
export interface StartWhatsAppOnboardingResponse {
  readonly onboarding: {
    readonly transactionId: string;
    readonly handoffToken: string;
    readonly provider: 'META';
    readonly source: 'EXISTING_BUSINESS_APP';
    readonly expiresAt: string;
  };
  readonly meta: MetaEmbeddedSignupPublicConfig;
}

/** Opaque capability used only by the separate HTTPS Embedded Signup window. */
export interface ResolveWhatsAppOnboardingHandoffRequest {
  readonly handoffToken: string;
}

export interface ResolveWhatsAppOnboardingHandoffResponse {
  readonly meta: MetaEmbeddedSignupPublicConfig;
}

export interface CompleteWhatsAppOnboardingHandoffRequest extends CompleteWhatsAppOnboardingRequest {
  readonly handoffToken: string;
}

/** M2.3 transient browser evidence. No token, credential reference, or status is accepted. */
export interface CompleteWhatsAppOnboardingRequest {
  readonly authorizationCode: string;
  readonly phoneNumberId: string;
  readonly whatsappBusinessAccountId: string;
}

/** Safe persisted state only; provider identifiers and credentials stay server-side. */
export interface CompleteWhatsAppOnboardingResponse {
  readonly connection: WhatsAppConnectionResponse['connection'];
}

/** M3.2 accepts only a human-authored text body; routing is server-derived. */
export interface SendConversationTextRequest {
  readonly text: string;
}

/** Safe outbound result. Provider identifiers and credential references stay server-side. */
export interface SendConversationTextResponse {
  readonly message: {
    readonly id: string;
    readonly direction: 'OUTBOUND';
    readonly messageType: 'TEXT';
    readonly status: 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    readonly createdAt: string;
  };
}

export interface TeamResponse {
  readonly id: string;
  readonly name: string;
  readonly memberCount: number;
}

export interface TeamListResponse {
  readonly teams: readonly TeamResponse[];
}

export interface CreateTeamRequest {
  readonly name: string;
}

export interface AddTeamMemberRequest {
  readonly organizationMemberId: string;
}

export interface OrganizationNotificationSettingsResponse {
  readonly handoverTeamId: string | null;
  readonly fallbackEmailAddresses: readonly string[];
  readonly emailNotificationsEnabled: boolean;
}

export interface UpdateOrganizationNotificationSettingsRequest extends OrganizationNotificationSettingsResponse {}

export interface UserNotificationPreferencesResponse {
  readonly preferredEmail: string | null;
  readonly emailNotificationsEnabled: boolean;
}

export interface UpdateUserNotificationPreferencesRequest extends UserNotificationPreferencesResponse {}

export interface NotificationResponse {
  readonly id: string;
  readonly type: 'HANDOVER_ASSIGNED';
  readonly resourceType: 'CONVERSATION';
  readonly resourceId: string;
  readonly title: string;
  readonly body: string;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface OrganizationNotificationsResponse {
  readonly notifications: readonly NotificationResponse[];
}

export interface NotificationUnreadCountResponse {
  readonly count: number;
}

export interface HandoverAssignmentResponse {
  readonly id: string;
  readonly status: 'WAITING' | 'ASSIGNED';
  readonly conversationId: string;
  readonly teamId: string | null;
  readonly assigneeUserId: string | null;
}

export interface HandoverInactivitySettingsResponse {
  readonly handoverAutoCloseEnabled: boolean;
  readonly handoverInactivityMinutes: number;
}

export interface UpdateHandoverInactivitySettingsRequest extends HandoverInactivitySettingsResponse {}

export interface ResolveHandoverResponse {
  readonly outcome: 'closed' | 'already_closed';
}

export type BotPublicationStatus = 'PUBLISHED' | 'UNPUBLISHED' | 'NOT_CONFIGURED';

/** Safe Business-facing publication state; deployment identity is never exposed. */
export interface BotPublicationResponse {
  readonly status: BotPublicationStatus;
}

export interface UpdateBotPublicationRequest {
  readonly published: boolean;
}

export type BotPreviewInput =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'interactive_reply'; readonly optionId: string };

export interface BotPreviewOption {
  readonly id: string;
  readonly label: string;
}

export type BotPreviewMessage =
  | { readonly type: 'text'; readonly text: string }
  | {
    readonly type: 'interactive';
    readonly body: string;
    readonly options: readonly BotPreviewOption[];
    readonly listButtonLabel?: string;
  };

export interface BotPreviewRequest {
  readonly previewSessionId: string | null;
  readonly input: BotPreviewInput;
}

/** Safe preview output. No deployment, connection, customer, or provider identifiers leave the API. */
export interface BotPreviewResponse {
  readonly previewSessionId: string;
  readonly messages: readonly BotPreviewMessage[];
  readonly handover: boolean;
}

export interface BotPreviewResetRequest {
  readonly previewSessionId: string;
}

export interface BotPreviewResetResponse {
  readonly reset: true;
}
