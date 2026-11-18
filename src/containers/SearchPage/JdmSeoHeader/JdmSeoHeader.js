import React from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';

import { useIntl } from '../../../util/reactIntl';

import css from './JdmSeoHeader.module.css';

/**
 * schema.org BreadcrumbList for an SEO search page.
 *
 * @param {Array<{ label: string, path: string }>} breadcrumbs
 * @param {string} marketplaceRootURL
 * @returns {Object}
 */
export const breadcrumbListSchema = (breadcrumbs, marketplaceRootURL) => ({
  '@context': 'http://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.label,
    item: `${marketplaceRootURL}${crumb.path}`,
  })),
});

/**
 * Breadcrumbs and page heading of an SEO search page ("Home > JDM Cars > Nissan > Silvia").
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className]
 * @param {string} props.heading e.g. "Nissan Silvia for sale in Australia"
 * @param {Array<{ label: string, path: string }>} props.breadcrumbs the last one is this page
 * @returns {JSX.Element}
 */
const JdmSeoHeader = props => {
  const { className, heading, breadcrumbs = [] } = props;
  const intl = useIntl();
  const lastIndex = breadcrumbs.length - 1;

  return (
    <header className={classNames(css.root, className)}>
      <nav aria-label={intl.formatMessage({ id: 'JdmSeo.breadcrumbAriaLabel' })}>
        <ol className={css.breadcrumbs}>
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.path} className={css.crumb}>
              {index === lastIndex ? (
                <span className={css.crumbCurrent} aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.path} className={css.crumbLink}>
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <h1 className={css.heading}>{heading}</h1>
    </header>
  );
};

export default JdmSeoHeader;
