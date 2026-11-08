export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function currentMonth(date = new Date()) {
  return {from:localDate(new Date(date.getFullYear(),date.getMonth(),1)),to:localDate(new Date(date.getFullYear(),date.getMonth()+1,0))};
}
export function validReportPeriod(from: string, to: string): boolean {
  return [from,to].every(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value)&&from<=to;
}
