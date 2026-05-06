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
    <div className="space-y-12 max-w-4xl mx-auto pb-10 printable-area">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 no-print">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
              <QrCode className="w-6 h-6" />
            </div>
            <h1 className="text-4xl font-black text-black tracking-tight border-b-4 border-brand-orange pb-2">Receber Moedas</h1>
          </div>
          <p className="text-gray-500 font-medium text-lg">Seu canal direto para recargas e pagamentos.</p>
        </div>
      </header>

      <Card className="overflow-hidden border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] bg-white max-w-xl mx-auto rounded-[40px]">
        <div className="bg-gray-900 p-10 text-white text-center no-print relative overflow-hidden">
          <div className="absolute top-0 right-0 p-20 bg-brand-orange/10 rounded-full -mr-10 -mt-10 blur-2xl" />
          <h2 className="text-2xl font-black capitalize tracking-tight relative z-10">{profile.full_name}</h2>
          <p className="text-brand-orange font-black text-[10px] uppercase tracking-[0.3em] mt-1 relative z-10">{profile.grade || 'Estudante'}</p>
        </div>
        
        <CardContent className="p-12 flex flex-col items-center justify-center bg-white">
          <div className="w-full max-w-xs mb-10 no-print">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-4">Sugerir Valor (Opcional)</label>
            <div className="relative">
              <Input
                type="number"
                placeholder="Valor fixo..."
                className="h-16 rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:border-brand-orange transition-all text-center text-xl font-black pr-12"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 font-black text-xs uppercase">UR</span>
            </div>
          </div>

          <div 
            ref={qrRef} 
            className="p-10 bg-white rounded-[40px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1),0_20px_40px_rgba(0,0,0,0.05)] mb-8 transition-transform hover:scale-[1.02] cursor-pointer"
            onClick={handleDownload}
          >
            <QRCodeSVG 
              value={transferUrl}
              size={280}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: "/apple-touch-icon.png",
                x: undefined,
                y: undefined,
                height: 48,
                width: 48,
                excavate: true,
              }}
            />
          </div>
          
          <div className="text-center mb-10">
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Escaneie para pagar</p>
            <p className="text-3xl font-black text-black tracking-tight">
              {chargeAmount && Number(chargeAmount) > 0 ? `${chargeAmount} UR` : 'UNIREAIS'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full no-print">
            <Button 
              variant="outline" 
              className="h-14 rounded-2xl border-gray-100 hover:bg-gray-50 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-gray-500"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4" /> Baixar PNG
            </Button>
            <Button 
              variant="outline"
              className="h-14 rounded-2xl border-gray-100 hover:bg-gray-50 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-gray-500"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4" /> Compartilhar
            </Button>
            <Button 
              className="col-span-2 h-14 rounded-2xl bg-brand-orange hover:bg-brand-orange/90 text-white flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-brand-orange/20"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4" /> Imprimir Etiqueta
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="max-w-xl mx-auto p-10 rounded-[40px] bg-brand-orange/5 border border-brand-orange/10 no-print flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-[24px] bg-brand-orange/20 flex items-center justify-center text-brand-orange mb-6">
          <Coins className="w-8 h-8" />
        </div>
        <h3 className="font-black text-xl text-black tracking-tight mb-4 uppercase italic">Dica de Empreendedor!</h3>
        <p className="text-gray-500 font-medium leading-relaxed max-w-sm">
          Este código é seu identificador único. <br/>
          <span className="text-brand-orange font-bold italic underline decoration-brand-orange/20 underline-offset-4">Imprima e cole na sua barraca</span> para acelerar suas vendas e receber pagamentos na hora!
        </p>
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
