import type { PGlite } from '@electric-sql/pglite';

// Execute workflow queries against the replayed PostgreSQL schema, rather than
// accepting arbitrary fields in mocks. Existing tenant tests exercise the RLS roles.
export function workflowClient(db: PGlite, businessId: string) {
  const identifier = (value: string) => {
    if (!/^[a-z_]+$/.test(value)) throw new Error('Invalid fixture identifier');
    return `"${value}"`;
  };
  return {
    myopsBusinessId: businessId,
    async rpc(name: string, args: Record<string, unknown>) {
      try {
        if (name !== 'post_accounting_transaction_atomic') throw new Error('Unexpected fixture RPC');
        const entries = Object.entries(args);
        const sql = `select public.${identifier(name)}(${entries.map(([key], i) => `${identifier(key)} => $${i + 1}`).join(',')}) as result`;
        const values = entries.map(([, value]) => value && typeof value === 'object' ? JSON.stringify(value) : value);
        const data = (await db.query<{ result: unknown }>(sql, values)).rows[0].result;
        return { data, error: null };
      } catch (error) {
        return { data: null, error: { message: String(error) } };
      }
    },
    from(table: string) {
      let inserted: Record<string, unknown>[] | undefined;
      let updated: Record<string, unknown> | undefined;
      let columns = '*';
      const filters: Array<[string, unknown]> = [];
      const sets: Array<[string, unknown[]]> = [];
      const execute = async (single = false) => {
        try {
          const values: unknown[] = [];
          const bind = (value: unknown) => {
            values.push(value && typeof value === 'object' ? JSON.stringify(value) : value);
            return `$${values.length}`;
          };
          const fields = columns === '*' ? '*' : columns.split(',').map(c => identifier(c.trim())).join(',');
          let sql: string;
          if (inserted) {
            const keys = Object.keys(inserted[0]);
            sql = `insert into ${identifier(table)} (${keys.map(identifier)}) values `
              + inserted.map(row => `(${keys.map(key => bind(row[key])).join(',')})`).join(',') + ' returning *';
          } else {
            const conditions = filters.map(([key, value]) => `${identifier(key)}=${bind(value)}`);
            for (const [key, items] of sets) {
              conditions.push(items.length ? `${identifier(key)} in (${items.map(bind).join(',')})` : 'false');
            }
            const where = conditions.length ? ` where ${conditions.join(' and ')}` : '';
            sql = updated
              ? `update ${identifier(table)} set ${Object.entries(updated).map(([key, value]) => `${identifier(key)}=${bind(value)}`).join(',')}${where} returning *`
              : `select ${fields} from ${identifier(table)}${where}`;
          }
          const rows = (await db.query(sql, values)).rows;
          return { data: single ? rows[0] ?? null : rows, error: null };
        } catch (error) {
          return { data: null, error: { message: String(error) } };
        }
      };
      const builder: any = {
        select(value = '*') { columns = value; return builder; },
        insert(value: Record<string, unknown> | Record<string, unknown>[]) { inserted = Array.isArray(value) ? value : [value]; return builder; },
        update(value: Record<string, unknown>) { updated = value; return builder; },
        eq(key: string, value: unknown) { filters.push([key, value]); return builder; },
        in(key: string, value: unknown[]) { sets.push([key, value]); return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle() { return execute(true); },
        single() { return execute(true); },
        then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) { return execute().then(resolve, reject); },
      };
      return builder;
    },
  };
}
