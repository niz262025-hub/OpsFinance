import { parseCsvRow } from '../../packages/csv-import';

export function normalizeAccountNumber(value: string): string {
  const number = value.trim().replace(/[\s-]/g, '');
  if (!/^\d{4,34}$/.test(number)) throw new Error('A full numeric account number is required; masked or partial numbers cannot be verified.');
  return number;
}

const accountLabel = (value: string) => /^(accountnumber|accountno|accno|nomborakaun|noakaun)$/.test(value.toLowerCase().replace(/[\s_.:#-]/g, ''));

// Recognize explicit account metadata only. Never infer an account from amounts,
// references, narration, or a manually entered upload confirmation.
export function verifyStatementAccount(content: string, expected: string | null | undefined): { csv: string; accountNumber: string } {
  if (!expected) throw new Error('Account verification unavailable. Add the account number in Financial Accounts before importing.');
  const expectedNumber = normalizeAccountNumber(expected);
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  const headerIndex = lines.findIndex(line => {
    const fields = parseCsvRow(line).map(field => field.toLowerCase().trim());
    return fields.some(field => ['date', 'transactiondate'].includes(field)) && fields.some(field => ['description', 'narration'].includes(field));
  });
  if (headerIndex < 0) throw new Error('Statement format not recognized. Use CSV/TXT with date, description, debit/credit and Account Number metadata.');
  const detected: string[] = [];
  for (const line of lines.slice(0, headerIndex)) {
    const fields = parseCsvRow(line);
    if (accountLabel(fields[0] ?? '') && fields[1]) detected.push(fields[1]);
    else {
      const pair = line.match(/^\s*(Account\s*(?:Number|No\.?|#)|Acc\.?\s*No\.?|Nombor\s*Akaun|No\.?\s*Akaun)\s*:\s*(.+?)\s*$/i);
      if (pair) detected.push(pair[2]);
    }
  }
  const header = parseCsvRow(lines[headerIndex]);
  const accountColumns = header.map((field, index) => accountLabel(field) ? index : -1).filter(index => index >= 0);
  for (const line of lines.slice(headerIndex + 1)) {
    const fields = parseCsvRow(line);
    for (const column of accountColumns) {
      if (!fields[column]?.trim()) throw new Error('Account verification unavailable. Every statement row must contain its full account number.');
      detected.push(fields[column]);
    }
  }
  if (!detected.length) throw new Error('Account verification unavailable. The statement does not contain a recognized full account number. Import cancelled.');
  const numbers = detected.map(normalizeAccountNumber);
  if (numbers.some(number => number !== expectedNumber)) throw new Error('Wrong account uploaded. The statement account number does not match the selected account. Import cancelled.');
  return { csv: lines.slice(headerIndex).join('\n'), accountNumber: expectedNumber };
}
