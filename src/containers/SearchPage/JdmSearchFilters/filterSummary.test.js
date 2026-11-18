import { filterParamName, filterSummary, joinLabels, selectedValues } from './filterSummary';

const intl = {
  formatNumber: n => n.toLocaleString('en-AU'),
  formatNumberToParts: () => [],
};

const make = {
  key: 'make',
  scope: 'public',
  schemaType: 'enum',
  enumOptions: [
    { option: 'nissan', label: 'Nissan' },
    { option: 'toyota', label: 'Toyota' },
    { option: 'honda', label: 'Honda' },
  ],
};
const category = { key: 'categoryLevel', schemaType: 'category', nestedParams: ['categoryLevel1'] };
const categories = [{ id: 'jdm-cars', name: 'JDM Cars', subcategories: [] }];

const summary = (filterConfig, urlQueryParams) =>
  filterSummary({ filterConfig, urlQueryParams, listingCategories: categories, intl });

describe('filterSummary', () => {
  it('reads the query param names', () => {
    expect(filterParamName(make)).toEqual('pub_make');
    expect(filterParamName(category)).toEqual('pub_categoryLevel1');
    expect(filterParamName({ key: 'price', schemaType: 'price' })).toEqual('price');
  });

  it('splits several values and drops the search mode', () => {
    expect(selectedValues('has_any:nissan,toyota')).toEqual(['nissan', 'toyota']);
    expect(selectedValues('nissan')).toEqual(['nissan']);
    expect(selectedValues(undefined)).toEqual([]);
    expect(joinLabels(['Nissan', 'Toyota', 'Honda'])).toEqual('Nissan +2');
  });

  it('shows enum labels and the category name', () => {
    expect(summary(make, {})).toBeNull();
    expect(summary(make, { pub_make: 'nissan,toyota' })).toEqual('Nissan, Toyota');
    expect(summary(make, { pub_make: 'unknown' })).toBeNull();
    expect(summary(category, { pub_categoryLevel1: 'jdm-cars' })).toEqual('JDM Cars');
  });

  it('shows ranges, years without digit grouping', () => {
    const year = { key: 'year', scope: 'public', schemaType: 'long' };
    const odometer = { key: 'odometer', scope: 'public', schemaType: 'long' };
    expect(summary(year, { pub_year: '2000,2010' })).toEqual('2000 – 2010');
    expect(summary(odometer, { pub_odometer: '0,150000' })).toEqual('0 – 150,000');
    expect(summary(odometer, { pub_odometer: 'x' })).toBeNull();
  });
});
