import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { parseGeoPackageFile, ParsedGeoPackage } from './lib/geopackageReader';
import { generateCategoryColors } from './lib/colorUtils';
import { exportData, ExportFormat, FilterMetadata } from './lib/exportUtils';
import { GeoJsonFeature } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MapViewer } from './components/MapViewer';
import { DataTable } from './components/DataTable';
import { FeatureDetailsModal } from './components/FeatureDetailsModal';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [parsedData, setParsedData] = useState<ParsedGeoPackage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportNotification, setExportNotification] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<GeoJsonFeature | null>(null);

  // Styling & Filtering State
  const [colorAttribute, setColorAttribute] = useState<string>('status');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');


  // Auto-load sample dataset on initial launch
  const loadSampleData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/sample_data_center_layer.gpkg');
      if (!response.ok) {
        throw new Error(`Failed to load sample dataset: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const result = await parseGeoPackageFile(buffer, 'data_center_layer.gpkg');
      setParsedData(result);
      if (result.activeLayer.columns.includes('status')) {
        setColorAttribute('status');
      } else if (result.activeLayer.columns.length > 0) {
        setColorAttribute(result.activeLayer.columns[0]);
      }
    } catch (err: any) {
      console.error('Failed to load sample GPKG:', err);
      setError(err?.message || 'Failed to load sample dataset.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSampleData();
  }, [loadSampleData]);

  // Handle User File Upload
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setSelectedFeature(null);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parseGeoPackageFile(buffer, file.name);
      setParsedData(result);

      // Default color attribute to one of allowed fields if available
      const isAllowedField = (col: string) => {
        const norm = col.toLowerCase().replace(/[\s_-]+/g, '');
        return ['state', 'size', 'operatorname', 'operator', 'status'].includes(norm);
      };
      const found = result.activeLayer.columns.find(isAllowedField);
      setColorAttribute(found || '');
      setSelectedCategory('');
      setSearchTerm('');
    } catch (err: any) {
      console.error('Error parsing GPKG file:', err);
      setError(err?.message || 'Failed to parse GeoPackage file. Please ensure it is a valid .gpkg file.');
    } finally {
      setIsLoading(false);
    }
  };

  // Change Active Layer
  const handleSelectLayer = (tableName: string) => {
    if (!parsedData) return;
    const target = parsedData.layers.find((l) => l.tableName === tableName);
    if (!target) return;

    setParsedData({
      ...parsedData,
      activeLayer: target,
      featureCollection: parsedData.layerDataMap[tableName],
    });
    setSelectedFeature(null);
    setColorAttribute('');
    setSelectedCategory('');
    setSearchTerm('');
  };

  // Compute color map & counts for categorical attribute
  const { colorMap, attributeCounts } = useMemo(() => {
    if (!parsedData || !colorAttribute) return { colorMap: {}, attributeCounts: {} };

    const features = parsedData.featureCollection.features;
    const counts: Record<string, number> = {};
    const values: (string | number)[] = [];

    features.forEach((feat) => {
      const val = feat.properties?.[colorAttribute];
      const strVal = val !== null && val !== undefined ? String(val) : 'Unknown / Empty';
      values.push(strVal);
      counts[strVal] = (counts[strVal] || 0) + 1;
    });

    const colors = generateCategoryColors(values);
    return { colorMap: colors, attributeCounts: counts };
  }, [parsedData, colorAttribute]);

  // Filtered features based on selected category in the sidebar AND search query
  const displayedFeatureCollection = useMemo(() => {
    if (!parsedData) return null;
    let feats = parsedData.featureCollection.features;

    // Filter by category
    if (selectedCategory && colorAttribute) {
      feats = feats.filter((f) => {
        const val = f.properties?.[colorAttribute];
        const strVal = val !== null && val !== undefined ? String(val) : 'Unknown / Empty';
        return strVal === selectedCategory;
      });
    }

    // Filter by search query
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      feats = feats.filter((f) => {
        const props = f.properties || {};
        return Object.values(props).some((val) =>
          String(val ?? '').toLowerCase().includes(term)
        );
      });
    }

    return {
      ...parsedData.featureCollection,
      features: feats,
    };
  }, [parsedData, selectedCategory, colorAttribute, searchTerm]);

  // Guess primary title field
  const titleField = useMemo(() => {
    if (!parsedData) return undefined;
    const cols = parsedData.activeLayer.columns;
    return cols.find((c) => ['name', 'title', 'label', 'identifier', 'facility_name'].includes(c.toLowerCase()));
  }, [parsedData]);

  // Unified export utility that accounts for active UI filters
  const handleExport = useCallback(
    async (
      format: ExportFormat,
      onlyFiltered: boolean = true,
      customFeatures?: GeoJsonFeature[]
    ) => {
      if (!parsedData) return;

      const isFilterActive = Boolean(
        (selectedCategory && colorAttribute) || searchTerm.trim()
      );

      // Determine which features to export:
      // 1. If explicit customFeatures provided (e.g. from sorted table), use those
      // 2. Otherwise if onlyFiltered is true and filters are active, use displayed features
      // 3. Otherwise, use all features in the active layer
      let featuresToExport: GeoJsonFeature[];
      if (customFeatures) {
        featuresToExport = customFeatures;
      } else if (onlyFiltered && isFilterActive) {
        featuresToExport = displayedFeatureCollection?.features || [];
      } else {
        featuresToExport = parsedData.featureCollection.features;
      }

      const filterInfo: FilterMetadata = {
        colorAttribute: selectedCategory ? colorAttribute : undefined,
        selectedCategory: selectedCategory || undefined,
        searchQuery: searchTerm.trim() || undefined,
        totalCount: parsedData.featureCollection.features.length,
        filteredCount: featuresToExport.length,
      };

      try {
        const result = await exportData({
          format,
          features: featuresToExport,
          columns: parsedData.activeLayer.columns,
          layerName: parsedData.activeLayer.tableName,
          filterInfo: isFilterActive && onlyFiltered ? filterInfo : undefined,
          includeCoordinates: true,
        });

        setExportNotification(
          `Exported ${result.recordCount} records (${result.format.toUpperCase()}) to ${result.fileName}`
        );
        setTimeout(() => {
          setExportNotification(null);
        }, 3500);
      } catch (err: any) {
        console.error('Export failed:', err);
        setError(err?.message || 'Failed to export dataset.');
      }
    },
    [parsedData, selectedCategory, colorAttribute, searchTerm, displayedFeatureCollection]
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      <Header
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isLoading={isLoading}
        fileName={parsedData?.fileName || ''}
      />

      {/* Main Body */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          fileName={parsedData?.fileName || ''}
          fileSizeBytes={parsedData?.fileSizeBytes || 0}
          layers={parsedData?.layers || []}
          activeLayer={parsedData?.activeLayer || null}
          onSelectLayer={handleSelectLayer}
          onFileUpload={handleFileUpload}
          onLoadSample={loadSampleData}
          isLoading={isLoading}
          colorAttribute={colorAttribute}
          onColorAttributeChange={setColorAttribute}
          colorMap={colorMap}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          attributeCounts={attributeCounts}
          onExport={handleExport}
          totalFeaturesCount={parsedData?.featureCollection.features.length || 0}
          filteredFeaturesCount={displayedFeatureCollection?.features.length || 0}
          searchTerm={searchTerm}
        />

        {/* Map Center Area */}
        <main className="flex-1 relative h-full w-full">
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {exportNotification && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white border border-emerald-500/40 backdrop-blur-md px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 text-xs animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{exportNotification}</span>
            </div>
          )}

          <MapViewer
            data={displayedFeatureCollection}
            selectedFeature={selectedFeature}
            onSelectFeature={setSelectedFeature}
            colorAttribute={colorAttribute}
            colorMap={colorMap}
            titleField={titleField}
          />

          {/* Feature Inspection Popup */}
          <FeatureDetailsModal
            feature={selectedFeature}
            onClose={() => setSelectedFeature(null)}
            titleField={titleField}
          />

          {/* Bottom Attribute Table Drawer */}
          {parsedData && (
            <DataTable
              features={displayedFeatureCollection?.features || []}
              columns={parsedData.activeLayer.columns}
              selectedFeature={selectedFeature}
              onSelectFeature={setSelectedFeature}
              isOpen={isTableOpen}
              onToggle={() => setIsTableOpen(!isTableOpen)}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onExport={(format, feats) => handleExport(format, true, feats)}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
