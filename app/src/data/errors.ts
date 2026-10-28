/** The database was written by a newer build of the app. Opening it with older migrations could lose data, so the app refuses. */
export class SchemaTooNewError extends Error {
  readonly found: number;
  readonly known: number;

  constructor(found: number, known: number) {
    super(`Database schema v${found} is newer than this app (v${known})`);
    this.name = 'SchemaTooNewError';
    this.found = found;
    this.known = known;
  }
}

/** A settings patch held a value its parser rejects. Nothing of that patch was written. */
export class InvalidSettingError extends Error {
  readonly setting: string;

  constructor(setting: string) {
    super(`Invalid value for setting "${setting}"`);
    this.name = 'InvalidSettingError';
    this.setting = setting;
  }
}
