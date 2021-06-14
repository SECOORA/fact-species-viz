import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import PropTypes from 'prop-types';

import Palettes, {paletteToCssGradient} from "./palettes.js";

const PaletteSwatch = (props) => {
	const paletteBg = useMemo(() => {
		return paletteToCssGradient(Palettes[props.palette]);
	}, [props.palette]);

	return (
			<div
				className={`h-${props.size || 12} w-${props.size || 12} mx-auto rounded-md bg-gray-100`}
				style={{ background: paletteBg }}
			/>
	)
}

PaletteSwatch.propTypes = {
	palette: PropTypes.string,
}

export default PaletteSwatch;