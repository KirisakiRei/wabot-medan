// logger.utils.ts
import * as fs from 'fs';
import * as path from 'path';

export function getTodayLogDir() {
  const now = new Date();
  const dir = path.join(
    'logs',
    now.getFullYear().toString(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  );

  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
