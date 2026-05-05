
export type Investment = {
  id: string;
  user_id: string; // Added user_id for association
  type: string;
  amount: number;
  quantity: number; // Added for share model
  purchase_unit_price: number; // Price per share at time of purchase
  rate_type: string;
  rate_value: number;
  created_at: string;
  redeemed_at: string | null;
  redeemed_amount: number | null;
};

// Simulation Constants
// 1 Real Day = 1 Virtual Month
const GAME_TIME_SCALE = 30; 

export const getOrganicOscillation = (seconds: number, seed: number, volatility: number) => {
  const wave1 = Math.sin((seconds / 1800) + seed);         // 30 min cycle
  const wave2 = Math.sin((seconds / 900) + seed * 1.3) * 0.4; // 15 min cycle
  const wave3 = Math.cos((seconds / 420) + seed * 0.7) * 0.2;  // 7 min jitter
  const wave4 = Math.sin((seconds / 120) + seed * 2.1) * 0.08; // 2 min micro jitter
  
  let combined = (wave1 + wave2 + wave3 + wave4) / 1.4;

  if (volatility >= 0.20) {
    combined -= 0.40; 
    if (combined < 0) combined *= 2.0; 
  }
  
  return combined * volatility;
};

export const getVolatilityByType = (type: string) => {
  if (type.includes('Criptoativo')) return 0.65;
  if (type.includes('Ações High')) return 0.35;
  if (type.includes('Venture Capital')) return 0.80;
  if (type.includes('Debênture')) return 0.12;
  if (type.includes('LCA')) return 0.05;
  return 0.02; // Conservative base
};

export function calculateCurrentSharePrice(basePrice: number, type: string, createdAt: string, volatility: number, investmentId: string): number {
  const startDate = new Date(createdAt);
  const now = new Date();
  const secondsPassed = (now.getTime() - startDate.getTime()) / 1000;
  const virtualYearsPassed = (secondsPassed * GAME_TIME_SCALE) / (365 * 24 * 60 * 60);

  // Annual drift (base growth)
  let drift = 5; // 5% base
  if (type.includes('Criptoativo')) drift = 2; // High volatility, low drift
  if (type.includes('Venture Capital')) drift = 8;
  
  let price = basePrice * Math.pow(1 + drift / 100, virtualYearsPassed);

  // Market Waves
  if (volatility > 0) {
    const seed = investmentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const wave = getOrganicOscillation(secondsPassed, seed, volatility);
    price = price * (1 + wave);

    // Friction for extreme volatility
    if (volatility >= 0.30) {
      const annualFriction = 0.45; 
      price *= Math.pow(1 - annualFriction, virtualYearsPassed);
    }
  }

  return Math.max(price, 0.000001); // Prevent zero or negative prices
}

export const calculateCurrentAmount = (investment: Investment): number => {
  if (investment.redeemed_at && investment.redeemed_amount) {
    return investment.redeemed_amount;
  }
  
  const volatility = getVolatilityByType(investment.type);
  const currentPrice = calculateCurrentSharePrice(
    investment.purchase_unit_price || 1,
    investment.type,
    investment.created_at,
    volatility,
    investment.id
  );

  return (investment.quantity || 1) * currentPrice;
};

export const getInvestmentColor = (type: string) => {
  if (type.includes('Criptoativo')) return '#8B5CF6'; // Purple
  if (type.includes('Ações High')) return '#EF4444'; // Red
  if (type.includes('Venture Capital')) return '#EC4899'; // Pink
  if (type.includes('CDB')) return '#F97316'; // Orange
  if (type.includes('Tesouro')) return '#10B981'; // Green
  return '#3B82F6'; // Blue
};
