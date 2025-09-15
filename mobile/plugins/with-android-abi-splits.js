const { withAppBuildGradle, createRunOncePlugin } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const PLUGIN_NAME = 'with-android-abi-splits';
const TAG_SPLITS = 'sillytavern-abi-splits';
const TAG_NDK = 'sillytavern-ndk-abi-filters';

function withAndroidAbi(config, props = {}) {
  const abis = props.abis || ['arm64-v8a', 'x86'];
  const abiList = abis.map((a) => `'${a}'`).join(', ');

  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents || '';

    // Remove our previously injected splits block so we build a single APK
    const splitsRegex = new RegExp(`// @${TAG_SPLITS}-start[\\s\\S]*?// @${TAG_SPLITS}-end`, 'g');
    contents = contents.replace(splitsRegex, '');

    // Ensure ndk abiFilters exists under defaultConfig
    const ndkBlock = `// @${TAG_NDK}-start\n        ndk {\n            abiFilters ${abiList}\n        }\n        // @${TAG_NDK}-end`;
    const ndkRegex = new RegExp(`// @${TAG_NDK}-start[\\s\\S]*?// @${TAG_NDK}-end`, 'g');
    if (ndkRegex.test(contents)) {
      contents = contents.replace(ndkRegex, ndkBlock);
    } else {
      const inserted = mergeContents({
        tag: TAG_NDK,
        src: contents,
        newSrc: ndkBlock,
        anchor: /defaultConfig\s*\{/g,
        offset: 1,
        comment: '//',
      });
      contents = inserted.contents;
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = createRunOncePlugin(withAndroidAbi, PLUGIN_NAME, '2.0.0');
