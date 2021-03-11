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
      return (
        <a
          key={tc}
          href="#"
          onClick={(e) => {
            props.onClick(tc);
            e.preventDefault();
          }}
          className={classNames(
            "text-base hover:scale-110 focus:outline-none flex justify-center px-4 py-2 rounded font-bold cursor-pointer  border duration-200 ease-in-out transition",
            { "rounded-l-none border-l-0": i > 0 },
            { "rounded-r-none border-r-0": i < props.items.length - 1 },
            {
              "border-yellow-700 hover:bg-yellow-700 hover:text-yellow-100 bg-yellow-100 text-yellow-700":
                tc === props.curVal,
            },
            {
              "border-gray-700 hover:bg-gray-700 hover:text-gray-100 bg-gray-100 text-gray-700":
                tc !== props.curVal,
            }
          )}
        >
          <div className="flex leading-5">
            {tc}
          </div>
        </a>
      );
    })}
  </div>;
};

export default Chooser;