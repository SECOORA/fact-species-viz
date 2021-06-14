import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import PropTypes from 'prop-types';

import PaletteSwatch from "./paletteSwatch.js";
import classNames from "classnames";

const LayerTile = (props) => {
  return (
    <div
      className={classNames("w-64 shadow rounded-sm mb-2", {
        "bg-yellow-500": props.isActive,
      })}
      onClick={(e) => props.onClick()}
    >
      <div className="flex items-center px-5 py-3">
        <PaletteSwatch palette={props.palette} />
        <div className="mx-3">
          <p className="text-gray-600">
            {props.aphiaId} - {props.year}
          </p>
        </div>
      </div>
    </div>
  );
};

LayerTile.propTypes = {
	aphiaId: PropTypes.number,
	year: PropTypes.number,
	palette: PropTypes.string,
	onClick: PropTypes.func,
	isActive: PropTypes.bool
};

export default LayerTile;