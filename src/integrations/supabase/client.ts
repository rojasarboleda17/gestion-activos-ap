import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://vyhfmkxqyoltjnjcfohu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aGZta3hxeW9sdGpuamNmb2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNTc2NzIsImV4cCI6MjA4MjczMzY3Mn0.HvDi_nKBMFMqv7DJL5BSQRZ954DJrM-xNQeGVZ-xxTM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
