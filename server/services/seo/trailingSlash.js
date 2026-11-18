/**
 * Client's canonicalisation rule: SEO search pages always end with a slash, and URLs without it
 * redirect permanently (/jdm-cars/honda => /jdm-cars/honda/).
 *
 * Keep the roots in sync with src/util/jdmSearchUrls.js (categories and STATE_SEGMENTS).
 */
const SEO_ROOTS = [
  'jdm-cars',
  'jdm-parts',
  'vic',
  'nsw',
  'wa',
  'qld',
  'act',
  'sa',
  'nt',
  'tas',
  'int',
];

// /jdm-cars, /jdm-cars/nissan/silvia/vic/page-2 ... at most 5 segments, without a trailing slash
const SEO_PATH_WITHOUT_SLASH = new RegExp(`^/(${SEO_ROOTS.join('|')})(/[^/]+){0,4}$`);

/**
 * Returns the URL with a trailing slash for an SEO path that has none, or null.
 *
 * @param {string} url request URL (path and query string)
 * @returns {string|null}
 */
const trailingSlashUrl = url => {
  const [path, ...query] = url.split('?');
  if (!SEO_PATH_WITHOUT_SLASH.test(path)) {
    return null;
  }
  return query.length > 0 ? `${path}/?${query.join('?')}` : `${path}/`;
};

/**
 * Express middleware: 301 to the trailing slash version of SEO paths.
 */
const redirectToTrailingSlash = (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }
  const target = trailingSlashUrl(req.url);
  return target ? res.redirect(301, target) : next();
};

module.exports = { trailingSlashUrl, redirectToTrailingSlash };
