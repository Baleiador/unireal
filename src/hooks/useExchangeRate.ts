import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CURRENCY_CONFIG } from '../constants';

export function useExchangeRate() {
  const [rate, setRate] = useState<number>(CURRENCY_CONFIG.BRL_RATE);
  const [loading, setLoading] = useState(true);

  const fetchRate = async () => {
    try {
      console.log('Buscando taxa de câmbio...');
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'exchange_rate')
        .single();
      
      if (error) throw error;

      if (data) {
        const val = parseFloat(data.value.toString());
        console.log('Taxa carregada:', val);
        setRate(val);
      }
    } catch (err) {
      console.warn('Erro ao buscar taxa, usando padrão:', CURRENCY_CONFIG.BRL_RATE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRate();

    const channel = supabase
      .channel('exchange_rate_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.exchange_rate' }, 
        (payload: any) => {
          console.log('Mudança de câmbio detectada via Realtime:', payload);
          if (payload.new && payload.new.value !== undefined) {
            const newRate = parseFloat(payload.new.value.toString());
            setRate(newRate);
          }
        }
      )
      .subscribe((status) => {
        console.log('Status do canal Realtime:', status);
      });

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
