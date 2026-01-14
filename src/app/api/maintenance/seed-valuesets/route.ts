
// Since we are in a Next.js environment but want to run a script, we might easier trigger it via a temporary API route OR just rely on the user to use the UI.
// But to be helpful, I'll create a simple API route to trigger this seed, or just try to run it if I can via ts-node, but environment variables might be tricky.
// Better: Create a temporary API route `/api/maintenance/seed-valuesets` and hit it with curr.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { C_SECTION_EXCLUSION_VS } from '@/components/indicator/valuesets';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Seed C_Section_Exclusion_VS
    const cSectionData = C_SECTION_EXCLUSION_VS.map(item => ({
        set_id: 'C_Section_Exclusion_VS',
        set_name: '剖腹產排除值集',
        code: item.code,
        display: item.display,
        system: 'http://tw-health-insurance',
        resource_path: 'Procedure.code'
    }));

    const { error } = await supabase.from('fhir_set_values').upsert(cSectionData, { onConflict: 'set_id, code' });

    if (error) {
        return NextResponse.json({ success: false, message: error.message, details: error });
    }

    // 2. Seed Vanco_Fluoro_VS
    const vancoData = [
        {
            set_id: 'Vanco_Fluoro_VS',
            set_name: '特殊抗生素值集',
            code: 'J01XA',
            display: 'Vancomycin (Example)',
            system: 'ATC',
            resource_path: 'MedicationRequest.medicationCodeableConcept'
        }
    ];
    const { error: error2 } = await supabase.from('fhir_set_values').upsert(vancoData, { onConflict: 'set_id, code' });

    if (error2) {
        return NextResponse.json({ success: false, message: error2.message, details: error2 });
    }

    // 3. Seed PCS_Surgery_VS
    const pcsData = [
        {
            set_id: 'PCS_Surgery_VS',
            set_name: '手術代碼值集 (PCS)',
            code: '00.30',
            display: 'PCS_Surgery_VS Range Sample',
            system: 'ICD-9-CM-Vol3',
            resource_path: 'Procedure.code'
        }
    ];
    const { error: error3 } = await supabase.from('fhir_set_values').upsert(pcsData, { onConflict: 'set_id, code' });

    if (error3) {
        return NextResponse.json({ success: false, message: error3.message, details: error3 });
    }

    return NextResponse.json({ success: true, message: "Seeded ValueSets" });
}
