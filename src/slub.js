import React from "react";
import ReactDOM from "react-dom";
import PropTypes from 'prop-types';
import classNames from "classnames";

function Slub(props) {
  return (
    <div className={classNames(
      "tw-text-xs tw-text-gray-600 tw-uppercase tw-font-semibold tw-mb-1",
      props.extraClasses
    )}>{props.children}</div>
  )
}

Slub.propTypes = {
  extraClasses: PropTypes.string,
}

export default Slub;