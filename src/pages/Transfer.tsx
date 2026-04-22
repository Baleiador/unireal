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
            // Robust parsing mechanism to ensure we capture URL and params correctly
            let parsedToId: string | null = null;
            let parsedAmount: string | null = null;

            // Try parsing as standard URL
            try {
              const url = new URL(decodedText);
              parsedToId = url.searchParams.get('to');
              parsedAmount = url.searchParams.get('amount');
            } catch (e) {
              // If standard URL parsing fails, we handle it below
            }

            // Fallback Regex parsing in case it's a malformed URL
            if (!parsedToId && decodedText.includes('to=')) {
               const toMatch = decodedText.match(/to=([^&]+)/);
               if (toMatch) parsedToId = toMatch[1];
               
               const amountMatch = decodedText.match(/amount=([^&]+)/);
               if (amountMatch) parsedAmount = amountMatch[1];
            }

            // Final fallback: plain UUID
            if (!parsedToId && decodedText.length > 30 && !decodedText.includes('http')) {
              parsedToId = decodedText;
            }

            if (parsedToId) {
              // Force state update immediately
              if (parsedAmount) {
                setAmount(parsedAmount);
              }
              
              fetchUserById(parsedToId);
              
              // Cleanup scanner
              scanner?.clear().catch(e => console.error("Clear error", e));
              setShowScanner(false);
            } else {
              alert("QR Code não reconhecido: " + decodedText);
              scanner?.clear().catch(e => console.error("Clear error", e));
              setShowScanner(false);
            }
          } catch (err) {
            console.error("Scanner parsing error:", err);
          }
        }, (errorMessage) => {
          // Silently ignore errors during scanning as it's very frequent
        });
        
        scannerRef.current = scanner;
      } catch (err) {
        console.error("Scanner initialization error:", err);
        setError("Erro ao iniciar a câmera. Verifique permissões.");
      }

      return () => {
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
    <div className="space-y-8 max-w-2xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-black mb-2 flex items-center gap-3">
          <Send className="w-8 h-8 text-brand-orange" />
          Transferir Unireais
        </h1>
        <p className="text-gray-500">Envie recompensas para seus colegas.</p>
      </header>

      <Card>
        <CardContent className="p-8">
          {success ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Send className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-black mb-2">Transferência Realizada!</h2>
              <p className="text-gray-500">Você enviou {amount} UR para {selectedUser?.full_name}.</p>
              <p className="text-sm text-gray-400 mt-4">Redirecionando para o dashboard...</p>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Para quem você quer enviar?</label>
                    <button 
                      type="button" 
                      onClick={() => setShowScanner(true)}
                      className="text-brand-orange font-bold text-sm flex items-center gap-1 hover:underline"
                    >
                      <QrCode className="w-4 h-4" />
                      Escanear QR
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      type="text"
                      placeholder="Busque pelo nome do aluno..."
                      className="pl-12"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {searchResults.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-50">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                          onClick={() => setSelectedUser(user)}
                        >
                          <div className="w-10 h-10 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center font-bold">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-black">{user.full_name}</span>
                            {user.grade && <span className="text-xs text-gray-500">{user.grade}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center font-bold text-lg">
                        {selectedUser.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Enviando para</p>
                        <p className="font-semibold text-black">{selectedUser.full_name}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="text-sm text-brand-orange hover:underline"
                    >
                      Trocar
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Valor (Unireais)</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="1"
                        max={profile?.balance || 0}
                        placeholder="0"
                        className="text-3xl font-bold h-20 pl-6"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl uppercase">
                        UR
                      </span>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-14 text-lg" disabled={loading}>
                    {loading ? 'Enviando...' : `Enviar ${amount || 0} UR`}
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
