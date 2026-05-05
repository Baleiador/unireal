
export type Investment = {
  id: string;
  type: string;
  amount: number;
  rate_type: string;
  rate_value: number;
  created_at: string;
  redeemed_at: string | null;
  redeemed_amount: number | null;
};

// Simulation Constants
// 1 Real Day = 1 Virtual Month
// Ratio: 30.41 (avg days in month) / 1 (real day) = 30.41
const GAME_TIME_SCALE = 30.41; 

export const getOrganicOscillation = (seconds: number, seed: number, volatility: number) => {
  // Slow down waves: Cycles now take between 10 and 30 minutes to complete
  // To prevent the "liquidity of a month in seconds" issue
  const wave1 = Math.sin((seconds / 1800) + seed);         // 30 min cycle
  const wave2 = Math.sin((seconds / 900) + seed * 1.3) * 0.4; // 15 min cycle
  const wave3 = Math.cos((seconds / 420) + seed * 0.7) * 0.2;  // 7 min jitter
  const wave4 = Math.sin((seconds / 120) + seed * 2.1) * 0.08; // 2 min micro jitter
  
  // Base oscillation
  let combined = (wave1 + wave2 + wave3 + wave4) / 1.4;

  // Add downward bias (luck is against the investor)
  // If volatility is high, we subtract a constant to skew the distribution toward losses
  if (volatility >= 0.20) {
    combined -= 0.40; // High downward pressure
    
    // Asymmetric Risk: Gravity is much stronger in high risk.
    // If the wave is already negative, we amplify the drop significantly.
    if (combined < 0) {
      combined *= 2.0; 
    }
  }
  
  return combined * volatility;
};

export const getVolatilityByType = (type: string) => {
  if (type.includes('Criptoativo')) return 0.45;
  if (type.includes('Ações High')) return 0.30;
  if (type.includes('Venture Capital')) return 0.65;
  return 0;
};

export const calculateCurrentAmount = (investment: Investment, currentSelic: number) => {
  if (investment.redeemed_at && investment.redeemed_amount) {
    return investment.redeemed_amount;
  }
  
  const startDate = new Date(investment.created_at);
  const now = new Date();
  const millisecondsPassed = now.getTime() - startDate.getTime();
  const secondsPassed = millisecondsPassed / 1000;
  
  // Apply Time Scale for yield calculation
  const virtualYearsPassed = (secondsPassed * GAME_TIME_SCALE) / (365 * 24 * 60 * 60);
  
  let annualRate = 0;
  const volatility = getVolatilityByType(investment.type);

  if (investment.rate_type === 'CDI') {
    const cdi = Math.max(currentSelic - 0.10, 0); 
    annualRate = cdi * (investment.rate_value / 100);
  } else {
    annualRate = investment.rate_value;
  }
  
  // Compound growth based on accelerated virtual time
  let currentAmount = investment.amount * Math.pow(1 + annualRate / 100, virtualYearsPassed);

  if (volatility > 0) {
    const seed = investment.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // Oscillation still uses real seconds but waves are now much longer
    const wave = getOrganicOscillation(secondsPassed, seed, volatility);
    currentAmount = currentAmount * (1 + wave);

    // High-Risk Decay: Market friction for pure risk.
    if (volatility >= 0.25) {
      const annualFriction = 0.45; 
      currentAmount *= Math.pow(1 - annualFriction, virtualYearsPassed);
    }
  }

  return currentAmount;
};

export const getInvestmentColor = (type: string) => {
  if (type.includes('Criptoativo')) return '#8B5CF6'; // Purple
  if (type.includes('Ações High')) return '#EF4444'; // Red
  if (type.includes('Venture Capital')) return '#EC4899'; // Pink
  if (type.includes('CDB')) return '#F97316'; // Orange
  if (type.includes('Tesouro')) return '#10B981'; // Green
  return '#3B82F6'; // Blue
};
