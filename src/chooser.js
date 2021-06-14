import React, {useState, useMemo, useEffect} from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";

function Chooser(props) {

  return (
    <div>
      <div className="text-sm">{props.label}</div>
      <div className="inline-block relative w-64">
        <select
          className="block appearance-none w-full bg-white border border-gray-400 hover:border-gray-500 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:shadow-outline"
          value={props.curVal}
          onChange={(e) => {
            const tc = parseInt(e.target.value) || e.target.value;
            if (props.enabledItems && props.enabledItems.indexOf(tc) === -1) {
              return;
            }
            props.onClick(tc);
          }}
        >
          {props.items.map((tc, i) => {
            const isEnabled = !!(
                props.enabledItems?.indexOf(tc) !== -1 ?? true
              ),
              label = props.labels ? props.labels[i] : tc;

            if (!isEnabled) { return null; }

            return (
              <option key={`${tc}-${i}`} value={tc}>
                {label}
              </option>
            );
          })}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg
            className="fill-current h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
          >
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="w-full">
        <div className="my-2 p-1 bg-white flex border border-gray-200 rounded">
          <div className="flex flex-auto flex-wrap"></div>
          {props.label}
          <div className="text-gray-300 w-8 py-1 pl-2 pr-1 border-l flex items-center border-gray-200">
            <button className="cursor-pointer w-6 h-6 text-gray-600 outline-none focus:outline-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="100%"
                height="100%"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="feather feather-chevron-up w-4 h-4"
              >
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        className="
            shadow
            bg-white
            top-100
            z-40
            w-full
            lef-0
            rounded
            max-h-select
            overflow-y-auto
          "
      >
        {props.items.map((tc, i) => {
          const isEnabled = !!(props.enabledItems?.indexOf(tc) !== -1 ?? true),
            label = props.labels ? props.labels[i] : tc;

          return (
            <div
              key={`${tc}-${i}`}
              className="flex flex-col w-full"
              onClick={(e) => {
                e.preventDefault();
                if (
                  props.enabledItems &&
                  props.enabledItems.indexOf(tc) === -1
                ) {
                  return;
                }
                props.onClick(tc);
              }}
            >
              <div
                className="
                cursor-pointer
                w-full
                border-gray-100
                rounded-t
                border-b
                hover:bg-teal-100
              "
              >
                <div
                  className="
                  flex
                  w-full
                  items-center
                  p-2
                  pl-2
                  border-transparent border-l-2
                  relative
                  hover:border-teal-100
                "
                >
                  {label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

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