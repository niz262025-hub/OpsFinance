// Server-only: never import this module into a browser component.
export function myopsBrokerHeaders(): Record<string,string> {
  const key=process.env.MYOPS_DATA_BROKER_KEY;
  if (!key) return {};
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(key)) throw new Error('Invalid server broker configuration.');
  return {'x-myops-broker-key':key};
}
