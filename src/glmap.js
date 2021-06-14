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

  const [allBBox, setAllBBox] = useState(null);
  const [noData, setNoData] = useState(false);
  const [noDataReason, setNoDataReason] = useState(null);

  const onAutoResize = (e) => {
    setViewport({
      ...viewport,
      ...e
    });
  }

  /**
   * Calculates a pixel number from the value if the value looks like a percentage (0 - 1).
   * Uses viewportProp ('width' or 'height') to pull correct value from viewport.
   * 
   * @param {Number} val 
   * @param {String} viewportProp 
   */
  const _calcPadding = (val, viewportProp) => {
    if (val < 1 && !Number.isInteger(val)) {
      return val * viewport[viewportProp];
    }
    return val;
  }

  const _viewportForExtents = (minLon, minLat, maxLon, maxLat, padding = 40) => {
    // fixup padding object if any member contains a percentage
    if (typeof padding === "object") {
      padding = {
        left:   _calcPadding(padding.left   || 40, 'width'),
        right:  _calcPadding(padding.right  || 40, 'width'),
        top:    _calcPadding(padding.top    || 40, 'height'),
        bottom: _calcPadding(padding.bottom || 40, 'height'),
      };
    }

    let newViewport = new WebMercatorViewport(viewport),
      {longitude, latitude, zoom} = newViewport.fitBounds([
        [minLon, minLat],
        [maxLon, maxLat]
      ], { padding: padding });

    return {
      latitude: latitude,
      longitude: longitude,
      zoom: zoom
    }
  }

  const zoomToExtents = (extents, padding=props.zoomToPadding || {top: 40, left: 40, right: 40, bottom: 40}) => {
    if (!extents) {
      extents = allBBox;
    }
    if (!extents) {
      return;
    }

    // if autorisize hasn't happened yet, 

    let [minLon, minLat, maxLon, maxLat] = extents,
      {latitude, longitude, zoom} = _viewportForExtents(minLon, minLat, maxLon, maxLat, padding);

    setViewport({
      ...viewport,
      latitude: latitude,
      longitude: longitude,
      zoom: Math.min(zoom, props.maxZoom || 10),
      transitionInterpolator: new LinearInterpolator(),
      transitionDuration: 500
    })
  }

    //   const newAllBBox = bbox(allFeatures);

    //   setStyles(newStyles);
    //   setLayerData(data);
    //   setAllBBox(newAllBBox);
    //   // zoomToExtents(newAllBBox);
    // }).catch(e => {
    //   setNoData(true);
    //   setNoDataReason(e.toString());
    //   setLayerData({});   // remove any previous layer data
    //   setAllBBox(null);

  // TODO: useEffect on layerData changes to calculate allbbox
  // TODO: allBbox should be a memo calc on layerData

  return (
    <div className="glmap-container block w-full">
      <div className="glmap-internal-container">
        <AutoSizer disableHeight onResize={onAutoResize}>
          {({ asWidth }) => (
            <ReactMapGL
              {...viewport}
              mapStyle={props.mapStyle || mapstyle}
              // onClick={onMapClick}
              interactiveLayerIds={
                props.interactiveLayerIds || Object.keys(props.layerData || {})
              }
              // onHover={onMapHover}
              onViewportChange={setViewport}
              mapboxApiAccessToken={process.env.MAPBOX_TOKEN}
            >
              {/* <div className="nav-holder">
                <NavigationControl />
              </div> */}

              {/* static layers for reliable z-indexing (max 5) */}
              <Layer id="z-0" type="background" layout={{ visibility: 'none'}} paint={{}} />
              <Layer id="z-1" type="background" layout={{ visibility: 'none'}} paint={{}} />
              <Layer id="z-2" type="background" layout={{ visibility: 'none'}} paint={{}} />
              <Layer id="z-3" type="background" layout={{ visibility: 'none'}} paint={{}} />
              <Layer id="z-4" type="background" layout={{ visibility: 'none'}} paint={{}} />

              {props.children}

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