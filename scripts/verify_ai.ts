
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { analyzeFullIndicator } from '../src/app/actions/ai';

async function testAi() {
    console.log("Testing AI Analysis for Duration Logic...");
    const name = "急診滯留超過24小時";
    const desc = "計算急診就診停留時間 (period.end - period.start)，篩選超過 24 小時的病患。若未出院 (period.end is null)，則以當前時間計算。";

    try {
        const result = await analyzeFullIndicator(name, desc);
        console.log("AI Output:", JSON.stringify(result, null, 2));

        // Validation Logic
        const hasDurationCheck = result.numeratorSteps?.some((s: any) => s.valueType === 'calculated_field');
        const hasAutoNull = result.numeratorSteps?.some((s: any) => s.autoHandleNullEnd === true);

        if (hasDurationCheck && hasAutoNull) {
            console.log("✅ Verification PASSED: Found DURATION_CHECK and autoHandleNullEnd=true");
        } else {
            console.error("❌ Verification FAILED: Missing required logic.", { hasDurationCheck, hasAutoNull });
        }
    } catch (error) {
        console.error("Error executing AI:", error);
    }
}

testAi();
