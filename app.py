import streamlit as st
import geopandas as gpd
import folium
from streamlit_folium import st_folium

st.set_page_config(page_title="GPKG Dashboard", layout="wide")
st.title("GeoPackage Viewer")

# @st.cache_data prevents the app from reloading the GPKG every time you click a button
@st.cache_data
def load_data(file_path):
    # pyogrio is significantly faster than the default fiona engine
    gdf = gpd.read_file(file_path, engine="pyogrio")
    
    # Web maps (Leaflet/Folium) strictly require EPSG:4326 (Latitude/Longitude)
    if gdf.crs.to_string() != "EPSG:4326":
        gdf = gdf.to_crs(epsg=4326)
        
    return gdf

# 1. Load the data
# Replace with your actual file name
gdf = load_data("data_center_layer.gpkg") 

# --- Dashboard Sidebar ---
st.sidebar.header("Filters & Export")

# Column filter selection
filter_columns = [col for col in gdf.columns if col != 'geometry']
selected_col = st.sidebar.selectbox("Filter Attribute", ["None"] + filter_columns)

filtered_gdf = gdf.copy()

if selected_col != "None":
    unique_vals = ["All"] + sorted([str(v) for v in gdf[selected_col].dropna().unique()])
    selected_val = st.sidebar.selectbox(f"Select {selected_col}", unique_vals)
    if selected_val != "All":
        filtered_gdf = filtered_gdf[filtered_gdf[selected_col].astype(str) == selected_val]

# Optional text search
search_query = st.sidebar.text_input("Search records", "")
if search_query.strip():
    query_str = search_query.strip().lower()
    mask = filtered_gdf[filter_columns].astype(str).apply(
        lambda row: row.str.lower().str.contains(query_str, regex=False).any(), axis=1
    )
    filtered_gdf = filtered_gdf[mask]

st.sidebar.caption(f"Showing {len(filtered_gdf)} of {len(gdf)} features")

# --- Export Section ---
st.sidebar.subheader("Export Data")

# GeoPackage (.gpkg) Export
try:
    import tempfile
    import os
    with tempfile.NamedTemporaryFile(suffix=".gpkg", delete=False) as tmp_file:
        tmp_path = tmp_file.name
    filtered_gdf.to_file(tmp_path, driver="GPKG")
    with open(tmp_path, "rb") as f:
        gpkg_bytes = f.read()
    if os.path.exists(tmp_path):
        os.remove(tmp_path)

    st.sidebar.download_button(
        label="Export Filtered GPKG (.gpkg)",
        data=gpkg_bytes,
        file_name=f"data_center_layer{export_name_suffix}.gpkg",
        mime="application/geopackage+sqlite3",
        use_container_width=True,
    )
except Exception as e:
    st.sidebar.caption(f"GPKG export unavailable: {e}")

# GeoJSON Export
geojson_data = filtered_gdf.to_json()
export_name_suffix = f"_{selected_col}_{selected_val}" if selected_col != "None" and selected_val != "All" else ""
if search_query.strip():
    export_name_suffix += f"_search_{search_query.strip()[:15]}"

st.sidebar.download_button(
    label="Export Filtered GeoJSON",
    data=geojson_data,
    file_name=f"data_center_layer{export_name_suffix}.geojson",
    mime="application/geo+json",
    use_container_width=True,
)

# CSV Export (with longitude/latitude)
csv_export_df = filtered_gdf.copy()
if "geometry" in csv_export_df.columns:
    if "longitude" not in csv_export_df.columns:
        csv_export_df["longitude"] = csv_export_df.geometry.x
    if "latitude" not in csv_export_df.columns:
        csv_export_df["latitude"] = csv_export_df.geometry.y
    csv_export_df = csv_export_df.drop(columns=["geometry"], errors="ignore")

st.sidebar.download_button(
    label="Export Filtered CSV",
    data=csv_export_df.to_csv(index=False),
    file_name=f"data_center_layer{export_name_suffix}.csv",
    mime="text/csv",
    use_container_width=True,
)

# 2. Set up the Map
if len(filtered_gdf) > 0:
    bounds = filtered_gdf.total_bounds # [minx, miny, maxx, maxy]
    center_y = (bounds[1] + bounds[3]) / 2
    center_x = (bounds[0] + bounds[2]) / 2
    zoom = 8 if len(filtered_gdf) < 50 else 5
else:
    bounds = gdf.total_bounds
    center_y = (bounds[1] + bounds[3]) / 2
    center_x = (bounds[0] + bounds[2]) / 2
    zoom = 4

m = folium.Map(location=[center_y, center_x], zoom_start=zoom)

# 3. Add the filtered GPKG data to the map
if len(filtered_gdf) > 0:
    tooltip_col = filtered_gdf.columns[0] if len(filtered_gdf.columns) > 0 else None
    folium.GeoJson(
        filtered_gdf,
        name="Filtered Layer",
        marker=folium.CircleMarker(
            radius=6,            # Size of the circle
            fill_color="#FF5733", # Inside color (e.g., an orange hex code)
            fill_opacity=0.8,    # Opacity of the fill (0 to 1)
            color="black",       # Border color
            weight=1             # Border thickness
        ),
        tooltip=folium.GeoJsonTooltip(fields=[tooltip_col]) if tooltip_col else None
    ).add_to(m)

# 4. Render the map in Streamlit
st_data = st_folium(m, width=900, height=600)