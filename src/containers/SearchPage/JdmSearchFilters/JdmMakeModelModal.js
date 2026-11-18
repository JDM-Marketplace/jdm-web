import React, { useState } from 'react';

import { useIntl } from '../../../util/reactIntl';
import { IconArrowHead, IconSearch, Modal } from '../../../components';

import css from './JdmSearchFilters.module.css';

export const VIEW_MAKE = 'make';
export const VIEW_MODEL = 'model';
export const VIEW_PART_MAKE = 'partMake';

const matchesQuery = (label, query) =>
  !query || `${label}`.toLowerCase().includes(query.trim().toLowerCase());

const toggle = (values, value) =>
  values.includes(value) ? values.filter(v => v !== value) : [...values, value];

/** Models of the selected makes; model ids start with their make id ("nissan-silvia"). */
const modelsOfMakes = (modelOptions, makes) =>
  modelOptions.filter(o => makes.some(make => `${o.option}`.startsWith(`${make}-`)));

/**
 * Popup for choosing makes and models (Miro "Side Filter": "Pop-up for selecting Make or
 * Model"), with a search box, a checkbox list, Clear and Search. In the make list, a row's
 * arrow opens the models of that make. Nothing is searched until Search is pressed.
 *
 * Mounted when opened, so the selection starts from the URL every time.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id
 * @param {'make'|'model'|'partMake'} props.initialView
 * @param {Array<Object>} [props.makeOptions] car makes ({ option, label })
 * @param {Array<Object>} [props.modelOptions] all car models
 * @param {Array<Object>} [props.partMakeOptions] part makes
 * @param {Array<string>} [props.selectedMakes]
 * @param {Array<string>} [props.selectedModels]
 * @param {Array<string>} [props.selectedPartMakes]
 * @param {Function} props.onApply called with { makes, models } or { partMakes }
 * @param {Function} props.onClose
 * @param {Function} props.onManageDisableScrolling
 * @param {string} [props.focusElementId] element that gets the focus back on close
 * @returns {JSX.Element}
 */
