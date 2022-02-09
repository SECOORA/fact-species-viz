import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";

import axios from "axios";

const CitationModal = (props) => {

  const [contacts, setContacts] = useState({}); // project code -> [{contacts}]

  useEffect(() => {
    async function getContacts() {
      const queryCCs = Object.keys(props.citations).map(cc => `'FACT.${cc}'`),
        curl = `https://members.oceantrack.org/geoserver/otn/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=otn:mstr_contacts&outputFormat=application%2Fjson&CQL_FILTER=collectioncode%20IN%20(${queryCCs})`,
        cresp = await axios.get(curl);

      if (cresp.status !== 200) {
        console.warn("WE GOT NOTHING @TODO");
        return;
      }

      // group responses by project
      const contactData = cresp.data.features.reduce((prevVal, curVal) => {
        const cc = curVal.properties.collectioncode.replace("FACT.", ""),
          newVal = {
            ...prevVal,
            [cc]: [...(prevVal[cc] || []), curVal.properties],
          };
        return newVal;
      }, {});

      setContacts(contactData);
    }
    getContacts();
  }, [props.citations])

	return (
    <div className="tw-h-full tw-w-full tw-absolute tw-flex tw-items-center tw-justify-center tw-bg-gray-500 tw-bg-opacity-50 tw-top-0 tw-left-0">
      <div className="tw-flex tw-flex-col tw-gap-4 tw-bg-white tw-rounded tw-shadow tw-p-8 tw-m-4 tw-w-xl tw-max-h-full tw-overflow-y-auto" style={{zIndex: 9999}}>
        <div className="tw-text-md tw-font-bold tw-mb-4 tw-border-b tw-border-dotted tw-border-gray-500">Citations/Project Info</div>

        {props.showCitations.map((sp) => {
          return (
            <div key={`cite-${sp}`} className="tw-text-sm tw-mb-2 tw-flex tw-flex-col tw-gap-1">
              <div className="tw-font-bold">
                {props.citations[sp]?.shortname}
              </div>
              <div className="">{props.citations[sp]?.citation}</div>
              {props.citations[sp]?.website && (
                <a href={props.citations[sp]?.website} target="_blank">
                  {props.citations[sp]?.website}
                </a>
              )}
              {contacts && contacts[sp] && (
                <div className="">
                  <div className="tw-text-sm tw-font-bold">Contacts</div>
                  <table className="tw-table-fixed tw-text-sm">
                    <tbody>
                      {contacts[sp].map((c, i) => {
                        return <tr key={i}>
                          <td className="tw-w-64">{c.firstname} {c.lastname} ({c.affiliation})</td>
                          <td className="tw-w-64">{c.role}</td>
                          <td><a className="tw-text-indigo-700" href={`mailto:${c.email}`}>{c.email}</a></td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="">
                <a
                  href={`https://secoora.org/fact/projects-species/projects/?project=FACT.${sp}`}
                  target="_blank"
                  className="tw-text-indigo-700"
                >
                  Project Page
                </a>
              </div>
            </div>
          );
        })}
        <div className="tw-flex tw-justify-end tw-mt-4">
          <button
            onClick={props.onClose}
            className="tw-flex-no-shrink tw-text-white tw-py-2 tw-px-4 tw-rounded tw-bg-indigo-500 hover:tw-bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default CitationModal;