import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import proj4 from 'proj4';
import { parseGeoPackageGeometry, BoundingBox } from './wkbParser';

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry: any;
  properties: Record<string, any>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export interface LayerMetadata {
  tableName: string;
  geomColumnName: string;
  geomType: string;
  srsId: number;
  srsName?: string;
  featureCount: number;
  bbox?: BoundingBox;
  columns: string[];
}

export interface ParsedGeoPackage {
  fileName: string;
  fileSizeBytes: number;
  layers: LayerMetadata[];
  activeLayer: LayerMetadata;
  featureCollection: GeoJsonFeatureCollection;
  layerDataMap: Record<string, GeoJsonFeatureCollection>;
}

import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let sqlJsInstance: SqlJsStatic | null = null;

/**
 * Initializes the SQL.js WebAssembly engine
 */
export async function getSqlEngine(): Promise<SqlJsStatic> {
  if (sqlJsInstance) return sqlJsInstance;

  sqlJsInstance = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });

  return sqlJsInstance;
}

/**
 * Get reprojection function to convert coordinates from the layer's SRS to WGS84 (EPSG:4326)
 */
function getReprojectFunction(
  db: Database,
  srsId: number
): ((pt: [number, number]) => [number, number]) | undefined {
  if (srsId === 4326 || srsId === 0 || srsId === -1) {
    // Already WGS84 or unspecified lon/lat
    return undefined;
  }

  if (srsId === 3857 || srsId === 900913) {
    return (pt: [number, number]) => {
      const res = proj4('EPSG:3857', 'EPSG:4326', pt);
      return [res[0], res[1]];
    };
  }

  // Attempt to look up WKT definition from gpkg_spatial_ref_sys
  try {
    const srsQuery = db.exec(
      `SELECT definition FROM gpkg_spatial_ref_sys WHERE srs_id = ${srsId} LIMIT 1`
    );
    if (srsQuery.length > 0 && srsQuery[0].values.length > 0) {
      const wktDef = srsQuery[0].values[0][0] as string;
      if (wktDef && wktDef.trim().length > 0 && !wktDef.toUpperCase().includes('UNDEFINED')) {
        const srsName = `EPSG:${srsId}`;
        try {
          proj4.defs(srsName, wktDef);
          return (pt: [number, number]) => {
            const res = proj4(srsName, 'EPSG:4326', pt);
            return [res[0], res[1]];
          };
        } catch (e) {
          console.warn(`Failed to parse custom WKT for SRS ${srsId}:`, e);
        }
      }
    }
  } catch (err) {
    console.warn(`Could not read gpkg_spatial_ref_sys for ${srsId}:`, err);
  }

  return undefined;
}

/**
 * Compute the bounding box of a GeoJSON FeatureCollection [minLng, minLat, maxLng, maxLat]
 */
export function computeFeatureCollectionBBox(
  features: GeoJsonFeature[]
): [number, number, number, number] | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function traverseCoords(coords: any) {
    if (!coords) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [x, y] = coords;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      return;
    }
    if (Array.isArray(coords)) {
      for (const item of coords) {
        traverseCoords(item);
      }
    }
  }

  for (const f of features) {
    if (f.geometry && f.geometry.coordinates) {
      traverseCoords(f.geometry.coordinates);
    }
  }

  if (minX !== Infinity && minY !== Infinity) {
    return [minX, minY, maxX, maxY];
  }
  return undefined;
}

/**
 * Parses an entire GeoPackage file (Uint8Array or ArrayBuffer) into structured layers & GeoJSON
 */
