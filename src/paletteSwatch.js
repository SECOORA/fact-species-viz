import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import PropTypes from 'prop-types';

import Palettes, {paletteToCssGradient} from "./palettes.js";
import classNames from "classnames";

const PaletteSwatch = ({
	palette,
	size = 12,
	height,
	width,
	rounded = true,
	extraClasses,
	onClick,
	highlightValue
}) => {

	const paletteBg = useMemo(() => {
		return paletteToCssGradient(Palettes[palette]);
	}, [palette]);

	const sizeClasses = useMemo(() => {
		const sc = [
			`tw-h-${height ?? size}`,
			`tw-w-${width ?? size}`
		]
		return sc.join(" ")
	}, [size, height, width])

	return (
    <div className="tw-relative">
      <div
        className={classNames(
          sizeClasses,
          "tw-bg-gray-100",
          { "tw-rounded-md": rounded },
          extraClasses
        )}
        style={{ background: paletteBg }}
        onClick={onClick}
      />
      {highlightValue !== undefined && (
        <div
          className={classNames(
            "tw-absolute tw-border-l-4 tw-z-50 tw-border-black tw-top-0 tw-w-1",
            `tw-h-${height ?? size}`
          )}
          style={{ left: `${highlightValue.toFixed(2) * 100}%` }}
        ></div>
      )}
    </div>
  );
}

PaletteSwatch.propTypes = {
	palette: PropTypes.string.isRequired,
	size: PropTypes.number,
	height: PropTypes.number,
	width: PropTypes.number,
	rounded: PropTypes.bool,
	extraClasses: PropTypes.string,
	onClick: PropTypes.func,
	highlightValue: PropTypes.number
}

export default PaletteSwatch;