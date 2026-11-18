/**
 * SEO URLs for JDM search pages (client sheet "MVP.xlsx": URL mapping and canonicalisation rules).
 *
 *   /jdm-cars/                        category "jdm-cars"
 *   /jdm-cars/{make}/                 + make, e.g. /jdm-cars/nissan/ ("other" make => /jdm-cars/other-models/)
 *   /jdm-cars/{make}/{model}/         + model, e.g. /jdm-cars/nissan/silvia/ (model id "nissan-silvia")
 *   /jdm-parts/                       category "jdm-parts"
 *   /jdm-parts/{partMake}/            + part make, e.g. /jdm-parts/universal/
 *   /{state}/                         state only, cars and parts, e.g. /vic/ or /int/ (overseas)
 *
 * A single state is always the last filter segment of car and part paths: /jdm-cars/vic/,
 * /jdm-cars/nissan/vic/, /jdm-cars/nissan/silvia/vic/, /jdm-parts/vic/, /jdm-parts/universal/vic/.
 * Make, model and part make ids never equal a state id. Several states stay in the query string.
 *
 * Each path can end with /page-{n}/ when no other filters are set. With other filters, they stay
 * in the query string (?pub_transmission=manual&page=2) and the canonical URL is the path without
 * them. All SEO paths end with a trailing slash.
 *
 * Option ids come from the listing fields in Console, so new makes, models and part makes get
 * URLs without code changes.
 */
import {
  MAKE_FIELD_KEY,
  MODEL_FIELD_KEY,
  OTHER_MAKE_ID,
  PART_MAKE_FIELD_KEY,
  STATE_FIELD_KEY,
  findListingField,
} from './jdmFields';
import { parse, stringify } from './urlHelpers';

export const CARS_CATEGORY_ID = 'jdm-cars';
export const PARTS_CATEGORY_ID = 'jdm-parts';

// The search schema for categories is fixed to categoryLevel1..3 (see configHelpers.js)
export const CATEGORY_PARAM = 'pub_categoryLevel1';
const MAKE_PARAM = `pub_${MAKE_FIELD_KEY}`;
const MODEL_PARAM = `pub_${MODEL_FIELD_KEY}`;
const PART_MAKE_PARAM = `pub_${PART_MAKE_FIELD_KEY}`;
const STATE_PARAM = `pub_${STATE_FIELD_KEY}`;

// The "Others" make is shown at /jdm-cars/other-models/
const OTHER_MAKE_SEGMENT = 'other-models';
export const OTHER_MODELS_SUFFIX = 'other-models';
export const OTHER_PARTS_ID = 'other-parts';
export const UNIVERSAL_PARTS_ID = 'universal';

// Location pages, one per state option. Routes are generated from this list.
export const STATE_SEGMENTS = ['vic', 'nsw', 'wa', 'qld', 'act', 'sa', 'nt', 'tas', 'int'];

export const SEO_TYPE_CARS = 'cars';
export const SEO_TYPE_PARTS = 'parts';
export const SEO_TYPE_STATE = 'state';

const PAGE_SEGMENT_RE = /^page-(\d+)$/;

const optionsOf = (listingFields, key) => findListingField(listingFields, key)?.enumOptions || [];
const findOption = (listingFields, key, id) =>
  id == null ? null : optionsOf(listingFields, key).find(o => `${o.option}` === `${id}`) || null;

/** A single filter value: "nissan" counts, "nissan,toyota" (has_any search) does not. */
const singleValue = value => {
  const str = value == null ? '' : `${value}`;
  return str && !str.includes(',') ? str : null;
};

const makeToSegment = make => (make === OTHER_MAKE_ID ? OTHER_MAKE_SEGMENT : make);
const segmentToMake = segment => (segment === OTHER_MAKE_SEGMENT ? OTHER_MAKE_ID : segment);

/** "nissan-silvia" => "silvia" for make "nissan"; null when the model belongs to another make. */
const modelToSegment = (make, model) =>
  model && model.startsWith(`${make}-`) ? model.slice(make.length + 1) : null;

const toPath = segments => `/${segments.join('/')}/`;

