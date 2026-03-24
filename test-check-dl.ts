import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
    const { data: defs } = await supabase.from("kpi_definitions").select("*");
    const { data: dls } = await supabase.from("kpi_dl").select("*");
    console.log("Defs found:", defs?.length);
    console.log("DLs found:", dls?.length);
    console.log("DL details:", JSON.stringify(dls, null, 2));
}
run();
