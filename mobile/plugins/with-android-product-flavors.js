// @ts-check
const { withAppBuildGradle, createRunOncePlugin } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const PLUGIN_NAME = 'with-android-product-flavors';
const TAG_DIMENSION = 'sillytavern-flavor-dimension';
const TAG_FLAVORS = 'sillytavern-product-flavors';

/**
 * Injects flavorDimensions and productFlavors into android/app/build.gradle.
 * @param {import('@expo/config-plugins').Config} config
 * @param {{ dimension?: string, devclientId: string, prodId: string }} props
 */
const withAndroidProductFlavors = (config, props) => {
  const dimension = props?.dimension || 'env';
  const devId = props?.devclientId;
  const prodId = props?.prodId;
  if (!devId || !prodId) return config;

  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // 1) flavorDimensions block
    const dimBlock = `// @${TAG_DIMENSION}-start\n    flavorDimensions "${dimension}"\n    // @${TAG_DIMENSION}-end`;
    const dimRegex = new RegExp(`// @${TAG_DIMENSION}-start[\\s\\S]*?// @${TAG_DIMENSION}-end`, 'g');
    if (dimRegex.test(contents)) {
      contents = contents.replace(dimRegex, dimBlock);
    } else {
      const inserted = mergeContents({
        tag: TAG_DIMENSION,
        src: contents,
        newSrc: dimBlock,
        anchor: /android\s*\{/g,
        offset: 1,
        comment: '//',
      });
      contents = inserted.contents;
    }

    // 2) productFlavors block
    const flavorsBlock = `// @${TAG_FLAVORS}-start\n    productFlavors {\n        devclient {\n            dimension "${dimension}"\n            applicationId '${devId}'\n        }\n        prod {\n            dimension "${dimension}"\n            applicationId '${prodId}'\n        }\n    }\n    // @${TAG_FLAVORS}-end`;
    const flavorsRegex = new RegExp(`// @${TAG_FLAVORS}-start[\\s\\S]*?// @${TAG_FLAVORS}-end`, 'g');
    if (flavorsRegex.test(contents)) {
      contents = contents.replace(flavorsRegex, flavorsBlock);
    } else {
      const inserted2 = mergeContents({
        tag: TAG_FLAVORS,
        src: contents,
        newSrc: flavorsBlock,
        anchor: /android\s*\{/g,
        offset: 1,
        comment: '//',
      });
      contents = inserted2.contents;
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

module.exports = createRunOncePlugin(withAndroidProductFlavors, PLUGIN_NAME, '1.0.0');