const parsePageNumber = value => {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
};

/**
 * Splits path segments into filter segments and a page number.
 * "page-1" is valid but not canonical (the URL without it is), "page-0" is invalid.
 */
const splitPageSegment = segments => {
  const last = segments[segments.length - 1];
  const match = last ? PAGE_SEGMENT_RE.exec(last) : null;
  if (!match) {
    return { filterSegments: segments, page: 1, hasPageSegment: false };
  }
  const page = Number.parseInt(match[1], 10);
  return {
    filterSegments: segments.slice(0, -1),
    page: page > 0 ? page : null,
    hasPageSegment: true,
  };
};

/** The enum option of a single state that has a location page, or null. */
const findStateOption = (listingFields, value) => {
  const id = singleValue(value);
  return STATE_SEGMENTS.includes(id) ? findOption(listingFields, STATE_FIELD_KEY, id) : null;
};

/**
 * Takes a trailing state segment off car and part paths (/jdm-cars/nissan/vic/).
 * Returns null when the segment is a state id that isn't in Console, which gives a 404.
 */
const splitStateSegment = (segments, listingFields) => {
  const last = segments[segments.length - 1];
  if (!STATE_SEGMENTS.includes(last)) {
    return { segments, state: null };
  }
  const state = findOption(listingFields, STATE_FIELD_KEY, last);
  return state ? { segments: segments.slice(0, -1), state } : null;
};

const stateFilterMaybe = state => (state ? { [STATE_PARAM]: state.option } : {});

/**
 * Reads an SEO search path.
 *
 * @param {string} root first path segment: "jdm-cars", "jdm-parts" or a state id
 * @param {Array<string>} segments the path segments after the root (may end with "page-N")
 * @param {Array<Object>} listingFields config.listing.listingFields
 * @returns {Object|null} null when the path does not exist (unknown make, model, page...), else
 *   { type, filters, page, make, model, partMake, state } where filters are search params and
 *   make/model/partMake/state are the matched enum options ({ option, label })
 */
export const parseJdmSeoPath = (root, segments = [], listingFields = []) => {
  const { filterSegments, page } = splitPageSegment(segments.filter(Boolean));
  if (page == null) {
    return null;
  }

  const isCategoryRoot = root === CARS_CATEGORY_ID || root === PARTS_CATEGORY_ID;
  const withState = isCategoryRoot ? splitStateSegment(filterSegments, listingFields) : null;
  if (isCategoryRoot && !withState) {
    return null;
  }

  if (root === CARS_CATEGORY_ID) {
    const { segments: carSegments, state } = withState;
    const [makeSegment, modelSegment, ...extra] = carSegments;
    if (extra.length > 0) {
      return null;
    }
    const make = makeSegment
      ? findOption(listingFields, MAKE_FIELD_KEY, segmentToMake(makeSegment))
      : null;
    if (makeSegment && (!make || makeSegment !== makeToSegment(make.option))) {
      return null;
    }
    const model = modelSegment
      ? findOption(listingFields, MODEL_FIELD_KEY, `${make.option}-${modelSegment}`)
      : null;
    if (modelSegment && (!model || make.option === OTHER_MAKE_ID)) {
      return null;
    }
    return {
      type: SEO_TYPE_CARS,
      page,
      make,
      model,
      state,
      filters: {
        [CATEGORY_PARAM]: CARS_CATEGORY_ID,
        ...(make ? { [MAKE_PARAM]: make.option } : {}),
        ...(model ? { [MODEL_PARAM]: model.option } : {}),
        ...stateFilterMaybe(state),
      },
    };
  }

  if (root === PARTS_CATEGORY_ID) {
    const { segments: partSegments, state } = withState;
    const [partMakeSegment, ...extra] = partSegments;
    if (extra.length > 0) {
      return null;
    }
    const partMake = partMakeSegment
      ? findOption(listingFields, PART_MAKE_FIELD_KEY, partMakeSegment)
      : null;
    if (partMakeSegment && !partMake) {
      return null;
    }
    return {
      type: SEO_TYPE_PARTS,
      page,
      partMake,
      state,
      filters: {
        [CATEGORY_PARAM]: PARTS_CATEGORY_ID,
        ...(partMake ? { [PART_MAKE_PARAM]: partMake.option } : {}),
        ...stateFilterMaybe(state),
      },
    };
  }

  if (STATE_SEGMENTS.includes(root)) {
    // The state must also exist in Console, so a removed state option gives a 404
    const state = findOption(listingFields, STATE_FIELD_KEY, root);
    if (!state || filterSegments.length > 0) {
      return null;
    }
    return { type: SEO_TYPE_STATE, page, state, filters: { [STATE_PARAM]: state.option } };
  }

  return null;
};

