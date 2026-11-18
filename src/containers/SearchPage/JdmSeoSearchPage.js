import React, { useMemo } from 'react';
import { Redirect } from 'react-router-dom';
import isEqual from 'lodash/isEqual';

import { useConfiguration } from '../../context/configurationContext';
import { useIntl } from '../../util/reactIntl';
import { parse, stringify } from '../../util/urlHelpers';
import {
  jdmSeoLocationFromSearchParams,
  jdmSeoPageMeta,
  jdmSeoSearchParams,
  jdmSeoSegmentsFromParams,
  jdmSeoUrl,
  jdmSeoUrlForSearch,
  parseJdmSeoPath,
} from '../../util/jdmSearchUrls';

import NotFoundPage from '../NotFoundPage/NotFoundPage';

/**
 * Turns links to the template's /s page into SEO URLs, so filter changes, sorting and resets made
 * on an SEO page go straight to the right SEO page instead of through a redirect.
 *
 * @param {Object} history React Router history
 * @param {Array<Object>} listingFields config.listing.listingFields
 * @returns {Object} history whose push and replace map /s URLs
 */
export const createJdmSeoHistory = (history, listingFields) => {
  const toSeo = to => {
    if (typeof to === 'string') {
      const url = new URL(to, 'http://localhost');
      const seoUrl = url.pathname === '/s' ? jdmSeoUrlForSearch(url.search, listingFields) : null;
      return seoUrl ? `${seoUrl}${url.hash}` : to;
    }
    const seoUrl = to?.pathname === '/s' ? jdmSeoUrlForSearch(to.search, listingFields) : null;
    if (!seoUrl) {
      return to;
    }
    const [pathname, search = ''] = seoUrl.split('?');
    return { ...to, pathname, search: search ? `?${search}` : '' };
  };
  // Everything else (location, listen...) comes from the real history
  const seoHistory = Object.create(history);
  seoHistory.push = (to, state) => history.push(toSeo(to), state);
  seoHistory.replace = (to, state) => history.replace(toSeo(to), state);
  return seoHistory;
};

/**
 * SEO search page (/jdm-cars/nissan/, /jdm-parts/, /vic/...). It renders the template's search
 * page with the path filters, as if the URL were /s?pub_categoryLevel1=jdm-cars&pub_make=nissan.
 *
 * - Unknown makes, models, part makes or pages show 404.
 * - Other URLs that are not canonical (no trailing slash, page-1, path filters in the query
 *   string) redirect (301 on the server) to the canonical SEO URL.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.params route params (s1, s2, s3)
 * @param {Object} props.location
 * @param {Object} [props.staticContext]
 * @param {string} props.seoRoot first path segment: "jdm-cars", "jdm-parts" or a state id
 * @param {React.ComponentType} props.SearchPageComponent grid or map search page
 * @returns {JSX.Element}
 */
const JdmSeoSearchPage = props => {
  const { params, location, staticContext, seoRoot, SearchPageComponent, ...rest } = props;
  const config = useConfiguration();
  const intl = useIntl();
  const listingFields = config.listing?.listingFields;
  const { pathname, search } = location;

  const parsed = useMemo(
    () => parseJdmSeoPath(seoRoot, jdmSeoSegmentsFromParams(params), listingFields),
    [seoRoot, params, listingFields]
  );
  const searchParams = useMemo(() => (parsed ? jdmSeoSearchParams(parsed, search) : null), [
    parsed,
    search,
  ]);

  // The template search page reads its filters from location: give it the matching /s location
  const searchLocation = useMemo(
    () =>
      searchParams ? { ...location, pathname: '/s', search: `?${stringify(searchParams)}` } : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.key, pathname, search, searchParams]
  );

  if (!parsed) {
    return <NotFoundPage staticContext={staticContext} />;
  }

  const canonical = jdmSeoLocationFromSearchParams(searchParams, listingFields);
  const isCanonical =
    canonical &&
    canonical.pathname === pathname &&
    isEqual(parse(stringify(canonical.searchParams)), parse(search));
  if (!isCanonical) {
    if (staticContext) {
      // Read by server/index.js: SEO redirects are permanent
      staticContext.status = 301;
    }
    return <Redirect to={canonical ? jdmSeoUrl(canonical) : `/s?${stringify(searchParams)}`} />;
  }

  const jdmSeo = {
    ...jdmSeoPageMeta(parsed, intl, config.marketplaceName),
    createHistory: history => createJdmSeoHistory(history, listingFields),
    // Page links: /page-2/ without other filters, ?page=2 with them
    getPageLink: (page, pageSearchParams = {}) =>
      jdmSeoUrl(jdmSeoLocationFromSearchParams({ ...pageSearchParams, page }, listingFields)),
  };

  return (
    <SearchPageComponent
      {...rest}
      params={{}}
      location={searchLocation}
      staticContext={staticContext}
      jdmSeo={jdmSeo}
    />
  );
};

export default JdmSeoSearchPage;
