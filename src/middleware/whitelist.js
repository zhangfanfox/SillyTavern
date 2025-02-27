import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import dns from 'node:dns';
import Handlebars from 'handlebars';
import ipRegex from 'ip-regex';
import ipMatching from 'ip-matching';

import { getIpFromRequest } from '../express-common.js';
import { color, getConfigValue, safeReadFileSync } from '../util.js';

const whitelistPath = path.join(process.cwd(), './whitelist.txt');
const enableForwardedWhitelist = getConfigValue('enableForwardedWhitelist', false, 'boolean');
let whitelist = getConfigValue('whitelist', []);

if (fs.existsSync(whitelistPath)) {
    try {
        let whitelistTxt = fs.readFileSync(whitelistPath, 'utf-8');
        whitelist = whitelistTxt.split('\n').filter(ip => ip).map(ip => ip.trim());
    } catch (e) {
        // Ignore errors that may occur when reading the whitelist (e.g. permissions)
    }
}

await resolveHostnames();

/**
 * Get the client IP address from the request headers.
 * @param {import('express').Request} req Express request object
 * @returns {string|undefined} The client IP address
 */
function getForwardedIp(req) {
    if (!enableForwardedWhitelist) {
        return undefined;
    }

    // Check if X-Real-IP is available
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'].toString();
    }

    // Check for X-Forwarded-For and parse if available
    if (req.headers['x-forwarded-for']) {
        const ipList = req.headers['x-forwarded-for'].toString().split(',').map(ip => ip.trim());
        return ipList[0];
    }

    // If none of the headers are available, return undefined
    return undefined;
}

/**
 * Checks if a string is a valid hostname according to RFC 1123
 * @param {string} hostname The string to test
 * @returns {boolean} True if the string is a valid hostname
 */
function isValidHostname(hostname) {
    const hostnameRegex = /^(([a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$/i;
    return hostnameRegex.test(hostname);
}

/**
 * Checks if a string is an IP address, CIDR notation, or IP wildcard
 * @param {string} entry The string to test
 * @returns {boolean} True if the string matches any IP format
 */
function isIpFormat(entry) {
    // Match CIDR notation (e.g. 192.168.0.0/24)
    if (entry.includes('/')) {
        return true;
    }

    // Match exact IP address
    if (ipRegex({ exact: true }).test(entry)) {
        return true;
    }

    // Match IPv4 with wildcards (e.g. 192.168.*.* or 192.168.0.*)
    const ipWildcardRegex = /^(\d{1,3}|\*)\.(\d{1,3}|\*)\.(\d{1,3}|\*)\.(\d{1,3}|\*)$/;
    return ipWildcardRegex.test(entry);
}

/**
 * Validate the IP addresses in the whitelist.
 * Hostnames are resolved to IP addresses.
 */
async function resolveHostnames() {
    for (let i = 0; i < whitelist.length; i++) {
        try {
            const entry = whitelist[i];

            // Skip if entry appears to be an IP address, CIDR notation, or IP wildcard
            if (isIpFormat(entry)) {
                continue;
            }

            if (isValidHostname(entry)) {
                const result = await dns.promises.lookup(entry);

                if (result.address) {
                    console.info('Resolved whitelist hostname', entry, 'to IP address', result.address);
                    whitelist[i] = result.address;
                }
            }
        } catch {
            // Ignore errors when resolving hostnames
        }
    }
}

/**
 * Returns a middleware function that checks if the client IP is in the whitelist.
 * @returns {import('express').RequestHandler} The middleware function
 */
export default function whitelistMiddleware() {
    const forbiddenWebpage = Handlebars.compile(
        safeReadFileSync('./public/error/forbidden-by-whitelist.html') ?? '',
    );

    const noLogPaths = [
        '/favicon.ico',
    ];

    return function (req, res, next) {
        const clientIp = getIpFromRequest(req);
        const forwardedIp = getForwardedIp(req);
        const userAgent = req.headers['user-agent'];

        //clientIp = req.connection.remoteAddress.split(':').pop();
        if (!whitelist.some(x => ipMatching.matches(clientIp, ipMatching.getMatch(x)))
            || forwardedIp && !whitelist.some(x => ipMatching.matches(forwardedIp, ipMatching.getMatch(x)))
        ) {
            // Log the connection attempt with real IP address
            const ipDetails = forwardedIp
                ? `${clientIp} (forwarded from ${forwardedIp})`
                : clientIp;

            if (!noLogPaths.includes(req.path)) {
                console.warn(
                    color.red(
                        `Blocked connection from ${ipDetails}; User Agent: ${userAgent}\n\tTo allow this connection, add its IP address to the whitelist or disable whitelist mode by editing config.yaml in the root directory of your SillyTavern installation.\n`,
                    ),
                );
            }

            return res.status(403).send(forbiddenWebpage({ ipDetails }));
        }
        next();
    };
}
