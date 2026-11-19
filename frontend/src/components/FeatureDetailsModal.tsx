import React from 'react';
import { GeoJsonFeature } from '../types';
import { X, MapPin, Tag } from 'lucide-react';

interface FeatureDetailsModalProps {
  feature: GeoJsonFeature | null;
  onClose: () => void;
  titleField?: string;
}

export const FeatureDetailsModal: React.FC<FeatureDetailsModalProps> = ({
  feature,
  onClose,
  titleField,
}) => {
  if (!feature) return null;

  const props = feature.properties || {};
  const title =
    (titleField && props[titleField]) ||
    props.name ||
    props.title ||
    props.id ||
    `Feature #${feature.id}`;

  const geomType = feature.geometry?.type || 'Unknown';
  let coordsString = '';
  if (feature.geometry?.coordinates) {
    if (geomType === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      coordsString = `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
    }
  }

  return (
    <div className="absolute top-4 left-4 z-20 max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
        <div className="flex items-center gap-2 overflow-hidden">
          <MapPin className="w-4 h-4 shrink-0" />
          <h3 className="font-semibold text-sm truncate" title={String(title)}>
            {String(title)}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/20 transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Geometry Info Pill */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1 font-medium text-slate-700">
          <Tag className="w-3 h-3 text-indigo-500" />
          {geomType}
        </span>
        {coordsString && <span className="font-mono text-[11px]">{coordsString}</span>}
      </div>

      {/* Properties List */}
      <div className="p-4 max-h-72 overflow-y-auto space-y-2.5 text-xs">
        {Object.entries(props).map(([key, val]) => (
          <div key={key} className="flex flex-col border-b border-slate-100 pb-1.5 last:border-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {key}
            </span>
            <span className="text-slate-800 break-words font-medium mt-0.5">
              {val !== null && val !== undefined ? String(val) : <em className="text-slate-400">null</em>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
