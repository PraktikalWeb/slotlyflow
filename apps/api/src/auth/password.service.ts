import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { AuthenticationConfig } from '@slotlyflow/config';

import { AUTH_CONFIG } from './auth.tokens.js';

@Injectable()
export class PasswordService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig) {}

  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: this.config.argon2.memoryCost, timeCost: this.config.argon2.timeCost, parallelism: this.config.argon2.parallelism });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
