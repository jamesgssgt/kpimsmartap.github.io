
import { createClient } from '@supabase/supabase-js';

// Inlined to avoid ts-node import issues
const C_SECTION_EXCLUSION_VS = [
    { code: '81001C', display: '葡萄胎或絨毛膜癌除去術' },
    { code: '81002C', display: '子宮外孕手術' },
    { code: '81003C', display: '胎盤取出術' },
    { code: '81004C', display: '無妊娠併發症之剖腹產術' },
    { code: '81005C', display: '剖腹產合併次全子宮切除術' },
    { code: '81006C', display: '妊娠前十二週流產刮宮術' },
    { code: '81007C', display: '妊娠超過十二週流產或死胎刮宮術' },
    { code: '81008B', display: '子宮切開流產術' },
    { code: '81009C', display: '死胎之引產(十二至二十四週)' },
    { code: '81010C', display: '死胎之引產(超過二十四週)' },
    { code: '81011C', display: '有妊娠併發症之剖腹產術' },
    { code: '81012B', display: '死胎破取術' },
    { code: '81013B', display: '骨盤腔臟器摘除術' },
    { code: '81014C', display: '骨盆腔子宮內膜異位症，電燒及切除—輕度' },
    { code: '81015C', display: '經腹部子宮內避孕器移除術' },
    { code: '81016B', display: '薦骨前神經截斷術' },
    { code: '81017C', display: '無妊娠併發症之陰道產' },
    { code: '81018C', display: '雙胎分娩' },
    { code: '81019C', display: '多胎分娩' },
    { code: '81020C', display: '腹腔鏡子宮外孕手術' },
    { code: '81021B', display: '骨盆腔惡性腫瘤消滅術' },
    { code: '81022B', display: '敗血性流產' },
    { code: '81023C', display: '子宮內膜電燒及切除術' },
    { code: '81024C', display: '前胎剖腹產後之陰道生產' },
    { code: '81025C', display: '前胎剖腹產後之陰道生產(雙胎分娩)' },
    { code: '81026C', display: '前胎剖腹產後之陰道生產(多胎分娩)' },
    { code: '81028C', display: '前置胎盤或植入性胎盤之剖腹產' },
    { code: '81029C', display: '剖腹產合併全子宮切除術' },
    { code: '81030C', display: '引產無效後之流產或死胎刮宮術' },
    { code: '81031C', display: '子宮內管刮除術' },
    { code: '81032C', display: '骨盆腔子宮內膜異位症，電燒及切除—中度' },
    { code: '81033B', display: '骨盆腔子宮內膜異位症，電燒及切除—重度' },
    { code: '81034C', display: '有妊娠併發症之陰道產' },
    { code: '81036B', display: '腹腔鏡式薦骨前神經截斷術' },
    { code: '81037K', display: '胎兒膀胱羊膜腔引流管置放術' }
];

const ORGAN_HARVEST_VS = [
    { code: '68035B', display: '屍體腎臟摘取術' },
    { code: '68037B', display: '活體腎臟摘取術' },
    { code: '68048B', display: '腹腔鏡活體腎臟摘取術' },
    { code: '75020B', display: '屍體多種器官摘取術' },
    { code: '75021B', display: '心臟摘取術' },
    { code: '75022B', display: '肺臟摘取術' },
    { code: '75023B', display: '肝臟摘取術' },
    { code: '75024B', display: '胰臟摘取術' },
    { code: '75025B', display: '小腸摘取術' }
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log("Seeding ValueSets...");

    // 1. Seed C_Section_Exclusion_VS
    const cSectionData = C_SECTION_EXCLUSION_VS.map(item => ({
        set_id: 'C_Section_Exclusion_VS',
        code: item.code,
        display: item.display,
        system: 'http://tw-health-insurance', // Assumption
        resource_path: 'Procedure.code'
    }));

    const { error: err1 } = await supabase.from('fhir_set_values').upsert(cSectionData, { onConflict: 'set_id,code' });
    if (err1) console.error("Error seeding C_Section:", err1);
    else console.log(`Seeded ${cSectionData.length} codes for C_Section_Exclusion_VS`);

    // 2. Seed Vanco_Fluoro_VS (Placeholder as empty/initial)
    const vancoData = [
        {
            set_id: 'Vanco_Fluoro_VS',
            code: 'J01XA',
            display: 'Vancomycin (Example)',
            system: 'ATC',
            resource_path: 'MedicationRequest.medicationCodeableConcept'
        }
    ];
    const { error: err2 } = await supabase.from('fhir_set_values').upsert(vancoData, { onConflict: 'set_id,code' });
    if (err2) console.error("Error seeding Vanco:", err2);
    else console.log(`Seeded placeholder for Vanco_Fluoro_VS`);

    // 3. Seed Organ_Harvest_VS
    const organHarvestData = ORGAN_HARVEST_VS.map(item => ({
        set_id: 'Organ_Harvest_VS',
        code: item.code,
        display: item.display,
        system: 'http://tw-health-insurance',
        resource_path: 'Procedure.code'
    }));

    const { error: err3 } = await supabase.from('fhir_set_values').upsert(organHarvestData, { onConflict: 'set_id,code' });
    if (err3) console.error("Error seeding Organ_Harvest_VS:", err3);
    else console.log(`Seeded ${organHarvestData.length} codes for Organ_Harvest_VS`);

}

seed();
