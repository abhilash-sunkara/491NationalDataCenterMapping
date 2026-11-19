import { GeoJsonFeature, getSqlEngine } from './geopackageReader';

export type ExportFormat = 'geojson' | 'csv' | 'json' | 'gpkg';

export interface FilterMetadata {
  colorAttribute?: string;
  selectedCategory?: string;
  searchQuery?: string;
  totalCount?: number;
  filteredCount?: number;
}

export interface ExportOptions {
  format: ExportFormat;
  features: GeoJsonFeature[];
  columns?: string[];
  layerName?: string;
  filterInfo?: FilterMetadata;
  includeCoordinates?: boolean; // Defaults to true for CSV/JSON
  customFileName?: string;
}

export interface ExportResult {
  fileName: string;
  recordCount: number;
  format: ExportFormat;
  isFiltered: boolean;
}

/**
 * Sanitize a string for safe use in file names
 */
function sanitizeForFilename(str: string): string {
  return str
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Concatenate two Uint8Arrays
 */
function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const res = new Uint8Array(a.byteLength + b.byteLength);
  res.set(a, 0);
  res.set(b, a.byteLength);
  return res;
}

/**
 * Generate a descriptive, clean filename reflecting the layer name and applied filters
 */
export function generateExportFileName(
  layerName: string = 'export',
  format: ExportFormat,
  filterInfo?: FilterMetadata
): string {
  const parts: string[] = [sanitizeForFilename(layerName || 'dataset')];

  if (filterInfo) {
    if (filterInfo.colorAttribute && filterInfo.selectedCategory) {
      const attr = sanitizeForFilename(filterInfo.colorAttribute);
      const cat = sanitizeForFilename(filterInfo.selectedCategory);
      parts.push(`${attr}-${cat}`);
    } else if (filterInfo.selectedCategory) {
      parts.push(sanitizeForFilename(filterInfo.selectedCategory));
    }

    if (filterInfo.searchQuery && filterInfo.searchQuery.trim()) {
      parts.push(`search-${sanitizeForFilename(filterInfo.searchQuery.trim().slice(0, 20))}`);
    }

    // If filtered but no specific single category (or many filters)
    if (
      parts.length === 1 &&
      filterInfo.totalCount !== undefined &&
      filterInfo.filteredCount !== undefined &&
      filterInfo.filteredCount < filterInfo.totalCount
    ) {
      parts.push(`filtered-${filterInfo.filteredCount}`);
    }
  }

  const base = parts.join('_');
  const ext =
    format === 'geojson' ? 'geojson' : format === 'csv' ? 'csv' : format === 'gpkg' ? 'gpkg' : 'json';
  return `${base}.${ext}`;
}

/**
 * Convert GeoJSON features to a standard GeoJSON FeatureCollection string
 */
export function featuresToGeoJSON(
  features: GeoJsonFeature[],
  options?: {
    layerName?: string;
    filterInfo?: FilterMetadata;
  }
): string {
  const collection: Record<string, any> = {
    type: 'FeatureCollection',
    name: options?.layerName || 'export',
    metadata: {
      generatedAt: new Date().toISOString(),
      featureCount: features.length,
      ...(options?.filterInfo
        ? {
            filterApplied: Boolean(
              options.filterInfo.selectedCategory || options.filterInfo.searchQuery
            ),
            filterAttribute: options.filterInfo.colorAttribute || null,
            filterCategory: options.filterInfo.selectedCategory || null,
            searchQuery: options.filterInfo.searchQuery || null,
          }
        : {}),
    },
    features,
  };

  return JSON.stringify(collection, null, 2);
}

/**
 * Extract coordinates [lng, lat] from a Point geometry if present
 */
function extractPointCoordinates(geom: any): [number, number] | null {
  if (!geom) return null;
  if (geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const [lng, lat] = geom.coordinates;
    if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
      return [lng, lat];
    }
  }
  return null;
}

/**
 * Escape a CSV field per RFC 4180
 */
