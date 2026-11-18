import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import classNames from 'classnames';

import { useConfiguration } from '../../../../context/configurationContext';
import { useRouteConfiguration } from '../../../../context/routeConfigurationContext';
import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { createResourceLocatorString } from '../../../../util/routes';
import {
  MAKE_FIELD_KEY,
  MODEL_FIELD_KEY,
  STATE_FIELD_KEY,
  findListingField,
  modelOptionsForMake,
} from '../../../../util/jdmFields';

import css from './HeroListingSearch.module.css';

// Price ranges in whole dollars. The search page reads them as `price=min,max`.
const PRICE_RANGES = [
  { id: 'under-10k', min: 0, max: 10000 },
  { id: '10k-20k', min: 10000, max: 20000 },
  { id: '20k-50k', min: 20000, max: 50000 },
  { id: '50k-100k', min: 50000, max: 100000 },
  { id: 'over-100k', min: 100000, max: null },
];

const SelectField = props => {
  const { id, label, value, onChange, disabled, children } = props;
  return (
    <div className={classNames(css.field, { [css.fieldDisabled]: disabled })}>
      <label htmlFor={id} className={css.label}>
        {label}
      </label>
      <select
        id={id}
        className={css.select}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </div>
  );
};

/**
 * Make / Model / Location / Price search shown in the landing page hero.
 * Options come from the listing fields configured in Console.
 *
 * @component
 * @returns {JSX.Element}
 */
const HeroListingSearch = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const routeConfiguration = useRouteConfiguration();
  const history = useHistory();

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [state, setState] = useState('');
  const [priceRange, setPriceRange] = useState('');

  const listingFields = config.listing?.listingFields || [];
  const makeOptions = findListingField(listingFields, MAKE_FIELD_KEY)?.enumOptions || [];
  const allModelOptions = findListingField(listingFields, MODEL_FIELD_KEY)?.enumOptions || [];
  const stateOptions = findListingField(listingFields, STATE_FIELD_KEY)?.enumOptions || [];
  const modelOptions = modelOptionsForMake(allModelOptions, make);

  const handleSubmit = e => {
    e.preventDefault();
    const range = PRICE_RANGES.find(r => r.id === priceRange);
    // "Over $100,000" has no upper limit: use the price filter's max from Console.
    const priceFilterMax =
      config.search?.defaultFilters?.find(f => f.schemaType === 'price')?.max || 1000000;
    const searchParams = {
      ...(make ? { [`pub_${MAKE_FIELD_KEY}`]: make } : {}),
      ...(model ? { [`pub_${MODEL_FIELD_KEY}`]: model } : {}),
      ...(state ? { [`pub_${STATE_FIELD_KEY}`]: state } : {}),
      ...(range ? { price: `${range.min},${range.max ?? priceFilterMax}` } : {}),
    };
    history.push(createResourceLocatorString('SearchPage', routeConfiguration, {}, searchParams));
  };

  const formatPrice = value =>
    intl.formatNumber(value, {
      style: 'currency',
      currency: config.currency || 'AUD',
      maximumFractionDigits: 0,
    });
  const priceRangeLabel = range =>
    range.max == null
      ? intl.formatMessage({ id: 'HeroListingSearch.priceOver' }, { min: formatPrice(range.min) })
      : range.min === 0
      ? intl.formatMessage({ id: 'HeroListingSearch.priceUnder' }, { max: formatPrice(range.max) })
      : intl.formatMessage(
          { id: 'HeroListingSearch.priceBetween' },
          { min: formatPrice(range.min), max: formatPrice(range.max) }
        );

  return (
    <form
      className={css.root}
      onSubmit={handleSubmit}
      role="search"
      aria-label={intl.formatMessage({ id: 'HeroListingSearch.ariaLabel' })}
    >
      <SelectField
        id="hero-search-make"
        label={intl.formatMessage({ id: 'HeroListingSearch.makeLabel' })}
        value={make}
        onChange={value => {
          setMake(value);
          // Models belong to one make
          if (model && !model.startsWith(`${value}-`)) {
            setModel('');
          }
        }}
      >
        <option value="">{intl.formatMessage({ id: 'HeroListingSearch.allMakes' })}</option>
        {makeOptions.map(o => (
          <option key={o.option} value={o.option}>
            {o.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="hero-search-model"
        label={intl.formatMessage({ id: 'HeroListingSearch.modelLabel' })}
        value={model}
        onChange={setModel}
        disabled={!make}
      >
        <option value="">
          {intl.formatMessage({
            id: make ? 'HeroListingSearch.allModels' : 'HeroListingSearch.selectMakeFirst',
          })}
        </option>
        {modelOptions.map(o => (
          <option key={o.option} value={o.option}>
            {o.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="hero-search-state"
        label={intl.formatMessage({ id: 'HeroListingSearch.locationLabel' })}
        value={state}
        onChange={setState}
      >
        <option value="">{intl.formatMessage({ id: 'HeroListingSearch.allStates' })}</option>
        {stateOptions.map(o => (
          <option key={o.option} value={o.option}>
            {o.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="hero-search-price"
        label={intl.formatMessage({ id: 'HeroListingSearch.priceLabel' })}
        value={priceRange}
        onChange={setPriceRange}
      >
        <option value="">{intl.formatMessage({ id: 'HeroListingSearch.anyPrice' })}</option>
        {PRICE_RANGES.map(range => (
          <option key={range.id} value={range.id}>
            {priceRangeLabel(range)}
          </option>
        ))}
      </SelectField>

      <button type="submit" className={css.submit}>
        <FormattedMessage id="HeroListingSearch.submit" />
      </button>
    </form>
  );
};

export default HeroListingSearch;
