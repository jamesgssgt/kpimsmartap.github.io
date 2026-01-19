
const { getFactors } = require('../src/app/actions/kift');

async function testGetFactors() {
    try {
        console.log("Fetching factors...");
        const factors = await getFactors();
        console.log("Factors count:", factors.length);
        if (factors.length > 0) {
            console.log("First factor:", JSON.stringify(factors[0], null, 2));
        } else {
            console.log("No factors found.");
        }
    } catch (error) {
        console.error("Error fetching factors:", error);
    }
}

// Mocking required environment or context if necessary
// But since this is a server action, it might depend on DB connection.
// If it imports from @/lib/supabase/client, we need to ensure that works in standalone script.
// Usually scripts/test-*.js runs with some setup.
// Let's rely on reading the file first to see dependencies.
// If it uses 'use server', we can't run it directly in node without Next.js context easily unless we transpile or mock.
// Better to just inspect the code first.

// Changing plan: I will just read the file first.
