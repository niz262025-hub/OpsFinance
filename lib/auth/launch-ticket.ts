/** Validate the exact browser fragment shape issued by MYOPS. */
export function isLaunchTicketFragment(fragment: string): boolean {
  return /^#t=[A-Za-z0-9_-]{43}$/.test(fragment);
}
