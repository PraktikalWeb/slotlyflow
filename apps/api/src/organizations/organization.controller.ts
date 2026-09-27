import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
import type {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  OrganizationContextResponse,
  OrganizationMemberListResponse,
  OrganizationMembershipMutationResponse,
  OrganizationMembershipListResponse,
  UpdateOrganizationMembershipRoleRequest,
  UpdateOrganizationSettingsRequest,
  UpdateOrganizationSettingsResponse,
} from '@slotlyflow/contracts';
import type { FastifyRequest } from 'fastify';

import { AUTH_CONFIG } from '../auth/auth.tokens.js';
import { AuthService } from '../auth/auth.service.js';
import { CsrfService } from '../auth/csrf.service.js';
import { OrganizationService } from './organization.service.js';
import { OrganizationContextService } from './organization-context.service.js';

@Controller('organizations')
export class OrganizationController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(OrganizationService) private readonly organizations: OrganizationService,
    @Inject(OrganizationContextService) private readonly contexts: OrganizationContextService,
  ) {}

  @Post()
  async create(
    @Body() body: CreateOrganizationRequest,
    @Req() request: FastifyRequest,
  ): Promise<CreateOrganizationResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    this.csrf.assert(request);
    return this.organizations.createForAuthenticatedUser(actor.id, body);
  }

  @Get()
  async list(@Req() request: FastifyRequest): Promise<OrganizationMembershipListResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    return { organizations: await this.organizations.resolveMembershipsForAuthenticatedUser(actor.id) };
  }

  @Get(':organizationId/memberships')
  async listMemberships(
    @Param('organizationId') organizationId: string,
    @Req() request: FastifyRequest,
  ): Promise<OrganizationMemberListResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'membership.read');
    return { memberships: await this.organizations.listMemberships(context) };
  }

  @Patch(':organizationId/memberships/:membershipId/role')
  async changeMembershipRole(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateOrganizationMembershipRoleRequest,
    @Req() request: FastifyRequest,
  ): Promise<OrganizationMembershipMutationResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    this.csrf.assert(request);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'membership.update_role');
    return { membership: await this.organizations.changeMembershipRole(context, membershipId, body) };
  }

  @Patch(':organizationId/memberships/:membershipId/deactivate')
  async deactivateMembership(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: FastifyRequest,
  ): Promise<OrganizationMembershipMutationResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    this.csrf.assert(request);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'membership.remove');
    return { membership: await this.organizations.deactivateMembership(context, membershipId) };
  }

  @Get(':organizationId')
  async detail(
    @Param('organizationId') organizationId: string,
    @Req() request: FastifyRequest,
  ): Promise<OrganizationContextResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'organization.read');
    return this.organizations.getOrganizationForContext(context);
  }

  @Patch(':organizationId')
  async updateSettings(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateOrganizationSettingsRequest,
    @Req() request: FastifyRequest,
  ): Promise<UpdateOrganizationSettingsResponse> {
    const actor = await this.auth.current(request.cookies[this.config.session.cookieName]);
    this.csrf.assert(request);
    const context = await this.contexts.resolveForPermission(actor.id, organizationId, 'organization.update');
    return { organization: await this.organizations.updateOrganizationSettings(context, body) };
  }
}
