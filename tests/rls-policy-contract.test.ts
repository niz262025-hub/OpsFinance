import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase 1.5 RLS contract', () => {
  it('includes row level security and business membership checks', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/002_phase1_5_rls.sql'), 'utf8');

    expect(migration).toContain('enable row level security');
    expect(migration).toContain('is_authorized_for_business');
    expect(migration).toContain('is_business_owner_or_admin');
    expect(migration).toContain('business_members');
  });

  it('denies destructive deletes for protected financial and audit tables', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/002_phase1_5_rls.sql'), 'utf8');

    expect(migration).toContain('for delete\nusing (false)');
    expect(migration).toContain('Audit logs cannot be deleted');
  });

  it('blocks arbitrary self-joining and self-role escalation', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/002_phase1_5_rls.sql'), 'utf8');
    const manager = migration.match(/function public\.manage_business_membership\([\s\S]*?\$\$;/i)?.[0] ?? '';
    const insertPolicy = migration.match(/create policy "Membership inserts require authorized RPC"[\s\S]*?;/i)?.[0] ?? '';
    const updatePolicy = migration.match(/create policy "Membership updates require authorized RPC"[\s\S]*?;/i)?.[0] ?? '';

    expect(migration).not.toContain('Users can join their own membership');
    expect(insertPolicy).toContain('with check (false)');
    expect(updatePolicy).toContain('using (false)');
    expect(updatePolicy).toContain('with check (false)');
    expect(manager).toContain('p_target_user_id = auth.uid()');
    expect(manager).toContain("v_actor_role not in ('OWNER', 'ADMIN')");
    expect(manager).toContain("v_actor_role = 'ADMIN' and p_target_role not in ('ACCOUNTANT', 'STAFF', 'VIEWER')");
    expect(manager).toContain('on conflict (business_id, user_id)');
  });

  it('allows membership management only for an authorized role in the same business', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/002_phase1_5_rls.sql'), 'utf8');
    const manager = migration.match(/function public\.manage_business_membership\([\s\S]*?\$\$;/i)?.[0] ?? '';
    const bootstrap = migration.match(/function public\.create_business_with_owner\([\s\S]*?\$\$;/i)?.[0] ?? '';

    expect(manager).toContain('bm.business_id = p_business_id');
    expect(manager).toContain('bm.user_id = auth.uid()');
    expect(bootstrap).toContain('auth.uid()');
    expect(bootstrap).toContain("values (v_business_id, v_user_id, 'OWNER')");
    expect(bootstrap).not.toContain('p_user_id');
    expect(bootstrap).not.toContain('p_role');
    expect(migration).toContain('revoke all on function public.manage_business_membership');
    expect(migration).toContain('revoke all on function public.create_business_with_owner');
    expect(migration).toContain('to authenticated');
  });

  it('keeps business reads scoped to the authenticated user membership', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/002_phase1_5_rls.sql'), 'utf8');
    const authorization = migration.match(/function public\.is_authorized_for_business\([\s\S]*?\$\$;/i)?.[0] ?? '';

    expect(authorization).toContain('bm.business_id = p_business_id');
    expect(authorization).toContain('bm.user_id = auth.uid()');
    expect(migration).toContain('using (public.is_authorized_for_business(business_id))');
  });

  it('documents the live UAT blocker in project documentation', () => {
    const doc = readFileSync(join(process.cwd(), 'SUPABASE_UAT.md'), 'utf8');

    expect(doc).toContain('Supabase UAT');
    expect(doc).toContain('This environment is blocked');
    expect(doc).toContain('supabase: command not found');
  });
});
