// daily-folder-transport.ts
import * as DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import { getTodayLogDir } from './logger.utils';

export function createDailyFolderTransport(options: {
  level?: string;
  filename: string;
}) {
  return new DailyRotateFile({
    level: options.level,
    dirname: getTodayLogDir(), // dihitung saat rotasi
    filename: options.filename,
    datePattern: 'YYYY-MM-DD',
    format: undefined,
    createSymlink: false,
    auditFile: path.join('logs', `.audit-${options.filename}.json`),
  });
}
