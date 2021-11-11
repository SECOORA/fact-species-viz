import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import PropTypes from 'prop-types';
import classNames from "classnames";

import PaletteSwatch from "./paletteSwatch.js";
import {IconVerticalDots, IconUp, IconDown, IconDuplicate, IconTrash, IconExpand} from "./icon.js";

const LayerTile = (props) => {

  const monthName = useMemo(() => {
    if (!props.month || props.month === "all") {
      return "All Months";
    }

    const d = new Date(`2020-${props.month}-15`);    // do middle of the month so the user's timezone doesn't take us into prev month
    return d.toLocaleString('default', {month: 'short'});
  }, [props.year, props.month]);

  const typeLabel = useMemo(() => {
    if (props.type.toLowerCase() === "distribution") {
      return "distr";
    } else if (props.type.toLowerCase() === "range") {
      return "range";
    }
    return "";
  }, [props.type]);

  return (
    <div
      className={classNames("tw-w-64 tw-mt-1 tw-rounded-sm tw-rounded-r-none", {
        "tw-bg-gray-300 tw-border-l tw-border-t tw-border-b tw-border-gray-600":
          props.isActive,
        "tw-bg-white tw-border-l tw-border-t tw-border-b tw-border-white tw-shadow":
          !props.isActive,
      })}
    >
      <div className="tw-flex tw-flex-col tw-relative">
        {props.isActive && (
          <div className="tw-h-full tw-w-2 tw-bg-gray-300 tw-absolute tw-top-0" style={{right: "-2px"}}></div>
        )}
        <div
          className="tw-flex tw-items-center tw-px-2 tw-py-2 tw-cursor-pointer"
          onClick={(e) => props.onClick()}
        >
          <PaletteSwatch
            palette={props.palette}
            extraClasses={"tw-flex-initial tw-shadow"}
            size={8}
          />
          <div className="tw-flex tw-flex-col tw-text-sm tw-px-3 tw-flex-grow">
            <div className="tw-text-gray-700 tw-font-bold tw-capitalize">
              {props.speciesName ?? props.aphiaId}
            </div>
            <div className="tw-text-gray-600 tw-capitalize tw-text-sm">
              {props.year} &middot; {monthName}{" "}
              {props.project !== "_ALL" && (
                <>
                  {" "}
                  &middot; <span className="tw-font-bold">{props.project}</span>
                </>
              )}
            </div>
          </div>

          <div className="tw-flex-initial tw-text-right">
            <span className="tw-m-1 tw-bg-gray-200 tw-rounded-full tw-px-2 tw-text-xs tw-leading-loose tw-capitalize">
              {typeLabel}
            </span>
          </div>
        </div>

        <div className="tw-z-10 tw-h-full tw-flex tw-items-center tw-justify-evenly tw-mb-1">
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
	year: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  month: PropTypes.any,
	palette: PropTypes.string,
	onClick: PropTypes.func,
	isActive: PropTypes.bool,
  type: PropTypes.string
};

export default LayerTile;