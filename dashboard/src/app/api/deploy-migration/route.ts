export async function GET() {
  return Response.json({
    status: 'live',
    message: 'Migration 0050 ready',
    note: 'Tables created when you run: npx supabase db push --remote pupmadgnwzkblyetlcgu --yes',
    app: 'https://emet-hq.vercel.app',
    tables: ['project_invites', 'customers'],
    commit: 'f993fe2'
  });
}
