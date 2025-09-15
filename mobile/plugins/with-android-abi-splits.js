// @ts-check
const {
  withAppBuildGradle,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const PLUGIN_NAME = 'with-android-abi-splits';
const TAG_SPLITS = 'sillytavern-abi-splits';
const TAG_NDK = 'sillytavern-ndk-abi-filters';

/**
 * Injects ABI `splits` block under the `android {}` scope and `ndk { abiFilters }` inside `defaultConfig {}`.
 * Defaults to limiting to arm64-v8a and x86.
 * @param {import('@expo/config-plugins').ConfigPluginProps} config
 */
const withAndroidAbiSplits = (config, props = {}) => {
  const abis = props.abis || ["arm64-v8a", "x86"];
  const abiList = abis.map(a => `'${a}'`).join(', ');

  return withAppBuildGradle(config, (mod) => {
    const src = mod.modResults.contents;

    // 1) Ensure splits { abi { ... } } inside android {}
    const splitsBlock = `// @${TAG_SPLITS}-start\n    splits {\n        abi {\n            enable true\n            reset()\n            include ${abiList}\n            universalApk false\n        }\n    }\n    // @${TAG_SPLITS}-end`;

    let afterAndroid = mergeContents({
      tag: TAG_SPLITS,
      src,
      newSrc: splitsBlock,
      anchor: /android\s*\{/g,
      offset: 1,
      comment: '//',
    });

    // 2) Ensure ndk { abiFilters ... } inside defaultConfig {}
    const ndkBlock = `// @${TAG_NDK}-start\n        ndk {\n            abiFilters ${abiList}\n        }\n        // @${TAG_NDK}-end`;

    let finalResult = mergeContents({
      tag: TAG_NDK,
      src: afterAndroid.contents,
      newSrc: ndkBlock,
      anchor: /defaultConfig\s*\{/g,
      offset: 1,
      comment: '//',
    });

    mod.modResults.contents = finalResult.contents;
    return mod;
  });
};

module.exports = createRunOncePlugin(withAndroidAbiSplits, PLUGIN_NAME, '1.0.0');
