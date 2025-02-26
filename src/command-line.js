import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import ipRegex from 'ip-regex';
import { canResolve, color, getConfigValue, stringToBool } from './util.js';

/**
 * @typedef {object} CommandLineArguments
 * @property {string} dataRoot
 * @property {number} port
 * @property {boolean} listen
 * @property {string} listenAddressIPv6
 * @property {string} listenAddressIPv4
 * @property {boolean|string} enableIPv4
 * @property {boolean|string} enableIPv6
 * @property {boolean} dnsPreferIPv6
 * @property {boolean} autorun
 * @property {string} autorunHostname
 * @property {number} autorunPortOverride
 * @property {boolean} enableCorsProxy
 * @property {boolean} disableCsrf
 * @property {boolean} ssl
 * @property {string} certPath
 * @property {string} keyPath
 * @property {boolean} whitelistMode
 * @property {boolean} avoidLocalhost
 * @property {boolean} basicAuthMode
 * @property {boolean} requestProxyEnabled
 * @property {string} requestProxyUrl
 * @property {string[]} requestProxyBypass
 * @property {function(): URL} getIPv4ListenUrl
 * @property {function(): URL} getIPv6ListenUrl
 * @property {function(boolean, boolean): Promise<string>} getAutorunHostname
 * @property {function(string): URL} getAutorunUrl
 */

/**
 * Gets the hostname to use for autorun in the browser.
 * @param {boolean} useIPv6 If use IPv6
 * @param {boolean} useIPv4 If use IPv4
 * @returns {Promise<string>} The hostname to use for autorun
 */

export class CommandLineParser {
    constructor() {
        /** @type {CommandLineArguments} */
        this.default = Object.freeze({
            dataRoot: './data',
            port: 8000,
            listen: false,
            listenAddressIPv6: '[::]',
            listenAddressIPv4: '0.0.0.0',
            enableIPv4: true,
            enableIPv6: false,
            dnsPreferIPv6: false,
            autorun: false,
            autorunHostname: 'auto',
            autorunPortOverride: -1,
            enableCorsProxy: false,
            disableCsrf: false,
            ssl: false,
            certPath: 'certs/cert.pem',
            keyPath: 'certs/privkey.pem',
            whitelistMode: true,
            avoidLocalhost: false,
            basicAuthMode: false,
            requestProxyEnabled: false,
            requestProxyUrl: '',
            requestProxyBypass: [],
            getIPv4ListenUrl: function () {
                throw new Error('getIPv4ListenUrl is not implemented');
            },
            getIPv6ListenUrl: function () {
                throw new Error('getIPv6ListenUrl is not implemented');
            },
            getAutorunHostname: async function () {
                throw new Error('getAutorunHostname is not implemented');
            },
            getAutorunUrl: function () {
                throw new Error('getAutorunUrl is not implemented');
            },
        });

        this.booleanAutoOptions = [true, false, 'auto'];
    }

