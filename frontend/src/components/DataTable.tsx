import React, { useState, useMemo } from 'react';
import { GeoJsonFeature } from '../types';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Table as TableIcon,
  Download,
  FileSpreadsheet,
  Database,
} from 'lucide-react';

interface DataTableProps {
  features: GeoJsonFeature[];
  columns: string[];
  selectedFeature: GeoJsonFeature | null;
  onSelectFeature: (feature: GeoJsonFeature | null) => void;
  isOpen: boolean;
  onToggle: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onExport?: (format: 'geojson' | 'csv' | 'json' | 'gpkg', featuresToExport: GeoJsonFeature[]) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  features,
  columns,
  selectedFeature,
  onSelectFeature,
  isOpen,
  onToggle,
  searchTerm: externalSearchTerm,
  onSearchChange,
  onExport,
}) => {
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const handleSearchChange = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setInternalSearchTerm(val);
    }
    setPage(1);
  };

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Filter features if not already filtered externally
  const filteredFeatures = useMemo(() => {
    // If externalSearchTerm is passed and already filters features in parent, features is already filtered.
    // However, if internal search is used or features wasn't filtered, filter here:
    if (!searchTerm.trim()) return features;
    const term = searchTerm.toLowerCase();

    // Check if features already are filtered by term
    return features.filter((feat) => {
      const props = feat.properties || {};
      return Object.values(props).some((val) =>
        String(val ?? '').toLowerCase().includes(term)
      );
    });
  }, [features, searchTerm]);


  // Sort features
  const sortedFeatures = useMemo(() => {
    if (!sortColumn) return filteredFeatures;

    return [...filteredFeatures].sort((a, b) => {
      const valA = a.properties?.[sortColumn];
      const valB = b.properties?.[sortColumn];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const numA = Number(valA);
      const numB = Number(valB);
      const isNum = !isNaN(numA) && !isNaN(numB);

      let comparison = 0;
      if (isNum) {
        comparison = numA - numB;
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredFeatures, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedFeatures.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedFeatures = sortedFeatures.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 shadow-2xl transition-all duration-300 flex flex-col ${
        isOpen ? 'h-80' : 'h-11'
      }`}
    >
      {/* Drawer Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-slate-700 cursor-pointer select-none">
        <div className="flex items-center gap-2.5" onClick={onToggle}>
          <TableIcon className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-semibold tracking-wide uppercase text-slate-800">
            Attribute Table
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
            {filteredFeatures.length} records
          </span>
        </div>

        {isOpen && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white w-48"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Quick Export Actions */}
            {onExport && (
              <div
                className="flex items-center gap-1.5 border-l border-slate-200 pl-3"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] text-slate-400 font-medium">Export:</span>
                <button
                  type="button"
                  onClick={() => onExport('gpkg', sortedFeatures)}
                  className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-amber-50 hover:border-amber-300 border border-slate-300 rounded-md text-[11px] text-slate-700 font-medium transition shadow-xs"
                  title={`Export ${sortedFeatures.length} records as GeoPackage (.gpkg)`}
                >
                  <Database className="w-3 h-3 text-amber-600" />
                  <span>GPKG</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExport('csv', sortedFeatures)}
                  className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-300 rounded-md text-[11px] text-slate-700 font-medium transition shadow-xs"
                  title={`Export ${sortedFeatures.length} records as CSV`}
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExport('geojson', sortedFeatures)}
                  className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-indigo-50 hover:border-indigo-300 border border-slate-300 rounded-md text-[11px] text-slate-700 font-medium transition shadow-xs"
                  title={`Export ${sortedFeatures.length} records as GeoJSON`}
                >
                  <Download className="w-3 h-3 text-indigo-600" />
                  <span>GeoJSON</span>
                </button>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center gap-1 text-xs text-slate-600 border-l border-slate-200 pl-3">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onToggle}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          {isOpen ? 'Minimize' : 'Expand'}
        </button>
      </div>

      {/* Table Content */}
      {isOpen && (
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-2 px-3 w-12 text-center text-slate-400">#</th>
                {columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="py-2 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/60 transition group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {paginatedFeatures.map((feat, idx) => {
                const isSelected = selectedFeature?.id === feat.id;
                const rowNum = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr
                    key={feat.id ?? idx}
                    onClick={() => onSelectFeature(feat)}
                    className={`cursor-pointer transition hover:bg-indigo-50/60 ${
                      isSelected ? 'bg-indigo-100/70 font-medium text-indigo-950' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {rowNum}
                    </td>
                    {columns.map((col) => {
                      const val = feat.properties?.[col];
                      return (
                        <td
                          key={col}
                          className="py-2 px-3 whitespace-nowrap max-w-xs truncate text-[12px]"
                          title={String(val ?? '')}
                        >
                          {val !== null && val !== undefined ? String(val) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