const JdmMakeModelModal = props => {
  const {
    id,
    initialView,
    makeOptions = [],
    modelOptions = [],
    partMakeOptions = [],
    selectedMakes = [],
    selectedModels = [],
    selectedPartMakes = [],
    onApply,
    onClose,
    onManageDisableScrolling,
    focusElementId,
  } = props;
  const intl = useIntl();
  const msg = (key, values) => intl.formatMessage({ id: `JdmSearchFilters.${key}` }, values);

  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState('');
  const [makes, setMakes] = useState(selectedMakes);
  const [models, setModels] = useState(selectedModels);
  const [partMakes, setPartMakes] = useState(selectedPartMakes);

  const isPartView = view === VIEW_PART_MAKE;
  const isModelView = view === VIEW_MODEL;
  const makeLabel = makeId => makeOptions.find(o => o.option === makeId)?.label;
  const availableModels = modelsOfMakes(modelOptions, makes);
  // With several makes, "Nissan Silvia" tells the models apart
  const modelLabel = o =>
    makes.length > 1
      ? `${makeLabel(makes.find(m => `${o.option}`.startsWith(`${m}-`)))} ${o.label}`
      : o.label;

  const options = isPartView
    ? partMakeOptions.map(o => ({ ...o, text: o.label }))
    : isModelView
    ? availableModels.map(o => ({ ...o, text: modelLabel(o) }))
    : makeOptions.map(o => ({ ...o, text: o.label }));
  const selected = new Set(isPartView ? partMakes : isModelView ? models : makes);
  // Makes that have models get the red arrow to their models
  const makesWithModels = new Set(
    makeOptions.filter(o => modelsOfMakes(modelOptions, [o.option]).length > 0).map(o => o.option)
  );
  const visibleOptions = options.filter(o => matchesQuery(o.text, query));

  const showView = nextView => {
    setView(nextView);
    setQuery('');
  };

  const handleToggle = value => {
    if (isPartView) {
      setPartMakes(prev => toggle(prev, value));
    } else if (isModelView) {
      setModels(prev => toggle(prev, value));
    } else {
      setMakes(prev => toggle(prev, value));
    }
  };

  const handleShowModels = makeId => {
    setMakes(prev => (prev.includes(makeId) ? prev : [...prev, makeId]));
    showView(VIEW_MODEL);
  };

  const handleClear = () => {
    if (isPartView) {
      setPartMakes([]);
    } else if (isModelView) {
      setModels([]);
    } else {
      setMakes([]);
      setModels([]);
    }
  };

  const handleSearch = () => {
    if (isPartView) {
      onApply({ partMakes });
    } else {
      // Models of makes that were unticked would match nothing
      const modelIds = new Set(modelsOfMakes(modelOptions, makes).map(o => o.option));
      onApply({ makes, models: models.filter(m => modelIds.has(m)) });
    }
  };

  const viewKey = isModelView ? 'model' : 'make';
  const searchInputId = `${id}-search`;
  const listHeadingId = `${id}-listHeading`;
  const listHeading = isModelView
    ? makes.length === 1
      ? msg('modalModelsOfMake', { make: makeLabel(makes[0]) })
      : msg('modalModels')
    : msg('modalMakes');

  return (
    <Modal
      id={id}
      isOpen
      onClose={onClose}
      onManageDisableScrolling={onManageDisableScrolling}
      usePortal
      focusElementId={focusElementId}
      containerClassName={css.modalContainer}
      contentClassName={css.modalContent}
    >
      <h2 className={css.modalTitle}>{msg(`${viewKey}ModalTitle`)}</h2>

      {isModelView ? (
        <button type="button" className={css.modalBack} onClick={() => showView(VIEW_MAKE)}>
          <IconArrowHead direction="left" size="small" rootClassName={css.modalBackIcon} />
          {msg('modalBackToMakes')}
        </button>
      ) : null}

      <label className={css.modalSearchLabel} htmlFor={searchInputId}>
        {msg(`${viewKey}ModalSearchLabel`)}
      </label>
      <div className={css.modalSearch}>
        <IconSearch rootClassName={css.modalSearchIcon} />
        <input
          id={searchInputId}
          className={css.modalSearchInput}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* A fieldset can't shrink as a flex item in Chrome, so the list wouldn't scroll */}
      <div className={css.modalOptions} role="group" aria-labelledby={listHeadingId}>
        <h3 id={listHeadingId} className={css.modalListHeading}>
          {listHeading}
        </h3>
        {isModelView && makes.length === 0 ? (
          <p className={css.modalEmpty}>{msg('modalChooseMakeFirst')}</p>
        ) : visibleOptions.length === 0 ? (
          <p className={css.modalEmpty}>{msg('modalNoMatches', { query: query.trim() })}</p>
        ) : (
          <ul className={css.modalList}>
            {visibleOptions.map(o => {
              const optionId = `${id}-${o.option}`;
              const isChecked = selected.has(o.option);
              const hasModels = view === VIEW_MAKE && makesWithModels.has(o.option);
              return (
                <li key={o.option} className={css.modalOption}>
                  <input
                    id={optionId}
                    className={css.modalCheckbox}
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(o.option)}
                  />
                  <label className={css.modalOptionLabel} htmlFor={optionId}>
                    {o.text}
                  </label>
                  {hasModels ? (
                    <button
                      type="button"
                      className={css.modalDrill}
                      onClick={() => handleShowModels(o.option)}
                      aria-label={msg('modalShowModels', { make: o.label })}
                    >
                      <IconArrowHead
                        direction="right"
                        size="small"
                        rootClassName={css.modalDrillIcon}
                      />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={css.modalFooter}>
        <button type="button" className={css.modalClear} onClick={handleClear}>
          {msg('modalClear')}
        </button>
        <button type="button" className={css.modalSearchButton} onClick={handleSearch}>
          {msg('modalSearch')}
        </button>
      </div>
    </Modal>
  );
};

export default JdmMakeModelModal;
