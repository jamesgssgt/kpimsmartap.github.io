const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://pyjjjannxwjwwoiqqfrc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ampqYW5ueHdqd3dvaXFxZnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NDM3NzksImV4cCI6MjA4MTUxOTc3OX0.9yu7Du-M8OPUJq9kwLhub9eft7AQUw9VJrSehzVLtJw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLogin() {
    console.log("Attempting login for joseph@kpim.com...");
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'joseph@kpim.com',
        password: 'BDBU_22425662'
    });

    if (error) {
        console.error("Login FAILED:", error.message);
        console.error("Error details:", JSON.stringify(error, null, 2));
    } else {
        console.log("Login SUCCESS!");
        console.log("User ID:", data.user.id);
        console.log("Session Access Token (truncated):", data.session.access_token.substring(0, 20) + "...");
    }
}

testLogin();
