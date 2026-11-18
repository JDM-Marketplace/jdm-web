import React from 'react';

import Field, { hasDataInFields } from '../../Field';

import css from './FaqAccordion.module.css';

const Chevron = () => (
  <svg
    className={css.chevron}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/**
 * One FAQ row. The CMS block title is the question and the block text is the answer.
 * Uses native <details>/<summary>, so it works with the keyboard and without JavaScript.
 *
 * @param {Object} props
 * @param {Object} props.block
 * @param {Object} props.options
 * @returns {JSX.Element|null}
 */
const FaqItem = props => {
  const { block, options } = props;
  const { blockId, title, text } = block;
  const hasQuestion = hasDataInFields([title], options);
  const hasAnswer = hasDataInFields([text], options);

  if (!hasQuestion) {
    return null;
  }

  return (
    <details className={css.item} id={blockId}>
      <summary className={css.question}>
        <span className={css.questionText}>
          <Field data={title} options={options} />
        </span>
        <Chevron />
      </summary>
      {hasAnswer ? (
        <div className={css.answer}>
          <Field data={text} options={options} />
        </div>
      ) : null}
    </details>
  );
};

/**
 * Accordion list for the FAQ section (anchor ID "faq" in Console).
 * Each CMS block is one question and answer pair.
 *
 * @component
 * @param {Object} props
 * @param {Array<Object>} props.blocks
 * @param {Object} props.options
 * @returns {JSX.Element}
 */
const FaqAccordion = props => {
  const { blocks = [], options } = props;

  return (
    <div className={css.root}>
      {blocks.map((block, index) => (
        <FaqItem key={block.blockId || `faq-${index}`} block={block} options={options} />
      ))}
    </div>
  );
};

export default FaqAccordion;
