import pandas as pd
import geopandas as gpd

df = pd.read_csv("updated_datacenters.csv")

gdf = gpd.GeoDataFrame(
    df, 
    geometry=gpd.points_from_xy(df.long, df.lat),
    crs="EPSG:4326" 
)

gdf.to_file("new_data_center_layer.gpkg", driver="GPKG")
