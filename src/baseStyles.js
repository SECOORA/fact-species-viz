const esriWorldTopo = {
  version: 8,
  sources: {
    "raster-tiles": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer">ArcGIS</a>',
    },
  },
  layers: [
    {
      id: "simple-tiles",
      type: "raster",
      source: "raster-tiles",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const esriOceans = {
  version: 8,
  sources: {
    "raster-tiles": {
      type: "raster",
      tiles: [
        // "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        "http://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles ©  Esri, Garmin, GEBCO, NOAA NGDC, and other contributors",
    },
  },
  layers: [
    {
      id: "simple-tiles",
      type: "raster",
      source: "raster-tiles",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const stamenTerrain = {
  version: 8,
  sources: {
    "raster-tiles": {
      type: "raster",
      tiles: ["//stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg"],
      tileSize: 256,
      attribution:
        'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
    },
  },
  layers: [
    {
      id: "simple-tiles",
      type: "raster",
      source: "raster-tiles",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export default {
  greyscale: "mapbox://styles/mz4/ck6m8v8x9052n1iphvif4ilra",
  esriWorldTopo: esriWorldTopo,
  esriOceans: esriOceans,
  stamenTerrain: stamenTerrain
}