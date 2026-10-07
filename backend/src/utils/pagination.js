// Shared page/pageSize parsing for every paginated list route. Clamps to
// sane bounds instead of erroring on a bad value — an out-of-range or
// malformed page is far more likely to be a stale bookmark/back-button than
// an attack, so it's friendlier (and no less safe) to just hand back the
// nearest valid page than to 400.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePagination(query, { defaultPageSize = DEFAULT_PAGE_SIZE, maxPageSize = MAX_PAGE_SIZE } = {}) {
  let pageSize = parseInt(query.pageSize, 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  pageSize = Math.min(pageSize, maxPageSize);

  let page = parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  return { page, pageSize };
}

// Clamps the requested page against the real total once it's known (e.g. a
// bookmarked page 9 after items were deleted down to 2 pages) and returns
// both the metadata block every paginated response includes AND the offset
// to actually query with — callers should re-run their data query with
// `offset` whenever `page` here differs from what they originally asked for.
function buildPageMeta({ page, pageSize, totalItems }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(page, totalPages);
  return { page: clampedPage, pageSize, totalItems, totalPages, offset: (clampedPage - 1) * pageSize };
}

module.exports = { parsePagination, buildPageMeta };
