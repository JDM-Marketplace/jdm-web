import React, { useState } from 'react';

import { useIntl } from '../../../util/reactIntl';
import { IconSearch } from '../../../components';

import css from './JdmSearchFilters.module.css';

/**
 * "Quick search" box at the top of the JDM search filters: the template's keyword filter
 * (Console > Listings > Listing search > Keyword filter), submitted with Enter or the search
 * button. An empty search clears the keywords.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id
 * @param {string} [props.initialKeywords] keywords in the URL
 * @param {Function} props.onSubmit called with { keywords }
 * @returns {JSX.Element}
 */
const JdmQuickSearch = props => {
  const { id, initialKeywords = '', onSubmit } = props;
  const intl = useIntl();
  const [value, setValue] = useState(initialKeywords);
  const inputId = `${id}-input`;

  const handleSubmit = e => {
    e.preventDefault();
    const keywords = value.trim();
    onSubmit({ keywords: keywords || null });
  };

  return (
    <form className={css.quickSearch} role="search" onSubmit={handleSubmit}>
      <label className={css.visuallyHidden} htmlFor={inputId}>
        {intl.formatMessage({ id: 'JdmSearchFilters.quickSearchLabel' })}
      </label>
      <input
        id={inputId}
        className={css.quickSearchInput}
        type="search"
        name="keywords"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={intl.formatMessage({ id: 'JdmSearchFilters.quickSearchPlaceholder' })}
        autoComplete="off"
        enterKeyHint="search"
      />
      <button
        type="submit"
        className={css.quickSearchButton}
        aria-label={intl.formatMessage({ id: 'JdmSearchFilters.quickSearchSubmit' })}
      >
        <IconSearch rootClassName={css.quickSearchIcon} />
      </button>
    </form>
  );
};

export default JdmQuickSearch;
