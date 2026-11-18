import React, { useMemo } from 'react';
import { Redirect, useHistory, useLocation } from 'react-router-dom';

import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';

import { useIntl } from '../../util/reactIntl';
import {
  isErrorNoViewingPermission,
  isErrorUserPendingApproval,
  isForbiddenError,
} from '../../util/errors';
import {
  NO_ACCESS_PAGE_USER_PENDING_APPROVAL,
  NO_ACCESS_PAGE_VIEW_LISTINGS,
} from '../../util/urlHelpers';
import { hasPermissionToViewData, isUserAuthorized } from '../../util/userHelpers';
import { jdmSeoUrlForSearch } from '../../util/jdmSearchUrls';

import { NamedRedirect } from '../../components';

/**
 * Shared access gating for SearchPage variants: forbidden, private marketplace,
 * pending approval, and no viewing rights. Injects router/context props into the page component.
 *
 * @param {Object} props
 * @param {React.ComponentType} props.PageComponent - Search page class receiving injected props
 * @param {Object} props - Remaining props from Redux `connect`
 * @returns {JSX.Element}
 */
const SearchPageAccessWrapper = ({ PageComponent, ...rest }) => {
  const config = useConfiguration();
  const routeConfiguration = useRouteConfiguration();
  const intl = useIntl();
  const routerHistory = useHistory();
  const routerLocation = useLocation();

  // SEO search pages (JdmSeoSearchPage) pass their own /s location and a history that maps
  // /s links to SEO URLs
  const { jdmSeo } = rest;
  const location = rest.location || routerLocation;
  const history = useMemo(
    () => (jdmSeo?.createHistory ? jdmSeo.createHistory(routerHistory) : routerHistory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routerHistory, !!jdmSeo]
  );

  // /s searches that have an SEO page (a category or a state) live at that page
  const seoUrl =
    !jdmSeo && location.pathname === '/s'
      ? jdmSeoUrlForSearch(location.search, config.listing?.listingFields)
      : null;
  if (seoUrl) {
    if (rest.staticContext) {
      // Read by server/index.js: SEO redirects are permanent
      rest.staticContext.status = 301;
    }
    return <Redirect to={seoUrl} />;
  }

  const searchListingsError = rest.searchListingsError;
  if (isForbiddenError(searchListingsError)) {
    return (
      <NamedRedirect
        name="SignupPage"
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  const { currentUser, ...restOfProps } = rest;
  const isPrivateMarketplace = config.accessControl.marketplace.private === true;
  const isUnauthorizedUser = currentUser && !isUserAuthorized(currentUser);
  const hasNoViewingRightsUser = currentUser && !hasPermissionToViewData(currentUser);
  const hasUserPendingApprovalError = isErrorUserPendingApproval(searchListingsError);
  const hasNoViewingRightsError = isErrorNoViewingPermission(searchListingsError);

  if ((isPrivateMarketplace && isUnauthorizedUser) || hasUserPendingApprovalError) {
    return (
      <NamedRedirect
        name="NoAccessPage"
        params={{ missingAccessRight: NO_ACCESS_PAGE_USER_PENDING_APPROVAL }}
      />
    );
  }
  if (hasNoViewingRightsUser || hasNoViewingRightsError) {
    return (
      <NamedRedirect
        name="NoAccessPage"
        params={{ missingAccessRight: NO_ACCESS_PAGE_VIEW_LISTINGS }}
      />
    );
  }

  return (
    <PageComponent
      config={config}
      routeConfiguration={routeConfiguration}
      intl={intl}
      history={history}
      location={location}
      currentUser={currentUser}
      {...restOfProps}
    />
  );
};

export default SearchPageAccessWrapper;
