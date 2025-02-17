import process from 'node:process';
import path from 'node:path';
import os from 'node:os';
import isDocker from 'is-docker';

/**
 * Get the Webpack configuration for the public/lib.js file.
 * @param {boolean} forceDist Whether to force the use the /dist folder.
 * @returns {import('webpack').Configuration}
 * */
export default function getPublicLibConfig(forceDist = false) {
    function getCacheDirectory() {
        // Docker got cache pre-baked into the image.
        if (forceDist || isDocker()) {
            return path.resolve(process.cwd(), 'dist/webpack');
        }

        // Data root is set (should be the case 99.99% of the time).
        if (typeof globalThis.DATA_ROOT === 'string') {
            return path.resolve(globalThis.DATA_ROOT, '_cache', 'webpack');
        }

        // Fallback to the system temp directory.
        return path.resolve(os.tmpdir(), 'webpack');
    }

    const cacheDirectory = getCacheDirectory();
    return {
        mode: 'production',
        entry: './public/lib.js',
        cache: {
            type: 'filesystem',
            cacheDirectory: cacheDirectory,
            store: 'pack',
            compression: 'gzip',
        },
        devtool: false,
        watch: false,
        module: {},
        stats: {
            preset: 'minimal',
            assets: false,
            modules: false,
            colors: true,
            timings: true,
        },
        experiments: {
            outputModule: true,
        },
        performance: {
            hints: false,
        },
        output: {
            path: path.resolve(process.cwd(), 'dist'),
            filename: 'lib.js',
            libraryTarget: 'module',
        },
    };
}
