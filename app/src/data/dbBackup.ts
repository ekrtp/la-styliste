/** What follows the database name in a copy's file name, before the version number (spec §10: `<name>.db.bak-v<old>`). */
const BACKUP_INFIX = '.bak-v';

/** The file name of the copy taken before migrating away from schema `version`. */
export function backupName(dbName: string, version: number): string {
  return `${dbName}${BACKUP_INFIX}${version}`;
}

/** Whether `fileName` is one of `dbName`'s pre-migration copies. */
export function isBackupOf(dbName: string, fileName: string): boolean {
  const prefix = `${dbName}${BACKUP_INFIX}`;
  return fileName.startsWith(prefix) && /^\d+$/.test(fileName.slice(prefix.length));
}

/** `VACUUM INTO` writes a consistent copy of the live database, WAL pages included, which a file copy would miss. */
export function vacuumIntoSql(path: string): string {
  return `VACUUM INTO '${path.replaceAll("'", "''")}'`;
}
