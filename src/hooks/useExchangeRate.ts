import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CURRENCY_CONFIG } from '../constants';

export function useExchangeRate() {
  const [rate, setRate] = useState<number>(CURRENCY_CONFIG.DEFAULT_BRL_RATE);
  const [loading, setLoading] = useState(true);

  const fetchRate = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'exchange_rate')
        .single();
      
      if (data) {
        setRate(parseFloat(data.value.toString()));
      }
    } catch (err) {
      console.warn('Usando taxa padrão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRate();

    // Ouvinte em tempo real para qualquer mudança na tabela de configurações
    const channel = supabase
      .channel('exchange_rate_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.exchange_rate' }, 
        (payload: any) => {
          if (payload.new && payload.new.value) {
            setRate(parseFloat(payload.new.value.toString()));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatValue = (amount: number) => {
    const brlValue = amount * rate;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(brlValue);
  };

  return { rate, formatValue, loading };
}
