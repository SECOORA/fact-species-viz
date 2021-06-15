import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import PropTypes from 'prop-types';
import classNames from "classnames";

export const IconBase = ({
	path,
	extraClasses = '',
	size = 6,
	onClick,
  enabled = true,
  tooltip
}) => {
	return (
    <div
      className={classNames("cursor-pointer px-2", extraClasses, {
        "text-gray-300 cursor-not-allowed": !enabled,
        "has-tooltip": tooltip,
      })}
      onClick={(e) => {
        if (!enabled) {
          return;
        }
        e.stopPropagation();
        onClick();
      }}
    >
      {tooltip && enabled && <span className="tooltip">{tooltip}</span>}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-${size} w-${size}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={path}
        />
      </svg>
    </div>
  );
}

IconBase.propTypes = {
	path: PropTypes.string.isRequired,
	extraClasses: PropTypes.string,
	size: PropTypes.number,
	onClick: PropTypes.func,
  enabled: PropTypes.bool
}

// https://heroicons.com/

export const IconVerticalDots = (props) => {
	return (
		<IconBase
			path="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
			{...props}
			/>
	);
}

export const IconUp = (props) => {
	return (
    <IconBase
      path="M5 15l7-7 7 7"
      {...props}
    />
  );
}

export const IconDown = (props) => {
	return <IconBase path="M19 9l-7 7-7-7" {...props} />;
}

export const IconDuplicate = (props) => {
	return (
    <IconBase
      path="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      {...props}
    />
  );
}

export const IconTrash = (props) => {
	return (
    <IconBase
      path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      {...props}
    />
  );
}

export const IconExpand = (props) => {
	return (
    <IconBase
      path="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
      {...props}
    />
  );
}
