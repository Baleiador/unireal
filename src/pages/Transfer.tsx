import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { supabase } from '../lib/supabase';
import { Send, Search, UserCheck, QrCode, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { Html5QrcodeScanner } from 'html5-qrcode';

type Profile = {
  id: string;
  full_name: string;
  grade: string | null;
};

export function Transfer() {
  const { profile, refreshProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [searchParams] = useSearchParams();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const navigate = useNavigate();

  // Handle URL pre-fill
  useEffect(() => {
    const toId = searchParams.get('to');
    const urlAmount = searchParams.get('amount');
    
    if (toId && !selectedUser) {
      fetchUserById(toId);
    }
    
    if (urlAmount && !amount) {
      setAmount(urlAmount);
    }
  }, [searchParams]);

  const fetchUserById = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, grade')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setSelectedUser(data);
      }
    } catch (err) {
      console.error('Error fetching user by ID:', err);
    }
  };

  // Handle Scanner
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    
    if (showScanner) {
      // Small timeout to ensure the DOM element #reader is mounted
      const timer = setTimeout(() => {
        try {
          const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true
          };

          scanner = new Html5QrcodeScanner("reader", config, false);
          
          scanner.render((decodedText) => {
            try {
              const url = new URL(decodedText);
              const toId = url.searchParams.get('to');
              const urlAmount = url.searchParams.get('amount');
              
              if (toId) {
                fetchUserById(toId);
                if (urlAmount) {
                  setAmount(urlAmount);
                }
                scanner?.clear().catch(e => console.error("Clear error", e));
                setShowScanner(false);
              }
            } catch (e) {
              // If not a URL, check if it's a UUID (length > 30)
              if (decodedText.length > 30) {
                fetchUserById(decodedText);
                scanner?.clear().catch(e => console.error("Clear error", e));
                setShowScanner(false);
              } else {
                alert("QR Code inválido: " + decodedText);
              }
            }
          }, (errorMessage) => {
            // Silently ignore errors during scanning as it's very frequent
          });
          
          scannerRef.current = scanner;
        } catch (err) {
          console.error("Scanner initialization error:", err);
          setError("Erro ao iniciar a câmera. Verifique se deu permissão e se não está sendo usada por outro app.");
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        if (scanner) {
          scanner.clear().catch(e => console.error("Failed to clear scanner", e));
        }
      };
    }
  }, [showScanner]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      const searchUsers = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, grade')
          .ilike('full_name', `%${searchQuery}%`)
          .neq('id', profile?.id)
          .limit(5);

        if (!error && data) {
          setSearchResults(data);
        }
      };
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, profile?.id]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Por favor, selecione um usuário e insira um valor válido.');
      return;
    }

    if (Number(amount) > (profile?.balance || 0)) {
      setError('Saldo insuficiente.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // In a real app, this should be a stored procedure (RPC) in Supabase
      // to ensure transaction atomicity. For this demo, we'll do it sequentially.
      
      // 1. Deduct from sender
      const { error: senderError } = await supabase
        .from('profiles')
        .update({ balance: (profile?.balance || 0) - Number(amount) })
        .eq('id', profile?.id);

      if (senderError) throw senderError;

      // 2. Add to receiver
      // First get receiver's current balance
      const { data: receiverData, error: receiverFetchError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', selectedUser.id)
        .single();

      if (receiverFetchError) throw receiverFetchError;

      const { error: receiverUpdateError } = await supabase
        .from('profiles')
        .update({ balance: receiverData.balance + Number(amount) })
        .eq('id', selectedUser.id);

      if (receiverUpdateError) throw receiverUpdateError;

      // 3. Create transaction record
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          sender_id: profile?.id,
          receiver_id: selectedUser.id,
          amount: Number(amount),
        });

      if (txError) throw txError;

      setSuccess(true);
      await refreshProfile();
      setTimeout(() => navigate('/'), 2000);

    } catch (err: any) {
      console.error('Transfer error:', err);
      setError('Erro ao realizar transferência. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
              <Send className="w-6 h-6" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight underline decoration-all decoration-brand-orange/30 underline-offset-8">Movimentar Unireais</h1>
          </div>
          <p className="text-gray-500 font-medium text-base md:text-lg">Distribua recompensas e saldo entre colegas.</p>
        </div>

        <div className="bg-white p-4 rounded-[28px] md:rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 w-fit">
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Seu Saldo</p>
            <p className="text-lg md:text-xl font-black text-brand-orange">{profile?.balance?.toLocaleString()} <span className="text-[10px] text-gray-400 font-bold uppercase">UR</span></p>
          </div>
        </div>
      </header>

      <Card className="border-none shadow-2xl overflow-hidden bg-white max-w-2xl mx-auto">
        <CardContent className="p-10">
          {success ? (
            <div className="text-center py-12 animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-green-50 text-green-500 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-500/10 scale-110">
                <CheckCircle className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-black text-black mb-4 tracking-tight">Envio Concluído!</h2>
              <p className="text-gray-500 font-medium text-lg leading-relaxed">
                Você enviou <span className="text-brand-orange font-black">{amount} UR</span> para <br/>
                <span className="text-black font-black underline decoration-brand-orange/20 decoration-4 underline-offset-4">{selectedUser?.full_name}</span>.
              </p>
              <div className="mt-10 p-4 bg-gray-50 rounded-2xl inline-flex items-center gap-2 text-gray-400 font-bold text-xs uppercase tracking-widest">
                <div className="w-2 h-2 bg-brand-orange rounded-full animate-ping" />
                Retornando ao Início
              </div>
            </div>
          ) : (
            <form onSubmit={handleTransfer} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                  {error}
                </div>
              )}

              {showScanner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center">
                      <h3 className="font-bold">Escanear QR Code</h3>
                      <button onClick={() => setShowScanner(false)} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="p-4 overflow-hidden">
                      <div id="reader" className="w-full overflow-hidden rounded-2xl border-none"></div>
                      <style dangerouslySetInnerHTML={{ __html: `
                        #reader { border: none !important; }
                        #reader __dashboard_section_title { display: none !important; }
                        #reader button { 
                          background-color: #F27D26 !important; 
                          color: white !important; 
                          border: none !important; 
                          padding: 10px 20px !important; 
                          border-radius: 12px !important; 
                          font-weight: bold !important;
                          cursor: pointer !important;
                          margin: 10px auto !important;
                          display: block !important;
                        }
                        #reader img { display: none !important; }
                        #reader select {
                          padding: 8px !important;
                          border-radius: 8px !important;
                          border: 1px solid #ddd !important;
                          margin: 5px !important;
                        }
                      `}} />
                    </div>
                    <div className="p-6 text-center text-sm text-gray-500">
                      Aponte a câmera para o QR Code do colega
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-orange-50 p-4 rounded-xl border border-brand-orange/20 flex justify-between items-center">
                <span className="text-brand-orange font-medium">Seu Saldo Disponível</span>
                <span className="text-2xl font-bold text-brand-orange">{profile?.balance || 0} UR</span>
              </div>

              {!selectedUser ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Destinatário</label>
                    <button 
                      type="button" 
                      onClick={() => setShowScanner(true)}
                      className="bg-black text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-xl shadow-black/10"
                    >
                      <QrCode className="w-4 h-4" />
                      Escanear
                    </button>
                  </div>
                  <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 w-6 h-6 group-focus-within:text-brand-orange transition-colors" />
                    <Input
                      type="text"
                      placeholder="Busque pelo nome do aluno..."
                      className="pl-16 h-16 rounded-3xl bg-gray-50 border-transparent focus:bg-white focus:border-brand-orange focus:ring-0 text-lg font-bold transition-all"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {searchResults.length > 0 && (
                      <div className="bg-gray-50 rounded-[32px] overflow-hidden p-2 space-y-1">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className="w-full text-left px-5 py-4 rounded-2xl hover:bg-white hover:shadow-xl transition-all flex items-center gap-4 group"
                            onClick={() => setSelectedUser(user)}
                          >
                            <div className="w-12 h-12 rounded-2xl bg-white text-brand-orange border border-gray-100 flex items-center justify-center font-black transition-transform group-hover:bg-brand-orange group-hover:text-white group-hover:border-brand-orange group-hover:scale-105">
                              {user.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-black tracking-tight">{user.full_name}</span>
                              {user.grade && <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{user.grade}</span>}
                            </div>
                            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                               <ArrowUpRight className="w-5 h-5 text-brand-orange" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center justify-between p-6 bg-gray-50 rounded-[32px] border border-gray-100 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 bg-brand-orange/5 rounded-full -mr-6 -mt-6 blur-2xl" />
                    <div className="flex items-center gap-5 relative z-10">
                      <div className="w-16 h-16 rounded-[24px] bg-white text-brand-orange border-2 border-brand-orange/10 flex items-center justify-center font-black text-2xl shadow-xl shadow-brand-orange/10 transform transition-transform group-hover:rotate-6">
                        {selectedUser.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Enviando para</p>
                        <p className="text-xl font-black text-black tracking-tight leading-none mb-1">{selectedUser.full_name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{selectedUser.grade}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="bg-white text-gray-400 hover:text-brand-orange p-4 rounded-2xl border border-gray-100 hover:border-brand-orange transition-all font-black text-[10px] uppercase tracking-widest relative z-10"
                    >
                      Trocar
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">Valor da Transferência</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="1"
                        max={profile?.balance || 0}
                        placeholder="0"
                        className="text-4xl md:text-5xl font-black h-24 md:h-28 pl-8 pr-20 rounded-[32px] bg-gray-50 border-transparent focus:bg-white focus:border-brand-orange focus:ring-0 transition-all placeholder:text-gray-200"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                      <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 font-black text-xl md:text-2xl uppercase tracking-widest select-none">
                        UR
                      </span>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-20 rounded-[32px] text-xl font-black shadow-2xl shadow-brand-orange/20 uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all" 
                    disabled={loading || !amount || Number(amount) <= 0}
                  >
                    {loading ? 'Processando Envio...' : `Enviar Unireais Agora`}
                  </Button>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
