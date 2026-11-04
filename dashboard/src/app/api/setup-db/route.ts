import { sql } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function GET() {
  try {
    // This endpoint helps verify the database setup
    return Response.json({
      status: 'ready',
      app: 'https://emet-hq.vercel.app',
      features: ['project-invites', 'customers'],
      next: 'Paste SQL from /migration-0050.sql into Supabase SQL Editor',
      supabase: 'https://app.supabase.com/project/pupmadgnwzkblyetlcgu/sql/new'
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
