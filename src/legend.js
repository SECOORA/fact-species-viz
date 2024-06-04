import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import PaletteSwatch from "./paletteSwatch";

const Legend = (props) => {
	return (
    <div className="tw-flex tw-flex-col tw-bg-white tw-border tw-border-gray-300 tw-shadow tw-px-2 tw-rounded-md tw-text-sm">
      {props.palettes?.length > 0 && (
        <div className="tw-inline-flex tw-items-center">
          <div>0</div>
          <div className="tw-flex tw-flex-col tw-border tw-border-gray-400 tw-mx-1">
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
          <div>{props.maxLevel} Animal Detection Events</div>
        </div>
      )}
      {props.presents?.length > 0 && (
        <div className="tw-flex tw-flex-col">
          <div className="tw-border-t tw-border-gray-100"></div>
          <div className="tw-inline-flex tw-my-1 tw-items-center">
            {props.presents.map((p, idx) => {
              return (
                <PaletteSwatch
                  key={`legend-pres-${idx}`}
                  palette={p}
                  size={5}
                  rounded={false}
                  extraClasses={"tw-shadow tw-border tw-border-black tw-mr-1"}
                />
              );
            })}
            <div className="tw-text-xs">Present</div>
          </div>
        </div>
      )}
    </div>
  );
}

Legend.propTypes = {
  maxLevel: PropTypes.number.isRequired,
  palettes: PropTypes.array,
  presents: PropTypes.array,
}

export default Legend;