import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://eqtqwuuffujvrdwpofcj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxdHF3dXVmZnVqdnJkd3BvZmNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAyMjk2OSwiZXhwIjoyMDg4NTk4OTY5fQ.26bssmOBDyGlhbR4et5vOEg4sWQsCsgq0gmT2-d9iag"; // from .env.local

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    // try to select from invitations to see columns
    const { data, error } = await supabase.from('invitations').select('*').limit(1);
    console.log("Data:", data);
    console.log("Error:", error);
}

main();
