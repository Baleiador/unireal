import { CURRENCY_CONFIG } from '../constants';

export function useExchangeRate() {
  const rate = CURRENCY_CONFIG.BRL_RATE;

  const formatValue = (amount: number) => {
    const brlValue = amount * rate;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(brlValue);
  };

  return { rate, formatValue, loading: false };
}
