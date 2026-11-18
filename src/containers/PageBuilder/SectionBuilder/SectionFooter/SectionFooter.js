import React from 'react';
import classNames from 'classnames';

import { pickFieldOptions } from '../../PageBuilder.helpers';

import Field from '../../Field';
import BlockBuilder from '../../BlockBuilder';

import SectionContainer from '../SectionContainer';
import css from './SectionFooter.module.css';

// The number of columns (numberOfColumns) affects styling

const GRID_CONFIG = [
  { contentCss: css.contentCol1, gridCss: css.gridCol1 },
  { contentCss: css.contentCol2, gridCss: css.gridCol2 },
  { contentCss: css.contentCol3, gridCss: css.gridCol3 },
  { contentCss: css.contentCol4, gridCss: css.gridCol4 },
];

const getIndex = numberOfColumns => numberOfColumns - 1;

const getGridCss = numberOfColumns => {
  const contentConfig = GRID_CONFIG[getIndex(numberOfColumns)];
  return contentConfig ? contentConfig.gridCss : GRID_CONFIG[0].gridCss;
};

/**
 * @typedef {Object} SocialMediaLinkConfig
 * @property {'socialMediaLink'} fieldType
 * @property {string} platform
 * @property {string} url
 */

/**
 * @typedef {Object} BlockConfig
 * @property {string} blockId
 * @property {string} blockName
 * @property {'defaultBlock' | 'footerBlock' | 'socialMediaLink'} blockType
 */

/**
 * @typedef {Object} FieldComponentConfig
 * @property {ReactNode} component
 * @property {Function} pickValidProps
 */

/**
 * Section component that's able to show blocks in multiple different columns (defined by "numberOfColumns" prop)
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {string} props.sectionId id of the section
 * @param {'footer'} props.sectionType
 * @param {number} props.numberOfColumns columns for blocks in footer (1-4)
 * @param {Array<SocialMediaLinkConfig>?} props.socialMediaLinks array of social media link configs
 * @param {Object?} props.slogan
 * @param {Object?} props.copyright
 * @param {Object?} props.appearance
 * @param {Array<BlockConfig>?} props.blocks array of block configs
 * @param {Object} props.options extra options for the section component (e.g. custom fieldComponents)
 * @param {Object<string,FieldComponentConfig>?} props.options.fieldComponents custom fields
 * @returns {JSX.Element} Section for article content
 */
// JDM: a footer block with this ID holds extra social links (e.g. Reddit, which Console's
// social media links don't offer). It's shown next to the social icons, not as a column.
const EXTRA_SOCIAL_BLOCK_ID = 'footer-social';

const SectionFooter = props => {
  const {
    sectionId,
    className,
    rootClassName,
    numberOfColumns = 1,
    socialMediaLinks = [],
    appearance,
    copyright,
    blocks = [],
    options,
  } = props;

  // If external mapping has been included for fields
  // E.g. { h1: { component: MyAwesomeHeader } }
  const fieldOptions = pickFieldOptions(options);
  const linksWithBlockId = socialMediaLinks?.map(sml => {
    return {
      ...sml,
      blockId: sml.link.platform,
    };
  });
  const extraSocialBlocks = blocks.filter(b => b.blockId === EXTRA_SOCIAL_BLOCK_ID);
  const columnBlocks = blocks.filter(b => b.blockId !== EXTRA_SOCIAL_BLOCK_ID);

  const showSocialMediaLinks = socialMediaLinks?.length > 0 || extraSocialBlocks.length > 0;

  // JDM design: no logo or slogan, the link columns first and the social links and
  // copyright in a row below them.
  return (
    <SectionContainer
      as="footer"
      id={sectionId}
      className={className || css.root}
      rootClassName={rootClassName}
      appearance={appearance}
      options={fieldOptions}
    >
      <div className={css.jdmFooter}>
        <div className={classNames(css.jdmColumns, getGridCss(numberOfColumns))}>
          <BlockBuilder blocks={columnBlocks} sectionId={sectionId} options={options} />
        </div>
        <div className={css.jdmBottom}>
          {showSocialMediaLinks ? (
            <div className={css.jdmSocial}>
              <div className={css.icons}>
                <BlockBuilder blocks={linksWithBlockId} sectionId={sectionId} options={options} />
              </div>
              {extraSocialBlocks.length > 0 ? (
                <div className={css.jdmExtraSocial}>
                  <BlockBuilder
                    blocks={extraSocialBlocks}
                    sectionId={sectionId}
                    options={options}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <Field data={copyright} className={css.copyright} />
        </div>
      </div>
    </SectionContainer>
  );
};

export default SectionFooter;
