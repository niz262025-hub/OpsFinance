export function navigateToDashboard(assign: (url: string) => void = (url) => window.location.assign(url)): void {
  assign('/dashboard');
}
