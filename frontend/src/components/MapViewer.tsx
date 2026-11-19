import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GeoJsonFeature, GeoJsonFeatureCollection, BaseMapType } from '../types';
import { Layers, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

interface MapViewerProps {
  data: GeoJsonFeatureCollection | null;
  selectedFeature: GeoJsonFeature | null;
  onSelectFeature: (feature: GeoJsonFeature | null) => void;
  colorAttribute?: string;
  colorMap?: Record<string, string>;
  titleField?: string;
}

const BASEMAP_TILES: Record<BaseMapType, { name: string; url: string; attribution: string }> = {
  streets: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    name: 'Esri Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
  },
  esriStreets: {
    name: 'Esri Streets',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Sources: Esri, DeLorme, NAVTEQ',
  },
  topo: {
    name: 'Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Sources: USGS, Intermap, EPA',
  },
};

export const MapViewer: React.FC<MapViewerProps> = ({
  data,
  selectedFeature,
  onSelectFeature,
  colorAttribute,
  colorMap,
  titleField,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const geoJsonLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [baseMap, setBaseMap] = useState<BaseMapType>('streets');
  const [showBaseMapMenu, setShowBaseMapMenu] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(4);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795], // US Center default
      zoom: 4,
      zoomControl: false,
    });

    const tile = L.tileLayer(BASEMAP_TILES[baseMap].url, {
      attribution: BASEMAP_TILES[baseMap].attribution,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tile;

    const layerGroup = L.layerGroup().addTo(map);
    geoJsonLayerGroupRef.current = layerGroup;

    map.on('mousemove', (e) => {
      setCursorCoords({
        lat: Number(e.latlng.lat.toFixed(4)),
        lng: Number(e.latlng.lng.toFixed(4)),
      });
    });

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update BaseMap Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(BASEMAP_TILES[baseMap].url);
  }, [baseMap]);

  // Render Features when data or colorMap changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = geoJsonLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (!data || !data.features || data.features.length === 0) return;

    const features = data.features;
    const bounds = L.latLngBounds([]);

    features.forEach((feature) => {
      const geom = feature.geometry;
      if (!geom || !geom.coordinates) return;

      const props = feature.properties || {};
      const val = colorAttribute ? String(props[colorAttribute] ?? '') : '';
      const color = (colorMap && val && colorMap[val]) ? colorMap[val] : '#2563eb';

      const displayName =
        (titleField && props[titleField]) ||
        props.name ||
        props.title ||
        props.id ||
        props.fid ||
        'Feature';

      if (geom.type === 'Point') {
        const [lng, lat] = geom.coordinates;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const latLng = L.latLng(lat, lng);
          bounds.extend(latLng);

          const isSelected = selectedFeature?.id === feature.id;

          const marker = L.circleMarker(latLng, {
            radius: isSelected ? 9 : 6.5,
            fillColor: color,
            fillOpacity: 0.85,
            color: isSelected ? '#ffffff' : '#1e293b',
            weight: isSelected ? 3 : 1.5,
          });

          marker.bindTooltip(
            `<div class="font-medium text-xs text-slate-800">${String(displayName)}</div>`,
            { direction: 'top', offset: [0, -5] }
          );

          marker.on('click', () => {
            onSelectFeature(feature);
          });

          marker.addTo(group);
        }
      } else {
        // LineString, Polygon, MultiPolygon, etc.
        const layer = L.geoJSON(feature as any, {
          style: () => ({
            color: color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.4,
          }),
          onEachFeature: (_, lyr) => {
            lyr.bindTooltip(
              `<div class="font-medium text-xs text-slate-800">${String(displayName)}</div>`,
              { direction: 'top' }
            );
            lyr.on('click', () => {
              onSelectFeature(feature);
            });
          },
        });

        layer.addTo(group);
        try {
          const b = layer.getBounds();
          if (b.isValid()) bounds.extend(b);
        } catch {
          // ignore invalid bounds
        }
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [data, colorAttribute, colorMap, titleField]);

  // Highlight or center selected feature
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedFeature) return;
    const geom = selectedFeature.geometry;
    if (geom && geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      const [lng, lat] = geom.coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        mapInstanceRef.current.flyTo([lat, lng], Math.max(mapInstanceRef.current.getZoom(), 11), {
          duration: 1.2,
        });
      }
    }
  }, [selectedFeature]);

  const fitBounds = () => {
    if (!mapInstanceRef.current || !data || !data.bbox) return;
    const [minX, minY, maxX, maxY] = data.bbox;
    mapInstanceRef.current.fitBounds(
      [
        [minY, minX],
        [maxY, maxX],
      ],
      { padding: [40, 40], maxZoom: 14 }
    );
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {/* Basemap Picker */}
        <div className="relative">
          <button
            onClick={() => setShowBaseMapMenu(!showBaseMapMenu)}
            title="Change Basemap"
            className="p-2.5 bg-white/95 backdrop-blur-md text-slate-700 hover:text-slate-900 rounded-lg shadow-md hover:bg-slate-50 transition border border-slate-200 flex items-center justify-center"
          >
            <Layers className="w-5 h-5 text-indigo-600" />
          </button>

          {showBaseMapMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Basemap
              </div>
              {(['streets', 'satellite', 'esriStreets', 'topo'] as BaseMapType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setBaseMap(type);
                    setShowBaseMapMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-100 transition ${
                    baseMap === type ? 'text-indigo-600 font-semibold bg-indigo-50/50' : 'text-slate-700'
                  }`}
                >
                  {BASEMAP_TILES[type].name}
                  {baseMap === type && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fit Bounds */}
        <button
          onClick={fitBounds}
          title="Fit Layer to Bounds"
          className="p-2.5 bg-white/95 backdrop-blur-md text-slate-700 hover:text-slate-900 rounded-lg shadow-md hover:bg-slate-50 transition border border-slate-200 flex items-center justify-center"
        >
          <Maximize2 className="w-5 h-5 text-slate-600" />
        </button>

        {/* Zoom Controls */}
        <div className="flex flex-col bg-white/95 backdrop-blur-md rounded-lg shadow-md border border-slate-200 overflow-hidden">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            title="Zoom In"
            className="p-2.5 hover:bg-slate-100 text-slate-700 border-b border-slate-200 flex items-center justify-center"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            title="Zoom Out"
            className="p-2.5 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Status Pill: Coordinates & Zoom */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-mono px-3 py-1.5 rounded-full shadow-lg flex items-center gap-3 border border-slate-700/50">
          <span>Zoom: {zoomLevel}</span>
          {cursorCoords && (
            <span>
              Lat: {cursorCoords.lat.toFixed(4)}°, Lng: {cursorCoords.lng.toFixed(4)}°
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
