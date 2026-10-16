function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asNumber(value) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(number) ? number : null;
}

function asString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function firstString(...values) {
  for (const value of values) {
    const string = asString(value);
    if (string) return string;
  }
  return null;
}

function normalizeClinicalTrial(item) {
  const normalized = { ...item };
  const aliases = [
    ["nctId", [item.nctId, item.nct_id, item.nctID, item.studyId, item.study_id]],
    ["title", [item.title, item.studyTitle, item.study_title, item.briefTitle, item.brief_title]],
    [
      "description",
      [item.description, item.studyDescription, item.study_description, item.briefSummary, item.brief_summary],
    ],
    ["status", [item.status, item.overallStatus, item.overall_status]],
    ["startDate", [item.startDate, item.start_date, item.studyStartDate, item.study_start_date]],
    [
      "completionDate",
      [item.completionDate, item.completion_date, item.studyCompletionDate, item.study_completion_date],
    ],
    ["interventionType", [item.interventionType, item.intervention_type]],
  ];

  aliases.forEach(([key, values]) => {
    if (!asString(normalized[key])) {
      const value = firstString(...values);
      if (value) normalized[key] = value;
    }
  });

  if (!Array.isArray(normalized.conditions)) {
    const conditions = normalized.condition ?? normalized.conditions_list;
    if (Array.isArray(conditions)) normalized.conditions = conditions;
    else if (typeof conditions === "string" && conditions.trim()) normalized.conditions = [conditions];
  }

  return normalized;
}

export function parseDatasetBody(body, key) {
  const parsed = isRecord(body) ? body : {};
  const nestedData = isRecord(parsed.data) ? parsed.data : null;
  const resultBucket =
    isRecord(parsed.results) && isRecord(parsed.results[key])
      ? parsed.results[key]
      : null;
  const rawItems = Array.isArray(parsed.data)
    ? parsed.data
    : Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed.results)
        ? parsed.results
        : nestedData && Array.isArray(nestedData.items)
          ? nestedData.items
          : nestedData && Array.isArray(nestedData.data)
            ? nestedData.data
            : resultBucket && Array.isArray(resultBucket.items)
              ? resultBucket.items
              : resultBucket && Array.isArray(resultBucket.data)
                ? resultBucket.data
            : [];
  const items = rawItems.filter(isRecord).map((item) =>
    key === "clinicalTrials" ? normalizeClinicalTrial(item) : item,
  );
  const pagination = isRecord(parsed.pagination)
    ? parsed.pagination
    : nestedData && isRecord(nestedData.pagination)
      ? nestedData.pagination
      : resultBucket && isRecord(resultBucket.pagination)
        ? resultBucket.pagination
      : {};
  const total =
    asNumber(pagination.total) ??
    asNumber(parsed.total) ??
    asNumber(parsed.count) ??
    (nestedData ? asNumber(nestedData.total) : null) ??
    (resultBucket ? asNumber(resultBucket.total) : null) ??
    items.length;

  return { items, total };
}
