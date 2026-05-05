
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

export const getOrganicOscillation = (seconds: number, seed: number, volatility: number) => {
  const wave1 = Math.sin((seconds / 47.3) + seed);
  const wave2 = Math.sin((seconds / 13.7) + seed * 1.3) * 0.4;
  const wave3 = Math.cos((seconds / 5.9) + seed * 0.7) * 0.2;
  const wave4 = Math.sin((seconds / 2.3) + seed * 2.1) * 0.08;
  
  // Base oscillation
  let combined = (wave1 + wave2 + wave3 + wave4) / 1.4;

  // Add downward bias (luck is against the investor)
  // If volatility is high, we subtract a constant to skew the distribution toward losses
  if (volatility >= 0.20) {
    combined -= 0.25; // 25% downward pressure on high-risk
    
    // Asymmetric Risk: Gravity is stronger in high risk.
    // If the wave is already negative, we amplify the drop.
    if (combined < 0) {
      combined *= 1.3; 
    }
  }
  
  return combined * volatility;
};

export const getVolatilityByType = (type: string) => {
  if (type.includes('Criptoativo')) return 0.35;
  if (type.includes('Ações High')) return 0.20;
  if (type.includes('Venture Capital')) return 0.50;
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
  const daysPassed = millisecondsPassed / (1000 * 60 * 60 * 24);
  const yearsPassed = daysPassed / 365;
  
  let annualRate = 0;
  const volatility = getVolatilityByType(investment.type);

  if (investment.rate_type === 'CDI') {
    const cdi = Math.max(currentSelic - 0.10, 0); 
    annualRate = cdi * (investment.rate_value / 100);
  } else {
    annualRate = investment.rate_value;
  }
  
  let currentAmount = investment.amount * Math.pow(1 + annualRate / 100, yearsPassed);

  if (volatility > 0) {
    const seed = investment.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const wave = getOrganicOscillation(secondsPassed, seed, volatility);
    currentAmount = currentAmount * (1 + wave);

    // High-Risk Decay: The longer you hold extremely volatile assets, 
    // the more they are eaten by "market friction" (decay).
    if (volatility >= 0.30) {
      const annualFriction = 0.12; // 12% annual decay for pure risk
      currentAmount *= Math.pow(1 - annualFriction, yearsPassed);
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
