export type BotDeploymentConfiguration = Record<string, unknown> | null;

export interface BotDefinitionRecord {
  readonly id: string;
  readonly definitionKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: 'ACTIVE' | 'ARCHIVED';
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface BotVersionRecord {
  readonly id: string;
  readonly botDefinitionId: string;
  readonly version: string;
  readonly implementationKey: string;
  readonly configurationSchema: BotDeploymentConfiguration;
  readonly status: 'PUBLISHED' | 'RETIRED';
  readonly publishedAt: Date;
  readonly createdAt: Date;
}

export interface BotDeploymentRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly whatsappConnectionId: string;
  readonly botVersionId: string;
  readonly configuration: BotDeploymentConfiguration;
  readonly status: 'INACTIVE' | 'ACTIVE';
  readonly isPublished: boolean;
  readonly activatedAt: Date | null;
  readonly deactivatedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PlatformBotCatalogueVersion {
  readonly id: string;
  readonly version: string;
  readonly status: 'PUBLISHED' | 'RETIRED';
  readonly implementationKey: string;
  readonly configurationSchema: BotDeploymentConfiguration;
  readonly publishedAt: Date;
  readonly createdAt: Date;
}

export interface PlatformBotCatalogueDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: 'ACTIVE' | 'ARCHIVED';
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly versions: readonly PlatformBotCatalogueVersion[];
}

export interface PlatformBotDeploymentListItem {
  readonly id: string;
  readonly status: 'INACTIVE' | 'ACTIVE';
  readonly activatedAt: Date | null;
  readonly deactivatedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly business: {
    readonly id: string;
    readonly name: string;
    readonly status: 'ACTIVE' | 'SUSPENDED';
  };
  readonly whatsappConnection: {
    readonly id: string;
    readonly organizationId: string;
    readonly displayPhoneNumber: string | null;
    readonly provider: 'META';
    readonly status: 'PENDING' | 'VERIFYING' | 'CONNECTED' | 'FAILED' | 'DISCONNECTED' | 'NEEDS_REAUTH' | 'CONFLICT';
    readonly verificationStatus: 'VERIFIED' | 'CHECK_FAILED' | null;
  };
  readonly bot: {
    readonly definitionId: string;
    readonly name: string;
  };
  readonly version: {
    readonly id: string;
    readonly version: string;
    readonly implementationKey: string;
  };
  readonly publication: {
    readonly status: 'PUBLISHED' | 'UNPUBLISHED';
  };
}

export interface PlatformBotDeploymentListQuery {
  readonly pageSize: number;
  readonly offset: number;
  readonly organizationId?: string;
  readonly botDefinitionId?: string;
  readonly whatsappConnectionId?: string;
}

/** Business-safe publication state. Deployment identity remains server-side. */
export interface BotPublicationState {
  readonly isPublished: boolean;
}

/** Safe, server-derived metadata reserved for a future deterministic runtime. */
export interface ResolvedBotRuntimeMetadata {
  readonly deploymentId: string;
  readonly organizationId: string;
  readonly whatsappConnectionId: string;
  readonly botDefinitionId: string;
  readonly botVersionId: string;
  readonly implementationKey: string;
  readonly configuration: BotDeploymentConfiguration;
  readonly isPublished: boolean;
}
