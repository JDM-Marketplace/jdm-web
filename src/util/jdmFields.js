/**
 * JDM listing field helpers shared by the ad form and the landing page search.
 *
 * The listing fields are configured in Console (Listings > Listing fields):
 * - make:  enum, e.g. "nissan"
 * - model: enum whose option ids start with the make id, e.g. "nissan-skyline"
 * - state: enum of Australian states, e.g. "nsw"
 */

export const MAKE_FIELD_KEY = 'make';
export const MODEL_FIELD_KEY = 'model';
export const STATE_FIELD_KEY = 'state';

/**
 * Find a listing field config by key.
 *
 * @param {Array<Object>} listingFields config.listing.listingFields
 * @param {string} key listing field key
 * @returns {Object|undefined}
 */
export const findListingField = (listingFields = [], key) =>
  listingFields.find(field => field?.key === key);

/**
 * Model options are tied to a make by their id prefix: "nissan-skyline" belongs to "nissan".
 * If a make has no prefixed models (e.g. a new make added in Console), all models are returned.
 *
 * @param {Array<{option: string, label: string}>} enumOptions model options
 * @param {string} make selected make id
 * @returns {Array<{option: string, label: string}>}
 */
export const modelOptionsForMake = (enumOptions = [], make) => {
  if (!make) {
    return [];
  }
  const forMake = enumOptions.filter(o => `${o.option}`.startsWith(`${make}-`));
  return forMake.length > 0 ? forMake : enumOptions;
};

export const YEAR_FIELD_KEY = 'year';
export const ODOMETER_FIELD_KEY = 'odometer';
export const CONDITION_FIELD_KEY = 'condition';

const enumLabel = (listingFields, key, value) =>
  findListingField(listingFields, key)?.enumOptions?.find(o => `${o.option}` === `${value}`)?.label;

/**
 * Details for the JDM listing card: "[Year] [Make] [Model]" and "[State] · [Odometer]" for cars,
 * "[Year] [Make]" and "[State] · [Condition]" for parts. Returns null for listings without a make
 * (e.g. listings created before the JDM fields existed), which keep the template card.
 *
 * @param {Object} publicData listing public data
 * @param {Array<Object>} listingFields config.listing.listingFields
 * @param {Function} formatOdometer formats the odometer number, e.g. 85000 => "85,000 km"
 * @returns {{ heading: string, meta: Array<string> } | null}
 */
export const getJdmCardDetails = (publicData = {}, listingFields = [], formatOdometer) => {
  const make = publicData[MAKE_FIELD_KEY];
  if (!make) {
    return null;
  }
  const year = publicData[YEAR_FIELD_KEY];
  const model = publicData[MODEL_FIELD_KEY];
  const state = publicData[STATE_FIELD_KEY];
  const odometer = publicData[ODOMETER_FIELD_KEY];
  const condition = publicData[CONDITION_FIELD_KEY];

  const heading = [
    year,
    enumLabel(listingFields, MAKE_FIELD_KEY, make) || make,
    model ? enumLabel(listingFields, MODEL_FIELD_KEY, model) : null,
  ]
    .filter(Boolean)
    .join(' ');

  const meta = [
    // State ids are the short codes (nsw, vic...), which fit the card better than full names
    state ? `${state}`.toUpperCase() : null,
    odometer != null && formatOdometer ? formatOdometer(odometer) : null,
    condition ? enumLabel(listingFields, CONDITION_FIELD_KEY, condition) || condition : null,
  ].filter(Boolean);

  return { heading, meta };
};