/**
 * Builds the SEO URL for search params, or returns null when they have no SEO page (no category
 * and no single state, e.g. a keyword search), in which case the template's /s page is used.
 *
 * Path filters are taken out of the query string. Values that don't match the path (a model of
 * another make, a car make on a parts page) are dropped, because they would match nothing.
 *
 * @param {Object} searchParams search params as in the /s query string, page included
 * @param {Array<Object>} listingFields config.listing.listingFields
 * @returns {{ pathname: string, searchParams: Object, page: number } | null}
 */
export const jdmSeoLocationFromSearchParams = (searchParams = {}, listingFields = []) => {
  const {
    [CATEGORY_PARAM]: categoryParam,
    [MAKE_PARAM]: makeParam,
    [MODEL_PARAM]: modelParam,
    [PART_MAKE_PARAM]: partMakeParam,
    [STATE_PARAM]: stateParam,
    page: pageParam,
    ...otherParams
  } = searchParams;
  const page = parsePageNumber(pageParam);
  // Make and model are car fields and part make a parts field, so they imply the category
  // (e.g. the landing page's /s?pub_make=nissan is /jdm-cars/nissan/)
  const category =
    categoryParam != null
      ? categoryParam
      : makeParam != null || modelParam != null
      ? CARS_CATEGORY_ID
      : partMakeParam != null
      ? PARTS_CATEGORY_ID
      : null;

  let segments = null;
  let rest = otherParams;
  const state = findStateOption(listingFields, stateParam);
  // Car and part pages: a single state goes last in the path, several stay as a filter
  const stateSegmentOrFilter = () => {
    if (state) {
      segments.push(state.option);
    } else if (stateParam != null) {
      rest = { ...rest, [STATE_PARAM]: stateParam };
    }
  };

  if (category === CARS_CATEGORY_ID) {
    const modelId = singleValue(modelParam);
    // A model id starts with its make id, so a model alone is enough to find the make
    const makeFromModel = modelId
      ? optionsOf(listingFields, MAKE_FIELD_KEY).find(o => modelId.startsWith(`${o.option}-`))
      : null;
    const make = findOption(listingFields, MAKE_FIELD_KEY, singleValue(makeParam)) || makeFromModel;
    const model =
      make && make.option !== OTHER_MAKE_ID
        ? findOption(listingFields, MODEL_FIELD_KEY, modelId)
        : null;
    const modelSegment = model ? modelToSegment(make.option, model.option) : null;

    segments = [CARS_CATEGORY_ID];
    if (make) {
      segments.push(makeToSegment(make.option));
    } else if (makeParam != null) {
      // Several makes: keep them as a filter
      rest = { ...rest, [MAKE_PARAM]: makeParam };
    }
    if (modelSegment) {
      segments.push(modelSegment);
    } else if (modelParam != null && !make) {
      rest = { ...rest, [MODEL_PARAM]: modelParam };
    }
    stateSegmentOrFilter();
  } else if (category === PARTS_CATEGORY_ID) {
    const partMake = findOption(listingFields, PART_MAKE_FIELD_KEY, singleValue(partMakeParam));
    segments = [PARTS_CATEGORY_ID];
    if (partMake) {
      segments.push(partMake.option);
    } else if (partMakeParam != null) {
      rest = { ...rest, [PART_MAKE_PARAM]: partMakeParam };
    }
    stateSegmentOrFilter();
  } else if (category == null) {
    if (!state) {
      return null;
    }
    segments = [state.option];
  } else {
    // Unknown or nested category
    return null;
  }

  const restParams = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value != null && value !== '')
  );
  const hasOtherFilters = Object.keys(restParams).length > 0;
  // /page-2/ only on unfiltered pages, filtered pages keep the page in the query string
  const pageSegment = page > 1 && !hasOtherFilters ? [`page-${page}`] : [];
  const pageParamMaybe = page > 1 && hasOtherFilters ? { page } : {};

  return {
    pathname: toPath([...segments, ...pageSegment]),
    searchParams: { ...restParams, ...pageParamMaybe },
    page,
  };
};

