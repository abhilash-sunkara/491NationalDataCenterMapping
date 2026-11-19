import React from 'react';
import { Map, Menu, Loader2, Sparkles } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  isLoading: boolean;
  fileName: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isLoading,
  fileName,
}) => {
  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between px-4 z-40 select-none shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div>
            <h1 className="font-bold text-sm tracking-tight flex items-center gap-2">
              GeoPackage Viewer
            </h1>      
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-900/60 border border-indigo-700/60 rounded-full text-indigo-200 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Parsing GeoPackage...</span>
          </div>
        )}

        {fileName && !isLoading && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 bg-slate-800 px-3 py-1 rounded-md border border-slate-700 font-mono">
            <span>{fileName}</span>
          </div>
        )}
      </div>
    </header>
  );
};
