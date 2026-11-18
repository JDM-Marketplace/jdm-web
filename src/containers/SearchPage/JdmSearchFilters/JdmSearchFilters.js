import React, { useState } from 'react';
import classNames from 'classnames';

import { useIntl } from '../../../util/reactIntl';
import { SCHEMA_TYPE_MULTI_ENUM } from '../../../util/types';
import { IconArrowHead } from '../../../components';

import FilterComponent from '../FilterComponent';
import JdmQuickSearch from './JdmQuickSearch';
import JdmMakeModelModal, { VIEW_MAKE, VIEW_MODEL, VIEW_PART_MAKE } from './JdmMakeModelModal';
import {
  MAKE_GROUP_KEYS,
  filterParamName,
  filterSummary,
  joinLabels,
  optionLabels,
  selectedValues,
} from './filterSummary';

import css from './JdmSearchFilters.module.css';

const KEYWORDS_KEY = 'keywords';
const STATE_KEY = 'state';

/** Query param value of an enum filter ("nissan,toyota"), or null to remove it. */
const formatEnumValue = (values, filterConfig) => {
  if (!values || values.length === 0) {
    return null;
  }
  const { schemaType, filterConfig: { searchMode } = {} } = filterConfig;
  const mode = schemaType === SCHEMA_TYPE_MULTI_ENUM && searchMode ? `${searchMode}:` : '';
  return `${mode}${values.join(',')}`;
};

/**
 * A collapsible filter row: label, the selected value in red and a chevron. Collapsed by default.
 */
const FilterRow = props => {
  const { id, label, summary, defaultOpen = false, children } = props;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;
  return (
    <div className={css.row}>
      <h3 className={css.rowHeading}>
        <button
          type="button"
          id={`${id}-toggle`}
          className={css.rowButton}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen(open => !open)}
        >
          <span className={css.rowLabel}>{label}</span>
          {summary ? <span className={css.rowSummary}>{summary}</span> : null}
          <IconArrowHead
            direction="right"
            size="small"
            rootClassName={classNames(css.chevron, { [css.chevronOpen]: isOpen })}
          />
        </button>
      </h3>
      {isOpen ? (
        <div id={panelId} className={css.rowPanel}>
          {children}
        </div>
      ) : null}
    </div>
  );
};

/** A row in the grey Make group that opens the make or model popup. */
const PopupRow = props => {
  const { id, label, summary, hint, disabled, onClick } = props;
  return (
    <button
      type="button"
      id={id}
      className={css.popupRow}
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
    >
      <span className={css.rowLabel}>{label}</span>
      {summary ? (
        <span className={css.rowSummary}>{summary}</span>
      ) : hint ? (
        <span className={css.popupRowHint}>{hint}</span>
      ) : null}
      <IconArrowHead direction="right" size="small" rootClassName={css.chevron} />
    </button>
  );
};

/**
 * Side filters of the JDM search page (Miro "Side Filter"): a "Filters" heading with Clear all,
 * Quick search (the keyword filter), then one collapsible row per filter. Make, model and part
 * make share the "Make" row, whose Make and Model rows open a popup. The template filters
 * (FilterComponent) are reused inside the rows, without their own header.
 *
 * @component
 * @param {Object} props
 * @param {string} props.idPrefix "desktop" or "mobile", keeps ids unique
 * @param {Array<Object>} props.filters available filters, in the template's order
 * @param {Object} props.urlQueryParams current search params
 * @param {Function} props.initialValues (queryParamNames, liveEdit) => values
 * @param {Function} props.getHandleChangedValueFn (useHistoryPush) => (params) => void
 * @param {Array<Object>} props.listingCategories
 * @param {string} props.marketplaceCurrency
 * @param {Function} [props.onResetAll] shows the "Filters" heading with Clear all when given
 * @param {Function} props.onManageDisableScrolling
 * @param {string} props.containerId
 * @returns {JSX.Element}
 */
