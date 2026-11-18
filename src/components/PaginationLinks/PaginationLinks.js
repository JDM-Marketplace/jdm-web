import React from 'react';
import { Link } from 'react-router-dom';
import classNames from 'classnames';

import { useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { stringify } from '../../util/urlHelpers';
import { IconArrowHead, NamedLink } from '../../components';

import css from './PaginationLinks.module.css';

let pgKey = 0;
const paginationGapKey = () => {
  pgKey += 1;
  return pgKey;
};

/**
 * Returns an array containing page numbers and possible ellipsis '…' characters.
 *
 * @param {Number} page - current page
 * @param {Number} totalPages - total page count
 * @return {Array}
 */
const getPageNumbersArray = (page, totalPages) => {
  // Create array of numbers: [1, 2, 3, 4, ..., totalPages]
  const numbersFrom1ToTotalPages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return numbersFrom1ToTotalPages
    .filter(v => {
      // Filter numbers that are next to current page and pick also first and last page
      // E.g. [1, 4, 5, 6, 9], where current page = 5 and totalPages = 9.
      return v === 1 || Math.abs(v - page) <= 1 || v === totalPages;
    })
    .reduce((newArray, p) => {
      // Create a new array where gaps between consecutive numbers is filled with ellipsis character
      // E.g. [1, '…', 4, 5, 6, '…', 9], where current page = 5 and totalPages = 9.
      const isFirstPageOrNextToCurrentPage = p === 1 || newArray[newArray.length - 1] + 1 === p;
      return isFirstPageOrNextToCurrentPage ? newArray.concat([p]) : newArray.concat(['\u2026', p]);
    }, []);
};

/**
 * Link to one page: a named route with ?page=N, or the URL from `getPageLink` when the page
 * builds its own page URLs (e.g. /jdm-cars/page-2/ on the SEO search pages).
 */
const PageLink = props => {
  const {
    page,
    pageName,
    pagePathParams,
    pageSearchParams,
    getPageLink,
    ariaLabel,
    ...rest
  } = props;
  return getPageLink ? (
    <Link to={getPageLink(page, pageSearchParams)} aria-label={ariaLabel} {...rest} />
  ) : (
    <NamedLink
      name={pageName}
      params={pagePathParams}
      to={{ search: stringify({ ...pageSearchParams, page }) }}
      ariaLabel={ariaLabel}
      {...rest}
    />
  );
};

/**
 * Component that renders "Previous page" and "Next page" pagination
 * links of the given page component with the given pagination
 * information.
 *
 * The links will be disabled when no previous/next page exists.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.rootClassName] - Custom class that overrides the default class for the root element
 * @param {string} props.pageName - The name of the page
 * @param {object} props.pagePathParams - The path parameters for the page route
 * @param {object} props.pageSearchParams - The search parameters for the page route
 * @param {propTypes.pagination} props.pagination - The pagination information
 * @param {Function} [props.getPageLink] - (page, pageSearchParams) => URL, replaces the named route links
 * @returns {JSX.Element}
 */
export const PaginationLinks = props => {
  const intl = useIntl();
  const {
    className,
    rootClassName,
    pageName,
    pagePathParams = {},
    pageSearchParams = {},
    pagination,
    getPageLink,
    compact = false,
    'aria-label': ariaLabel,
  } = props;
  const linkProps = { pageName, pagePathParams, pageSearchParams, getPageLink };
  const classes = classNames(rootClassName || css.root, className);

  const { page, totalPages, paginationLimit, paginationUnsupported } = pagination;
  const hasPaginationLimit = !!paginationLimit;
  const pageCountLimit = paginationUnsupported
    ? 1
    : hasPaginationLimit
    ? paginationLimit
    : totalPages;
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < pageCountLimit ? page + 1 : null;

  // JDM search page (Miro): "‹ Back   Page 1 of 12   Next ›"
  if (compact) {
    const backContent = (
      <>
        <IconArrowHead direction="left" size="small" rootClassName={css.compactIcon} />
        {intl.formatMessage({ id: 'PaginationLinks.back' })}
      </>
    );
    const nextContent = (
      <>
        {intl.formatMessage({ id: 'PaginationLinks.nextPage' })}
        <IconArrowHead direction="right" size="small" rootClassName={css.compactIcon} />
      </>
    );
    return (
      <nav className={classNames(css.compactRoot, className)} aria-label={ariaLabel}>
        {prevPage ? (
          <PageLink {...linkProps} page={prevPage} className={css.compactBack} rel="prev">
            {backContent}
          </PageLink>
        ) : (
          <span className={classNames(css.compactBack, css.compactDisabled)} aria-hidden="true">
            {backContent}
          </span>
        )}
        <span className={css.compactStatus}>
          {intl.formatMessage(
            { id: 'PaginationLinks.pageOf' },
            { page, totalPages: pageCountLimit }
          )}
        </span>
        {nextPage ? (
          <PageLink {...linkProps} page={nextPage} className={css.compactNext} rel="next">
            {nextContent}
          </PageLink>
        ) : (
          <span className={classNames(css.compactNext, css.compactDisabled)} aria-hidden="true">
            {nextContent}
          </span>
        )}
      </nav>
    );
  }

  /* Arrow links: to previous page */
  const prevLinkEnabled = (
    <PageLink
      {...linkProps}
      page={prevPage}
      className={css.prev}
      title={intl.formatMessage({ id: 'PaginationLinks.previous' })}
      ariaLabel={intl.formatMessage({ id: 'PaginationLinks.previous' })}
    >
      <IconArrowHead direction="left" size="big" rootClassName={css.arrowIcon} />
    </PageLink>
  );

  const prevLinkDisabled = (
    <div className={css.prev}>
      <IconArrowHead
        direction="left"
        size="big"
        rootClassName={classNames(css.arrowIcon, css.disabled)}
      />
    </div>
  );

  /* Arrow links: to next page */
  const nextLinkEnabled = (
    <PageLink
      {...linkProps}
      page={nextPage}
      className={css.next}
      title={intl.formatMessage({ id: 'PaginationLinks.next' })}
      ariaLabel={intl.formatMessage({ id: 'PaginationLinks.next' })}
    >
      <IconArrowHead direction="right" size="big" rootClassName={css.arrowIcon} />
    </PageLink>
  );

  const nextLinkDisabled = (
    <div className={css.next}>
      <IconArrowHead
        direction="right"
        size="big"
        rootClassName={classNames(css.arrowIcon, css.disabled)}
      />
    </div>
  );

  /* Numbered pagination links */

  const pageNumbersNavLinks = getPageNumbersArray(page, pageCountLimit).map(v => {
    const isCurrentPage = v === page;
    const pageClassNames = classNames(css.toPageLink, { [css.currentPage]: isCurrentPage });
    return typeof v === 'number' ? (
      <li key={v} className={css.pageNumberListItem}>
        <PageLink
          {...linkProps}
          page={v}
          className={pageClassNames}
          title={intl.formatMessage({ id: 'PaginationLinks.toPage' }, { page: v })}
          ariaLabel={intl.formatMessage({ id: 'PaginationLinks.toPage' }, { page: v })}
        >
          {v}
        </PageLink>
      </li>
    ) : (
      <li
        key={`pagination_gap_${paginationGapKey()}`}
        className={classNames(css.pageNumberListItem, css.paginationGap)}
        aria-hidden="true"
      >
        {v}
      </li>
    );
  });

  // Using 'justify-content: space-between' we can deal with very narrow mobile screens.
  // However, since the length of pageNumberList can vary up to 7,
  // we need to keep track of how much space is allocated for the list
  // Maximum length of pageNumbersNavLinks is 7 (e.g. [1, '…', 4, 5, 6, '…', 9])
  const pageNumberListClassNames = classNames(
    css.pageNumberList,
    css[`pageNumberList${pageNumbersNavLinks.length}Items`]
  );

  return (
    <nav className={classes}>
      {prevPage ? prevLinkEnabled : prevLinkDisabled}
      <ul className={pageNumberListClassNames}>{pageNumbersNavLinks}</ul>
      {nextPage ? nextLinkEnabled : nextLinkDisabled}
    </nav>
  );
};

export default PaginationLinks;
