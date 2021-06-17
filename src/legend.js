import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import PaletteSwatch from "./paletteSwatch";

const Legend = (props) => {
	return (
    <div className="inline-flex text-sm items-center bg-white border border-gray-300 shadow px-2 rounded-md">
      <div>0</div>
      <div className="flex flex-col border border-gray-400 mx-1">
        {props.palettes?.map((p, idx) => {
          return (
            <PaletteSwatch
              key={`legend-pal-${idx}`}
              palette={p}
              height={2}
              width={32}
              rounded={false}
              extraClasses={""}
            />
          );
        })}
      </div>
      <div>{props.maxLevel}</div>
    </div>
  );

}

Legend.propTypes = {
	maxLevel: PropTypes.number.isRequired,
	palettes: PropTypes.array,

}

export default Legend;