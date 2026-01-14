
import { QualityIndicator, IndicatorResult } from "../types";

// Mock data generation for demo purposes
export const fetchIndicatorResults = async (indicator: QualityIndicator): Promise<IndicatorResult[]> => {
  // In a real app, this would hit a FHIR endpoint (e.g., /Observation, /Patient)
  // and apply filters based on the indicator's numerator/denominator criteria.
  
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network latency

  const results: IndicatorResult[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(now.getMonth() - i);
    
    // Random but plausible data
    const den = 100 + Math.floor(Math.random() * 200);
    const num = Math.floor(den * (0.6 + Math.random() * 0.3));
    
    results.push({
      indicatorId: indicator.id,
      timestamp: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
      denominatorCount: den,
      numeratorCount: num,
      rate: parseFloat(((num / den) * 100).toFixed(2)),
    });
  }

  return results;
};
