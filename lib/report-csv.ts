function cell(value: unknown): string {
  const raw = String(value ?? '');
  const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function reportCsv(report: unknown, context: Record<string, string>): string {
  const rows: unknown[][] = [['Field', 'Value'], ...Object.entries(context)];
  function visit(value: unknown, path: string) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index + 1}]`));
    } else if (value !== null && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => visit(item, path ? `${path}.${key}` : key));
    } else rows.push([path, value]);
  }
  visit(report, 'report');
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
