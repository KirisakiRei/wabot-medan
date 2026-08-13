import { Module } from '@nestjs/common';
import { PengaduanService } from './pengaduan.service';
import { ActiveRequest } from 'src/active-request/active-request';

@Module({
  providers: [PengaduanService, ActiveRequest],
  exports : [PengaduanService]
})
export class PengaduanModule {}
