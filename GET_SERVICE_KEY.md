# 🔑 Get Supabase Service Key

The server needs the **Supabase Service Key** (service role key) to access the database.

## How to Get It:

1. Go to https://supabase.com/dashboard
2. Select your project: `vexmydzwlongsqnzamdk`
3. Click **Settings** (gear icon) in the left sidebar
4. Click **API** under Project Settings
5. Find **service_role** key (NOT the anon key)
6. Copy the **service_role** key
7. Open `.env` file in this project
8. Replace `your-supabase-service-role-key` with the actual service key

**Example:**
```
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleG15ZHp3bG9uZ3NxbnphbWRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4NDM1MSwiZXhwIjoyMDgxNTYwMzUxfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **IMPORTANT:** The service key bypasses Row Level Security (RLS). Keep it secret and never commit it to git!

After adding the service key, restart the server:
```bash
npm start
```



