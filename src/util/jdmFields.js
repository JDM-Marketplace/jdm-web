/**
 * JDM listing field helpers shared by the ad form and the landing page search.
 *
 * The listing fields are configured in Console (Listings > Listing fields):
 * - make:        enum (cars), e.g. "nissan", or "other" (Others)
 * - part_make:   enum (parts), e.g. "nissan", "universal" or "other-parts"
 * - model:       enum (cars) whose option ids start with the make id, e.g. "nissan-silvia".
 *                Each make has "{make}-other-models" (Other Models)
 * - make_other:  text (cars), the make typed in when the make is "other"
 * - model_other: text (cars), the model typed in when the make is "other" or the model is
 *                "{make}-other-models"
 * - state:       enum of Australian states, e.g. "nsw", and "int" (Overseas)
 */

export const MAKE_FIELD_KEY = 'make';
export const PART_MAKE_FIELD_KEY = 'part_make';
export const MODEL_FIELD_KEY = 'model';
export const MAKE_OTHER_FIELD_KEY = 'make_other';
export const MODEL_OTHER_FIELD_KEY = 'model_other';
export const STATE_FIELD_KEY = 'state';

export const OTHER_MAKE_ID = 'other';
const OTHER_MODELS_SUFFIX = '-other-models';

/** "nissan-other-models" is the Other Models option of a make. */
export const isOtherModel = model => !!model && `${model}`.endsWith(OTHER_MODELS_SUFFIX);

/** The typed-in make is asked when the make is Others. */
export const needsMakeOther = make => make === OTHER_MAKE_ID;

/** The typed-in model is asked when the make is Others (no model list) or the model is Other Models. */
export const needsModelOther = (make, model) => needsMakeOther(make) || isOtherModel(model);

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
  // Others has no model list: the model is typed in (model_other)
  if (!make || needsMakeOther(make)) {
    return [];
  }
  const forMake = enumOptions.filter(o => `${o.option}`.startsWith(`${make}-`));
  return forMake.length > 0 ? forMake : enumOptions;
};

/**
 * Public data values for the "other" fields that the form doesn't show are cleared (null), so a
 * listing changed from Others to Nissan doesn't keep its typed-in make. With the Others make,
 * the model list isn't shown either.
 *
 * @param {Object} publicListingFields listing field values by key (not namespaced)
 * @returns {Object}
 */
export const clearUnusedOtherFields = publicListingFields => {
  const make = publicListingFields[MAKE_FIELD_KEY];
  const model = publicListingFields[MODEL_FIELD_KEY];
  const has = key => Object.prototype.hasOwnProperty.call(publicListingFields, key);
  return {
    ...publicListingFields,
    ...(has(MODEL_FIELD_KEY) && needsMakeOther(make) ? { [MODEL_FIELD_KEY]: null } : {}),
    ...(has(MAKE_OTHER_FIELD_KEY) && !needsMakeOther(make) ? { [MAKE_OTHER_FIELD_KEY]: null } : {}),
    ...(has(MODEL_OTHER_FIELD_KEY) && !needsModelOther(make, model)
      ? { [MODEL_OTHER_FIELD_KEY]: null }
      : {}),
  };
};

export const YEAR_FIELD_KEY = 'year';
export const ODOMETER_FIELD_KEY = 'odometer';
export const CONDITION_FIELD_KEY = 'condition';

/**
 * Public data the JDM listing card reads (getJdmCardDetails). Add these to the 'fields.listing'
 * of every listing query whose results render a ListingCard (search page, featured listings).
 */
export const JDM_CARD_PUBLIC_DATA_FIELDS = [
  MAKE_FIELD_KEY,
  PART_MAKE_FIELD_KEY,
  MODEL_FIELD_KEY,
  MAKE_OTHER_FIELD_KEY,
  MODEL_OTHER_FIELD_KEY,
  YEAR_FIELD_KEY,
  STATE_FIELD_KEY,
  ODOMETER_FIELD_KEY,
  CONDITION_FIELD_KEY,
].map(key => `publicData.${key}`);

const enumLabel = (listingFields, key, value) =>
  findListingField(listingFields, key)?.enumOptions?.find(o => `${o.option}` === `${value}`)?.label;

/**
 * Details for the JDM listing card: "[Year] [Make] [Model]" and "[State] · [Odometer]" for cars,
 * "[Year] [Make]" and "[State] · [Condition]" for parts. With Others / Other Models, the make and
 * model typed in by the seller are shown. Returns null for listings without a make (e.g. listings
 * created before the JDM fields existed), which keep the template card.
 *
 * @param {Object} publicData listing public data
 * @param {Array<Object>} listingFields config.listing.listingFields
 * @param {Function} formatOdometer formats the odometer number, e.g. 85000 => "85,000 km"
 * @returns {{ heading: string, meta: Array<string> } | null}
 */
