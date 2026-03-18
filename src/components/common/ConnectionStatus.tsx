import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ConnectionStatusProps {
  binanceStatus: ConnectionState;
  coinbaseStatus: ConnectionState;
}

const StatusDot: React.FC<{ status: ConnectionState; label: string }> = ({ status, label }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'disconnected':
      case 'error':
        return 'bg-red-500';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Wifi size={12} />;
      case 'connecting':
        return <Loader2 size={12} className="animate-spin" />;
      case 'disconnected':
      case 'error':
        return <WifiOff size={12} />;
    }
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-500">{getStatusIcon()}</span>
    </div>
  );
};

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ binanceStatus, coinbaseStatus }) => {
  const allConnected = binanceStatus === 'connected' && coinbaseStatus === 'connected';
  const anyDisconnected = binanceStatus === 'disconnected' || coinbaseStatus === 'disconnected';

  if (allConnected) {
    return null; // Don't show when everything is working
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed bottom-20 md:bottom-4 right-4 z-50 px-3 py-2 rounded-lg border backdrop-blur-sm ${
        anyDisconnected
          ? 'bg-red-500/10 border-red-500/30 text-red-400'
          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="sr-only">Connection Status Warning</div>
        <StatusDot status={binanceStatus} label="Binance" />
        <StatusDot status={coinbaseStatus} label="Coinbase" />
      </div>
    </div>
  );
};

export default ConnectionStatus;
