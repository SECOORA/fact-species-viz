import React, { useState, useEffect, useRef } from "react";
import ReactMapGL, {Source, Layer, Popup, LinearInterpolator, WebMercatorViewport, NavigationControl } from 'react-map-gl';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import * as d3 from 'd3';
import bbox from "@turf/bbox";

import * as mapstyle from './mapstyle.json';

function GLMap(props) {
  const idField = props.idField || "id";

  const [viewport, setViewport] = useState({
    width: props.mapWidth || '100%',
    height: props.mapHeight || 667,
    latitude: props.latitude || 30.97,
    longitude: props.longitude || -80.42,
    zoom: props.zoom || 4.25
    /*
    pitch: 60.5,
    bearing: -47.3985
    */
  });

  const [styles, setStyles] = useState({});
  const [layerData, setLayerData] = useState({});
  const [allBBox, setAllBBox] = useState(null);

  const onAutoResize = (e) => {
    setViewport({
      ...viewport,
      ...e
    });
  }

  useEffect(() => {
    if (!props.layerSources) {
      return;
    }

    // @TODO >1 sources
    // good pattern: https://github.com/facebook/react/issues/14326#issuecomment-472043812
    let {url, transform} = props.layerSources;
    d3.json(url).then(d => {

      let transformed = transform(d);
      
      // build sources from returned data and styles
      // extract and merge individual features
      let data = {},
        allFeatures = {
          type: "FeatureCollection",
          features: []
        };

      transformed.catalog.forEach(ce => {
        Object.entries(ce.data).forEach(([layerName, feature]) => {
          if (!data.hasOwnProperty(layerName)) {
            data[layerName] = {
              type: "FeatureCollection",
              features: []
            }
          }

          data[layerName].features.push(feature);
          allFeatures.features.push(feature);
        });
      });

      // pad out missing styles from normal
      // @TODO: ensure normal defined
      let newStyles = {};
      Object.entries(transformed.styles).forEach(([layerName, styleObj]) => {
        newStyles[layerName] = {
          normal: styleObj.normal,
        };
      });

      setStyles(newStyles);
      setLayerData(data);
      setAllBBox(bbox(allFeatures));
    });
  }, [props.layerSources]);

  return (
    <div className="glmap-container">
      <div className="glmap-internal-container">
        <AutoSizer disableHeight onResize={onAutoResize}>
          {({ asWidth }) => (
            <ReactMapGL
              {...viewport}
              mapStyle={props.mapStyle || mapstyle}
              // onClick={onMapClick}
              interactiveLayerIds={
                props.interactiveLayerIds || Object.keys(layerData)
              }
              // onHover={onMapHover}
              onViewportChange={setViewport}
              mapboxApiAccessToken={process.env.MAPBOX_TOKEN}
            >
              {/* <div className="nav-holder">
                <NavigationControl />
              </div> */}

              {Object.entries(layerData).map(([layerName, fc]) => {
                return (
                  <Source
                    id={layerName}
                    type="geojson"
                    data={fc}
                    key={layerName}
                  >
                    {/*
                     * The invisible layer used for interactiveLayers in mapbox.  Always present, never visible.
                     */}
                    <Layer id={layerName} {...styles[layerName].normal} />

                    {/*
                     * "Normal" - on when nothing hovered or selected.
                     */}
                    <Layer
                      id={layerName + "normal"}
                      {...styles[layerName].normal}
                    />

                  </Source>
                );
              })}
            </ReactMapGL>
          )}
        </AutoSizer>
      </div>
    </div>
  );
}

export default GLMap;