
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/^['"](.*)['"]$/, '$1');
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Keys");
    process.exit(1);
}

// Use Service Role if available, else Anon
const supabase = createClient(supabaseUrl, serviceRoleKey || anonKey!);

async function createUser() {
    const email = 'testkpim@kpim.com.tw';
    const password = 'testkpim123';

    console.log(`Creating user ${email} using ${serviceRoleKey ? 'Service Role' : 'Anon Key'}...`);

    if (serviceRoleKey) {
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: 'Test KPIM',
                role: 'user'
            }
        });
        if (error) console.error("Admin Create Error:", error.message);
        else console.log("User created (verified):", data.user.id);
    } else {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: 'Test KPIM',
                }
            }
        });

        if (error) {
            console.error("SignUp Error:", error.message);
        } else {
            console.log("User signed up:", data.user?.id);
            console.log("Session:", !!data.session);
            if (!data.session) {
                console.warn("WARNING: User created but no session. Email confirmation likely required.");
            }
        }
    }
}

createUser();
