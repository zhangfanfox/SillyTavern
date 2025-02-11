import { saveSettingsDebounced } from '../../script.js';

const MIGRATED_MARKER = '__migrated';
const MIGRATABLE_KEYS = [
    /^AlertRegex_/,
    /^AlertWI_/,
    /^Assets_SkipConfirm_/,
    /^Characters_PerPage$/,
    /^DataBank_sortField$/,
    /^DataBank_sortOrder$/,
    /^extension_update_nag$/,
    /^extensions_sortByName$/,
    /^FeatherlessModels_PerPage$/,
    /^GroupMembers_PerPage$/,
    /^GroupCandidates_PerPage$/,
    /^LNavLockOn$/,
    /^LNavOpened$/,
    /^mediaWarningShown:/,
    /^NavLockOn$/,
    /^NavOpened$/,
    /^Personas_PerPage$/,
    /^Personas_GridView$/,
    /^Proxy_SkipConfirm_/,
    /^RegenerateWithCtrlEnter$/,
    /^SelectedNavTab$/,
    /^sendAsNamelessWarningShown$/,
    /^StoryStringValidationCache$/,
    /^WINavOpened$/,
    /^WI_PerPage$/,
    /^world_info_sort_order$/,
];

/**
 * Provides access to account storage of arbitrary key-value pairs.
 */
class AccountStorage {
    constructor() {
        this.state = {};
        this.ready = false;
    }

    #migrateLocalStorage() {
        for (let i = 0; i < globalThis.localStorage.length; i++) {
            const key = globalThis.localStorage.key(i);
            const value = globalThis.localStorage.getItem(key);

            if (MIGRATABLE_KEYS.some(k => k.test(key))) {
                this.state[key] = value;
                globalThis.localStorage.removeItem(key);
            }
        }
    }

    /**
     * Initialize the account storage.
     * @param {Object} state Initial state
     */
    init(state) {
        if (state && typeof state === 'object') {
            this.state = Object.assign(this.state, state);
        }

        if (!Object.hasOwn(this.state, MIGRATED_MARKER)) {
            this.#migrateLocalStorage();
            this.state[MIGRATED_MARKER] = 1;
            saveSettingsDebounced();
        }

        this.ready = true;
    }

    /**
     * Get the value of a key in account storage.
     * @param {string} key Key to get
     * @returns {string|null} Value of the key
     */
    getItem(key) {
        if (!this.ready) {
            console.warn(`AccountStorage not ready (trying to read from ${key})`);
        }

        return Object.hasOwn(this.state, key) ? String(this.state[key]) : null;
    }

    /**
     * Set a key in account storage.
     * @param {string} key Key to set
     * @param {string} value Value to set
     */
    setItem(key, value) {
        if (!this.ready) {
            console.warn(`AccountStorage not ready (trying to write to ${key})`);
        }

        this.state[key] = String(value);
        saveSettingsDebounced();
    }

    /**
     * Remove a key from account storage.
     * @param {string} key Key to remove
     */
    removeItem(key) {
        if (!this.ready) {
            console.warn(`AccountStorage not ready (trying to remove ${key})`);
        }

        delete this.state[key];
        saveSettingsDebounced();
    }
}

/**
 * Account storage instance.
 */
export const accountStorage = new AccountStorage();
