import { describe, expect, it } from 'vitest';
import { planSweep } from './layout';

describe('planSweep', () => {
  it('deletes staging folders and orphans, and keeps folders that have a row', () => {
    expect(planSweep(['keep0001', 'half0001.tmp', 'lost0001'], new Set(['keep0001']))).toEqual({
      staging: ['half0001.tmp'],
      orphans: ['lost0001'],
      keptOrphans: 0,
    });
  });

  it('keeps every orphan when there are more than crashes could leave', () => {
    const folders = ['lost0001', 'lost0002', 'lost0003', 'lost0004', 'lost0005', 'lost0006'];
    expect(planSweep(folders, new Set())).toEqual({ staging: [], orphans: [], keptOrphans: 6 });
  });

  it('keeps every orphan when the database has no photo rows', () => {
    expect(planSweep(['lost0001'], new Set())).toEqual({ staging: [], orphans: [], keptOrphans: 1 });
  });

  it('never touches a folder whose name is not a photo id', () => {
    expect(planSweep(['.hidden', 'short', 'a b c d e f', 'x/y.tmp'], new Set())).toEqual({ staging: [], orphans: [], keptOrphans: 0 });
  });
});
