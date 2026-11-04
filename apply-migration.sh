#!/bin/bash
cd ~/emet/dashboard

# Apply migration using Supabase CLI
echo "Pushing migration to live Supabase..."
npx supabase db push --remote pupmadgnwzkblyetlcgu

echo "✅ Migration applied!"
echo "Live app: https://emet-hq.vercel.app"