/**
 * The SEO path of a page number, used by the pagination links of an SEO search page.
 *
 * @param {string} basePath the SEO path without page, e.g. "/jdm-cars/nissan/"
 * @param {number} page
 * @returns {string}
 */
export const jdmSeoPagePath = (basePath, page) =>
  page > 1 ? `${basePath}page-${page}/` : basePath;

/**
 * Canonical path of an SEO search page: filtered URLs point to the page without the filters and
 * the page number; unfiltered paginated URLs (/jdm-cars/page-2/) point to themselves.
 *
 * @param {string} pathname
 * @param {string} search location.search
 * @returns {string}
 */
export const jdmSeoCanonicalPath = (pathname, search) => {
  const withSlash = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const hasQuery = !!search && search !== '?';
  return hasQuery ? withSlash.replace(/page-\d+\/$/, '') : withSlash;
};

/**
 * The path of an SEO search page without its page number.
 *
 * @param {Object} parsed result of parseJdmSeoPath
 * @returns {string}
 */
export const jdmSeoBasePath = parsed => {
  const { type, make, model, partMake, state } = parsed;
  const stateSegment = state ? [state.option] : [];
  if (type === SEO_TYPE_CARS) {
    const segments = [CARS_CATEGORY_ID];
    if (make) {
      segments.push(makeToSegment(make.option));
    }
    if (model) {
      segments.push(modelToSegment(make.option, model.option));
    }
    return toPath([...segments, ...stateSegment]);
  }
  if (type === SEO_TYPE_PARTS) {
    const segments = partMake ? [PARTS_CATEGORY_ID, partMake.option] : [PARTS_CATEGORY_ID];
    return toPath([...segments, ...stateSegment]);
  }
  return toPath(stateSegment);
};

const isOtherModels = model => `${model?.option}`.endsWith(`-${OTHER_MODELS_SUFFIX}`);

/**
 * Meta title, description, heading and breadcrumbs of an SEO search page (patterns from the sheet).
 * Car and part pages with a state use the same pattern with "in Australia" replaced by the state
 * ("JdmSeo.carsMakeState": "{make} JDM Cars for sale {location}") and end with a state crumb.
 *
 * @param {Object} parsed result of parseJdmSeoPath
 * @param {Object} intl
 * @param {string} marketplaceName
 * @returns {{ title: string, description: string, heading: string, breadcrumbs: Array<{ label: string, path: string }> }}
 */
