(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SchaeferCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function fold(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
      .toLocaleLowerCase('de-DE')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function optionCounts(items, getter) {
    const counts = new Map();
    for (const item of items) {
      const value = getter(item);
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return Array.from(counts, ([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'de'));
  }

  function getRegions(reports, modality) {
    if (!modality) return [];
    return optionCounts(reports.filter((report) => report.modality === modality), (report) => report.region);
  }

  function getThemes(reports, modality, region) {
    if (!modality || !region) return [];
    return optionCounts(
      reports.filter((report) => report.modality === modality && report.region === region),
      (report) => report.theme,
    );
  }

  function getQuestions(reports, modality, region, theme) {
    if (!modality || !region || !theme) return [];
    return optionCounts(
      reports.filter((report) => report.modality === modality && report.region === region && report.theme === theme),
      (report) => report.question,
    );
  }

  function filterReports(reports, state) {
    if (!state || !state.modality || !state.region || !state.theme || !state.question) return [];
    return reports
      .filter((report) => (
        report.modality === state.modality
        && report.region === state.region
        && report.theme === state.theme
        && report.question === state.question
      ))
      .slice()
      .sort((a, b) => (a.rank_in_group || Number.MAX_SAFE_INTEGER) - (b.rank_in_group || Number.MAX_SAFE_INTEGER)
        || a.source_row - b.source_row);
  }


  function findReferenceNormal(referenceNormals, state) {
    if (!state || !state.modality || !state.region || !state.theme || !state.question) return null;
    return (referenceNormals || []).find((item) => (
      item.modality === state.modality
      && item.region === state.region
      && item.question === state.question
    )) || null;
  }

  function composeResultSequence(reports, referenceNormals, state) {
    if (!state || !state.modality || !state.region || !state.theme || !state.question) return [];
    const originals = filterReports(reports, state);
    if (!originals.length) return [];
    const reference = findReferenceNormal(referenceNormals, state);
    return reference ? [reference, ...originals] : originals;
  }

  function searchOptions(options, query) {
    const needle = fold(query);
    if (!needle) return options.slice();
    return options.filter((option) => fold(option.value).includes(needle));
  }

  function formatCount(value) {
    return new Intl.NumberFormat('de-DE').format(Number(value) || 0);
  }

  return Object.freeze({
    fold,
    getRegions,
    getThemes,
    getQuestions,
    filterReports,
    findReferenceNormal,
    composeResultSequence,
    searchOptions,
    formatCount,
  });
}));
