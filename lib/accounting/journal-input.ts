export type JournalInputLine = { account_id: string; debit: string; credit: string };

function cents(value: unknown): number {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Journal amounts must be positive numbers with at most two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('Journal amount is too large.');
  return result;
}

export function validateJournalLines(input: unknown) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 100) throw new Error('A journal requires between 2 and 100 lines.');
  let debit = 0;
  let credit = 0;
  const lines = input.map((line) => {
    const account = String(line?.account_id ?? '').trim();
    if (!account) throw new Error('Select an account for every journal line.');
    const dr = cents(line?.debit);
    const cr = cents(line?.credit);
    if ((dr > 0) === (cr > 0)) throw new Error('Each journal line needs either a debit or a credit.');
    debit += dr; credit += cr;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) throw new Error('Journal total is too large.');
    return { account_id: account, debit: (dr / 100).toFixed(2), credit: (cr / 100).toFixed(2) };
  });
  if (debit !== credit) throw new Error('Journal is unbalanced: total debit must equal total credit.');
  return { lines, amount: (debit / 100).toFixed(2) };
}
