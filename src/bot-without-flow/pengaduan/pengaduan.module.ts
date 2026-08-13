import { Module } from '@nestjs/common';
import { PengaduanService } from './pengaduan.service';

@Module({
  providers: [PengaduanService],
  exports : [PengaduanService]
})
export class PengaduanModule {}
