import React, { useRef, useState } from 'react';
import { LayerMetadata } from '../types';
import {
  UploadCloud,
  FileSpreadsheet,
  FileJson,
  Download,
  Palette,
  Layers,
  Database,
  Info,
  CheckCircle2,
  Filter,
  Search,
} from 'lucide-react';

interface SidebarProps {
  fileName: string;
  fileSizeBytes: number;
  layers: LayerMetadata[];
  activeLayer: LayerMetadata | null;
  onSelectLayer: (layerName: string) => void;
  onFileUpload: (file: File) => void;
  onLoadSample: () => void;
  isLoading: boolean;
  colorAttribute: string;
  onColorAttributeChange: (attr: string) => void;
  colorMap: Record<string, string>;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  attributeCounts: Record<string, number>;
  onExportGeoJSON?: () => void;
  onExportCSV?: () => void;
  onExport?: (format: 'geojson' | 'csv' | 'json' | 'gpkg', onlyFiltered: boolean) => void;
  isOpen: boolean;
  totalFeaturesCount?: number;
  filteredFeaturesCount?: number;
  searchTerm?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  fileName,
  fileSizeBytes,
  layers,
  activeLayer,
  onSelectLayer,
  onFileUpload,
  onLoadSample,
  isLoading,
  colorAttribute,
  onColorAttributeChange,
  colorMap,
  selectedCategory,
  onSelectCategory,
  attributeCounts,
  onExportGeoJSON,
  onExportCSV,
  onExport,
  isOpen,
  totalFeaturesCount = 0,
  filteredFeaturesCount = 0,
  searchTerm = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');


  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.gpkg')) {
        onFileUpload(file);
      } else {
        alert('Please drop a valid .gpkg file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <aside className="w-80 bg-white border-r border-slate-200 flex flex-col h-full shadow-lg z-30 select-none">
      {/* Upload & Dropzone */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".gpkg"
            className="hidden"
          />
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800">
              Drag & Drop your <span className="text-indigo-600">.gpkg</span> file
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">or click to browse local files</p>
          </div>
        </div>

        {/* Load Sample Button */}
        
      </div>

      {/* Layer Details & Controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Dataset Info Box */}
        {/* {activeLayer ? (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                Active Dataset
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {formatBytes(fileSizeBytes)}
              </span>
            </div>
            <div className="text-xs font-medium text-slate-900 truncate" title={fileName}>
              {fileName}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Features
                </span>
                <span className="text-base font-bold text-slate-800">
                  {activeLayer.featureCount}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  CRS / SRS
                </span>
                <span className="text-base font-bold text-indigo-600">
                  {activeLayer.srsId || '4326'}
                </span>
              </div>
            </div>
          </div>
        ) : null} */}

        {/* Layer Selector */}
        {layers.length > 1 && (
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Layers ({layers.length})
            </label>
            <select
              value={activeLayer?.tableName || ''}
              onChange={(e) => onSelectLayer(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {layers.map((l) => (
                <option key={l.tableName} value={l.tableName}>
                  {l.tableName} ({l.geomType}) - {l.featureCount} items
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Color By Category */}
        {activeLayer && (() => {
          const isAllowedField = (col: string) => {
            const norm = col.toLowerCase().replace(/[\s_-]+/g, '');
            return ['state', 'size', 'operatorname', 'operator', 'status'].includes(norm);
          };

          const formatFieldLabel = (col: string) => {
            const norm = col.toLowerCase().replace(/[\s_-]+/g, '');
            if (norm === 'operatorname' || norm === 'operator') return 'Operator Name';
            if (norm === 'status') return 'Status';
            if (norm === 'state') return 'State';
            if (norm === 'size') return 'Size';
            return col;
          };

          const colorOptions = activeLayer.columns.filter(isAllowedField);

          return (
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                {/* <Palette className="w-3.5 h-3.5 text-indigo-600" /> */}
                Filter
              </label>
              <select
                value={colorAttribute}
                onChange={(e) => onColorAttributeChange(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Default (Single Color)</option>
                {colorOptions.map((col) => (
                  <option key={col} value={col}>
                    {formatFieldLabel(col)}
                  </option>
                ))}
              </select>

              {/* Category Legend & Filter */}
              {colorAttribute && Object.keys(colorMap).length > 0 && (
                <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-slate-600 uppercase flex items-center gap-1">
                      <Filter className="w-3 h-3 text-slate-400" />
                      Categories
                    </span>
                    {selectedCategory && (
                      <button
                        onClick={() => onSelectCategory('')}
                        className="text-[11px] text-indigo-600 hover:underline"
                      >
                        Clear Filter
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {Object.entries(colorMap).map(([cat, color]) => {
                      const count = attributeCounts[cat] ?? 0;
                      const isFiltered = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => onSelectCategory(isFiltered ? '' : cat)}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-xs transition ${
                            isFiltered
                              ? 'bg-indigo-100/70 font-semibold text-indigo-900 border border-indigo-300'
                              : 'hover:bg-slate-200/50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                            <span className="truncate">{cat || '(empty)'}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}


        {/* Export Data */}
        {activeLayer && (() => {
          const isFiltered = Boolean(
            (selectedCategory && colorAttribute) || (searchTerm && searchTerm.trim())
          );
          const currentCount =
            isFiltered && exportScope === 'filtered'
              ? filteredFeaturesCount
              : totalFeaturesCount;

          return (
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  Export Data
                </span>
                {isFiltered && (
                  <span className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Filter className="w-2.5 h-2.5" />
                    Filters Active
                  </span>
                )}
              </div>

              {/* Filter Indicator / Scope Toggle */}
              {isFiltered ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-2">
                  <div className="text-[11px] text-slate-600 space-y-1">
                    {selectedCategory && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Filter className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="text-slate-400">Category:</span>
                        <span className="font-semibold text-slate-800 truncate">
                          {selectedCategory}
                        </span>
                      </div>
                    )}
                    {searchTerm && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Search className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="text-slate-400">Search:</span>
                        <span className="font-semibold text-slate-800 truncate">
                          "{searchTerm}"
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Scope selector */}
                  <div className="flex rounded-md bg-slate-200/70 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setExportScope('filtered')}
                      className={`flex-1 py-1 rounded text-center font-medium transition ${
                        exportScope === 'filtered'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Filtered ({filteredFeaturesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportScope('all')}
                      className={`flex-1 py-1 rounded text-center font-medium transition ${
                        exportScope === 'all'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({totalFeaturesCount})
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                  <span>Exporting full dataset</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {totalFeaturesCount} records
                  </span>
                </div>
              )}

              {/* Export Format Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (onExport) {
                      onExport('gpkg', isFiltered && exportScope === 'filtered');
                    }
                  }}
                  className="py-1.5 px-2 bg-white hover:bg-amber-50/70 hover:border-amber-300 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition flex items-center justify-center gap-1.5 shadow-sm group"
                  title={`Export ${currentCount} records as standard GeoPackage (.gpkg)`}
                >
                  <Database className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition shrink-0" />
                  <span className="text-[11px] font-medium">GeoPackage</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onExport) {
                      onExport('geojson', isFiltered && exportScope === 'filtered');
                    } else if (onExportGeoJSON) {
                      onExportGeoJSON();
                    }
                  }}
                  className="py-1.5 px-2 bg-white hover:bg-indigo-50/70 hover:border-indigo-300 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition flex items-center justify-center gap-1.5 shadow-sm group"
                  title={`Export ${currentCount} records as GeoJSON (.geojson)`}
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition shrink-0" />
                  <span className="text-[11px] font-medium">GeoJSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onExport) {
                      onExport('csv', isFiltered && exportScope === 'filtered');
                    } else if (onExportCSV) {
                      onExportCSV();
                    }
                  }}
                  className="py-1.5 px-2 bg-white hover:bg-emerald-50/70 hover:border-emerald-300 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition flex items-center justify-center gap-1.5 shadow-sm group"
                  title={`Export ${currentCount} records as CSV spreadsheet (.csv)`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition shrink-0" />
                  <span className="text-[11px] font-medium">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onExport) {
                      onExport('json', isFiltered && exportScope === 'filtered');
                    }
                  }}
                  className="py-1.5 px-2 bg-white hover:bg-blue-50/70 hover:border-blue-300 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition flex items-center justify-center gap-1.5 shadow-sm group"
                  title={`Export ${currentCount} records as JSON (.json)`}
                >
                  <FileJson className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition shrink-0" />
                  <span className="text-[11px] font-medium">JSON</span>
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Client-Side WebAssembly
        </span>
        <span className="font-mono text-slate-400">OGC GPKG</span>
      </div>
    </aside>
  );
};