export async function parseGeoPackageFile(
  buffer: ArrayBuffer | Uint8Array,
  fileName = 'dataset.gpkg'
): Promise<ParsedGeoPackage> {
  const SQL = await getSqlEngine();
  const uint8Data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const db = new SQL.Database(uint8Data);

  // Discover feature layers
  let discoveredLayers: LayerMetadata[] = [];

  // Check gpkg_contents first
  try {
    const contentsResult = db.exec(
      `SELECT table_name, data_type, identifier, min_x, min_y, max_x, max_y, srs_id FROM gpkg_contents WHERE data_type = 'features'`
    );

    if (contentsResult.length > 0 && contentsResult[0].values.length > 0) {
      for (const row of contentsResult[0].values) {
        const tableName = row[0] as string;
        let srsId = (row[7] as number) || 4326;
        let bbox: BoundingBox | undefined;
        if (row[3] !== null && row[4] !== null && row[5] !== null && row[6] !== null) {
          bbox = {
            minX: row[3] as number,
            minY: row[4] as number,
            maxX: row[5] as number,
            maxY: row[6] as number,
          };
        }

        // Geometry column name from gpkg_geometry_columns
        let geomColumn = 'geom';
        let geomType = 'GEOMETRY';
        try {
          const geomResult = db.exec(
            `SELECT column_name, geometry_type_name, srs_id FROM gpkg_geometry_columns WHERE table_name = '${tableName}' LIMIT 1`
          );
          if (geomResult.length > 0 && geomResult[0].values.length > 0) {
            geomColumn = (geomResult[0].values[0][0] as string) || 'geom';
            geomType = (geomResult[0].values[0][1] as string) || 'GEOMETRY';
            srsId = (geomResult[0].values[0][2] as number) || srsId;
          }
        } catch (e) {
          console.warn('Error reading gpkg_geometry_columns:', e);
        }

        // Count features
        let count = 0;
        try {
          const countRes = db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
          if (countRes.length > 0 && countRes[0].values.length > 0) {
            count = countRes[0].values[0][0] as number;
          }
        } catch (e) {
          console.warn(`Could not count table ${tableName}:`, e);
        }

        // Table column schema
        let columns: string[] = [];
        try {
          const tableInfo = db.exec(`PRAGMA table_info("${tableName}")`);
          if (tableInfo.length > 0) {
            columns = tableInfo[0].values
              .map((r) => r[1] as string)
              .filter((c) => c !== geomColumn);
          }
        } catch (e) {
          console.warn('Could not read table pragma:', e);
        }

        discoveredLayers.push({
          tableName,
          geomColumnName: geomColumn,
          geomType,
          srsId,
          featureCount: count,
          bbox,
          columns,
        });
      }
    }
  } catch (err) {
    console.warn('No gpkg_contents table found or query failed:', err);
  }

  // Fallback: If no feature layers were found in gpkg_contents, inspect all user tables
  if (discoveredLayers.length === 0) {
    try {
      const masterRes = db.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'gpkg_%' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'rtree_%'`
      );
      if (masterRes.length > 0) {
        for (const row of masterRes[0].values) {
          const tableName = row[0] as string;
          const tableInfo = db.exec(`PRAGMA table_info("${tableName}")`);
          if (tableInfo.length > 0) {
            const allCols = tableInfo[0].values.map((r) => r[1] as string);
            const geomCandidate =
              allCols.find((c) => ['geom', 'geometry', 'shape', 'the_geom'].includes(c.toLowerCase())) ||
              allCols[1] ||
              'geom';

            const countRes = db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
            const count = countRes.length > 0 ? (countRes[0].values[0][0] as number) : 0;

            discoveredLayers.push({
              tableName,
              geomColumnName: geomCandidate,
              geomType: 'GEOMETRY',
              srsId: 4326,
              featureCount: count,
              columns: allCols.filter((c) => c !== geomCandidate),
            });
          }
        }
      }
    } catch (e) {
      console.error('Fallback table discovery failed:', e);
    }
  }

  if (discoveredLayers.length === 0) {
    db.close();
    throw new Error('No spatial feature layers found in this GeoPackage file.');
  }

  // Load all layers into GeoJSON FeatureCollections
  const layerDataMap: Record<string, GeoJsonFeatureCollection> = {};

  for (const layer of discoveredLayers) {
    const reproject = getReprojectFunction(db, layer.srsId);
    const query = `SELECT * FROM "${layer.tableName}"`;
    const res = db.exec(query);

    const features: GeoJsonFeature[] = [];

    if (res.length > 0 && res[0].values.length > 0) {
      const colNames = res[0].columns;
      const geomColIdx = colNames.indexOf(layer.geomColumnName);

      for (const row of res[0].values) {
        let geometry: any = null;
        const properties: Record<string, any> = {};

        for (let i = 0; i < colNames.length; i++) {
          const colName = colNames[i];
          const val = row[i];

          if (i === geomColIdx && val instanceof Uint8Array) {
            geometry = parseGeoPackageGeometry(val, reproject);
          } else if (i !== geomColIdx) {
            properties[colName] = val;
          }
        }

        if (geometry) {
          features.push({
            type: 'Feature',
            id: properties.fid ?? properties.id ?? properties.ogc_fid ?? features.length + 1,
            geometry,
            properties,
          });
        }
      }
    }

    const bbox = computeFeatureCollectionBBox(features);
    layerDataMap[layer.tableName] = {
      type: 'FeatureCollection',
      features,
      bbox,
    };
  }

  db.close();

  const activeLayer = discoveredLayers[0];
  const activeCollection = layerDataMap[activeLayer.tableName];

  return {
    fileName,
    fileSizeBytes: uint8Data.byteLength,
    layers: discoveredLayers,
    activeLayer,
    featureCollection: activeCollection,
    layerDataMap,
  };
}
