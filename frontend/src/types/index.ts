import { GeoJsonFeature, GeoJsonFeatureCollection, LayerMetadata } from '../lib/geopackageReader';
import { ExportFormat, FilterMetadata, ExportOptions, ExportResult } from '../lib/exportUtils';

export type {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  LayerMetadata,
  ExportFormat,
  FilterMetadata,
  ExportOptions,
  ExportResult,
};

export interface FilterState {
  searchQuery: string;
  colorAttribute: string;
  selectedCategory: string;
}

export type BaseMapType = 'streets' | 'esriStreets' | 'satellite' | 'topo';

