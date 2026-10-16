import assert from "node:assert/strict";
import { parseDatasetBody } from "../lib/dashboard-data.mjs";

const liveRegistryShape = {
  data: {
    items: [
      {
        nct_id: "NCT12345678",
        study_title: "A registry-compatible clinical trial",
        overall_status: "RECRUITING",
        start_date: "2025-01-01",
        completion_date: "2027-01-01",
        conditions: ["lung cancer"],
      },
    ],
    total: "1",
  },
};

const parsed = parseDatasetBody(liveRegistryShape, "clinicalTrials");
assert.equal(parsed.total, 1);
assert.equal(parsed.items.length, 1);
assert.equal(parsed.items[0].nctId, "NCT12345678");
assert.equal(parsed.items[0].title, "A registry-compatible clinical trial");
assert.equal(parsed.items[0].status, "RECRUITING");

const groupedSearchShape = {
  results: {
    clinicalTrials: {
      items: [
        {
          nctId: "NCT87654321",
          title: "A grouped trial result",
        },
      ],
      total: 7,
    },
  },
};

const grouped = parseDatasetBody(groupedSearchShape, "clinicalTrials");
assert.equal(grouped.total, 7);
assert.equal(grouped.items[0].nctId, "NCT87654321");

const documentedListShape = {
  data: [
    {
      id: "trial-1",
      nctId: "NCT11111111",
      title: "A documented list response",
    },
  ],
  pagination: { total: 12 },
};

const documented = parseDatasetBody(documentedListShape, "clinicalTrials");
assert.equal(documented.total, 12);
assert.equal(documented.items[0].title, "A documented list response");

console.log("Dashboard data test passed: live clinical-trial fields are normalized.");
