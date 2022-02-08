import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import classNames from "classnames";

const SpeciesImage = ({
  media,
  srcSize = 'medium',
  caption = '',
  highlight = false,
  dehilight = false,
  mini = false,
  extraClasses = '',
}) => {

  const classes = useMemo(() => {
    if (mini) {
      return "tw-inline-block tw-h-20 tw-w-20 tw-rounded-full";
    }

    return "tw-rounded-lg";
  }, [mini])

  const styles = useMemo(() => {
    let stylesRet = {};
    if (dehilight) {
      stylesRet['filter'] = 'grayscale(90%)'
    }

    return stylesRet;

  }, [dehilight]);

  return (
    <img
      style={{
        ...styles,
        transition: "all 100ms ease-in-out"
      }}
      className={classNames(
        classes,
        extraClasses,
        "tw-object-cover tw-ring-2 tw-flex-shrink tw-min-h-0",
        { "tw-ring-white": !highlight },
        { "tw-ring-4 tw-ring-indigo-600 tw-shadow-lg": highlight }
      )}
      alt={caption}
      width={media?.sizes[srcSize].width}
      height={media?.sizes[srcSize].height}
      src={media?.sizes[srcSize].source_url}
    ></img>
  );
}

SpeciesImage.propTypes = {
  media: PropTypes.object,
  size: PropTypes.string,
  caption: PropTypes.string,
  highlight: PropTypes.bool,
  dehilight: PropTypes.bool,
  mini: PropTypes.bool,
  extraClasses: PropTypes.string,
}

export default SpeciesImage;