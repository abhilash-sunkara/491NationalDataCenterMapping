import proj4 from 'proj4';

export interface GeoJsonGeometry {
  type: string;
  coordinates: any;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GeoPackageBinaryHeader {
  magic: string;
  version: number;
  byteOrder: 'little' | 'big';
  envelopeIndicator: number;
  isEmpty: boolean;
  srsId: number;
  wkbOffset: number;
  envelope?: BoundingBox;
}

/**
 * Parse the GeoPackage Binary Geometry header (OGC GeoPackage Standard Section 2.1.4)
 */
export function parseGeoPackageHeader(bytes: Uint8Array): GeoPackageBinaryHeader | null {
  if (bytes.length < 8) return null;
  if (bytes[0] !== 0x47 || bytes[1] !== 0x50) {
    // 'G', 'P' magic bytes
    return null;
  }

  const version = bytes[2];
  const flags = bytes[3];
  const isLittleEndian = (flags & 0x01) === 1;
  const envelopeIndicator = (flags >> 1) & 0x07;
  const isEmpty = ((flags >> 4) & 0x01) === 1;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const srsId = view.getInt32(4, isLittleEndian);

  let envBytes = 0;
  let envelope: BoundingBox | undefined;

  if (envelopeIndicator === 1) {
    // 32 bytes: minX, maxX, minY, maxY
    envBytes = 32;
    if (bytes.length >= 8 + envBytes) {
      envelope = {
        minX: view.getFloat64(8, isLittleEndian),
        maxX: view.getFloat64(16, isLittleEndian),
        minY: view.getFloat64(24, isLittleEndian),
        maxY: view.getFloat64(32, isLittleEndian),
      };
    }
  } else if (envelopeIndicator === 2 || envelopeIndicator === 3) {
    // 48 bytes: minX, maxX, minY, maxY, minZ/M, maxZ/M
    envBytes = 48;
    if (bytes.length >= 8 + envBytes) {
      envelope = {
        minX: view.getFloat64(8, isLittleEndian),
        maxX: view.getFloat64(16, isLittleEndian),
        minY: view.getFloat64(24, isLittleEndian),
        maxY: view.getFloat64(32, isLittleEndian),
      };
    }
  } else if (envelopeIndicator === 4) {
    // 64 bytes: minX, maxX, minY, maxY, minZ, maxZ, minM, maxM
    envBytes = 64;
    if (bytes.length >= 8 + envBytes) {
      envelope = {
        minX: view.getFloat64(8, isLittleEndian),
        maxX: view.getFloat64(16, isLittleEndian),
        minY: view.getFloat64(24, isLittleEndian),
        maxY: view.getFloat64(32, isLittleEndian),
      };
    }
  }

  return {
    magic: 'GP',
    version,
    byteOrder: isLittleEndian ? 'little' : 'big',
    envelopeIndicator,
    isEmpty,
    srsId,
    wkbOffset: 8 + envBytes,
    envelope,
  };
}

/**
 * Standard WKB Geometry Types
 */
const WKB_TYPE = {
  Point: 1,
  LineString: 2,
  Polygon: 3,
  MultiPoint: 4,
  MultiLineString: 5,
  MultiPolygon: 6,
  GeometryCollection: 7,
};

class WkbReader {
  private view: DataView;
  private offset: number;
  private reprojectFn?: (pt: [number, number]) => [number, number];

  constructor(
    buffer: ArrayBufferLike,
    byteOffset: number,
    byteLength: number,
    startOffset: number,
    reprojectFn?: (pt: [number, number]) => [number, number]
  ) {
    this.view = new DataView(buffer as ArrayBuffer, byteOffset, byteLength);
    this.offset = startOffset;
    this.reprojectFn = reprojectFn;
  }

