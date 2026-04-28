import { supabase } from './lib/supabase';

export const CURRENCY_CONFIG = {
  NAME: 'Unireal',
  SYMBOL: 'UR',
  DEFAULT_BRL_RATE: 0.10,
  BRL_SYMBOL: 'R$',
};

export const formatBRL = async (amount: number) => {
  let rate = CURRENCY_CONFIG.DEFAULT_BRL_RATE;
  
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'exchange_rate')
      .single();
    
    if (!error && data) {
      rate = parseFloat(data.value.toString());
    }
  } catch (err) {
    console.warn('Falling back to default exchange rate');
  }

  const brlValue = amount * rate;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(brlValue);
};

// Hook-friendly version or synchronous version for components that use state
export const getLiveRate = async () => {
  const { data } = await supabase.from('settings').select('value').eq('key', 'exchange_rate').single();
  return data ? parseFloat(data.value.toString()) : CURRENCY_CONFIG.DEFAULT_BRL_RATE;
};
