// src/admin/RankingsTab.jsx
// Phase C — Rankings tab wrapper (delegates to RankingsTable)

import RankingsTable from "./scores/RankingsTable";

/**
 * @param {object[]} props.ranked           Sorted project summaries
 * @param {string}   props.periodName       Current period name
 * @param {object[]} [props.criteriaConfig] Active criteria
 */
export default function RankingsTab({ ranked = [], periodName, criteriaConfig }) {
  return (
    <RankingsTable
      ranked={ranked}
      periodName={periodName}
      criteriaConfig={criteriaConfig}
    />
  );
}
