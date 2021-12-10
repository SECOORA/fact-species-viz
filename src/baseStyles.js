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
  greyscale: {
    title: "SECOORA Greyscale",
    style: "mapbox://styles/mz4/ck6m8v8x9052n1iphvif4ilra",
    thumbnail:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAADvUlEQVRoge2bMW+rPBSG7///DV68sDCyMHnwYImlkRXkKgxeIhCShyB5gO29w9WxIG2TJph+5mteyUMxtf3Y5xyDw/nTtme07RnDcEHTNGCMoSxLWGtDadszDoc3MMaglALJOQdjDIwxcM4trltr4ZxD33eo6yOon7Y9h/uoT2sttNaL9r334XpdH+Gcg/cezrlFW4+WP18Be+9DmaZxATxNI4wxyLIMjDEwxpBlGYwxAICmacA5h1IKWZaBcx6u5XmOaRrhnEOe52CMgXOOoihC+8NwCX9zzsEYQ57n6PsOw3CJD5znOaSUkFJCKQXv/QJ4GC4BxBiD0+k9wHjvQztZlqGqKhhj0LbnBbCUEowxCCFgrYUQYrHC9H/zOq01vPfxgWlmaeavga21YIyhKIpgnrQi1tqFpUzTGMx8Pim0un3fAcAHl3HO4XR6h5QytC2l3Aa4LEu07Rl936Hvuw8mPb+PVJYlGGNomibUCyEWfk3Acwsh3792maIowDmHEAJVVW0P7L3HMFwwDJcFsJQSfd+Bc44sy+CcWwD0fXcX2HsfVs0Yg2kaA9TcgoQQC+vaHJii7DBcYIwJfmmthZQyAJB5SilD0LoFPE1jiMrXbSilgr+TS21m0hQgqqpabAG00uRPTdOEQZdliaIooLUO/koTUlXVAlgIASEEpmkMVlMURQhcUkporQEAWusPdYfDW1zg+VY0DJcAPN9j/yvNxxUF+FZJSdEePD4rtGWkps2AU9UmwKlqDeyXwJ91kILWwu4OeG3A+hKYglXfd8mZ+SbAKfv1NI3bAqeoTYBT3YNJUYFTeJS8p6jAe9CvAwaeg34B7wkYeBz6Bdy2/w4D9qRfsS3NtRo49YeOz7QKeG9+DOwcmN7SHtUq4HmHzw7gUV2/jj7a52rgn1rxey/231U04C2D2Hf6995Hay+Jc+mY/a8G/ok9OZZJA/dPRJI58Yg5huRX+NZAn9Eti0nCh0kxJ3oV8E9Cx9Jq4D1B3/oN+SHgvUD/OuBbW9NDwHt5T161Le1tdYEX8HPAezoFiQK8p4O9KMB7CVjAy6RfQet/BXyP4QW8d+jowKkHsE2AqaS4N28KnJqZf+eTpijAz4LTF/eUV3E9eKqjhx5KILm+dzfA9KU75VHM1fddqLPWAviXCEJpRJ/pOx+PJwGslApJXiRjDJRSC2D6In6+wpROAHztv5RdlwSwUgp1fQx5FgRWVRXq+hiyXGgSKO9hmkZYa3E4vKGqKmitcTq9o23Pi2tKqdBHXR/xF+OBqJtAf7AIAAAAAElFTkSuQmCC",
  },
  esriWorldTopo: {
    title: "ESRI World Topographic Map",
    style: esriWorldTopo,
    thumbnail:
      "data:image/png;base64,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",
  },
  esriOceans: {
    title: "ESRI Oceans",
    style: esriOceans,
    thumbnail:
      "data:image/png;base64,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",
  },
  stamenTerrain: {
    title: "Stamen Terrain",
    style: stamenTerrain,
    thumbnail:
      "data:image/png;base64,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",
  },
};