function escapeCSVValue(val: any): string {
  if (val === null || val === undefined) {
    return '""';
  }
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Convert GeoJSON features to CSV string
 */
export function featuresToCSV(
  features: GeoJsonFeature[],
  columns: string[] = [],
  options?: {
    includeCoordinates?: boolean;
  }
): string {
  const includeCoords = options?.includeCoordinates !== false;

  let baseColumns = [...columns];
  if (baseColumns.length === 0) {
    const colSet = new Set<string>();
    features.forEach((f) => {
      if (f.properties) {
        Object.keys(f.properties).forEach((k) => colSet.add(k));
      }
    });
    baseColumns = Array.from(colSet);
  }

  const lowerCols = baseColumns.map((c) => c.toLowerCase());
  const hasLongitude =
    lowerCols.includes('longitude') || lowerCols.includes('lng') || lowerCols.includes('lon');
  const hasLatitude = lowerCols.includes('latitude') || lowerCols.includes('lat');

  const finalColumns = [...baseColumns];
  const shouldAddLongitude = includeCoords && !hasLongitude;
  const shouldAddLatitude = includeCoords && !hasLatitude;

  if (shouldAddLongitude) finalColumns.push('longitude');
  if (shouldAddLatitude) finalColumns.push('latitude');

  const rows: string[] = [];

  // Header row
  rows.push(finalColumns.map((c) => escapeCSVValue(c)).join(','));

  // Data rows
  features.forEach((feat) => {
    const props = feat.properties || {};
    const coords = extractPointCoordinates(feat.geometry);

    const rowValues = baseColumns.map((col) => escapeCSVValue(props[col]));

    if (shouldAddLongitude) {
      rowValues.push(coords ? String(coords[0]) : '""');
    }
    if (shouldAddLatitude) {
      rowValues.push(coords ? String(coords[1]) : '""');
    }

    rows.push(rowValues.join(','));
  });

  return rows.join('\r\n');
}

/**
 * Convert features to JSON format
 */
export function featuresToJSON(
  features: GeoJsonFeature[],
  format: 'records' | 'geojson' = 'records',
  options?: {
    layerName?: string;
    filterInfo?: FilterMetadata;
    includeCoordinates?: boolean;
  }
): string {
  if (format === 'geojson') {
    return featuresToGeoJSON(features, options);
  }

  const includeCoords = options?.includeCoordinates !== false;
  const records = features.map((feat) => {
    const props = { ...(feat.properties || {}) };
    if (includeCoords) {
      const coords = extractPointCoordinates(feat.geometry);
      if (coords) {
        if (!('longitude' in props) && !('lng' in props) && !('lon' in props)) {
          props.longitude = coords[0];
        }
        if (!('latitude' in props) && !('lat' in props)) {
          props.latitude = coords[1];
        }
      }
    }
    return props;
  });

  return JSON.stringify(records, null, 2);
}

/**
 * Convert GeoJSON geometry object to an OGC GeoPackage Binary BLOB (Uint8Array)
 * Standard header: 'GP', version 0, flags, srs_id + WKB
 */
export function geoJsonGeometryToGpkgBlob(geom: any, srsId: number = 4326): Uint8Array {
  const createHeader = (isEmpty: boolean): Uint8Array => {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    const u = new Uint8Array(buf);
    u[0] = 0x47; // 'G'
    u[1] = 0x50; // 'P'
    u[2] = 0x00; // version 0
    u[3] = isEmpty ? 0x11 : 0x01; // little endian (bit 0 = 1), isEmpty (bit 4 = 1)
    view.setInt32(4, srsId, true);
    return u;
  };

  if (!geom || !geom.type || !geom.coordinates) {
    return createHeader(true);
  }

  const type = geom.type;
  const coords = geom.coordinates;

  if (type === 'Point') {
    if (!Array.isArray(coords) || coords.length < 2) return createHeader(true);
    const wkb = new ArrayBuffer(21);
    const v = new DataView(wkb);
    const u = new Uint8Array(wkb);
    u[0] = 1; // little endian
    v.setUint32(1, 1, true); // Point
    v.setFloat64(5, Number(coords[0]), true);
    v.setFloat64(13, Number(coords[1]), true);
    return concatUint8Arrays(createHeader(false), u);
  }

  if (type === 'MultiPoint') {
    if (!Array.isArray(coords) || coords.length === 0) return createHeader(true);
    const wkb = new ArrayBuffer(9 + coords.length * 21);
    const v = new DataView(wkb);
    const u = new Uint8Array(wkb);
    u[0] = 1;
    v.setUint32(1, 4, true); // MultiPoint
    v.setUint32(5, coords.length, true);
    let offset = 9;
    for (const pt of coords) {
      u[offset] = 1;
      v.setUint32(offset + 1, 1, true);
      v.setFloat64(offset + 5, Number(pt[0]), true);
      v.setFloat64(offset + 13, Number(pt[1]), true);
      offset += 21;
    }
    return concatUint8Arrays(createHeader(false), u);
  }

  if (type === 'LineString') {
    if (!Array.isArray(coords) || coords.length === 0) return createHeader(true);
    const wkb = new ArrayBuffer(9 + coords.length * 16);
    const v = new DataView(wkb);
    const u = new Uint8Array(wkb);
    u[0] = 1;
    v.setUint32(1, 2, true); // LineString
    v.setUint32(5, coords.length, true);
    let offset = 9;
    for (const pt of coords) {
      v.setFloat64(offset, Number(pt[0]), true);
      v.setFloat64(offset + 8, Number(pt[1]), true);
      offset += 16;
    }
    return concatUint8Arrays(createHeader(false), u);
  }

  if (type === 'Polygon') {
    if (!Array.isArray(coords) || coords.length === 0) return createHeader(true);
    let totalPoints = 0;
    for (const ring of coords) totalPoints += ring.length;
    const wkb = new ArrayBuffer(9 + coords.length * 4 + totalPoints * 16);
    const v = new DataView(wkb);
    const u = new Uint8Array(wkb);
    u[0] = 1;
    v.setUint32(1, 3, true); // Polygon
    v.setUint32(5, coords.length, true);
    let offset = 9;
    for (const ring of coords) {
      v.setUint32(offset, ring.length, true);
      offset += 4;
      for (const pt of ring) {
        v.setFloat64(offset, Number(pt[0]), true);
        v.setFloat64(offset + 8, Number(pt[1]), true);
        offset += 16;
      }
    }
    return concatUint8Arrays(createHeader(false), u);
  }

  return createHeader(true);
}

/**
 * Convert GeoJSON features into a binary OGC GeoPackage database file (.gpkg)
 */
export async function featuresToGeoPackage(
  features: GeoJsonFeature[],
  columns: string[] = [],
  options?: {
    layerName?: string;
    srsId?: number;
  }
): Promise<Uint8Array> {
  const SQL = await getSqlEngine();
  const db = new SQL.Database();
  const rawLayerName = options?.layerName || 'data_center_layer';
  const tableName = rawLayerName.replace(/[^a-zA-Z0-9_]/g, '_');
  const srsId = options?.srsId || 4326;

  // 1. GeoPackage Pragma
  db.run('PRAGMA application_id = 1196444487;'); // 'GPKG' / 0x47504B47
  db.run('PRAGMA user_version = 10300;'); // GPKG 1.3

  // 2. Standard gpkg_spatial_ref_sys table
  db.run(`CREATE TABLE gpkg_spatial_ref_sys (
    srs_name TEXT NOT NULL,
    srs_id INTEGER NOT NULL PRIMARY KEY,
    organization TEXT NOT NULL,
    organization_coordsys_id INTEGER NOT NULL,
    definition TEXT NOT NULL,
    description TEXT
  );`);

  db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES 
    ('Undefined Cartesian SRS', -1, 'NONE', -1, 'undefined', 'undefined cartesian coordinate reference system'),
    ('Undefined geographic SRS', 0, 'NONE', 0, 'undefined', 'undefined geographic coordinate reference system'),
    ('WGS 84 geodetic', 4326, 'EPSG', 4326, 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]', 'longitude/latitude coordinates in degrees');
  `);

  // 3. Standard gpkg_contents table
  db.run(`CREATE TABLE gpkg_contents (
    table_name TEXT NOT NULL PRIMARY KEY,
    data_type TEXT NOT NULL,
    identifier TEXT UNIQUE,
    description TEXT DEFAULT '',
    last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE,
    srs_id INTEGER,
    CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
  );`);

  // 4. Standard gpkg_geometry_columns table
  db.run(`CREATE TABLE gpkg_geometry_columns (
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    geometry_type_name TEXT NOT NULL,
    srs_id INTEGER NOT NULL,
    z TINYINT NOT NULL,
    m TINYINT NOT NULL,
    CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name),
    CONSTRAINT uk_gc_table_name UNIQUE (table_name),
    CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name),
    CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys (srs_id)
  );`);

  // Derive attribute columns
  let finalCols = [...columns];
  if (finalCols.length === 0) {
    const colSet = new Set<string>();
    features.forEach((f) => {
      if (f.properties) {
        Object.keys(f.properties).forEach((k) => colSet.add(k));
      }
    });
    finalCols = Array.from(colSet);
  }
  // Remove conflicting geom or fid names from properties list
  finalCols = finalCols.filter(
    (c) => c.toLowerCase() !== 'geom' && c.toLowerCase() !== 'fid'
  );

  // Infer SQL types for columns
  const colDefStrings: string[] = [];
  for (const col of finalCols) {
    let isNumeric = true;
    let isAllInteger = true;
    let hasValue = false;

    for (const f of features) {
      const val = f.properties?.[col];
      if (val !== null && val !== undefined && val !== '') {
        hasValue = true;
        if (typeof val === 'number') {
          if (!Number.isInteger(val)) isAllInteger = false;
        } else {
          const num = Number(val);
          if (isNaN(num)) {
            isNumeric = false;
            break;
          }
          if (!Number.isInteger(num)) isAllInteger = false;
        }
      }
    }

    const sanitizedCol = col.replace(/[^a-zA-Z0-9_]/g, '_');
    const sqlType = !hasValue || !isNumeric ? 'TEXT' : isAllInteger ? 'INTEGER' : 'REAL';
    colDefStrings.push(`"${sanitizedCol}" ${sqlType}`);
  }

  // 5. Create feature table
  const colDefsSql = colDefStrings.length > 0 ? `, ${colDefStrings.join(', ')}` : '';
  db.run(`CREATE TABLE "${tableName}" (
    fid INTEGER PRIMARY KEY AUTOINCREMENT,
    geom BLOB${colDefsSql}
  );`);

  // Detect geometry type and bounds
  let geomType = 'POINT';
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const f of features) {
    if (f.geometry?.type) {
      geomType = f.geometry.type.toUpperCase();
    }
    const coords = extractPointCoordinates(f.geometry);
    if (coords) {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (!Number.isFinite(minX)) {
    minX = -180;
    minY = -90;
    maxX = 180;
    maxY = 90;
  }

  // 6. Register layer in gpkg_contents and gpkg_geometry_columns
  db.run(`INSERT INTO gpkg_contents (table_name, data_type, identifier, min_x, min_y, max_x, max_y, srs_id)
    VALUES ('${tableName}', 'features', '${tableName}', ${minX}, ${minY}, ${maxX}, ${maxY}, ${srsId});`);

  db.run(`INSERT INTO gpkg_geometry_columns (table_name, column_name, geometry_type_name, srs_id, z, m)
    VALUES ('${tableName}', 'geom', '${geomType}', ${srsId}, 0, 0);`);

  // 7. Insert records with prepared statement
  const sanitizedColNames = finalCols.map((c) => `"${c.replace(/[^a-zA-Z0-9_]/g, '_')}"`);
  const placeholders = ['?', ...finalCols.map(() => '?')].join(', ');
  const insertSql = `INSERT INTO "${tableName}" (geom${
    sanitizedColNames.length > 0 ? ', ' + sanitizedColNames.join(', ') : ''
  }) VALUES (${placeholders});`;

  const stmt = db.prepare(insertSql);
  for (const f of features) {
    const blob = geoJsonGeometryToGpkgBlob(f.geometry, srsId);
    const rowVals = finalCols.map((col) => {
      const v = f.properties?.[col];
      return v !== null && v !== undefined ? v : null;
    });
    stmt.run([blob, ...rowVals]);
  }
  stmt.free();

  // 8. Export binary buffer
  const binary = db.export();
  db.close();

  return binary;
}

/**
 * Trigger text file download directly in browser
 */
export function triggerFileDownload(content: string, fileName: string, mimeType: string): void {
  const blobData = mimeType.startsWith('text/csv') ? ['\uFEFF', content] : [content];
  const blob = new Blob(blobData, { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Trigger binary file download directly in browser
 */
export function triggerBinaryDownload(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string
): void {
  const blob = new Blob([bytes as any], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Master export utility function
 */
export async function exportData(options: ExportOptions): Promise<ExportResult> {
  const {
    format,
    features,
    columns = [],
    layerName = 'data_center_layer',
    filterInfo,
    includeCoordinates = true,
    customFileName,
  } = options;

  const fileName =
    customFileName || generateExportFileName(layerName, format, filterInfo);

  switch (format) {
    case 'geojson': {
      const content = featuresToGeoJSON(features, { layerName, filterInfo });
      triggerFileDownload(content, fileName, 'application/geo+json;charset=utf-8');
      break;
    }

    case 'csv': {
      const content = featuresToCSV(features, columns, { includeCoordinates });
      triggerFileDownload(content, fileName, 'text/csv;charset=utf-8;');
      break;
    }

    case 'json': {
      const content = featuresToJSON(features, 'records', {
        layerName,
        filterInfo,
        includeCoordinates,
      });
      triggerFileDownload(content, fileName, 'application/json;charset=utf-8');
      break;
    }

    case 'gpkg': {
      const binary = await featuresToGeoPackage(features, columns, { layerName });
      triggerBinaryDownload(binary, fileName, 'application/geopackage+sqlite3');
      break;
    }
  }

  const isFiltered = Boolean(
    filterInfo &&
      ((filterInfo.selectedCategory && filterInfo.colorAttribute) ||
        (filterInfo.searchQuery && filterInfo.searchQuery.trim()) ||
        (filterInfo.totalCount !== undefined &&
          filterInfo.filteredCount !== undefined &&
          filterInfo.filteredCount < filterInfo.totalCount))
  );

  return {
    fileName,
    recordCount: features.length,
    format,
    isFiltered,
  };
}