  private readUint8(): number {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  private readUint32(le: boolean): number {
    const val = this.view.getUint32(this.offset, le);
    this.offset += 4;
    return val;
  }

  private readFloat64(le: boolean): number {
    const val = this.view.getFloat64(this.offset, le);
    this.offset += 8;
    return val;
  }

  private readPointCoords(le: boolean, hasZ: boolean, hasM: boolean): [number, number] {
    let x = this.readFloat64(le);
    let y = this.readFloat64(le);
    if (hasZ) this.offset += 8;
    if (hasM) this.offset += 8;

    if (this.reprojectFn) {
      return this.reprojectFn([x, y]);
    }
    return [x, y];
  }

  public readGeometry(): GeoJsonGeometry | null {
    if (this.offset >= this.view.byteLength) return null;

    const byteOrder = this.readUint8();
    const le = byteOrder === 1;

    let rawType = this.readUint32(le);

    // WKB ISO types: type + 1000 for Z, type + 2000 for M, type + 3000 for ZM
    // EWKB flags: 0x80000000 hasZ, 0x40000000 hasM
    let hasZ = false;
    let hasM = false;

    if (rawType & 0x80000000) {
      hasZ = true;
      rawType &= ~0x80000000;
    }
    if (rawType & 0x40000000) {
      hasM = true;
      rawType &= ~0x40000000;
    }
    if (rawType & 0x20000000) {
      // EWKB SRID follows
      this.offset += 4;
      rawType &= ~0x20000000;
    }

    if (rawType >= 1000 && rawType < 2000) {
      hasZ = true;
      rawType -= 1000;
    } else if (rawType >= 2000 && rawType < 3000) {
      hasM = true;
      rawType -= 2000;
    } else if (rawType >= 3000 && rawType < 4000) {
      hasZ = true;
      hasM = true;
      rawType -= 3000;
    }

    switch (rawType) {
      case WKB_TYPE.Point: {
        const coords = this.readPointCoords(le, hasZ, hasM);
        return { type: 'Point', coordinates: coords };
      }

      case WKB_TYPE.LineString: {
        const numPoints = this.readUint32(le);
        const coords: [number, number][] = [];
        for (let i = 0; i < numPoints; i++) {
          coords.push(this.readPointCoords(le, hasZ, hasM));
        }
        return { type: 'LineString', coordinates: coords };
      }

      case WKB_TYPE.Polygon: {
        const numRings = this.readUint32(le);
        const coordinates: [number, number][][] = [];
        for (let r = 0; r < numRings; r++) {
          const numPoints = this.readUint32(le);
          const ring: [number, number][] = [];
          for (let i = 0; i < numPoints; i++) {
            ring.push(this.readPointCoords(le, hasZ, hasM));
          }
          coordinates.push(ring);
        }
        return { type: 'Polygon', coordinates };
      }

      case WKB_TYPE.MultiPoint: {
        const numParts = this.readUint32(le);
        const coordinates: [number, number][] = [];
        for (let i = 0; i < numParts; i++) {
          const part = this.readGeometry();
          if (part && part.type === 'Point') {
            coordinates.push(part.coordinates);
          }
        }
        return { type: 'MultiPoint', coordinates };
      }

      case WKB_TYPE.MultiLineString: {
        const numParts = this.readUint32(le);
        const coordinates: [number, number][][] = [];
        for (let i = 0; i < numParts; i++) {
          const part = this.readGeometry();
          if (part && part.type === 'LineString') {
            coordinates.push(part.coordinates);
          }
        }
        return { type: 'MultiLineString', coordinates };
      }

      case WKB_TYPE.MultiPolygon: {
        const numParts = this.readUint32(le);
        const coordinates: [number, number][][][] = [];
        for (let i = 0; i < numParts; i++) {
          const part = this.readGeometry();
          if (part && part.type === 'Polygon') {
            coordinates.push(part.coordinates);
          }
        }
        return { type: 'MultiPolygon', coordinates };
      }

      case WKB_TYPE.GeometryCollection: {
        const numParts = this.readUint32(le);
        const geometries: GeoJsonGeometry[] = [];
        for (let i = 0; i < numParts; i++) {
          const part = this.readGeometry();
          if (part) geometries.push(part);
        }
        return { type: 'GeometryCollection', coordinates: geometries };
      }

      default:
        console.warn(`Unsupported WKB type: ${rawType}`);
        return null;
    }
  }
}

/**
 * Parses GeoPackage binary blob into a GeoJSON Geometry
 */
export function parseGeoPackageGeometry(
  bytes: Uint8Array | null | undefined,
  reprojectFn?: (pt: [number, number]) => [number, number]
): GeoJsonGeometry | null {
  if (!bytes || bytes.length < 8) return null;

  const header = parseGeoPackageHeader(bytes);
  if (!header || header.isEmpty) return null;

  try {
    const reader = new WkbReader(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
      header.wkbOffset,
      reprojectFn
    );
    return reader.readGeometry();
  } catch (err) {
    console.error('Error parsing GPKG WKB geometry:', err);
    return null;
  }
}
