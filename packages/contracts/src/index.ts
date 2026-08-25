export interface ServiceStatusResponse {
  readonly status: 'ok';
  readonly service: 'api';
}

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
}

export type LoginRequest = RegisterRequest;

export interface EmailAddressRequest {
  readonly email: string;
}

export interface PasswordResetRequest {
  readonly token: string;
  readonly password: string;
}

export interface TokenRequest {
  readonly token: string;
}

export interface AuthenticatedUserResponse {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
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
