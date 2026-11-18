import { SCHEMA_TYPE_ENUM, SCHEMA_TYPE_LONG, SCHEMA_TYPE_MULTI_ENUM } from '../../../util/types';
import { constructQueryParamName } from '../../../util/search';
import { formatCurrencyMajorUnit } from '../../../util/currency';

// Fields grouped under the "Make" row (Miro "Side Filter": Make opens Make and Model)
export const MAKE_GROUP_KEYS = ['make', 'model', 'part_make'];
const YEAR_KEY = 'year';

/** Query param name of a filter. */
export const filterParamName = filterConfig => {
  const { key, schemaType, scope, nestedParams } = filterConfig;
  if (schemaType === 'category') {
    return constructQueryParamName(nestedParams?.[0] || 'categoryLevel1', scope);
  }
  return ['price', 'keywords', 'dates', 'seats'].includes(key)
    ? key
    : constructQueryParamName(key, scope);
};

/** "has_any:nissan,toyota" and "nissan,toyota" => ["nissan", "toyota"] */
export const selectedValues = value => {
  if (value == null || value === '') {
    return [];
  }
  const str = `${value}`;
  const withoutMode = str.includes(':') ? str.slice(str.indexOf(':') + 1) : str;
  return withoutMode.split(',').filter(Boolean);
};

/** "Nissan", "Nissan, Toyota" or "Nissan +2" for three or more */
export const joinLabels = labels =>
  labels.length > 2 ? `${labels[0]} +${labels.length - 1}` : labels.join(', ');

/** Labels of the selected options of an enum field. Unknown ids are skipped. */
export const optionLabels = (enumOptions = [], values = []) =>
  values.map(v => enumOptions.find(o => `${o.option}` === `${v}`)?.label).filter(Boolean);

const findCategoryName = (categories = [], id) => {
  for (const category of categories) {
    if (category.id === id) {
      return category.name;
    }
    const sub = findCategoryName(category.subcategories, id);
    if (sub) {
      return sub;
    }
  }
  return null;
};

/**
 * The selected value of a filter as short text for its row ("Nissan", "$0 – $10,000",
 * "2000 – 2010"), or null when the filter isn't set.
 *
 * @param {Object} params
 * @param {Object} params.filterConfig default filter or listing field config
 * @param {Object} params.urlQueryParams current search params
 * @param {Array<Object>} params.listingCategories category tree
 * @param {Object} params.intl
 * @param {string} params.marketplaceCurrency
 * @returns {string|null}
 */
export const filterSummary = ({
  filterConfig,
  urlQueryParams = {},
  listingCategories,
  intl,
  marketplaceCurrency,
}) => {
  const { key, schemaType } = filterConfig;
  const value = urlQueryParams[filterParamName(filterConfig)];
  if (value == null || value === '') {
    return null;
  }

  if (schemaType === 'category') {
    return findCategoryName(listingCategories, value);
  }
  if (schemaType === SCHEMA_TYPE_ENUM || schemaType === SCHEMA_TYPE_MULTI_ENUM) {
    const labels = optionLabels(filterConfig.enumOptions, selectedValues(value));
    return labels.length > 0 ? joinLabels(labels) : null;
  }

  const [min, max] = `${value}`.split(',').map(Number);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }
  if (key === 'price') {
    const format = n => formatCurrencyMajorUnit(intl, marketplaceCurrency, n);
    return `${format(min)} – ${format(max)}`;
  }
  if (schemaType === SCHEMA_TYPE_LONG) {
    // Years read as 2005, not 2,005
    const format = n => (key === YEAR_KEY ? `${n}` : intl.formatNumber(n));
    return `${format(min)} – ${format(max)}`;
  }
  return null;
};
