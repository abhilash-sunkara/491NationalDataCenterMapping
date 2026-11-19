# GeoPackage Web Viewer

A fast, interactive, client-side **GeoPackage (.gpkg)** spatial dashboard built with **TypeScript**, **React**, **Tailwind CSS**, and **Leaflet**.

## Features

- **In-Browser WebAssembly Engine**: Uses `sql.js` (WebAssembly SQLite) to directly read OGC GeoPackage files client-side without requiring a backend server.
- **OGC GeoPackage Standard Parser**:
  - Parses binary geometry headers, envelopes, and standard WKB (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon).
  - Handles coordinate reprojection via `proj4` (EPSG:4326, EPSG:3857, and custom WKT definitions in `gpkg_spatial_ref_sys`).
- **Interactive Map**:
  - Powered by Leaflet with 4 switchable basemaps (Light Voyager, Dark Matter, OpenStreetMap, Esri World Imagery).
  - Dynamic CircleMarkers for Points and GeoJSON vector styling for Polygons/Lines.
  - Smooth fly-to animations and auto-zoom to layer bounds.
  - Live cursor coordinates (Latitude / Longitude) and zoom level tracking.
- **Multi-Layer Support**: Automatically enumerates all feature tables and lets you toggle between layers.
- **Dynamic Categorical Styling & Legend**:
  - Select any attribute column (e.g., `status`, `operator_name`, `state`, etc.) to dynamically color-code markers on the map.
  - Interactive category legend with item counts and one-click filtering.
- **Attribute Table Drawer**:
  - Collapsible bottom drawer with search, column sorting, pagination, and count indicators.
  - Bi-directional selection: clicking a row centers the map on the feature; clicking a map marker highlights the row and opens the detail inspector.
- **Drag & Drop / File Upload**:
  - Drag and drop any `.gpkg` file onto the upload zone or choose from your file system.
  - One-click "Load Sample" button for the national data centers dataset (`data_center_layer.gpkg`).
- **Export Capabilities (Filter-Aware)**:
  - Export filtered or full active layer as standard OGC **GeoPackage (`.gpkg`)** directly in the browser via WebAssembly SQLite.
  - Export as standard **GeoJSON (`.geojson`)** with embedded filter metadata.
  - Export layer attributes with coordinates as **CSV (`.csv`)** (Excel-compatible with UTF-8 BOM).
  - Export feature records as **JSON (`.json`)**.

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser.

## Build for Production

```bash
npm run build
npm run preview
```