    /**
     * Parses command line arguments.
     * @param {string[]} args Process startup arguments.
     * @returns {CommandLineArguments} Parsed command line arguments.
     */
    parse(args) {
        const cliArguments = yargs(hideBin(args))
            .usage('Usage: <your-start-script> <command> [options]')
            .option('enableIPv6', {
                type: 'string',
                default: null,
                describe: 'Enables IPv6 protocol.',
            }).option('enableIPv4', {
                type: 'string',
                default: null,
                describe: 'Enables IPv4 protocol.',
            }).option('port', {
                type: 'number',
                default: null,
                describe: 'Sets the port under which SillyTavern will run.\nIf not provided falls back to yaml config \'port\'.',
            }).option('dnsPreferIPv6', {
                type: 'boolean',
                default: null,
                describe: 'Prefers IPv6 for DNS\nyou should probably have the enabled if you\'re on an IPv6 only network\nIf not provided falls back to yaml config \'dnsPreferIPv6\'.',
            }).option('autorun', {
                type: 'boolean',
                default: null,
                describe: 'Automatically launch SillyTavern in the browser.\nAutorun is automatically disabled if --ssl is set to true.\nIf not provided falls back to yaml config \'autorun\'.',
            }).option('autorunHostname', {
                type: 'string',
                default: null,
                describe: 'Sets the autorun hostname, probably best left on \'auto\'.\nUse values like \'localhost\', \'st.example.com\'',
            }).option('autorunPortOverride', {
                type: 'string',
                default: null,
                describe: 'Overrides the port for autorun with open your browser with this port and ignore what port the server is running on. -1 is use server port',
            }).option('listen', {
                type: 'boolean',
                default: null,
                describe: 'SillyTavern is listening on all network interfaces (Wi-Fi, LAN, localhost). If false, will limit it only to internal localhost (127.0.0.1).\nIf not provided falls back to yaml config \'listen\'.',
            }).option('listenAddressIPv6', {
                type: 'string',
                default: null,
                describe: 'Set SillyTavern to listen to a specific IPv6 address. If not set, it will fallback to listen to all.',
            }).option('listenAddressIPv4', {
                type: 'string',
                default: null,
                describe: 'Set SillyTavern to listen to a specific IPv4 address. If not set, it will fallback to listen to all.',
            }).option('corsProxy', {
                type: 'boolean',
                default: null,
                describe: 'Enables CORS proxy\nIf not provided falls back to yaml config \'enableCorsProxy\'',
            }).option('disableCsrf', {
                type: 'boolean',
                default: null,
                describe: 'Disables CSRF protection',
            }).option('ssl', {
                type: 'boolean',
                default: false,
                describe: 'Enables SSL',
            }).option('certPath', {
                type: 'string',
                default: 'certs/cert.pem',
                describe: 'Path to your certificate file.',
            }).option('keyPath', {
                type: 'string',
                default: 'certs/privkey.pem',
                describe: 'Path to your private key file.',
            }).option('whitelist', {
                type: 'boolean',
                default: null,
                describe: 'Enables whitelist mode',
            }).option('dataRoot', {
                type: 'string',
                default: null,
                describe: 'Root directory for data storage',
            }).option('avoidLocalhost', {
                type: 'boolean',
                default: null,
                describe: 'Avoids using \'localhost\' for autorun in auto mode.\nuse if you don\'t have \'localhost\' in your hosts file',
            }).option('basicAuthMode', {
                type: 'boolean',
                default: null,
                describe: 'Enables basic authentication',
            }).option('requestProxyEnabled', {
                type: 'boolean',
                default: null,
                describe: 'Enables a use of proxy for outgoing requests',
            }).option('requestProxyUrl', {
                type: 'string',
                default: null,
                describe: 'Request proxy URL (HTTP or SOCKS protocols)',
            }).option('requestProxyBypass', {
                type: 'array',
                describe: 'Request proxy bypass list (space separated list of hosts)',
            }).parseSync();

        /** @type {CommandLineArguments} */
        const result = {
            dataRoot: cliArguments.dataRoot ?? getConfigValue('dataRoot', this.default.dataRoot),
            port: cliArguments.port ?? getConfigValue('port', this.default.port, 'number'),
            listen: cliArguments.listen ?? getConfigValue('listen', this.default.listen, 'boolean'),
            listenAddressIPv6: cliArguments.listenAddressIPv6 ?? getConfigValue('listenAddress.ipv6', this.default.listenAddressIPv6),
            listenAddressIPv4: cliArguments.listenAddressIPv4 ?? getConfigValue('listenAddress.ipv4', this.default.listenAddressIPv4),
            enableIPv4: stringToBool(cliArguments.enableIPv4) ?? stringToBool(getConfigValue('protocol.ipv4', this.default.enableIPv4)) ?? this.default.enableIPv4,
            enableIPv6: stringToBool(cliArguments.enableIPv6) ?? stringToBool(getConfigValue('protocol.ipv6', this.default.enableIPv6)) ?? this.default.enableIPv6,
            dnsPreferIPv6: cliArguments.dnsPreferIPv6 ?? getConfigValue('dnsPreferIPv6', this.default.dnsPreferIPv6, 'boolean'),
            autorun: cliArguments.autorun ?? getConfigValue('autorun', this.default.autorun, 'boolean'),
            autorunHostname: cliArguments.autorunHostname ?? getConfigValue('autorunHostname', this.default.autorunHostname),
            autorunPortOverride: cliArguments.autorunPortOverride ?? getConfigValue('autorunPortOverride', this.default.autorunPortOverride, 'number'),
            enableCorsProxy: cliArguments.corsProxy ?? getConfigValue('enableCorsProxy', this.default.enableCorsProxy, 'boolean'),
            disableCsrf: cliArguments.disableCsrf ?? getConfigValue('disableCsrfProtection', this.default.disableCsrf, 'boolean'),
            ssl: cliArguments.ssl ?? getConfigValue('ssl.enabled', this.default.ssl, 'boolean'),
            certPath: cliArguments.certPath ?? getConfigValue('ssl.certPath', this.default.certPath),
            keyPath: cliArguments.keyPath ?? getConfigValue('ssl.keyPath', this.default.keyPath),
            whitelistMode: cliArguments.whitelist ?? getConfigValue('whitelistMode', this.default.whitelistMode, 'boolean'),
            avoidLocalhost: cliArguments.avoidLocalhost ?? getConfigValue('avoidLocalhost', this.default.avoidLocalhost, 'boolean'),
            basicAuthMode: cliArguments.basicAuthMode ?? getConfigValue('basicAuthMode', this.default.basicAuthMode, 'boolean'),
            requestProxyEnabled: cliArguments.requestProxyEnabled ?? getConfigValue('requestProxy.enabled', this.default.requestProxyEnabled, 'boolean'),
            requestProxyUrl: cliArguments.requestProxyUrl ?? getConfigValue('requestProxy.url', this.default.requestProxyUrl),
            requestProxyBypass: cliArguments.requestProxyBypass ?? getConfigValue('requestProxy.bypass', this.default.requestProxyBypass),
            getIPv4ListenUrl: function () {
                const isValid = ipRegex.v4({ exact: true }).test(this.listenAddressIPv4);
                return new URL(
                    (this.ssl ? 'https://' : 'http://') +
                    (this.listen ? (isValid ? this.listenAddressIPv4 : '0.0.0.0') : '127.0.0.1') +
                    (':' + this.port),
                );
            },
            getIPv6ListenUrl: function () {
                const isValid = ipRegex.v6({ exact: true }).test(this.listenAddressIPv6);
                return new URL(
                    (this.ssl ? 'https://' : 'http://') +
                    (this.listen ? (isValid ? this.listenAddressIPv6 : '[::]') : '[::1]') +
                    (':' + this.port),
                );
            },
            getAutorunHostname: async function (useIPv6, useIPv4) {
                if (this.autorunHostname === 'auto') {
                    let localhostResolve = await canResolve('localhost', useIPv6, useIPv4);

                    if (useIPv6 && useIPv4) {
                        return (this.avoidLocalhost || !localhostResolve) ? '[::1]' : 'localhost';
                    }

                    if (useIPv6) {
                        return '[::1]';
                    }

                    if (useIPv4) {
                        return '127.0.0.1';
                    }
                }

                return this.autorunHostname;
            },
            getAutorunUrl: function (hostname) {
                const autorunPort = (this.autorunPortOverride >= 0) ? this.autorunPortOverride : this.port;
                return new URL(
                    (this.ssl ? 'https://' : 'http://') +
                    (hostname) +
                    (':') +
                    (autorunPort),
                );
            },
        };

        if (!this.booleanAutoOptions.includes(result.enableIPv6)) {
            console.warn(color.red('`protocol: ipv6` option invalid'), '\n use:', this.booleanAutoOptions, '\n setting to:', this.default.enableIPv6);
            result.enableIPv6 = this.default.enableIPv6;
        }

        if (!this.booleanAutoOptions.includes(result.enableIPv4)) {
            console.warn(color.red('`protocol: ipv4` option invalid'), '\n use:', this.booleanAutoOptions, '\n setting to:', this.default.enableIPv4);
            result.enableIPv4 = this.default.enableIPv4;
        }

        return result;
    }
}
