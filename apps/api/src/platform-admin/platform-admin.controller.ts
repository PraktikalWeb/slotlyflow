import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import type { FastifyRequest } from 'fastify';

import { CsrfService } from '../auth/csrf.service.js';
import { PlatformAdminService, parsePagination } from './platform-admin.service.js';
import {
  PlatformAuthorizationGuard,
  requirePlatformRequestContext,
  type PlatformAuthorizedRequest,
} from './platform-authorization.guard.js';
import { PlatformStaffService } from './platform-staff.service.js';
import { RequirePlatformPermission } from './require-platform-permission.decorator.js';

@Controller('admin')
@UseGuards(PlatformAuthorizationGuard)
export class PlatformAdminController {
  constructor(
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(PlatformAdminService) private readonly admin: PlatformAdminService,
    @Inject(PlatformStaffService) private readonly staff: PlatformStaffService,
  ) {}

  @Get('me')
  me(@Req() request: PlatformAuthorizedRequest): unknown {
    const context = requirePlatformRequestContext(request);
    return {
      user: context.user,
      platformStaff: {
        id: context.staff.id,
        role: context.staff.role,
        status: context.staff.status,
      },
      permissions: context.permissions,
    };
  }

  @Get('businesses')
  @RequirePlatformPermission('platform.businesses.read')
  listBusinesses(
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('search') search: string | undefined,
  ): Promise<unknown> {
    return this.admin.listBusinesses(page, pageSize, search);
  }

  @Get('businesses/:organizationId')
  @RequirePlatformPermission('platform.businesses.read')
  getBusiness(@Param('organizationId') organizationId: string): Promise<unknown> {
    return this.admin.getBusiness(organizationId);
  }

  @Patch('businesses/:organizationId/status')
  @RequirePlatformPermission('platform.businesses.manage')
  updateBusinessStatus(
    @Param('organizationId') organizationId: string,
    @Body() body: unknown,
    @Req() request: PlatformAuthorizedRequest,
  ): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return this.admin.updateBusinessStatus(requirePlatformRequestContext(request), organizationId, body);
  }

  @Get('users')
  @RequirePlatformPermission('platform.users.read')
  listUsers(
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('search') search: string | undefined,
  ): Promise<unknown> {
    return this.admin.listUsers(page, pageSize, search);
  }

  @Get('users/:userId')
  @RequirePlatformPermission('platform.users.read')
  getUser(@Param('userId') userId: string): Promise<unknown> {
    return this.admin.getUser(userId);
  }

  @Get('platform-staff')
  @RequirePlatformPermission('platform.staff.read')
  async listPlatformStaff(
    @Query('page') pageValue: string | undefined,
    @Query('pageSize') pageSizeValue: string | undefined,
  ): Promise<unknown> {
    const pagination = parsePagination(pageValue, pageSizeValue);
    const result = await this.staff.list(pagination);
    return { ...result, page: pagination.page, pageSize: pagination.pageSize };
  }

  @Post('platform-staff')
  @RequirePlatformPermission('platform.staff.manage')
  async grantPlatformStaff(
    @Body() body: unknown,
    @Req() request: PlatformAuthorizedRequest,
  ): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return { staff: await this.staff.grant(requirePlatformRequestContext(request), body) };
  }

  @Patch('platform-staff/:staffId')
  @RequirePlatformPermission('platform.staff.manage')
  async updatePlatformStaff(
    @Param('staffId') staffId: string,
    @Body() body: unknown,
    @Req() request: PlatformAuthorizedRequest,
  ): Promise<unknown> {
    this.csrf.assert(request as FastifyRequest);
    return { staff: await this.staff.update(requirePlatformRequestContext(request), staffId, body) };
  }
}