const JdmSearchFilters = props => {
  const {
    idPrefix,
    filters = [],
    urlQueryParams = {},
    initialValues,
    getHandleChangedValueFn,
    listingCategories,
    marketplaceCurrency,
    onResetAll,
    onManageDisableScrolling,
    containerId,
  } = props;
  const intl = useIntl();
  const msg = key => intl.formatMessage({ id: `JdmSearchFilters.${key}` });
  const [modalView, setModalView] = useState(null);

  const id = key => `JdmSearchFilters.${idPrefix}.${key}`;
  const applyParams = params => getHandleChangedValueFn(true)(params);

  const keywordsFilter = filters.find(f => f.key === KEYWORDS_KEY);
  const findGroupFilter = key => filters.find(f => f.key === key);
  const makeFilter = findGroupFilter('make');
  const modelFilter = findGroupFilter('model');
  const partMakeFilter = findGroupFilter('part_make');

  const valuesOf = filterConfig =>
    filterConfig ? selectedValues(urlQueryParams[filterParamName(filterConfig)]) : [];
  const labelsOf = filterConfig =>
    filterConfig ? optionLabels(filterConfig.enumOptions, valuesOf(filterConfig)) : [];
  const summaryOf = filterConfig => {
    const labels = labelsOf(filterConfig);
    return labels.length > 0 ? joinLabels(labels) : null;
  };

  const selectedMakes = valuesOf(makeFilter);
  const groupSummary = summaryOf(makeFilter) || summaryOf(partMakeFilter);

  // Make, model and part make become one row, where the first of them is
  const rows = [];
  filters.forEach(f => {
    if (f.key === KEYWORDS_KEY) {
      return;
    }
    if (!MAKE_GROUP_KEYS.includes(f.key)) {
      rows.push(f);
    } else if (!rows.includes('makeGroup')) {
      rows.push('makeGroup');
    }
  });

  const rowLabel = filterConfig => {
    const { key, schemaType } = filterConfig;
    if (schemaType === 'category') {
      return msg('typeLabel');
    }
    const builtInLabelIds = {
      price: 'FilterComponent.priceLabel',
      listingType: 'FilterComponent.listingTypeLabel',
      dates: 'FilterComponent.datesLabel',
      seats: 'FilterComponent.seatsLabel',
    };
    if (builtInLabelIds[schemaType]) {
      return intl.formatMessage({ id: builtInLabelIds[schemaType] });
    }
    // Miro calls the state filter "Location"; the Console label "State" stays on listing pages
    if (key === STATE_KEY) {
      return msg('locationLabel');
    }
    return filterConfig.filterConfig?.label || key;
  };

  const fieldLabel = (filterConfig, fallbackKey) =>
    filterConfig?.filterConfig?.label || msg(fallbackKey);

  const handleApply = ({ makes, models, partMakes }) => {
    setModalView(null);
    if (partMakes) {
      applyParams({
        [filterParamName(partMakeFilter)]: formatEnumValue(partMakes, partMakeFilter),
      });
      return;
    }
    applyParams({
      [filterParamName(makeFilter)]: formatEnumValue(makes, makeFilter),
      ...(modelFilter
        ? { [filterParamName(modelFilter)]: formatEnumValue(models, modelFilter) }
        : {}),
    });
  };

  const popupRowId = view => id(`popup.${view}`);

  const makeGroupRow = (
    <FilterRow
      key="makeGroup"
      id={id('makeGroup')}
      label={msg('makeLabel')}
      summary={groupSummary}
      defaultOpen={!!groupSummary}
    >
      <div className={css.makeGroup}>
        {makeFilter ? (
          <PopupRow
            id={popupRowId(VIEW_MAKE)}
            label={fieldLabel(makeFilter, 'makeLabel')}
            summary={summaryOf(makeFilter)}
            onClick={() => setModalView(VIEW_MAKE)}
          />
        ) : null}
        {modelFilter ? (
          <PopupRow
            id={popupRowId(VIEW_MODEL)}
            label={fieldLabel(modelFilter, 'modelLabel')}
            summary={summaryOf(modelFilter)}
            hint={selectedMakes.length === 0 ? msg('chooseMakeFirst') : null}
            disabled={selectedMakes.length === 0}
            onClick={() => setModalView(VIEW_MODEL)}
          />
        ) : null}
        {partMakeFilter ? (
          <PopupRow
            id={popupRowId(VIEW_PART_MAKE)}
            label={fieldLabel(partMakeFilter, 'makeLabel')}
            summary={summaryOf(partMakeFilter)}
            onClick={() => setModalView(VIEW_PART_MAKE)}
          />
        ) : null}
      </div>
    </FilterRow>
  );

  return (
    <div className={css.root}>
      {onResetAll ? (
        <div className={css.header}>
          <h2 className={css.heading}>{msg('heading')}</h2>
          <button type="button" className={css.clearAll} onClick={onResetAll}>
            {msg('clearAll')}
          </button>
        </div>
      ) : null}

      {keywordsFilter ? (
        <JdmQuickSearch
          key={urlQueryParams.keywords || ''}
          id={id('quickSearch')}
          initialKeywords={urlQueryParams.keywords || ''}
          onSubmit={applyParams}
        />
      ) : null}

      <div className={css.rows}>
        {rows.map(row =>
          row === 'makeGroup' ? (
            makeGroupRow
          ) : (
            <FilterRow
              key={`${row.scope || 'built-in'}.${row.key}`}
              id={id(row.key)}
              label={rowLabel(row)}
              summary={filterSummary({
                filterConfig: row,
                urlQueryParams,
                listingCategories,
                intl,
                marketplaceCurrency,
              })}
            >
              <FilterComponent
                id={id(`filter.${row.key.toLowerCase()}`)}
                rootClassName={css.plainFilter}
                config={row}
                containerId={containerId}
                listingCategories={listingCategories}
                marketplaceCurrency={marketplaceCurrency}
                urlQueryParams={urlQueryParams}
                initialValues={initialValues}
                getHandleChangedValueFn={getHandleChangedValueFn}
                intl={intl}
                liveEdit
                showAsPopup={false}
                hideHeader
              />
            </FilterRow>
          )
        )}
      </div>

      {modalView ? (
        <JdmMakeModelModal
          id={id('makeModelModal')}
          initialView={modalView}
          makeOptions={makeFilter?.enumOptions}
          modelOptions={modelFilter?.enumOptions}
          partMakeOptions={partMakeFilter?.enumOptions}
          selectedMakes={selectedMakes}
          selectedModels={valuesOf(modelFilter)}
          selectedPartMakes={valuesOf(partMakeFilter)}
          onApply={handleApply}
          onClose={() => setModalView(null)}
          onManageDisableScrolling={onManageDisableScrolling}
          focusElementId={popupRowId(modalView)}
        />
      ) : null}
    </div>
  );
};

export default JdmSearchFilters;
