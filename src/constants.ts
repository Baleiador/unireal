export const UNITS = ['Ribeirão', 'Palmares'] as const;
export type SchoolUnit = typeof UNITS[number];

export const CURRENCY_CONFIG = {
  NAME: 'Unireal',
  SYMBOL: 'UR',
  BRL_RATE: 0.01, // 1 UR = R$ 0,01
  BRL_SYMBOL: 'R$',
};

export const formatBRL = (amount: number) => {
  const brlValue = amount * CURRENCY_CONFIG.BRL_RATE;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(brlValue);
};
