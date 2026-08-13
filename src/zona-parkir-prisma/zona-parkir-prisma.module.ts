import { Global, Module } from '@nestjs/common';
import { ZonaParkirPrismaService } from './zona-parkir-prisma.service';

@Global()
@Module({
  providers: [ZonaParkirPrismaService]
})
export class ZonaParkirPrismaModule {}
