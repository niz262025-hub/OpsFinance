import { describe, expect, it } from 'vitest';
import { reportCsv } from '../lib/report-csv';

describe('report CSV', () => {
  it('exports report totals, rows and selected period without dropping zero values', () => {
    const csv = reportCsv({totalDebit:'100.00', rows:[{accountName:'Cash, "Main"',credit:0}]}, {from:'2026-10-01'});
    expect(csv).toContain('"from","2026-10-01"');
    expect(csv).toContain('"report.totalDebit","100.00"');
    expect(csv).toContain('"report.rows[1].credit","0"');
    expect(csv).toContain('"Cash, ""Main"""');
  });
  it('neutralizes spreadsheet formulas from account names and metadata', () => {
    const csv = reportCsv({accountName:'=HYPERLINK("https://example.test")'}, {name:'@SUM(1)'});
    expect(csv).toContain("'@SUM(1)");
    expect(csv).toContain("'=HYPERLINK");
  });
});
