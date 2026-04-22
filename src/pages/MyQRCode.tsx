import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, QrCode, Download, Share2, Coins } from 'lucide-react';

export function MyQRCode() {
  const { profile } = useAuth();
  const qrRef = useRef<HTMLDivElement>(null);
  const [chargeAmount, setChargeAmount] = useState<string>('');

  if (!profile) return null;

  // Generate the transfer link
  // The app will open the transfer page with this user as the pre-selected recipient
  const baseUrl = `${window.location.origin}/transfer?to=${profile.id}`;
  const transferUrl = chargeAmount && Number(chargeAmount) > 0 
    ? `${baseUrl}&amount=${chargeAmount}`
    : baseUrl;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 50, 50, 900, 900);
        
        ctx.fillStyle = 'black';
        ctx.font = 'bold 40px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(profile.full_name, 500, 930);

        if (chargeAmount && Number(chargeAmount) > 0) {
          ctx.font = 'bold 30px Inter, sans-serif';
          ctx.fillStyle = '#F27D26';
          ctx.fillText(`Valor: ${chargeAmount} UR`, 500, 970);
        }
        
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `QRCode_Unireal_${profile.full_name.replace(/\s+/g, '_')}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Meu QR Code Unireal',
          text: `Envie Unireais para ${profile.full_name} usando este link:`,
          url: transferUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(transferUrl);
      alert('Link copiado para a área de transferência!');
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto printable-area">
      <header className="no-print">
        <h1 className="text-3xl font-bold text-black mb-2 flex items-center gap-3">
          <QrCode className="w-8 h-8 text-brand-orange" />
          Meu QR Code
        </h1>
        <p className="text-gray-500">Mostre este código para receber transferências rapidamente.</p>
      </header>

      <Card className="overflow-hidden border-none shadow-2xl">
        <div className="bg-brand-orange p-6 text-white text-center no-print">
          <h2 className="text-xl font-bold capitalize">{profile?.full_name || 'Usuário'}</h2>
          <p className="text-white/80 text-sm">{profile?.grade || 'Aluno'}</p>
        </div>
        
        <CardContent className="p-12 flex flex-col items-center justify-center bg-white">
          {profile?.is_admin && (
            <div className="w-full max-w-xs mb-8 no-print">
              <label className="block text-sm font-medium text-gray-700 mb-2">Valor Fixo da Cobrança (Opcional)</label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  placeholder="Exemplo: 50"
                  className="text-xl font-bold h-14 pl-10 bg-gray-50 border-gray-200"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                />
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold uppercase text-sm">
                  UR
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">Deixe em branco para que o pagador decida o valor.</p>
            </div>
          )}

          <div ref={qrRef} className="p-4 bg-white border-8 border-brand-orange/10 rounded-3xl shadow-inner mb-8">
            <QRCodeSVG 
              value={transferUrl || baseUrl} 
              size={256}
              level="H"
              includeMargin={false}
            />
          </div>
          
          <div className="text-center mb-8">
            <p className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-1">Escaneie para pagar</p>
            <p className="text-2xl font-black text-black">
              {chargeAmount && Number(chargeAmount) > 0 ? `${chargeAmount} UR` : 'UNIREAL'}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 no-print">
            <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
            <Button onClick={handleDownload} variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Baixar PNG
            </Button>
            <Button onClick={handleShare} className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Compartilhar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-orange-50 p-6 rounded-2xl border border-brand-orange/20 no-print">
        <h3 className="font-bold text-brand-orange mb-2">Como funciona?</h3>
        <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
          <li>Imprima este código e cole no seu caderno ou crachá.</li>
          <li>Outros alunos podem escanear com a câmera do celular.</li>
          <li>O sistema abrirá automaticamente a tela de transferência com seu nome selecionado.</li>
        </ul>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .printable-area .Card {
            box-shadow: none !important;
            border: 1px solid #eee !important;
          }
        }
      `}} />
    </div>
  );
}
