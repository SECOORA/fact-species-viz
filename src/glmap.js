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
  const [noData, setNoData] = useState(false);
  const [noDataReason, setNoDataReason] = useState(null);

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
      if (transformed === null) {
        setNoData(true);
        setLayerData({});   // remove any previous layer data
        setAllBBox(null);
        return;
      }

      // unset nodata on successful load
      setNoData(false);
      setNoDataReason(null);

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
    }).catch(e => {
      setNoData(true);
      setNoDataReason(e.toString());
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
        <div className="overlay-container absolute top-0 left-0 w-full h-full pointer-events-none">
          {noData && (
            <div className="w-full h-full bg-white opacity-50 flex place-content-center">
              <div className="flex flex-col justify-center items-center">
                <p className="text-4xl">NO DATA</p>
                {noDataReason && <p>{noDataReason}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GLMap;