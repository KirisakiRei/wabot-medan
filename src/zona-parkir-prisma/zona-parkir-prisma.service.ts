import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from 'generated/zona-parkir';

@Injectable()
export class ZonaParkirPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