export const jdmSeoPageMeta = (parsed, intl, marketplaceName) => {
  const { type, page, make, model, partMake, state } = parsed;
  const msg = (id, values = {}) => intl.formatMessage({ id: `JdmSeo.${id}` }, values);
  const home = { label: msg('breadcrumbHome'), path: '/' };
  const cars = { label: msg('breadcrumbCars'), path: toPath([CARS_CATEGORY_ID]) };
  const parts = { label: msg('breadcrumbParts'), path: toPath([PARTS_CATEGORY_ID]) };
  // Crumbs before the state one point to the page without the state
  const withoutState = { ...parsed, state: null };

  let key;
  let values = {};
  let breadcrumbs;

  if (type === SEO_TYPE_CARS && model) {
    key = isOtherModels(model) ? 'carsOtherModels' : 'carsModel';
    values = { make: make.label, model: model.label };
    breadcrumbs = [
      home,
      cars,
      { label: make.label, path: toPath([CARS_CATEGORY_ID, makeToSegment(make.option)]) },
      { label: model.label, path: jdmSeoBasePath(withoutState) },
    ];
  } else if (type === SEO_TYPE_CARS && make) {
    key = make.option === OTHER_MAKE_ID ? 'carsOtherMake' : 'carsMake';
    values = { make: make.label };
    const crumb = make.option === OTHER_MAKE_ID ? msg('breadcrumbOtherModels') : make.label;
    breadcrumbs = [home, cars, { label: crumb, path: jdmSeoBasePath(withoutState) }];
  } else if (type === SEO_TYPE_CARS) {
    key = 'cars';
    breadcrumbs = [home, cars];
  } else if (type === SEO_TYPE_PARTS && partMake) {
    const id = partMake.option;
    key =
      id === OTHER_PARTS_ID
        ? 'partsOther'
        : id === UNIVERSAL_PARTS_ID
        ? 'partsUniversal'
        : 'partsMake';
    values = { make: partMake.label };
    const crumb =
      id === OTHER_PARTS_ID ? partMake.label : msg('breadcrumbPartsMake', { make: partMake.label });
    breadcrumbs = [home, parts, { label: crumb, path: jdmSeoBasePath(withoutState) }];
  } else if (type === SEO_TYPE_PARTS) {
    key = 'parts';
    breadcrumbs = [home, parts];
  } else {
    key = `state.${state.option}`;
    breadcrumbs = [home];
  }

  const stateCrumb = state
    ? [{ label: msg(`state.${state.option}.breadcrumb`), path: jdmSeoBasePath(parsed) }]
    : [];
  const isCategoryWithState = !!state && type !== SEO_TYPE_STATE;
  const messageKey = isCategoryWithState ? `${key}State` : key;
  const messageValues = isCategoryWithState
    ? { ...values, location: msg(`location.${state.option}`) }
    : values;

  const heading = msg(`${messageKey}.heading`, messageValues);
  const pageSuffix = page > 1 ? msg('pageSuffix', { page }) : '';
  const title = msg('title', { heading, pageSuffix, marketplaceName });
  const baseDescription = msg(`${messageKey}.description`, messageValues);
  const description =
    page > 1 ? msg('descriptionWithPage', { description: baseDescription, page }) : baseDescription;

  return { title, description, heading, breadcrumbs: [...breadcrumbs, ...stateCrumb] };
};

const LAT_LNG_OPTIONS = { latlng: ['origin'], latlngBounds: ['bounds'] };

/**
 * Path segments of an SEO route (/jdm-cars/:s1/:s2/:s3/:s4).
 *
 * @param {Object} params route params
 * @returns {Array<string>}
 */
export const jdmSeoSegmentsFromParams = (params = {}) =>
  [params.s1, params.s2, params.s3, params.s4].filter(Boolean);

/**
 * Search params of the template's /s page for an SEO page: the query string filters with the path
 * filters (category, make...) and the page number on top.
 *
 * @param {Object} parsed result of parseJdmSeoPath
 * @param {string} search location.search
 * @returns {Object}
 */
export const jdmSeoSearchParams = (parsed, search) => {
  const { page: queryPage, ...queryParams } = parse(search, LAT_LNG_OPTIONS);
  const page = parsed.page > 1 ? parsed.page : queryPage;
  return { ...queryParams, ...parsed.filters, ...(page ? { page } : {}) };
};

/**
 * URL of an SEO location.
 *
 * @param {{ pathname: string, searchParams: Object }} seoLocation
 * @returns {string}
 */
export const jdmSeoUrl = ({ pathname, searchParams }) => {
  const search = stringify(searchParams);
  return search ? `${pathname}?${search}` : pathname;
};

/**
 * The SEO URL of a /s URL, or null when the search has no SEO page.
 *
 * @param {string} search location.search of the /s page
 * @param {Array<Object>} listingFields config.listing.listingFields
 * @returns {string|null}
 */
export const jdmSeoUrlForSearch = (search, listingFields) => {
  const seoLocation = jdmSeoLocationFromSearchParams(parse(search, LAT_LNG_OPTIONS), listingFields);
  return seoLocation ? jdmSeoUrl(seoLocation) : null;
};
