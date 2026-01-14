
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from('fhir_set_values')
        .update({ set_name: '剖腹產排除值集' })
        .eq('set_id', 'C_Section_Exclusion_VS');

    await supabase.from('fhir_set_values')
        .update({ set_name: '特殊抗生素值集' })
        .eq('set_id', 'Vanco_Fluoro_VS');

    return NextResponse.json({ success: true, message: "Updated set names" });
}
