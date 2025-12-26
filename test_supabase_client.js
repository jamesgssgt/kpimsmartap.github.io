
const { createBrowserClient } = require("@supabase/ssr");

try {
    const client = createBrowserClient("", "");
    console.log("Success with empty strings");
} catch (e) {
    console.log("Error with empty strings:", e.message);
}

try {
    const client = createBrowserClient(undefined, undefined);
    console.log("Success with undefined");
} catch (e) {
    console.log("Error with undefined:", e.message);
}
