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
	onClick
}) => {

	const paletteBg = useMemo(() => {
		return paletteToCssGradient(Palettes[palette]);
	}, [palette]);

	const sizeClasses = useMemo(() => {
		const sc = [
			`h-${height ?? size}`,
			`w-${width ?? size}`
		]
		return sc.join(" ")
	}, [size, height, width])

	return (
			<div
				className={classNames(sizeClasses, "bg-gray-100", {"rounded-md": rounded}, extraClasses)}
				style={{ background: paletteBg }}
				onClick={onClick}
			/>
	)
}

PaletteSwatch.propTypes = {
	palette: PropTypes.string.isRequired,
	size: PropTypes.number,
	height: PropTypes.number,
	width: PropTypes.number,
	rounded: PropTypes.bool,
	extraClasses: PropTypes.string,
	onClick: PropTypes.func
}

export default PaletteSwatch;