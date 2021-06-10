import React, {useState, useMemo, useEffect} from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";

function Chooser(props) {
  return <div className="flex items-baseline flex-wrap mb-2">
    {props.label && (
      <div className="mr-1 text-sm text-gray-600 w-24 text-right">
        {props.label}:
      </div>
    )}
    {props.items.map((tc, i) => {
      const isEnabled = !!(props.enabledItems?.indexOf(tc) !== -1 ?? true),
        label = props.labels ? props.labels[i] : tc;

      return (
        <a
          key={tc}
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (props.enabledItems && props.enabledItems.indexOf(tc) === -1) {
              return;
            }
            props.onClick(tc);
          }}
          className={classNames(
            "text-base hover:scale-110 focus:outline-none flex justify-center px-4 py-2 rounded font-bold cursor-pointer border duration-200 ease-in-out transition",
            { "rounded-l-none border-l-0": i > 0 },
            { "rounded-r-none border-r-0": i < props.items.length - 1 },
            {
              "border-yellow-700 hover:bg-yellow-700 hover:text-yellow-100 bg-yellow-100 text-yellow-700":
                tc === props.curVal && isEnabled,
            },
            {
              "border-gray-700 hover:bg-gray-700 hover:text-gray-100 bg-gray-100 text-gray-700":
                tc !== props.curVal && isEnabled,
            },
            {
              "text-gray-300 cursor-not-allowed": !isEnabled,
            }
          )}
        >
          <div className="flex leading-5">
            {label}
          </div>
        </a>
      );
    })}
  </div>;
};

export default Chooser;