export const getJdmCardDetails = (publicData = {}, listingFields = [], formatOdometer) => {
  const carMake = publicData[MAKE_FIELD_KEY];
  const partMake = publicData[PART_MAKE_FIELD_KEY];
  if (!carMake && !partMake) {
    return null;
  }
  const year = publicData[YEAR_FIELD_KEY];
  const model = carMake ? publicData[MODEL_FIELD_KEY] : null;
  const makeOther = `${publicData[MAKE_OTHER_FIELD_KEY] || ''}`.trim();
  const modelOther = `${publicData[MODEL_OTHER_FIELD_KEY] || ''}`.trim();
  const state = publicData[STATE_FIELD_KEY];
  const odometer = publicData[ODOMETER_FIELD_KEY];
  const condition = publicData[CONDITION_FIELD_KEY];

  const makeLabel = carMake
    ? needsMakeOther(carMake) && makeOther
      ? makeOther
      : enumLabel(listingFields, MAKE_FIELD_KEY, carMake) || carMake
    : enumLabel(listingFields, PART_MAKE_FIELD_KEY, partMake) || partMake;
  const modelLabel =
    carMake && needsModelOther(carMake, model) && modelOther
      ? modelOther
      : model
      ? enumLabel(listingFields, MODEL_FIELD_KEY, model)
      : null;

  const heading = [year, makeLabel, modelLabel].filter(Boolean).join(' ');

  const meta = [
    // State ids are the short codes (nsw, vic...), which fit the card better than full names
    state ? `${state}`.toUpperCase() : null,
    odometer != null && formatOdometer ? formatOdometer(odometer) : null,
    condition ? enumLabel(listingFields, CONDITION_FIELD_KEY, condition) || condition : null,
  ].filter(Boolean);

  return { heading, meta };
};

export const TRANSMISSION_FIELD_KEY = 'transmission';
export const BODY_TYPE_FIELD_KEY = 'body_type';
export const DRIVE_TYPE_FIELD_KEY = 'drive_type';

// Specs of the listing page, in the order of the design: Make, Model, Year and Location, then
// Transmission, Body type, Drive type and Odometer. Parts have Make, Year, Location and Condition.
const CAR_SPEC_KEYS = [
  MAKE_FIELD_KEY,
  MODEL_FIELD_KEY,
  YEAR_FIELD_KEY,
  STATE_FIELD_KEY,
  TRANSMISSION_FIELD_KEY,
  BODY_TYPE_FIELD_KEY,
  DRIVE_TYPE_FIELD_KEY,
  ODOMETER_FIELD_KEY,
];
const PART_SPEC_KEYS = [PART_MAKE_FIELD_KEY, YEAR_FIELD_KEY, STATE_FIELD_KEY, CONDITION_FIELD_KEY];

const hasValue = value => value != null && `${value}`.trim() !== '';

/**
 * Specs of a JDM listing for the listing page. Enum values are shown with their labels, the
 * odometer is formatted with formatOdometer and, with Others / Other Models, the make and model
 * typed in by the seller are shown. Fields without a value are left out.
 *
 * @param {Object} publicData listing public data
 * @param {Array<Object>} listingFields config.listing.listingFields
 * @param {Function} formatOdometer formats the odometer number, e.g. 85000 => "85,000 km"
 * @returns {Array<{ key: string, value: string }>} empty for listings without a make
 */
export const getJdmListingSpecs = (publicData = {}, listingFields = [], formatOdometer) => {
  const carMake = publicData[MAKE_FIELD_KEY];
  const partMake = publicData[PART_MAKE_FIELD_KEY];
  if (!carMake && !partMake) {
    return [];
  }
  const model = carMake ? publicData[MODEL_FIELD_KEY] : null;
  const makeOther = `${publicData[MAKE_OTHER_FIELD_KEY] || ''}`.trim();
  const modelOther = `${publicData[MODEL_OTHER_FIELD_KEY] || ''}`.trim();

  const valueOf = key => {
    const value = publicData[key];
    if (key === MAKE_FIELD_KEY && needsMakeOther(carMake) && makeOther) {
      return makeOther;
    }
    if (key === MODEL_FIELD_KEY && needsModelOther(carMake, model) && modelOther) {
      return modelOther;
    }
    if (!hasValue(value)) {
      return null;
    }
    if (key === ODOMETER_FIELD_KEY) {
      return formatOdometer ? formatOdometer(value) : `${value}`;
    }
    if (key === YEAR_FIELD_KEY) {
      return `${value}`;
    }
    return enumLabel(listingFields, key, value) || `${value}`;
  };

  const keys = carMake ? CAR_SPEC_KEYS : PART_SPEC_KEYS;
  return keys.map(key => ({ key, value: valueOf(key) })).filter(spec => hasValue(spec.value));
};
