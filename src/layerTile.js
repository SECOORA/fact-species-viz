import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import PropTypes from 'prop-types';
import classNames from "classnames";

import PaletteSwatch from "./paletteSwatch.js";
import {IconVerticalDots, IconUp, IconDown, IconDuplicate, IconTrash, IconExpand} from "./icon.js";

const LayerTile = (props) => {

  const monthName = useMemo(() => {
    if (!props.month || props.month === "all") {
      return "All";
    }

    const d = new Date(`${props.year}-${props.month}-15`);    // do middle of the month so the user's timezone doesn't take us into prev month
    return d.toLocaleString('default', {month: 'short'});
  }, [props.year, props.month]);

  const typeLabel = useMemo(() => {
    if (props.type.toLowerCase() === "distribution") {
      return "dist";
    } else if (props.type.toLowerCase() === "range") {
      return "range";
    }
    return "";
  }, [props.type]);

  return (
    <div
      className={classNames("w-64 mt-1 rounded-sm rounded-r-none", {
        "bg-gray-300 border-l border-t border-b border-gray-600":
          props.isActive,
        "bg-white border-l border-t border-b border-white shadow":
          !props.isActive,
      })}
    >
      <div className="flex flex-col relative">
        {props.isActive && (
          <div className="h-full w-2 bg-gray-300 absolute top-0" style={{right: "-2px"}}></div>
        )}
        <div
          className="flex items-center px-2 py-2 cursor-pointer"
          onClick={(e) => props.onClick()}
        >
          <PaletteSwatch
            palette={props.palette}
            extraClasses={"flex-initial shadow"}
            size={8}
          />
          <div className="flex flex-col text-sm px-3 flex-grow">
            <div className="text-gray-700 font-bold capitalize">
              {props.speciesName ?? props.aphiaId}
            </div>
            <div className="text-gray-600 capitalize text-sm">
              {props.year} &middot; {monthName}{" "}
              {props.project !== "_ALL" && (
                <>
                  {" "}
                  &middot; <span className="font-bold">{props.project}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex-initial text-right">
            <span className="m-1 bg-gray-200 rounded-full px-2 text-xs leading-loose uppercase">
              {typeLabel}
            </span>
          </div>
        </div>

        <div className="z-10 h-full flex items-center justify-evenly mb-1">
          <IconUp
            size={4}
            onClick={props.onLayerUp}
            enabled={props.enableLayerUp}
            tooltip="Move Layer Up"
          />
          <IconDown
            size={4}
            onClick={props.onLayerDown}
            enabled={props.enableLayerDown}
            tooltip="Move Layer Down"
          />
          <IconDuplicate
            size={4}
            onClick={props.onLayerDuplicate}
            enabled={props.enableDuplicate}
            tooltip="Duplicate Layer"
          />
          {/* <IconExpand size={4} enabled={true} /> */}
          <IconTrash
            size={4}
            onClick={props.onLayerDelete}
            extraClasses={""}
            enabled={props.enableDelete}
            tooltip="Delete Layer"
          />
        </div>
      </div>
    </div>
  );
};

LayerTile.propTypes = {
	aphiaId: PropTypes.number,
  speciesName: PropTypes.string,
	year: PropTypes.number,
  month: PropTypes.any,
	palette: PropTypes.string,
	onClick: PropTypes.func,
	isActive: PropTypes.bool,
  type: PropTypes.string
};

export default LayerTile;