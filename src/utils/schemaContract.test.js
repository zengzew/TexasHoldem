import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'supabase_schema.sql'), 'utf8');

describe('schema contract', () => {
  it('defines the forgot password reset rpc', () => {
    expect(schemaSql).toContain('create or replace function public.reset_password_by_nickname');
    expect(schemaSql).toContain('grant execute on function public.reset_password_by_nickname(text, text) to anon, authenticated;');
  });
});
