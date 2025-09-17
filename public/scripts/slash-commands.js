import { Fuse, DOMPurify } from '../lib.js';
import { copyText, flashHighlight } from './utils.js';

import {
    Generate,
    activateSendButtons,
    addOneMessage,
    characters,
    chat,
    chat_metadata,
    comment_avatar,
    deactivateSendButtons,
    default_avatar,
    deleteSwipe,
    displayPastChats,
    duplicateCharacter,
    eventSource,
    event_types,
    extension_prompt_roles,
    extension_prompt_types,
    extractMessageBias,
    generateQuietPrompt,
    generateRaw,
    getCurrentChatDetails,
    getCurrentChatId,
    getFirstDisplayedMessageId,
    getThumbnailUrl,
    is_send_press,
    main_api,
    name1,
    name2,
    neutralCharacterName,
    newAssistantChat,
    online_status,
    reloadCurrentChat,
    removeMacros,
    renameCharacter,
    renameChat,
    saveChatConditional,
    saveSettings,
    saveSettingsDebounced,
    sendMessageAsUser,
    sendSystemMessage,
    setActiveCharacter,
    setActiveGroup,
    setCharacterId,
    setCharacterName,
    setExtensionPrompt,
    showMoreMessages,
    stopGeneration,
    substituteParams,
    syncMesToSwipe,
    system_avatar,
    system_message_types,
    this_chid,
} from '../script.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommandParserError } from './slash-commands/SlashCommandParserError.js';
import { getMessageTimeStamp, isMobile } from './RossAscends-mods.js';
import { hideChatMessageRange } from './chats.js';
import { getContext, saveMetadataDebounced } from './extensions.js';
import { getRegexedString, regex_placement } from './extensions/regex/engine.js';
import { findGroupMemberId, groups, is_group_generating, openGroupById, resetSelectedGroup, saveGroupChat, selected_group, getGroupMembers } from './group-chats.js';
import { chat_completion_sources, oai_settings, promptManager } from './openai.js';
import { user_avatar } from './personas.js';
import { addEphemeralStoppingString, chat_styles, context_presets, flushEphemeralStoppingStrings, power_user } from './power-user.js';
import { SERVER_INPUTS, textgen_types, textgenerationwebui_settings } from './textgen-settings.js';
import { decodeTextTokens, getAvailableTokenizers, getFriendlyTokenizerName, getTextTokens, getTokenCountAsync, selectTokenizer } from './tokenizers.js';
import { debounce, delay, equalsIgnoreCaseAndAccents, findChar, getCharIndex, isFalseBoolean, isTrueBoolean, onlyUnique, regexFromString, showFontAwesomePicker, stringToRange, trimToEndSentence, trimToStartSentence, waitUntilCondition } from './utils.js';
import { registerVariableCommands, resolveVariable } from './variables.js';
import { background_settings } from './backgrounds.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { SlashCommandClosureResult } from './slash-commands/SlashCommandClosureResult.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { AutoComplete, AUTOCOMPLETE_STATE } from './autocomplete/AutoComplete.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { SlashCommandAbortController } from './slash-commands/SlashCommandAbortController.js';
import { SlashCommandNamedArgumentAssignment } from './slash-commands/SlashCommandNamedArgumentAssignment.js';
import { SlashCommandEnumValue, enumTypes } from './slash-commands/SlashCommandEnumValue.js';
import { POPUP_RESULT, POPUP_TYPE, Popup, callGenericPopup } from './popup.js';
import { commonEnumProviders, enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandBreakController } from './slash-commands/SlashCommandBreakController.js';
import { SlashCommandExecutionError } from './slash-commands/SlashCommandExecutionError.js';
import { slashCommandReturnHelper } from './slash-commands/SlashCommandReturnHelper.js';
import { accountStorage } from './util/AccountStorage.js';
import { SlashCommandDebugController } from './slash-commands/SlashCommandDebugController.js';
import { SlashCommandScope } from './slash-commands/SlashCommandScope.js';
import { t } from './i18n.js';
import { kai_settings } from './kai-settings.js';
import { instruct_presets, selectContextPreset, selectInstructPreset } from './instruct-mode.js';
import { debounce_timeout } from './constants.js';
export {
    executeSlashCommands, executeSlashCommandsWithOptions, getSlashCommandsHelp, registerSlashCommand,
};

export const parser = new SlashCommandParser();
/**
 * @deprecated Use SlashCommandParser.addCommandObject() instead
 */
const registerSlashCommand = SlashCommandParser.addCommand.bind(SlashCommandParser);
const getSlashCommandsHelp = parser.getHelpString.bind(parser);

/**
 * Converts a SlashCommandClosure to a filter function that returns a boolean.
 * @param {SlashCommandClosure} closure
 * @returns {() => Promise<boolean>}
 */
function closureToFilter(closure) {
    return async () => {
        try {
            const localClosure = closure.getCopy();
            localClosure.onProgress = () => { };
            const result = await localClosure.execute();
            return isTrueBoolean(result.pipe);
        } catch (e) {
            console.error('Error executing filter closure', e);
            return false;
        }
    };
}

/**
 * @typedef {object} ConnectAPIMap
 * @property {string} selected - API name (e.g. "textgenerationwebui", "openai")
 * @property {string?} [button] - CSS selector for the API button
 * @property {string?} [type] - API type, mostly used by text completion. (e.g. "openrouter")
 * @property {string?} [source] - API source, mostly used by chat completion. (e.g. "openai")
 */

/** @type {Record<string, ConnectAPIMap>} */
export const CONNECT_API_MAP = {};

/** @type {string[]} */
export const UNIQUE_APIS = [];

function setupConnectAPIMap() {
    /** @type {Record<string, ConnectAPIMap>} */
    const result = {
        // Default APIs not contained inside text gen / chat gen
        'kobold': {
            selected: 'kobold',
            button: '#api_button',
        },
        'horde': {
            selected: 'koboldhorde',
        },
        'novel': {
            selected: 'novel',
            button: '#api_button_novel',
        },
        'koboldcpp': {
            selected: 'textgenerationwebui',
            button: '#api_button_textgenerationwebui',
            type: textgen_types.KOBOLDCPP,
        },
        // KoboldCpp alias
        'kcpp': {
            selected: 'textgenerationwebui',
            button: '#api_button_textgenerationwebui',
            type: textgen_types.KOBOLDCPP,
        },
        'openai': {
            selected: 'openai',
            button: '#api_button_openai',
            source: chat_completion_sources.OPENAI,
        },
        // OpenAI alias
        'oai': {
            selected: 'openai',
            button: '#api_button_openai',
            source: chat_completion_sources.OPENAI,
        },
        // Google alias
        'google': {
            selected: 'openai',
            button: '#api_button_openai',
            source: chat_completion_sources.MAKERSUITE,
        },
        // OpenRouter special naming, to differentiate between chat comp and text comp
        'openrouter': {
            selected: 'openai',
            button: '#api_button_openai',
            source: chat_completion_sources.OPENROUTER,
        },
        'openrouter-text': {
            selected: 'textgenerationwebui',
            button: '#api_button_textgenerationwebui',
            type: textgen_types.OPENROUTER,
        },
    };

    // Fill connections map from textgen_types and chat_completion_sources
    for (const textGenType of Object.values(textgen_types)) {
        if (result[textGenType]) continue;
        result[textGenType] = {
            selected: 'textgenerationwebui',
            button: '#api_button_textgenerationwebui',
            type: textGenType,
        };
    }

    for (const chatCompletionSource of Object.values(chat_completion_sources)) {
        if (result[chatCompletionSource]) continue;
        result[chatCompletionSource] = {
            selected: 'openai',
            button: '#api_button_openai',
            source: chatCompletionSource,
        };
    }

    Object.assign(CONNECT_API_MAP, result);
    UNIQUE_APIS.push(...new Set(Object.values(CONNECT_API_MAP).map(x => x.selected)));
}

export function initDefaultSlashCommands() {
    eventSource.on(event_types.CHAT_CHANGED, processChatSlashCommands);
    setupConnectAPIMap();

    async function enableInstructCallback() {
        $('#instruct_enabled').prop('checked', true).trigger('input').trigger('change');
        return '';
    }

    async function disableInstructCallback() {
        $('#instruct_enabled').prop('checked', false).trigger('input').trigger('change');
        return '';
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'dupe',
        callback: duplicateCharacter,
        helpString: t`Duplicates the currently selected character.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'api',
        callback: async function (args, text) {
            if (!text?.toString()?.trim()) {
                for (const [key, config] of Object.entries(CONNECT_API_MAP)) {
                    if (config.selected !== main_api) continue;

                    if (config.source) {
                        if (oai_settings.chat_completion_source === config.source) {
                            return key;
                        } else {
                            continue;
                        }
                    }

                    if (config.type) {
                        if (textgenerationwebui_settings.type === config.type) {
                            return key;
                        } else {
                            continue;
                        }
                    }

                    return key;
                }

                console.error('FIXME: The current API is not in the API map');
                return '';
            }

            const apiConfig = CONNECT_API_MAP[text?.toString()?.toLowerCase() ?? ''];
            if (!apiConfig) {
                toastr.error(t`Error: ${text} is not a valid API`);
                return '';
            }

            let connectionRequired = false;

            if (main_api !== apiConfig.selected) {
                $(`#main_api option[value='${apiConfig.selected || text}']`).prop('selected', true);
                $('#main_api').trigger('change');
                connectionRequired = true;
            }

            if (apiConfig.source && oai_settings.chat_completion_source !== apiConfig.source) {
                $(`#chat_completion_source option[value='${apiConfig.source}']`).prop('selected', true);
                $('#chat_completion_source').trigger('change');
                connectionRequired = true;
            }

            if (apiConfig.type && textgenerationwebui_settings.type !== apiConfig.type) {
                $(`#textgen_type option[value='${apiConfig.type}']`).prop('selected', true);
                $('#textgen_type').trigger('change');
                connectionRequired = true;
            }

            if (connectionRequired && apiConfig.button) {
                $(apiConfig.button).trigger('click');
            }

            const quiet = isTrueBoolean(args?.quiet?.toString());
            const toast = quiet ? jQuery() : toastr.info(t`API set to ${text}, trying to connect..`);

            try {
                if (connectionRequired) {
                    await waitUntilCondition(() => online_status !== 'no_connection', 5000, 100);
                }
                console.log('Connection successful');
            } catch {
                console.log('Could not connect after 5 seconds, skipping.');
            }

            toastr.clear(toast);
            return text?.toString()?.trim() ?? '';
        },
        returns: t`the current API`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`Suppress the toast message on connection`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`API to connect to`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: Object.entries(CONNECT_API_MAP).sort(([a], [b]) => a.localeCompare(b)).map(([api, { selected }]) =>
                    new SlashCommandEnumValue(api, selected, enumTypes.getBasedOnIndex(UNIQUE_APIS.findIndex(x => x === selected)),
                        selected[0].toUpperCase() ?? enumIcons.default)),
            }),
        ],
        helpString: `
            <div>
                ${t`Connect to an API. If no argument is provided, it will return the currently connected API.`}
            </div>
            <div>
                <strong>${t`Available APIs:`}</strong>
                <pre><code>${Object.keys(CONNECT_API_MAP).sort((a, b) => a.localeCompare(b)).join(', ')}</code></pre>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'impersonate',
        callback: async function (args, prompt) {
            const options = prompt?.toString()?.trim() ? { quiet_prompt: prompt.toString().trim(), quietToLoud: true } : {};
            const shouldAwait = isTrueBoolean(args?.await?.toString());
            const outerPromise = new Promise((outerResolve) => setTimeout(async () => {
                try {
                    await waitUntilCondition(() => !is_send_press && !is_group_generating, 10000, 100);
                } catch {
                    console.warn('Timeout waiting for generation unlock');
                    toastr.warning(t`Cannot run /impersonate command while the reply is being generated.`);
                    return '';
                }

                // Prevent generate recursion
                $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));

                outerResolve(new Promise(innerResolve => setTimeout(() => innerResolve(Generate('impersonate', options)), 1)));
            }, 1));

            if (shouldAwait) {
                const innerPromise = await outerPromise;
                await innerPromise;
            }

            return '';
        }
        ,
        aliases: ['imp'],
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'await',
                t`Whether to await for the triggered generation before continuing`,
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: `
            <div>
                ${t`Calls an impersonation response, with an optional additional prompt.`}
            </div>
            <div>
                ${t`If <code>await=true</code> named argument is passed, the command will wait for the impersonation to end before continuing.`}
            </div>
            <div>
                <strong>${t`Example:`}</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/impersonate What is the meaning of life?</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'delchat',
        callback: async function () {
            return displayPastChats().then(() => new Promise((resolve) => {
                let resolved = false;
                const timeOutId = setTimeout(() => {
                    toastr.error(t`Chat deletion timed out. Please try again.`);
                    setResolved();
                }, 5000);

                const setResolved = () => {
                    if (resolved) {
                        return;
                    }
                    resolved = true;
                    [event_types.CHAT_DELETED, event_types.GROUP_CHAT_DELETED].forEach((eventType) => {
                        eventSource.removeListener(eventType, setResolved);
                    });
                    clearTimeout(timeOutId);
                    resolve('');
                };

                [event_types.CHAT_DELETED, event_types.GROUP_CHAT_DELETED].forEach((eventType) => {
                    eventSource.on(eventType, setResolved);
                });

                const currentChatDeleteButton = $('.select_chat_block[highlight=\'true\']').parent().find('.PastChat_cross');
                $(currentChatDeleteButton).trigger('click', { fromSlashCommand: true });
            }));
        },
        helpString: t`Deletes the current chat.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'renamechat',
        callback: async function doRenameChat(_, chatName) {
            if (!chatName) {
                toastr.warning(t`Name must be provided as an argument to rename this chat.`);
                return '';
            }

            const currentChatName = getCurrentChatId();
            if (!currentChatName) {
                toastr.warning(t`No chat selected that can be renamed.`);
                return '';
            }

            await renameChat(currentChatName, chatName.toString());

            toastr.success(t`Successfully renamed chat to: ${chatName}`);
            return '';
        },
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`new chat name`, [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: t`Renames the current chat.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'getchatname',
        callback: async function doGetChatName() {
            return getCurrentChatDetails().sessionName;
        },
        returns: t`chat file name`,
        helpString: t`Returns the name of the current chat file into the pipe.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'closechat',
        callback: function () {
            $('#option_close_chat').trigger('click');
            return '';
        },
        helpString: t`Closes the current chat.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tempchat',
        callback: () => {
            return new Promise((resolve, reject) => {
                const eventCallback = async (chatId) => {
                    if (chatId) {
                        return reject(t`Not in a temporary chat`);
                    }
                    await newAssistantChat({ temporary: true });
                    return resolve('');
                };
                eventSource.once(event_types.CHAT_CHANGED, eventCallback);
                $('#option_close_chat').trigger('click');
                setTimeout(() => {
                    reject(t`Failed to open temporary chat`);
                    eventSource.removeListener(event_types.CHAT_CHANGED, eventCallback);
                }, debounce_timeout.relaxed);
            });
        },
        helpString: t`Opens a temporary chat with Assistant.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'panels',
        callback: function () {
            $('#option_settings').trigger('click');
            return '';
        },
        aliases: ['togglepanels'],
        helpString: t`Toggle UI panels on/off`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'forcesave',
        callback: async function () {
            await saveSettings();
            await saveChatConditional();
            toastr.success(t`Chat and settings saved.`);
            return '';
        },
        helpString: t`Forces a save of the current chat and settings`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'instruct',
        callback: async function (args, name) {
            if (!name) {
                return power_user.instruct.enabled || isTrueBoolean(args?.forceGet?.toString()) ? power_user.instruct.preset : '';
            }

            const quiet = isTrueBoolean(args?.quiet?.toString());
            const instructNames = instruct_presets.map(preset => preset.name);
            const fuse = new Fuse(instructNames);
            const result = fuse.search(name?.toString() ?? '');

            if (result.length === 0) {
                !quiet && toastr.warning(t`Instruct template '${name}' not found`);
                return '';
            }

            const foundName = result[0].item;
            selectInstructPreset(foundName, { quiet: quiet });
            return foundName;
        },
        returns: t`current template`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`Suppress the toast message on template change`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'forceGet',
                description: t`Force getting a name even if instruct mode is disabled`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`instruct template name`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => instruct_presets.map(preset => new SlashCommandEnumValue(preset.name, null, enumTypes.enum, enumIcons.preset)),
            }),
        ],
        helpString: `
            <div>
                ${t`Selects instruct mode template by name. Enables instruct mode if not already enabled.`}
                ${t`Gets the current instruct template if no name is provided and instruct mode is enabled or <code>forceGet=true</code> is passed.`}
            </div>
            <div>
                <strong>${t`Example:`}</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/instruct creative</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'instruct-on',
        callback: enableInstructCallback,
        helpString: t`Enables instruct mode.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'instruct-off',
        callback: disableInstructCallback,
        helpString: t`Disables instruct mode`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'instruct-state',
        aliases: ['instruct-toggle'],
        helpString: t`Gets the current instruct mode state. If an argument is provided, it will set the instruct mode state.`,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`instruct mode state`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        callback: async (_args, state) => {
            if (!state || typeof state !== 'string') {
                return String(power_user.instruct.enabled);
            }

            const newState = isTrueBoolean(state);
            newState ? enableInstructCallback() : disableInstructCallback();
            return String(power_user.instruct.enabled);
        },
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'context',
        callback: async function (args, name) {
            if (!name) {
                return power_user.context.preset;
            }

            const quiet = isTrueBoolean(args?.quiet?.toString());
            const contextNames = context_presets.map(preset => preset.name);
            const fuse = new Fuse(contextNames);
            const result = fuse.search(name?.toString() ?? '');

            if (result.length === 0) {
                !quiet && toastr.warning(t`Context template '${name}' not found`);
                return '';
            }

            const foundName = result[0].item;
            selectContextPreset(foundName, { quiet: quiet });
            return foundName;
        },
        returns: t`template name`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`Suppress the toast message on template change`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`context template name`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => context_presets.map(preset => new SlashCommandEnumValue(preset.name, null, enumTypes.enum, enumIcons.preset)),
            }),
        ],
        helpString: t`Selects context template by name. Gets the current template if no name is provided`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'chat-manager',
        callback: () => {
            $('#option_select_chat').trigger('click');
            return '';
        },
        aliases: ['chat-history', 'manage-chats'],
        helpString: t`Opens the chat manager for the current character/group.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: '?',
        callback: helpCommandCallback,
        aliases: ['help'],
        unnamedArgumentList: [SlashCommandArgument.fromProps({
            description: t`help topic`,
            typeList: [ARGUMENT_TYPE.STRING],
            enumList: [
                new SlashCommandEnumValue('slash', t`slash commands (STscript)`, enumTypes.command, '/'),
                new SlashCommandEnumValue('macros', t`{{macros}} (text replacement)`, enumTypes.macro, enumIcons.macro),
                new SlashCommandEnumValue('format', t`chat/text formatting`, enumTypes.name, '★'),
                new SlashCommandEnumValue('hotkeys', t`keyboard shortcuts`, enumTypes.enum, '⏎'),
            ],
        })],
        helpString: t`Get help on macros, chat formatting and commands.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'bg',
        callback: setBackgroundCallback,
        aliases: ['background'],
        returns: t`the current background`,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`background filename`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => [...document.querySelectorAll('.bg_example')]
                    .map(it => new SlashCommandEnumValue(it.getAttribute('bgfile')))
                    .filter(it => it.value?.length),
            }),
        ],
        helpString: `
        <div>
            ${t`Sets a background according to the provided filename. Partial names allowed.`}
        </div>
        <div>
            ${t`If no background is provided, this will return the currently selected background.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/bg beach.jpg</code></pre>
                </li>
                <li>
                    <pre><code>/bg</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'char-find',
        aliases: ['findchar'],
        callback: (args, name) => {
            if (typeof name !== 'string') throw new Error(t`name must be a string`);
            if (args.preferCurrent instanceof SlashCommandClosure || Array.isArray(args.preferCurrent)) throw new Error(t`preferCurrent cannot be a closure or array`);
            if (args.quiet instanceof SlashCommandClosure || Array.isArray(args.quiet)) throw new Error(t`quiet cannot be a closure or array`);

            const char = findChar({ name: name, filteredByTags: validateArrayArgString(args.tag, 'tag'), preferCurrentChar: !isFalseBoolean(args.preferCurrent), quiet: isTrueBoolean(args.quiet) });
            return char?.avatar ?? '';
        },
        returns: t`the avatar key (unique identifier) of the character`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'tag',
                description: t`Supply one or more tags to filter down to the correct character for the provided name, if multiple characters have the same name.`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: commonEnumProviders.tags('assigned'),
                acceptsMultiple: true,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'preferCurrent',
                description: t`Prefer current character or characters in a group, if multiple characters match`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`Do not show warning if multiple charactrers are found`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumProvider: commonEnumProviders.boolean('trueFalse'),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`Character name - or unique character identifier (avatar key)`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: commonEnumProviders.characters('character'),
            }),
        ],
        helpString: `
        <div>
            ${t`Searches for a character and returns its avatar key.`}
        </div>
        <div>
            ${t`This can be used to choose the correct character for something like <code>/sendas</code> or other commands in need of a character name if you have multiple characters with the same name.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/char-find name="Chloe"</code></pre>
                    ${t`Returns the avatar key for "Chloe".`}
                </li>
                <li>
                    <pre><code>/search name="Chloe" tag="friend"</code></pre>
                    ${t`Returns the avatar key for the character "Chloe" that is tagged with "friend".`}
                    ${t`This is useful if you for example have multiple characters named "Chloe", and the others are "foe", "goddess", or anything else, so you can actually select the character you are looking for.`}
                </li>
            </ul>
        </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sendas',
        rawQuotes: true,
        callback: sendMessageAs,
        returns: t`Optionally the text of the sent message, if specified in the "return" argument`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: t`Character name - or unique character identifier (avatar key)`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.characters('character'),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'avatar',
                description: t`Character avatar override (Can be either avatar key or just the character name to pull the avatar from)`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: commonEnumProviders.characters('character'),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'compact',
                description: t`Use compact layout`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'at',
                description: t`position to insert the message (index-based, corresponding to message id). If not set, the message will be inserted at the end of the chat.\nNegative values (including -0) are accepted and will work similarly to how 'depth' usually works. For example, -1 will insert the message right before the last message in chat.`,
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages({ allowIdAfter: true }),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'return',
                description: t`The way how you want the return value to be provided`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'none',
                enumList: slashCommandReturnHelper.enumList({ allowObject: true }),
                forceEnum: true,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'raw',
                description: t`If true, does not alter quoted literal unnamed arguments`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumProvider: commonEnumProviders.boolean('trueFalse'),
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            ${t`Sends a message as a specific character. Uses the character avatar if it exists in the characters list.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/sendas name="Chloe" Hello, guys!</code></pre>
                    ${t`will send "Hello, guys!" from "Chloe".`}
                </li>
                <li>
                    <pre><code>/sendas name="Chloe" avatar="BigBadBoss" Hehehe, I am the big bad evil, fear me.</code></pre>
                    ${t`will send a message as the character "Chloe", but utilizing the avatar from a character named "BigBadBoss".`}
                </li>
            </ul>
        </div>
        <div>
            ${t`If "compact" is set to true, the message is sent using a compact layout.`}
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sys',
        rawQuotes: true,
        callback: sendNarratorMessage,
        aliases: ['nar'],
        returns: t`Optionally the text of the sent message, if specified in the "return" argument`,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'compact',
                t`compact layout`,
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'at',
                description: t`position to insert the message (index-based, corresponding to message id). If not set, the message will be inserted at the end of the chat.\nNegative values (including -0) are accepted and will work similarly to how 'depth' usually works. For example, -1 will insert the message right before the last message in chat.`,
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages({ allowIdAfter: true }),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: t`Optional custom display name to use for this system narrator message.`,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'return',
                description: t`The way how you want the return value to be provided`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'none',
                enumList: slashCommandReturnHelper.enumList({ allowObject: true }),
                forceEnum: true,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'raw',
                description: t`If true, does not alter quoted literal unnamed arguments`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumProvider: commonEnumProviders.boolean('trueFalse'),
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            ${t`Sends a message as a system narrator.`}
        </div>
        <div>
            ${t`If <code>compact</code> is set to <code>true</code>, the message is sent using a compact layout.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/sys The sun sets in the west.</code></pre>
                </li>
                <li>
                    <pre><code>/sys compact=true A brief note.</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sysname',
        callback: setNarratorName,
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`name`, [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: t`Sets a name for future system narrator messages in this chat (display only). Default: System. Leave empty to reset.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'comment',
        rawQuotes: true,
        callback: sendCommentMessage,
        returns: t`Optionally the text of the sent message, if specified in the "return" argument`,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'compact',
                t`Whether to use a compact layout`,
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'at',
                description: t`position to insert the message (index-based, corresponding to message id). If not set, the message will be inserted at the end of the chat.\nNegative values (including -0) are accepted and will work similarly to how 'depth' usually works. For example, -1 will insert the message right before the last message in chat.`,
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages({ allowIdAfter: true }),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'return',
                description: t`The way how you want the return value to be provided`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'none',
                enumList: slashCommandReturnHelper.enumList({ allowObject: true }),
                forceEnum: true,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'raw',
                description: t`If true, does not alter quoted literal unnamed arguments`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumProvider: commonEnumProviders.boolean('trueFalse'),
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text',
                [ARGUMENT_TYPE.STRING],
                true,
            ),
        ],
        helpString: `
        <div>
            ${t`Adds a note/comment message not part of the chat.`}
        </div>
        <div>
            ${t`If <code>compact</code> is set to <code>true</code>, the message is sent using a compact layout.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/comment This is a comment</code></pre>
                </li>
                <li>
                    <pre><code>/comment compact=true This is a compact comment</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'single',
        callback: setStoryModeCallback,
        aliases: ['story'],
        helpString: t`Sets the message style to single document mode without names or avatars visible.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'bubble',
        callback: setBubbleModeCallback,
        aliases: ['bubbles'],
        helpString: t`Sets the message style to bubble chat mode.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'flat',
        callback: setFlatModeCallback,
        aliases: ['default'],
        helpString: t`Sets the message style to flat chat mode.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'continue',
        callback: continueChatCallback,
        aliases: ['cont'],
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'await',
                t`Whether to await for the continued generation before proceeding`,
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: `
        <div>
            ${t`Continues the last message in the chat, with an optional additional prompt.`}
        </div>
        <div>
            ${t`If <code>await=true</code> named argument is passed, the command will await for the continued generation before proceeding.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/continue</code></pre>
                    ${t`Continues the chat with no additional prompt and immediately proceeds to the next command.`}
                </li>
                <li>
                    <pre><code>/continue await=true Let's explore this further...</code></pre>
                    ${t`Continues the chat with the provided prompt and waits for the generation to finish.`}
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'go',
        callback: goToCharacterCallback,
        returns: t`The character/group name`,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`Character name - or unique character identifier (avatar key)`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.characters('all'),
            }),
        ],
        helpString: t`Opens up a chat with the character or group by its name`,
        aliases: ['char'],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'rename-char',
        /** @param {{silent: string, chats: string}} options @param {string} name */
        callback: async ({ silent = 'true', chats = null }, name) => {
            const renamed = await renameCharacter(name, { silent: isTrueBoolean(silent), renameChats: chats !== null ? isTrueBoolean(chats) : null });
            return String(renamed);
        },
        returns: t`true/false - Whether the rename was successful`,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'silent', t`Hide any blocking popups. (if false, the name is optional. If not supplied, a popup asking for it will appear)`, [ARGUMENT_TYPE.BOOLEAN], false, false, 'true',
            ),
            new SlashCommandNamedArgument(
                'chats', t`Rename char in all previous chats`, [ARGUMENT_TYPE.BOOLEAN], false, false, '<null>',
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`new char name`, [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: t`Renames the current character.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sysgen',
        callback: generateSystemMessage,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'trim',
                description: t`Trim the output by the last sentence boundary`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                isRequired: false,
                enumProvider: commonEnumProviders.boolean('trueFalse'),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'compact',
                description: t`Use a compact layout for the message`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                isRequired: false,
                acceptsMultiple: false,
                enumProvider: commonEnumProviders.boolean('trueFalse'),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'at',
                description: t`Position to insert the message (index-based, corresponding to message id). If not set, the message will be inserted at the end of the chat.\nNegative values (including -0) are accepted and will work similarly to how 'depth' usually works. For example, -1 will insert the message right before the last message in chat.`,
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages({ allowIdAfter: true }),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: t`Optional custom display name to use for this system narrator message.`,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'return',
                description: t`The way how you want the return value to be provided`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'none',
                enumList: slashCommandReturnHelper.enumList({ allowObject: true }),
                forceEnum: true,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: t`Generates a system message using a specified prompt.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ask',
        callback: askCharacter,
        returns: t`Optionally the text of the sent message, if specified in the "return" argument`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: t`Character name - or unique character identifier (avatar key)`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.characters('character'),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'return',
                description: t`The way how you want the return value to be provided`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'pipe',
                enumList: slashCommandReturnHelper.enumList({ allowObject: true }),
                forceEnum: true,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], false, false,
            ),
        ],
        helpString: t`Asks a specified character card a prompt. Character name must be provided in a named argument.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'delname',
        callback: deleteMessagesByNameCallback,
        namedArgumentList: [],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`Character name - or unique character identifier (avatar key)`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.characters('character'),
            }),
        ],
        aliases: ['cancel'],
        helpString: `
        <div>
            ${t`Deletes all messages attributed to a specified name.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/delname John</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'send',
        rawQuotes: true,
        callback: sendUserMessageCallback,
        returns: t`Optionally the text of the sent message, if specified in the "return" argument`,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'compact',
                t`whether to use a compact layout`,
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'at',
                description: t`position to insert the message (index-based, corresponding to message id). If not set, the message will be inserted at the end of the chat.\nNegative values (including -0) are accepted and will work similarly to how 'depth' usually works. For example, -1 will insert the message right before the last message in chat.`,
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages({ allowIdAfter: true }),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: t`display name`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: '{{user}}',
                enumProvider: commonEnumProviders.personas,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'return',
                description: t`The way how you want the return value to be provided`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'none',
                enumList: slashCommandReturnHelper.enumList({ allowObject: true }),
                forceEnum: true,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'raw',
                description: t`If true, does not alter quoted literal unnamed arguments`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumProvider: commonEnumProviders.boolean('trueFalse'),
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text',
                [ARGUMENT_TYPE.STRING],
                true,
            ),
        ],
        helpString: `
        <div>
            ${t`Adds a user message to the chat log without triggering a generation.`}
        </div>
        <div>
            ${t`If <code>compact</code> is set to <code>true</code>, the message is sent using a compact layout.`}
        </div>
        <div>
            ${t`If <code>name</code> is set, it will be displayed as the message sender. Can be an empty for no name.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/send Hello there!</code></pre>
                </li>
                <li>
                    <pre><code>/send compact=true Hi</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'trigger',
        callback: triggerGenerationCallback,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'await',
                t`Whether to await for the triggered generation before continuing`,
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`group member index (starts with 0) or name`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: `
        <div>
            ${t`Triggers a message generation. If in group, can trigger a message for the specified group member index or name.`}
        </div>
        <div>
            ${t`If <code>await=true</code> named argument is passed, the command will await for the triggered generation before continuing.`}
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'hide',
        callback: hideMessageCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: t`only hide messages from a certain character or persona`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: commonEnumProviders.messageNames,
                isRequired: false,
                acceptsMultiple: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`message index (starts with 0) or range, defaults to the last message index if not provided`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.RANGE],
                isRequired: false,
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        helpString: t`Hides a chat message from the prompt.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'unhide',
        callback: unhideMessageCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: t`only unhide messages from a certain character or persona`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: commonEnumProviders.messageNames,
                isRequired: false,
                acceptsMultiple: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`message index (starts with 0) or range, defaults to the last message index if not provided`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.RANGE],
                isRequired: false,
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        helpString: t`Unhides a message from the prompt.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-get',
        aliases: ['getmember', 'memberget'],
        callback: (async ({ field = 'name' }, arg) => {
            if (!selected_group) {
                toastr.warning(t`Cannot run /member-get command outside of a group chat.`);
                return '';
            }
            if (field === '') {
                toastr.warning(t`'/member-get field=' argument required!`);
                return '';
            }
            field = field.toString();
            arg = arg.toString();
            if (!['name', 'index', 'id', 'avatar'].includes(field)) {
                toastr.warning(t`'/member-get field=' argument required!`);
                return '';
            }
            const isId = !isNaN(parseInt(arg));
            const groupMember = findGroupMemberId(arg, true);
            if (!groupMember) {
                toastr.warning(t`No group member found using ${isId ? 'id' : 'string'} ${arg}`);
                return '';
            }
            return groupMember[field];
        }),
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'field',
                description: t`Whether to retrieve the name, index, id, or avatar.`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                defaultValue: 'name',
                enumList: [
                    new SlashCommandEnumValue('name', t`Character name`),
                    new SlashCommandEnumValue('index', t`Group member index`),
                    new SlashCommandEnumValue('avatar', t`Character avatar`),
                    new SlashCommandEnumValue('id', t`Character index`),
                ],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`member index (starts with 0), name, or avatar`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: t`Retrieves a group member's name, index, id, or avatar.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-disable',
        callback: disableGroupMemberCallback,
        aliases: ['disable', 'disablemember', 'memberdisable'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`member index (starts with 0) or name`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: t`Disables a group member from being drafted for replies.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-enable',
        aliases: ['enable', 'enablemember', 'memberenable'],
        callback: enableGroupMemberCallback,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`member index (starts with 0) or name`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: t`Enables a group member to be drafted for replies.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-add',
        callback: addGroupMemberCallback,
        aliases: ['addmember', 'memberadd'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`Character name - or unique character identifier (avatar key)`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: () => selected_group ? commonEnumProviders.characters('character')() : [],
            }),
        ],
        helpString: `
        <div>
            ${t`Adds a new group member to the group chat.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/member-add John Doe</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-remove',
        callback: removeGroupMemberCallback,
        aliases: ['removemember', 'memberremove'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`member index (starts with 0) or name`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: `
        <div>
            ${t`Removes a group member from the group chat.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/member-remove 2</code></pre>
                    <pre><code>/member-remove John Doe</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-up',
        callback: moveGroupMemberUpCallback,
        aliases: ['upmember', 'memberup'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`member index (starts with 0) or name`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: t`Moves a group member up in the group chat list.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-down',
        callback: moveGroupMemberDownCallback,
        aliases: ['downmember', 'memberdown'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`member index (starts with 0) or name`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: t`Moves a group member down in the group chat list.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-peek',
        aliases: ['peek', 'memberpeek', 'peekmember'],
        callback: peekCallback,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`member index (starts with 0) or name`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: `
        <div>
            ${t`Shows a group member character card without switching chats.`}
        </div>
        <div>
            <strong>${t`Examples:`}</strong>
            <ul>
                <li>
                    <pre><code>/peek Gloria</code></pre>
                    ${t`Shows the character card for the character named "Gloria".`}
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-count',
        callback: countGroupMemberCallback,
        aliases: ['countmember', 'membercount'],
        helpString: t`Returns the total number of group members in the group chat list.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'delswipe',
        callback: deleteSwipeCallback,
        returns: t`the new, currently selected swipe id`,
        aliases: ['swipedel'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`1-based swipe id`,
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: true,
                enumProvider: () => Array.isArray(chat[chat.length - 1]?.swipes) ?
                    chat[chat.length - 1].swipes.map((/** @type {string} */ swipe, /** @type {number} */ i) => new SlashCommandEnumValue(String(i + 1), swipe, enumTypes.enum, enumIcons.message))
                    : [],
            }),
        ],
        helpString: `
        <div>
            ${t`Deletes a swipe from the last chat message. If swipe id is not provided, it deletes the current swipe.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/delswipe</code></pre>
                    ${t`Deletes the current swipe.`}
                </li>
                <li>
                    <pre><code>/delswipe 2</code></pre>
                    ${t`Deletes the second swipe from the last chat message.`}
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'echo',
        rawQuotes: true,
        callback: echoCallback,
        returns: t`the text`,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'title', t`title of the toast message`, [ARGUMENT_TYPE.STRING], false,
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'severity',
                description: t`severity level of the toast message`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'info',
                enumProvider: () => [
                    new SlashCommandEnumValue('info', 'info', enumTypes.macro, 'ℹ️'),
                    new SlashCommandEnumValue('warning', 'warning', enumTypes.enum, '⚠️'),
                    new SlashCommandEnumValue('error', 'error', enumTypes.enum, '❗'),
                    new SlashCommandEnumValue('success', 'success', enumTypes.enum, '✅'),
                ],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'timeout',
                description: t`time in milliseconds to display the toast message. Set this and 'extendedTimeout' to 0 to show indefinitely until dismissed.`,
                typeList: [ARGUMENT_TYPE.NUMBER],
                defaultValue: `${toastr.options.timeOut}`,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'extendedTimeout',
                description: t`time in milliseconds to display the toast message. Set this and 'timeout' to 0 to show indefinitely until dismissed.`,
                typeList: [ARGUMENT_TYPE.NUMBER],
                defaultValue: `${toastr.options.extendedTimeOut}`,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'preventDuplicates',
                description: t`prevent duplicate toasts with the same message from being displayed.`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'awaitDismissal',
                description: t`wait for the toast to be dismissed before continuing.`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'cssClass',
                description: t`additional CSS class to add to the toast message (e.g. for custom styling)`,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'color',
                description: t`custom CSS color of the toast message. Accepts all valid CSS color values (e.g. 'red', '#FF0000', 'rgb(255, 0, 0)').<br />>Can be more customizable with the 'cssClass' argument and custom classes.`,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'escapeHtml',
                description: t`whether to escape HTML in the toast message.`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'onClick',
                description: t`a closure to call when the toast is clicked. This executed closure receives scope as provided in the script. Careful about possible side effects when manipulating variables and more.`,
                typeList: [ARGUMENT_TYPE.CLOSURE],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'raw',
                description: t`If true, does not alter quoted literal unnamed arguments`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumProvider: commonEnumProviders.boolean('trueFalse'),
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Echoes the provided text to a toast message. Can be used to display informational messages or for pipes debugging.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/echo title="My Message" severity=warning This is a warning message</code></pre>
                </li>
                <li>
                    <pre><code>/echo color=purple This message is purple</code></pre>
                </li>
                <li>
                    <pre><code>/echo onClick={: /echo escapeHtml=false color=transparent cssClass=wider_dialogue_popup &lt;img src="/img/five.png" /&gt; :} timeout=5000 Clicking on this message within 5 seconds will open the image.</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'gen',
        callback: generateCallback,
        returns: t`generated text`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'trim',
                description: t`Trim the output by the last sentence boundary`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                isRequired: false,
                enumProvider: commonEnumProviders.boolean('trueFalse'),
            }),
            new SlashCommandNamedArgument(
                'lock', t`lock user input during generation`, [ARGUMENT_TYPE.BOOLEAN], false, false, null, commonEnumProviders.boolean('onOff')(),
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: t`in-prompt character name for instruct mode (or unique character identifier (avatar key), which will be used as name)`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'System',
                enumProvider: () => [...commonEnumProviders.characters('character')(), new SlashCommandEnumValue('System', null, enumTypes.enum, enumIcons.assistant)],
            }),
            new SlashCommandNamedArgument(
                'length', t`API response length in tokens`, [ARGUMENT_TYPE.NUMBER], false,
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'as',
                description: t`role of the output prompt`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue('system', null, enumTypes.enum, enumIcons.assistant),
                    new SlashCommandEnumValue('char', null, enumTypes.enum, enumIcons.character),
                ],
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            ${t`Generates text using the provided prompt and passes it to the next command through the pipe, optionally locking user input while generating and allowing to configure the in-prompt name for instruct mode (default = "System").`}
        </div>
        <div>
            ${t`"as" argument controls the role of the output prompt: system (default) or char. If "length" argument is provided as a number in tokens, allows to temporarily override an API response length.`}
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'genraw',
        callback: generateRawCallback,
        returns: t`generated text`,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'lock', t`lock user input during generation`, [ARGUMENT_TYPE.BOOLEAN], false, false, 'off', commonEnumProviders.boolean('onOff')(),
            ),
            new SlashCommandNamedArgument(
                'instruct', t`use instruct mode`, [ARGUMENT_TYPE.BOOLEAN], false, false, 'on', commonEnumProviders.boolean('onOff')(),
            ),
            new SlashCommandNamedArgument(
                'stop', t`one-time custom stop strings`, [ARGUMENT_TYPE.LIST], false, false, '[]',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'as',
                description: t`role of the output prompt`,
                defaultValue: 'system',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue('system', null, enumTypes.enum, enumIcons.assistant),
                    new SlashCommandEnumValue('char', null, enumTypes.enum, enumIcons.character),
                ],
            }),
            new SlashCommandNamedArgument(
                'system', t`system prompt at the start`, [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.VARIABLE_NAME], false,
            ),
            new SlashCommandNamedArgument(
                'prefill', t`prefill prompt at the end`, [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.VARIABLE_NAME], false,
            ),
            new SlashCommandNamedArgument(
                'length', t`API response length in tokens`, [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME], false,
            ),
            new SlashCommandNamedArgument(
                'trim', t`trim {{user}} and {{char}} prefixes from the output`, [ARGUMENT_TYPE.BOOLEAN], false, false, 'on', commonEnumProviders.boolean('onOff')(),
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            ${t`Generates text using the provided prompt and passes it to the next command through the pipe, optionally locking user input while generating. Does not include chat history or character card.`}
        </div>
        <div>
            ${t`Use instruct=off to skip instruct formatting, e.g. <pre><code>/genraw instruct=off Why is the sky blue?</code></pre>`}
        </div>
        <div>
            ${t`Use stop=... with a JSON-serialized array to add one-time custom stop strings, e.g. <pre><code>/genraw stop=["\\n"] Say hi</code></pre>`}
        </div>
        <div>
            ${t`"as" argument controls the role of the output prompt: system (default) or char. "system" argument adds an (optional) system prompt at the start.`}
        </div>
        <div>
            ${t`If "length" argument is provided as a number in tokens, allows to temporarily override an API response length.`}
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'addswipe',
        callback: addSwipeCallback,
        returns: t`the new swipe id`,
        aliases: ['swipeadd'],
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'switch',
                description: t`switch to the new swipe`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean()(),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            ${t`Adds a swipe to the last chat message.`}
        </div>
        <div>
            ${t`Use switch=true to switch to directly switch to the new swipe.`}
        </div>`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'stop',
        callback: () => {
            const stopped = stopGeneration();
            return String(stopped);
        },
        returns: t`true/false, whether the generation was running and got stopped`,
        helpString: `
            <div>
                ${t`Stops the generation and any streaming if it is currently running.`}
            </div>
            <div>
                ${t`Note: This command cannot be executed from the chat input, as sending any message or script from there is blocked during generation. But it can be executed via automations or QR scripts/buttons.`}
            </div>
        `,
        aliases: ['generate-stop'],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'abort',
        callback: abortCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`Whether to suppress the toast message notifying about the /abort call.`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`The reason for aborting command execution. Shown when quiet=false`,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        helpString: t`Aborts the slash command batch execution.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'fuzzy',
        callback: fuzzyCallback,
        returns: t`matching item`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'list',
                description: t`list of items to match against`,
                acceptsMultiple: false,
                isRequired: true,
                typeList: [ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.VARIABLE_NAME],
                enumProvider: commonEnumProviders.variables('all'),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'threshold',
                description: t`fuzzy match threshold (0.0 to 1.0)`,
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: false,
                defaultValue: '0.4',
                acceptsMultiple: false,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'mode',
                description: t`fuzzy match mode`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'first',
                acceptsMultiple: false,
                enumList: [
                    new SlashCommandEnumValue('first', t`first match below the threshold`, enumTypes.enum, enumIcons.default),
                    new SlashCommandEnumValue('best', t`best match below the threshold`, enumTypes.enum, enumIcons.default),
                ],
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text to search`, [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            ${t`Performs a fuzzy match of each item in the <code>list</code> against the <code>text to search</code>. If any item matches, then its name is returned. If no item matches the text, no value is returned.`}
        </div>
        <div>
            ${t`The optional <code>threshold</code> (default is 0.4) allows control over the match strictness.`}
            ${t`A low value (min 0.0) means the match is very strict.`}
            ${t`At 1.0 (max) the match is very loose and will match anything.`}
        </div>
        <div>
            ${t`The optional <code>mode</code> argument allows to control the behavior when multiple items match the text.`}
            <ul>
                <li>${t`<code>first</code> (default) returns the first match below the threshold.`}</li>
                <li>${t`<code>best</code> returns the best match below the threshold.`}</li>
            </ul>
        </div>
        <div>
            ${t`The returned value passes to the next command through the pipe.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/fuzzy list=["a","b","c"] threshold=0.4 abc</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pass',
        callback: (_, arg) => {
            // We do not support arrays of closures. Arrays of strings will be send as JSON
            if (Array.isArray(arg) && arg.some(x => x instanceof SlashCommandClosure)) throw new Error(t`Command /pass does not support multiple closures`);
            if (Array.isArray(arg)) return JSON.stringify(arg);
            return arg;
        },
        returns: t`the provided value`,
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text`, [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY, ARGUMENT_TYPE.CLOSURE], true,
            ),
        ],
        aliases: ['return'],
        helpString: `
        <div>
            <pre><span class="monospace">/pass (text)</span> – ${t`passes the text to the next command through the pipe.`}</pre>
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li><pre><code>/pass Hello world</code></pre></li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'delay',
        callback: delayCallback,
        aliases: ['wait', 'sleep'],
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`milliseconds`, [ARGUMENT_TYPE.NUMBER], true,
            ),
        ],
        helpString: `
        <div>
            ${t`Delays the next command in the pipe by the specified number of milliseconds.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/delay 1000</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'input',
        aliases: ['prompt'],
        callback: inputCallback,
        returns: t`user input`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'default',
                description: t`default value of the input field`,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'large',
                description: t`popup window will be shown larger in height, with more space for content (input field needs to be sized via 'rows' argument)`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'off',
                enumList: commonEnumProviders.boolean('onOff')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'wide',
                description: t`popup window will be shown wider, with a wider input field`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'off',
                enumList: commonEnumProviders.boolean('onOff')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'okButton',
                description: t`text for the ok button`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'Ok',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'rows',
                description: t`number of rows for the input field (lines being displayed)`,
                typeList: [ARGUMENT_TYPE.NUMBER],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'onSuccess',
                description: t`closure to execute when the ok button is clicked or the input is closed as successful (via Enter, etc)`,
                typeList: [ARGUMENT_TYPE.CLOSURE],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'onCancel',
                description: t`closure to execute when the cancel button is clicked or the input is closed as cancelled (via Escape, etc)`,
                typeList: [ARGUMENT_TYPE.CLOSURE],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`text to display`,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        helpString: `
        <div>
            ${t`Shows a popup with the provided text and an input field.`}
            ${t`The <code>default</code> argument is the default value of the input field, and the text argument is the text to display.`}
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'run',
        aliases: ['call', 'exec'],
        callback: runCallback,
        returns: t`result of the executed closure of QR`,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'args', t`named arguments`, [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY], false, true,
            ),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`scoped variable or qr label`,
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME, ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.CLOSURE],
                isRequired: true,
                enumProvider: (executor, scope) => [
                    ...commonEnumProviders.variables('scope')(executor, scope),
                    ...(typeof window['qrEnumProviderExecutables'] === 'function') ? window['qrEnumProviderExecutables']() : [],
                ],
            }),
        ],
        helpString: `
        <div>
            ${t`Runs a closure from a scoped variable, or a Quick Reply with the specified name from a currently active preset or from another preset.`}
            ${t`Named arguments can be referenced in a QR with <code>{{arg::key}}</code>.`}
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'messages',
        callback: getMessagesCallback,
        aliases: ['message'],
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'names', t`show message author names`, [ARGUMENT_TYPE.BOOLEAN], false, false, 'off', commonEnumProviders.boolean('onOff')(),
            ),
            new SlashCommandNamedArgument(
                'hidden', t`include hidden messages`, [ARGUMENT_TYPE.BOOLEAN], false, false, 'on', commonEnumProviders.boolean('onOff')(),
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'role',
                description: t`filter messages by role`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue('system', null, enumTypes.enum, enumIcons.system),
                    new SlashCommandEnumValue('assistant', null, enumTypes.enum, enumIcons.assistant),
                    new SlashCommandEnumValue('user', null, enumTypes.enum, enumIcons.user),
                ],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`message index (starts with 0) or range`,
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.RANGE],
                isRequired: true,
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        returns: t`the specified message or range of messages as a string`,
        helpString: `
        <div>
            ${t`Returns the specified message or range of messages as a string.`}
        </div>
        <div>
            ${t`Use the <code>hidden=off</code> argument to exclude hidden messages.`}
        </div>
        <div>
            ${t`Use the <code>role</code> argument to filter messages by role. Possible values are: system, assistant, user.`}
        </div>
        <div>
            <strong>${t`Examples:`}</strong>
            <ul>
                <li>
                    <pre><code>/messages 10</code></pre>
                    ${t`Returns the 10th message.`}
                </li>
                <li>
                    <pre><code>/messages names=on 5-10</code></pre>
                    ${t`Returns messages 5 through 10 with author names.`}
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'setinput',
        callback: setInputCallback,
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text`, [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            ${t`Sets the user input to the specified text and passes it to the next command through the pipe.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/setinput Hello world</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'popup',
        callback: popupCallback,
        returns: t`popup text`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'scroll',
                description: t`allows vertical scrolling of the content`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'true',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'large',
                description: t`show large popup`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'wide',
                description: t`show wide popup`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'wider',
                description: t`show wider popup`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'transparent',
                description: t`show transparent popup`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'okButton',
                description: t`text for the OK button`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'OK',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'cancelButton',
                description: t`text for the Cancel button`,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'result',
                description: t`if enabled, returns the popup result (as an integer) instead of the popup text. Resolves to 1 for OK and 0 cancel button, empty string for exiting out.`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`popup text`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: `
        <div>
            ${t`Shows a blocking popup with the specified text and buttons.`}
            ${t`Returns the popup text.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/popup large=on wide=on okButton="Confirm" Please confirm this action.</code></pre>
                </li>
                <li>
                    <pre><code>/popup okButton="Left" cancelButton="Right" result=true Do you want to go left or right? | /echo 0 means right, 1 means left. Choice: {{pipe}}</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'buttons',
        callback: buttonsCallback,
        returns: t`clicked button label (or array of labels if multiple is enabled)`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'labels',
                description: t`button labels`,
                typeList: [ARGUMENT_TYPE.LIST],
                isRequired: true,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'multiple',
                description: t`if enabled multiple buttons can be clicked/toggled, and all clicked buttons are returned as an array`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`text`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: `
        <div>
            ${t`Shows a blocking popup with the specified text and buttons.`}
            ${t`Returns the clicked button label into the pipe or empty string if canceled.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/buttons labels=["Yes","No"] Do you want to continue?</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'trimtokens',
        callback: trimTokensCallback,
        returns: t`trimmed text`,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'limit', t`number of tokens to keep`, [ARGUMENT_TYPE.NUMBER], true,
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'direction',
                description: t`trim direction`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumList: [
                    new SlashCommandEnumValue('start', null, enumTypes.enum, '⏪'),
                    new SlashCommandEnumValue('end', null, enumTypes.enum, '⏩'),
                ],
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text`, [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: `
        <div>
            ${t`Trims the start or end of text to the specified number of tokens.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/trimtokens limit=5 direction=start This is a long sentence with many words</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'trimstart',
        callback: trimStartCallback,
        returns: t`trimmed text`,
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text`, [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            ${t`Trims the text to the start of the first full sentence.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong>
            <ul>
                <li>
                    <pre><code>/trimstart This is a sentence. And here is another sentence.</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'trimend',
        callback: trimEndCallback,
        returns: t`trimmed text`,
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text`, [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: t`Trims the text to the end of the last full sentence.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'inject',
        returns: t`injection ID`,
        callback: injectCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'id',
                description: t`injection ID`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumProvider: commonEnumProviders.injects,
            }),
            new SlashCommandNamedArgument(
                'position', t`injection position`, [ARGUMENT_TYPE.STRING], false, false, 'after', ['before', 'after', 'chat', 'none'],
            ),
            new SlashCommandNamedArgument(
                'depth', t`injection depth`, [ARGUMENT_TYPE.NUMBER], false, false, '4',
            ),
            new SlashCommandNamedArgument(
                'scan', t`include injection content into World Info scans`, [ARGUMENT_TYPE.BOOLEAN], false, false, 'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'role',
                description: t`role for in-chat injections`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumList: [
                    new SlashCommandEnumValue('system', null, enumTypes.enum, enumIcons.system),
                    new SlashCommandEnumValue('assistant', null, enumTypes.enum, enumIcons.assistant),
                    new SlashCommandEnumValue('user', null, enumTypes.enum, enumIcons.user),
                ],
            }),
            new SlashCommandNamedArgument(
                'ephemeral', t`remove injection after generation`, [ARGUMENT_TYPE.BOOLEAN], false, false, 'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'filter',
                description: t`if a filter is defined, an injection will only be performed if the closure returns true`,
                typeList: [ARGUMENT_TYPE.CLOSURE],
                isRequired: false,
                acceptsMultiple: false,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text`, [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: t`Injects a text into the LLM prompt for the current chat. Requires a unique injection ID (will be auto-generated if not provided). Positions: "before" main prompt, "after" main prompt, in-"chat", hidden with "none" (default: after). Depth: injection depth for the prompt (default: 4). Role: role for in-chat injections (default: system). Scan: include injection content into World Info scans (default: false). Hidden injects in "none" position are not inserted into the prompt but can be used for triggering WI entries. Returns the injection ID.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'listinjects',
        callback: listInjectsCallback,
        helpString: t`Lists all script injections for the current chat. Displays injects in a popup by default. Use the <code>return</code> argument to change the return type.`,
        returns: t`Optionally the JSON object of script injections`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'return',
                description: t`The way how you want the return value to be provided`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'popup-html',
                enumList: slashCommandReturnHelper.enumList({ allowPipe: false, allowObject: true, allowChat: true, allowPopup: true, allowTextVersion: false }),
                forceEnum: true,
            }),
            // TODO remove some day
            SlashCommandNamedArgument.fromProps({
                name: 'format',
                description: t`!!! DEPRECATED - use "return" instead !!! output format`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                forceEnum: true,
                enumList: [
                    new SlashCommandEnumValue('popup', t`Show injects in a popup.`, enumTypes.enum, enumIcons.default),
                    new SlashCommandEnumValue('chat', t`Post a system message to the chat.`, enumTypes.enum, enumIcons.default),
                    new SlashCommandEnumValue('none', t`Just return the injects as a JSON object.`, enumTypes.enum, enumIcons.default),
                ],
            }),
        ],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'flushinject',
        aliases: ['flushinjects'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`injection ID or a variable name pointing to ID`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: '',
                enumProvider: commonEnumProviders.injects,
            }),
        ],
        callback: flushInjectsCallback,
        helpString: t`Removes a script injection for the current chat. If no ID is provided, removes all script injections.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tokens',
        callback: (_, text) => {
            if (text instanceof SlashCommandClosure || Array.isArray(text)) throw new Error(t`Unnamed argument cannot be a closure for command /tokens`);
            return getTokenCountAsync(text).then(count => String(count));
        },
        returns: t`number of tokens`,
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text`, [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: t`Counts the number of tokens in the provided text.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'model',
        callback: modelCallback,
        returns: t`current model`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`suppress the toast message on model change`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`model name`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => getModelOptions(true)?.options?.map(option => new SlashCommandEnumValue(option.value, option.value !== option.text ? option.text : null)) ?? [],
            }),
        ],
        helpString: t`Sets the model for the current API. Gets the current model name if no argument is provided.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'getpromptentry',
        aliases: ['getpromptentries'],
        callback: getPromptEntryCallback,
        returns: t`true/false state of prompt(s)`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'identifier',
                description: t`Prompt entry identifier(s) to retrieve`,
                typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.LIST],
                acceptsMultiple: true,
                enumProvider: () =>
                    promptManager.serviceSettings.prompts
                        .map(prompt => prompt.identifier)
                        .map(identifier => new SlashCommandEnumValue(identifier)),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: t`Prompt entry name(s) to retrieve`,
                typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.LIST],
                acceptsMultiple: true,
                enumProvider: () =>
                    promptManager.serviceSettings.prompts
                        .map(prompt => prompt.name)
                        .map(name => new SlashCommandEnumValue(name)),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'return',
                description: t`Whether the return will be simple, a list, or a dict.`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'simple',
                enumList: ['simple', 'list', 'dict'],
            }),
        ],
        helpString: `
            <div>
                ${t`Gets the state of the specified prompt entries.`}
            </div>
            <div>
                ${t`If <code>return</code> is <code>simple</code> (default) then the return will be a single value if only one value was retrieved; otherwise uses a dict (if the identifier parameter was used) or a list.`}
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'setpromptentry',
        aliases: ['setpromptentries'],
        callback: setPromptEntryCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'identifier',
                description: t`Prompt entry identifier(s) to target`,
                typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.LIST],
                acceptsMultiple: true,
                enumProvider: () => {
                    const prompts = promptManager.serviceSettings.prompts;
                    return prompts.map(prompt => new SlashCommandEnumValue(prompt.identifier, prompt.name, enumTypes.enum));
                },
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: t`Prompt entry name(s) to target`,
                typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.LIST],
                acceptsMultiple: true,
                enumProvider: () => {
                    const prompts = promptManager.serviceSettings.prompts;
                    return prompts.map(prompt => new SlashCommandEnumValue(prompt.name, prompt.identifier, enumTypes.enum));
                },
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`Set entry/entries on or off`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                acceptsMultiple: false,
                defaultValue: 'toggle', // unnamed arguments don't support default values yet
                enumList: commonEnumProviders.boolean('onOffToggle')(),
            }),
        ],
        helpString: t`Sets the specified prompt manager entry/entries on or off.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pick-icon',
        callback: async () => ((await showFontAwesomePicker()) ?? false).toString(),
        returns: t`The chosen icon name or false if cancelled.`,
        helpString: `
                <div>${t`Opens a popup with all the available Font Awesome icons and returns the selected icon's name.`}</div>
                <div>
                    <strong>${t`Example:`}</strong>
                    <ul>
                        <li>
                            <pre><code>/pick-icon |\n/if left={{pipe}} rule=eq right=false\n\telse={: /echo chosen icon: "{{pipe}}" :}\n\t{: /echo cancelled icon selection :}\n|</code></pre>
                        </li>
                    </ul>
                </div>
            `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'api-url',
        callback: setApiUrlCallback,
        returns: t`the current API url`,
        aliases: ['server'],
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'api',
                description: t`API to set/get the URL for - if not provided, current API is used`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue('custom', 'custom OpenAI-compatible', enumTypes.getBasedOnIndex(UNIQUE_APIS.findIndex(x => x === 'openai')), 'O'),
                    new SlashCommandEnumValue('kobold', 'KoboldAI Classic', enumTypes.getBasedOnIndex(UNIQUE_APIS.findIndex(x => x === 'kobold')), 'K'),
                    ...Object.values(textgen_types).map(api => new SlashCommandEnumValue(api, null, enumTypes.getBasedOnIndex(UNIQUE_APIS.findIndex(x => x === 'textgenerationwebui')), 'T')),
                ],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'connect',
                description: t`Whether to auto-connect to the API after setting the URL`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`suppress the toast message on API change`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`API url to connect to`,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        helpString: `
            <div>
                ${t`Set the API url / server url for the currently selected API, including the port. If no argument is provided, it will return the current API url.`}
            </div>
            <div>
                ${t`If a manual API is provided to <b>set</b> the URL, make sure to set <code>connect=false</code>, as auto-connect only works for the currently selected API, or consider switching to it with <code>/api</code> first.`}
            </div>
            <div>
                ${t`This slash command works for most of the Text Completion sources, KoboldAI Classic, and also Custom OpenAI compatible for the Chat Completion sources. If unsure which APIs are supported, check the auto-completion of the optional <code>api</code> argument of this command.`}
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tokenizer',
        callback: selectTokenizerCallback,
        returns: t`current tokenizer`,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`tokenizer name`,
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: getAvailableTokenizers().map(tokenizer =>
                    new SlashCommandEnumValue(tokenizer.tokenizerKey, tokenizer.tokenizerName, enumTypes.enum, enumIcons.default)),
            }),
        ],
        helpString: `
            <div>
                ${t`Selects tokenizer by name. Gets the current tokenizer if no name is provided.`}
            </div>
            <div>
                <strong>${t`Available tokenizers:`}</strong>
                <pre><code>${getAvailableTokenizers().map(t => t.tokenizerKey).join(', ')}</code></pre>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'upper',
        aliases: ['uppercase', 'to-upper'],
        callback: (_, text) => typeof text === 'string' ? text.toUpperCase() : '',
        returns: t`uppercase string`,
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text to affect`, [ARGUMENT_TYPE.STRING], true, false,
            ),
        ],
        helpString: t`Converts the provided string to uppercase.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lower',
        aliases: ['lowercase', 'to-lower'],
        callback: (_, text) => typeof text === 'string' ? text.toLowerCase() : '',
        returns: t`lowercase string`,
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text to affect`, [ARGUMENT_TYPE.STRING], true, false,
            ),
        ],
        helpString: t`Converts the provided string to lowercase.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'substr',
        aliases: ['substring'],
        callback: (arg, text) => typeof text === 'string' ? text.slice(...[Number(arg.start), arg.end && Number(arg.end)]) : '',
        returns: t`substring`,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'start', t`start index`, [ARGUMENT_TYPE.NUMBER], false, false,
            ),
            new SlashCommandNamedArgument(
                'end', t`end index`, [ARGUMENT_TYPE.NUMBER], false, false,
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text to affect`, [ARGUMENT_TYPE.STRING], true, false,
            ),
        ],
        helpString: `
            <div>
                ${t`Extracts text from the provided string.`}
            </div>
            <div>
                ${t`If <code>start</code> is omitted, it's treated as 0.<br />`}
                ${t`If <code>start</code> < 0, the index is counted from the end of the string.<br />`}
                ${t`If <code>start</code> >= the string's length, an empty string is returned.<br />`}
                ${t`If <code>end</code> is omitted, or if <code>end</code> >= the string's length, extracts to the end of the string.<br />`}
                ${t`If <code>end</code> < 0, the index is counted from the end of the string.<br />`}
                ${t`If <code>end</code> <= <code>start</code> after normalizing negative values, an empty string is returned.`}
            </div>
            <div>
                <strong>${t`Example:`}</strong>
                <pre>/let x The morning is upon us.     ||                                     </pre>
                <pre>/substr start=-3 {{var::x}}         | /echo  |/# us.                    ||</pre>
                <pre>/substr start=-3 end=-1 {{var::x}}  | /echo  |/# us                     ||</pre>
                <pre>/substr end=-1 {{var::x}}           | /echo  |/# The morning is upon us ||</pre>
                <pre>/substr start=4 end=-1 {{var::x}}   | /echo  |/# morning is upon us     ||</pre>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'is-mobile',
        callback: () => String(isMobile()),
        returns: ARGUMENT_TYPE.BOOLEAN,
        helpString: t`Returns true if the current device is a mobile device, false otherwise. Equivalent to <code>{{isMobile}}</code> macro.`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'chat-render',
        helpString: t`Renders a specified number of messages into the chat window. Displays all messages if no argument is provided.`,
        callback: async (args, number) => {
            await showMoreMessages(number && !isNaN(Number(number)) ? Number(number) : Number.MAX_SAFE_INTEGER);
            if (isTrueBoolean(String(args?.scroll ?? ''))) {
                $('#chat').scrollTop(0);
            }
            return '';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'scroll',
                description: t`scroll to the top after rendering`,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`number of messages`, [ARGUMENT_TYPE.NUMBER], false,
            ),
        ],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'chat-reload',
        helpString: t`Reloads the current chat.`,
        callback: async () => {
            await reloadCurrentChat();
            return '';
        },
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'replace',
        aliases: ['re'],
        callback: (async ({ mode = 'literal', pattern, replacer = '' }, text) => {
            if (!pattern) {
                throw new Error(t`Argument of 'pattern=' cannot be empty`);
            }
            text = text.toString();
            pattern = pattern.toString();
            replacer = replacer.toString();
            switch (mode) {
                case 'literal':
                    return text.replaceAll(pattern, replacer);
                case 'regex':
                    return text.replace(regexFromString(pattern), replacer);
                default:
                    throw new Error(t`Invalid '/replace mode=' argument specified!`);
            }
        }),
        returns: t`replaced text`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'mode',
                description: t`Replaces occurrence(s) of a pattern`,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'literal',
                enumList: ['literal', 'regex'],
            }),
            new SlashCommandNamedArgument(
                'pattern', t`pattern to search with`, [ARGUMENT_TYPE.STRING], true, false,
            ),
            new SlashCommandNamedArgument(
                'replacer', t`replacement text for matches`, [ARGUMENT_TYPE.STRING], false, false, '',
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text to affect`, [ARGUMENT_TYPE.STRING], true, false,
            ),
        ],
        helpString: `
            <div>
                ${t`Replaces text within the provided string based on the pattern.`}
            </div>
            <div>
                ${t`If <code>mode</code> is <code>literal</code> (or omitted), <code>pattern</code> is a literal search string (case-sensitive).<br />`}
                ${t`If <code>mode</code> is <code>regex</code>, <code>pattern</code> is parsed as an ECMAScript Regular Expression.<br />`}
                ${t`The <code>replacer</code> replaces based on the <code>pattern</code> in the input text.<br />`}
                ${t`If <code>replacer</code> is omitted, the replacement(s) will be an empty string.<br />`}
            </div>
            <div>
                <strong>${t`Example:`}</strong>
                <pre><code class="language-stscript">/let x Blue house and blue car ||                                                                        </code></pre>
                <pre><code class="language-stscript">/replace pattern="blue" {{var::x}}                                | /echo  |/# Blue house and  car     ||</code></pre>
                <pre><code class="language-stscript">/replace pattern="blue" replacer="red" {{var::x}}                 | /echo  |/# Blue house and red car  ||</code></pre>
                <pre><code class="language-stscript">/replace mode=regex pattern="/blue/i" replacer="red" {{var::x}}   | /echo  |/# red house and blue car  ||</code></pre>
                <pre><code class="language-stscript">/replace mode=regex pattern="/blue/gi" replacer="red" {{var::x}}  | /echo  |/# red house and red car   ||</code></pre>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'test',
        callback: (({ pattern }, text) => {
            if (!pattern) {
                throw new Error(t`Argument of 'pattern=' cannot be empty`);
            }
            const re = regexFromString(pattern.toString());
            if (!re) {
                throw new Error(t`The value of 'pattern' argument is not a valid regular expression.`);
            }
            return JSON.stringify(re.test(text.toString()));
        }),
        returns: 'true | false',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'pattern', t`pattern to find`, [ARGUMENT_TYPE.STRING], true, false,
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text to test`, [ARGUMENT_TYPE.STRING], true, false,
            ),
        ],
        helpString: `
            <div>
                ${t`Tests text for a regular expression match.`}
            </div>
            <div>
                ${t`Returns <code>true</code> if the match is found, <code>false</code> otherwise.`}
            </div>
            <div>
                <strong>${t`Example:`}</strong>
                <pre><code class="language-stscript">/let x Blue house and green car                         ||</code></pre>
                <pre><code class="language-stscript">/test pattern="green" {{var::x}}    | /echo  |/# true   ||</code></pre>
                <pre><code class="language-stscript">/test pattern="blue" {{var::x}}     | /echo  |/# false  ||</code></pre>
                <pre><code class="language-stscript">/test pattern="/blue/i" {{var::x}}  | /echo  |/# true   ||</code></pre>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'match',
        callback: (({ pattern }, text) => {
            if (!pattern) {
                throw new Error(t`Argument of 'pattern=' cannot be empty`);
            }
            const re = regexFromString(pattern.toString());
            if (!re) {
                throw new Error(t`The value of 'pattern' argument is not a valid regular expression.`);
            }
            if (re.flags.includes('g')) {
                return JSON.stringify([...text.toString().matchAll(re)]);
            } else {
                const match = text.toString().match(re);
                return match ? JSON.stringify(match) : '';
            }
        }),
        returns: t`group array for each match`,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'pattern', t`pattern to find`, [ARGUMENT_TYPE.STRING], true, false,
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                t`text to match against`, [ARGUMENT_TYPE.STRING], true, false,
            ),
        ],
        helpString: `
            <div>
                ${t`Retrieves regular expression matches in the given text`}
            </div>
            <div>
                ${t`Returns an array of groups (with the first group being the full match). If the regex contains the global flag (i.e. <code>/g</code>), multiple nested arrays are returned for each match. If the regex is global, returns <code>[]</code> if no matches are found, otherwise it returns an empty string.`}
            </div>
            <div>
                <strong>${t`Example:`}</strong>
                <pre><code class="language-stscript">/let x color_green green lamp color_blue                                                                            ||</code></pre>
                <pre><code class="language-stscript">/match pattern="green" {{var::x}}            | /echo  |/# [ "green" ]                                               ||</code></pre>
                <pre><code class="language-stscript">/match pattern="color_(\\w+)" {{var::x}}      | /echo  |/# [ "color_green", "green" ]                                ||</code></pre>
                <pre><code class="language-stscript">/match pattern="/color_(\\w+)/g" {{var::x}}   | /echo  |/# [ [ "color_green", "green" ], [ "color_blue", "blue" ] ]  ||</code></pre>
                <pre><code class="language-stscript">/match pattern="orange" {{var::x}}           | /echo  |/#                                                           ||</code></pre>
                <pre><code class="language-stscript">/match pattern="/orange/g" {{var::x}}        | /echo  |/# []                                                        ||</code></pre>
            </div>
        `,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'chat-jump',
        aliases: ['chat-scrollto', 'floor-teleport'],
        callback: async (_, index) => {
            const messageIndex = Number(index);

            if (isNaN(messageIndex) || messageIndex < 0 || messageIndex >= chat.length) {
                toastr.warning(t`Invalid message index: ${index}. Please enter a number between 0 and ${chat.length}.`);
                console.warn(`WARN: Invalid message index provided for /chat-jump: ${index}. Max index: ${chat.length}`);
                return '';
            }

            // Load more messages if needed
            const firstDisplayedMessageId = getFirstDisplayedMessageId();
            if (isFinite(firstDisplayedMessageId) && messageIndex < firstDisplayedMessageId) {
                const needToLoadCount = firstDisplayedMessageId - messageIndex;
                await showMoreMessages(needToLoadCount);
                await delay(1);
            }

            const chatContainer = document.getElementById('chat');
            const messageElement = document.querySelector(`#chat .mes[mesid="${messageIndex}"]`);

            if (messageElement instanceof HTMLElement && chatContainer instanceof HTMLElement) {
                const elementRect = messageElement.getBoundingClientRect();
                const containerRect = chatContainer.getBoundingClientRect();

                const scrollPosition = elementRect.top - containerRect.top + chatContainer.scrollTop;
                chatContainer.scrollTo({
                    top: scrollPosition,
                    behavior: 'smooth',
                });

                flashHighlight($(messageElement), 2000);
            } else {
                toastr.warning(t`Could not find element for message ${messageIndex}. It might not be rendered yet or the index is invalid.`);
                console.warn(`WARN: Element not found for message index ${messageIndex} in /chat-jump.`);
            }

            return '';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`The message index (0-based) to scroll to.`,
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: true,
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        helpString: `
        <div>
            ${t`Scrolls the chat view to the specified message index. Index starts at 0.`}
        </div>
        <div>
            <strong>${t`Example:`}</strong> <pre><code>/chat-jump 10</code></pre> ${t`Scrolls to the 11th message (id=10).`}
        </div>
    `,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'clipboard-get',
        returns: t`clipboard text`,
        callback: async () => {
            if (!navigator.clipboard) {
                toastr.warning(t`Clipboard API not available in this context.`);
                return '';
            }

            try {
                const text = await navigator.clipboard.readText();
                return text;
            }
            catch (error) {
                console.error('Error reading clipboard:', error);
                toastr.warning(t`Failed to read clipboard text. Have you granted the permission?`);
                return '';
            }
        },
        helpString: t`Retrieves the text from the OS clipboard. Only works in secure contexts (HTTPS or localhost). Browser may ask for permission.`,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'clipboard-set',
        callback: async (_, text) => {
            await copyText(text.toString());
            return '';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`text to copy to the clipboard`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                acceptsMultiple: false,
            }),
        ],
        helpString: t`Copies the provided text to the OS clipboard. Returns an empty string.`,
    }));


    const promptPostProcessingEnumProvider = () => Array
        .from(document.getElementById('custom_prompt_post_processing').querySelectorAll('option'))
        .map(option => new SlashCommandEnumValue(option.value || 'none', option.textContent, enumTypes.enum));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prompt-post-processing',
        aliases: ['ppp'],
        helpString: `
            <div>
                ${t`Sets a "Prompt Post-Processing" type. Gets the current selection if no value is provided.`}
            </div>
            <div>
                <strong>${t`Examples:`}</strong>
            </div>
            <ul>
                <li><pre><code class="language-stscript">/prompt-post-processing | /echo</code></pre></li>
                <li><pre><code class="language-stscript">/prompt-post-processing single</code></pre></li>
            </ul>
        `,
        namedArgumentList: [],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`value`,
                typeList: [ARGUMENT_TYPE.STRING],
                acceptsMultiple: false,
                isRequired: true,
                forceEnum: true,
                enumProvider: promptPostProcessingEnumProvider,
            }),
        ],
        callback: (_args, value) => {
            const stringValue = String(value ?? '').trim().toLowerCase();
            if (!stringValue) {
                return oai_settings.custom_prompt_post_processing || 'none';
            }

            const validValues = promptPostProcessingEnumProvider().map(option => option.value);
            if (!validValues.includes(stringValue)) {
                throw new Error(t`Invalid value "${stringValue}". Valid values are: ${validValues.join(', ')}`);
            }

            // 'none' value must be coerced to an empty string
            oai_settings.custom_prompt_post_processing = stringValue === 'none' ? '' : stringValue;
            $('#custom_prompt_post_processing').val(oai_settings.custom_prompt_post_processing);
            saveSettingsDebounced();

            return oai_settings.custom_prompt_post_processing;
        },
    }));

    registerVariableCommands();
}

const NARRATOR_NAME_KEY = 'narrator_name';
const NARRATOR_NAME_DEFAULT = 'System';
export const COMMENT_NAME_DEFAULT = 'Note';
const SCRIPT_PROMPT_KEY = 'script_inject_';

/**
 * Adds a new script injection to the chat.
 * @param {import('./slash-commands/SlashCommand.js').NamedArguments} args Named arguments
 * @param {import('./slash-commands/SlashCommand.js').UnnamedArguments} value Unnamed argument
 */
function injectCallback(args, value) {
    const positions = {
        'before': extension_prompt_types.BEFORE_PROMPT,
        'after': extension_prompt_types.IN_PROMPT,
        'chat': extension_prompt_types.IN_CHAT,
        'none': extension_prompt_types.NONE,
    };
    const roles = {
        'system': extension_prompt_roles.SYSTEM,
        'user': extension_prompt_roles.USER,
        'assistant': extension_prompt_roles.ASSISTANT,
    };

    const id = String(args?.id ?? '') || Math.random().toString(36).substring(2);
    const ephemeral = isTrueBoolean(String(args?.ephemeral ?? ''));

    const defaultPosition = 'after';
    const defaultDepth = 4;
    const positionValue = args?.position ?? defaultPosition;
    const position = positions[positionValue] ?? positions[defaultPosition];
    const depthValue = Number(args?.depth ?? defaultDepth);
    const depth = isNaN(depthValue) ? defaultDepth : depthValue;
    const roleValue = typeof args?.role === 'string' ? args.role.toLowerCase().trim() : Number(args?.role ?? extension_prompt_roles.SYSTEM);
    const role = roles[roleValue] ?? extension_prompt_roles.SYSTEM;
    const scan = isTrueBoolean(String(args?.scan));
    const filter = args?.filter instanceof SlashCommandClosure ? args.filter.rawText : null;
    const filterFunction = args?.filter instanceof SlashCommandClosure ? closureToFilter(args.filter) : null;
    value = value || '';
    if (args?.filter && !String(filter ?? '').trim()) {
        throw new Error(t`Failed to parse the filter argument. Make sure it is a valid non-empty closure.`);
    }

    const prefixedId = `${SCRIPT_PROMPT_KEY}${id}`;

    if (!chat_metadata.script_injects) {
        chat_metadata.script_injects = {};
    }

    if (value) {
        const inject = { value, position, depth, scan, role, filter };
        chat_metadata.script_injects[id] = inject;
    } else {
        delete chat_metadata.script_injects[id];
    }

    setExtensionPrompt(prefixedId, String(value), position, depth, scan, role, filterFunction);
    saveMetadataDebounced();

    if (ephemeral) {
        let deleted = false;
        const unsetInject = () => {
            if (deleted) {
                return;
            }
            console.log('Removing ephemeral script injection', id);
            delete chat_metadata.script_injects[id];
            setExtensionPrompt(prefixedId, '', position, depth, scan, role, filterFunction);
            saveMetadataDebounced();
            deleted = true;
        };
        eventSource.once(event_types.GENERATION_ENDED, unsetInject);
        eventSource.once(event_types.GENERATION_STOPPED, unsetInject);
    }

    return id;
}

async function listInjectsCallback(args) {
    /** @type {import('./slash-commands/SlashCommandReturnHelper.js').SlashCommandReturnType} */
    let returnType = args.return;

    // Old legacy return type handling
    if (args.format) {
        toastr.warning(t`Legacy argument 'format' with value '${args.format}' is deprecated. Please use 'return' instead. Routing to the correct return type...`, t`Deprecation warning`);
        const type = String(args?.format).toLowerCase().trim();
        if (!chat_metadata.script_injects || !Object.keys(chat_metadata.script_injects).length) {
            type !== 'none' && toastr.info(t`No script injections for the current chat`);
        }
        switch (type) {
            case 'none':
                returnType = 'none';
                break;
            case 'chat':
                returnType = 'chat-html';
                break;
            case 'popup':
            default:
                returnType = 'popup-html';
                break;
        }
    }

    // Now the actual new return type handling
    const buildTextValue = (injects) => {
        const injectsStr = Object.entries(injects)
            .map(([id, inject]) => {
                const position = Object.entries(extension_prompt_types);
                const positionName = position.find(([_, value]) => value === inject.position)?.[0] ?? t`unknown`;
                return `* **${id}**: <code>${inject.value}</code> (${positionName}, ${t`depth`}: ${inject.depth}, ${t`scan`}: ${inject.scan ?? false}, ${t`role`}: ${inject.role ?? extension_prompt_roles.SYSTEM})`;
            })
            .join('\n');
        return `### ${t`Script injections:`}\n${injectsStr || t`No script injections for the current chat`}`;
    };

    return await slashCommandReturnHelper.doReturn(returnType ?? 'popup-html', chat_metadata.script_injects ?? {}, { objectToStringFunc: buildTextValue });
}

/**
 * Flushes script injections for the current chat.
 * @param {import('./slash-commands/SlashCommand.js').NamedArguments} _ Named arguments
 * @param {string} value Unnamed argument
 * @returns {string} Empty string
 */
function flushInjectsCallback(_, value) {
    if (!chat_metadata.script_injects) {
        return '';
    }

    const idArgument = value;

    for (const [id, inject] of Object.entries(chat_metadata.script_injects)) {
        if (idArgument && id !== idArgument) {
            continue;
        }

        const prefixedId = `${SCRIPT_PROMPT_KEY}${id}`;
        setExtensionPrompt(prefixedId, '', inject.position, inject.depth, inject.scan, inject.role);
        delete chat_metadata.script_injects[id];
    }

    saveMetadataDebounced();
    return '';
}

export function processChatSlashCommands() {
    const context = getContext();

    if (!(context.chatMetadata.script_injects)) {
        return;
    }

    for (const id of Object.keys(context.extensionPrompts)) {
        if (!id.startsWith(SCRIPT_PROMPT_KEY)) {
            continue;
        }

        console.log('Removing script injection', id);
        delete context.extensionPrompts[id];
    }

    for (const [id, inject] of Object.entries(context.chatMetadata.script_injects)) {
        /**
         * Rehydrates a filter closure from a string.
         * @returns {SlashCommandClosure | null}
         */
        function reviveFilterClosure() {
            if (!inject.filter) {
                return null;
            }

            try {
                return new SlashCommandParser().parse(inject.filter, true);
            } catch (error) {
                console.warn('Failed to revive filter closure for script injection', id, error);
                return null;
            }
        }

        const prefixedId = `${SCRIPT_PROMPT_KEY}${id}`;
        const filterClosure = reviveFilterClosure();
        const filter = filterClosure ? closureToFilter(filterClosure) : null;
        console.log('Adding script injection', id);
        setExtensionPrompt(prefixedId, inject.value, inject.position, inject.depth, inject.scan, inject.role, filter);
    }
}

function setInputCallback(_, value) {
    $('#send_textarea').val(value || '')[0].dispatchEvent(new Event('input', { bubbles: true }));
    return value;
}

function trimStartCallback(_, value) {
    if (!value) {
        return '';
    }

    return trimToStartSentence(value);
}

function trimEndCallback(_, value) {
    if (!value) {
        return '';
    }

    return trimToEndSentence(value);
}

async function trimTokensCallback(arg, value) {
    if (!value) {
        console.warn('WARN: No argument provided for /trimtokens command');
        return '';
    }

    const limit = Number(resolveVariable(arg.limit));

    if (isNaN(limit)) {
        console.warn(`WARN: Invalid limit provided for /trimtokens command: ${limit}`);
        return value;
    }

    if (limit <= 0) {
        return '';
    }

    const direction = arg.direction || 'end';
    const tokenCount = await getTokenCountAsync(value);

    // Token count is less than the limit, do nothing
    if (tokenCount <= limit) {
        return value;
    }

    const { tokenizerName, tokenizerId } = getFriendlyTokenizerName(main_api);
    console.debug('Requesting tokenization for /trimtokens command', tokenizerName);

    try {
        const textTokens = getTextTokens(tokenizerId, value);

        if (!Array.isArray(textTokens) || !textTokens.length) {
            console.warn('WARN: No tokens returned for /trimtokens command, falling back to estimation');
            const percentage = limit / tokenCount;
            const trimIndex = Math.floor(value.length * percentage);
            const trimmedText = direction === 'start' ? value.substring(trimIndex) : value.substring(0, value.length - trimIndex);
            return trimmedText;
        }

        const sliceTokens = direction === 'start' ? textTokens.slice(0, limit) : textTokens.slice(-limit);
        const { text } = decodeTextTokens(tokenizerId, sliceTokens);
        return text;
    } catch (error) {
        console.warn('WARN: Tokenization failed for /trimtokens command, returning original', error);
        return value;
    }
}

/**
 * Displays a popup with buttons based on provided labels and handles button interactions.
 *
 * @param {object} args - Named arguments for the command
 * @param {string} args.labels - JSON string of an array of button labels
 * @param {string} [args.multiple=false] - Flag indicating if multiple buttons can be toggled
 * @param {string} text - The text content to be displayed within the popup
 *
 * @returns {Promise<string>} - A promise that resolves to a string of the button labels selected
 *                              If 'multiple' is true, returns a JSON string array of labels.
 *                              If 'multiple' is false, returns a single label string.
 */
async function buttonsCallback(args, text) {
    try {
        /** @type {string[]} */
        const buttons = JSON.parse(resolveVariable(args?.labels));

        if (!Array.isArray(buttons) || !buttons.length) {
            console.warn('WARN: Invalid labels provided for /buttons command');
            return '';
        }

        /** @type {Set<number>} */
        const multipleToggledState = new Set();
        const multiple = isTrueBoolean(args?.multiple);

        // Map custom buttons to results. Start at 2 because 1 and 0 are reserved for ok and cancel
        const resultToButtonMap = new Map(buttons.map((button, index) => [index + 2, button]));

        return new Promise(async (resolve) => {
            const safeValue = DOMPurify.sanitize(text || '');

            /** @type {Popup} */
            let popup;

            const buttonContainer = document.createElement('div');
            buttonContainer.classList.add('flex-container', 'flexFlowColumn', 'wide100p');

            const scrollableContainer = document.createElement('div');
            scrollableContainer.classList.add('scrollable-buttons-container');

            for (const [result, button] of resultToButtonMap) {
                const buttonElement = document.createElement('div');
                buttonElement.classList.add('menu_button', 'wide100p');

                if (multiple) {
                    buttonElement.classList.add('toggleable');
                    buttonElement.dataset.toggleValue = String(result);
                    buttonElement.addEventListener('click', async () => {
                        buttonElement.classList.toggle('toggled');
                        if (buttonElement.classList.contains('toggled')) {
                            multipleToggledState.add(result);
                        } else {
                            multipleToggledState.delete(result);
                        }
                    });
                } else {
                    buttonElement.classList.add('result-control');
                    buttonElement.dataset.result = String(result);
                }

                buttonElement.innerText = button;
                buttonContainer.appendChild(buttonElement);
            }

            scrollableContainer.appendChild(buttonContainer);

            const popupContainer = document.createElement('div');
            popupContainer.innerHTML = safeValue;
            popupContainer.appendChild(scrollableContainer);

            // Ensure the popup uses flex layout
            popupContainer.style.display = 'flex';
            popupContainer.style.flexDirection = 'column';
            popupContainer.style.maxHeight = '80vh'; // Limit the overall height of the popup

            popup = new Popup(popupContainer, POPUP_TYPE.TEXT, '', { okButton: multiple ? t`Ok` : t`Cancel`, allowVerticalScrolling: true });
            popup.show()
                .then((result => resolve(getResult(result))))
                .catch(() => resolve(''));

            /** @returns {string} @param {string|number|boolean} result */
            function getResult(result) {
                if (multiple) {
                    const array = result === POPUP_RESULT.AFFIRMATIVE ? Array.from(multipleToggledState).map(r => resultToButtonMap.get(r) ?? '') : [];
                    return JSON.stringify(array);
                }
                return typeof result === 'number' ? resultToButtonMap.get(result) ?? '' : '';
            }
        });
    } catch {
        return '';
    }
}

async function popupCallback(args, value) {
    const safeBody = DOMPurify.sanitize(value || '');
    const safeHeader = args?.header && typeof args?.header === 'string' ? DOMPurify.sanitize(args.header) : null;
    const requestedResult = isTrueBoolean(args?.result);

    /** @type {import('./popup.js').PopupOptions} */
    const popupOptions = {
        allowVerticalScrolling: !isFalseBoolean(args?.scroll),
        large: isTrueBoolean(args?.large),
        wide: isTrueBoolean(args?.wide),
        wider: isTrueBoolean(args?.wider),
        transparent: isTrueBoolean(args?.transparent),
        okButton: args?.okButton !== undefined && typeof args?.okButton === 'string' ? args.okButton : t`OK`,
        cancelButton: args?.cancelButton !== undefined && typeof args?.cancelButton === 'string' ? args.cancelButton : null,
    };
    const result = await Popup.show.text(safeHeader, safeBody, popupOptions);
    return String(requestedResult ? result ?? '' : value);
}

async function getMessagesCallback(args, value) {
    const includeNames = !isFalseBoolean(args?.names);
    const includeHidden = isTrueBoolean(args?.hidden);
    const role = args?.role;
    const range = stringToRange(value, 0, chat.length - 1);

    if (!range) {
        console.warn(`WARN: Invalid range provided for /messages command: ${value}`);
        return '';
    }

    const filterByRole = (mes) => {
        if (!role) {
            return true;
        }

        const isNarrator = mes.extra?.type === system_message_types.NARRATOR;

        if (role === 'system') {
            return isNarrator && !mes.is_user;
        }

        if (role === 'assistant') {
            return !isNarrator && !mes.is_user;
        }

        if (role === 'user') {
            return !isNarrator && mes.is_user;
        }

        throw new Error(t`Invalid role provided. Expected one of: system, assistant, user. Got: ${role}`);
    };

    const processMessage = async (mesId) => {
        const msg = chat[mesId];
        if (!msg) {
            console.warn(`WARN: No message found with ID ${mesId}`);
            return null;
        }

        if (role && !filterByRole(msg)) {
            console.debug(`/messages: Skipping message with ID ${mesId} due to role filter`);
            return null;
        }

        if (!includeHidden && msg.is_system) {
            console.debug(`/messages: Skipping hidden message with ID ${mesId}`);
            return null;
        }

        return includeNames ? `${msg.name}: ${msg.mes}` : msg.mes;
    };

    const messagePromises = [];

    for (let rInd = range.start; rInd <= range.end; ++rInd)
        messagePromises.push(processMessage(rInd));

    const messages = await Promise.all(messagePromises);

    return messages.filter(m => m !== null).join('\n\n');
}

async function runCallback(args, name) {
    if (!name) {
        throw new Error(t`No name provided for /run command`);
    }

    if (name instanceof SlashCommandClosure) {
        name.breakController = new SlashCommandBreakController();
        return (await name.execute())?.pipe;
    }

    /**@type {SlashCommandScope} */
    const scope = args._scope;
    if (scope.existsVariable(name)) {
        const closure = scope.getVariable(name);
        if (!(closure instanceof SlashCommandClosure)) {
            throw new Error(t`"${name}" is not callable.`);
        }
        closure.scope.parent = scope;
        closure.breakController = new SlashCommandBreakController();
        if (args._debugController && !closure.debugController) {
            closure.debugController = args._debugController;
        }
        while (closure.providedArgumentList.pop());
        closure.argumentList.forEach(arg => {
            if (Object.keys(args).includes(arg.name)) {
                const providedArg = new SlashCommandNamedArgumentAssignment();
                providedArg.name = arg.name;
                providedArg.value = args[arg.name];
                closure.providedArgumentList.push(providedArg);
            }
        });
        const result = await closure.execute();
        return result.pipe;
    }

    if (typeof window['executeQuickReplyByName'] !== 'function') {
        throw new Error(t`Quick Reply extension is not loaded`);
    }

    try {
        name = name.trim();
        /**@type {ExecuteSlashCommandsOptions} */
        const options = {
            abortController: args._abortController,
            debugController: args._debugController,
        };
        return await window['executeQuickReplyByName'](name, args, options);
    } catch (error) {
        throw new Error(t`Error running Quick Reply "${name}": ${error.message}`);
    }
}

/**
 *
 * @param {import('./slash-commands/SlashCommand.js').NamedArguments} param0
 * @param {string} [reason]
 */
function abortCallback({ _abortController, quiet }, reason) {
    if (quiet instanceof SlashCommandClosure) throw new Error(t`argument 'quiet' cannot be a closure for command /abort`);
    _abortController.abort((reason ?? '').toString().length == 0 ? t`/abort command executed` : reason, !isFalseBoolean(quiet?.toString() ?? 'true'));
    return '';
}

async function delayCallback(_, amount) {
    if (!amount) {
        console.warn('WARN: No amount provided for /delay command');
        return '';
    }

    amount = Number(amount);
    if (isNaN(amount)) {
        amount = 0;
    }

    await delay(amount);
    return '';
}


async function inputCallback(args, prompt) {
    const safeValue = DOMPurify.sanitize(prompt || '');
    const defaultInput = args?.default !== undefined && typeof args?.default === 'string' ? args.default : '';
    const popupOptions = {
        large: isTrueBoolean(args?.large),
        wide: isTrueBoolean(args?.wide),
        okButton: args?.okButton !== undefined && typeof args?.okButton === 'string' ? args.okButton : t`Ok`,
        rows: args?.rows !== undefined && typeof args?.rows === 'string' ? isNaN(Number(args.rows)) ? 4 : Number(args.rows) : 4,
    };
    // Do not remove this delay, otherwise the prompt will not show up
    await delay(1);
    const result = await callGenericPopup(safeValue, POPUP_TYPE.INPUT, defaultInput, popupOptions);
    await delay(1);

    // Input will return null on nothing entered, and false on cancel clicked
    if (result === null || result === false) {
        // Veryify if a cancel handler exists and it is valid
        if (args?.onCancel) {
            if (!(args.onCancel instanceof SlashCommandClosure)) {
                throw new Error(t`argument 'onCancel' must be a closure for command /input`);
            }
            await args.onCancel.execute();
        }
    } else {
        // Verify if an ok handler exists and it is valid
        if (args?.onSuccess) {
            if (!(args.onSuccess instanceof SlashCommandClosure)) {
                throw new Error(t`argument 'onSuccess' must be a closure for command /input`);
            }
            await args.onSuccess.execute();
        }
    }

    return String(result || '');
}

/**
 * Each item in "args.list" is searched within "search_item" using fuzzy search. If any matches it returns the matched "item".
 * @param {FuzzyCommandArgs} args - arguments containing "list" (JSON array) and optionaly "threshold" (float between 0.0 and 1.0)
 * @param {string} searchInValue - the string where items of list are searched
 * @returns {string} - the matched item from the list
 * @typedef {{list: string, threshold: string, mode:string}} FuzzyCommandArgs - arguments for /fuzzy command
 * @example /fuzzy list=["down","left","up","right"] "he looks up" | /echo // should return "up"
 * @link https://www.fusejs.io/
 */
function fuzzyCallback(args, searchInValue) {
    if (!searchInValue) {
        console.warn('WARN: No argument provided for /fuzzy command');
        return '';
    }

    if (!args.list) {
        console.warn('WARN: No list argument provided for /fuzzy command');
        return '';
    }

    try {
        const list = JSON.parse(resolveVariable(args.list));
        if (!Array.isArray(list)) {
            console.warn('WARN: Invalid list argument provided for /fuzzy command');
            return '';
        }

        const params = {
            includeScore: true,
            findAllMatches: true,
            ignoreLocation: true,
            threshold: 0.4,
        };
        // threshold determines how strict is the match, low threshold value is very strict, at 1 (nearly?) everything matches
        if ('threshold' in args) {
            params.threshold = parseFloat(args.threshold);
            if (isNaN(params.threshold)) {
                console.warn('WARN: \'threshold\' argument must be a float between 0.0 and 1.0 for /fuzzy command');
                return '';
            }
            if (params.threshold < 0) {
                params.threshold = 0;
            }
            if (params.threshold > 1) {
                params.threshold = 1;
            }
        }

        function getFirstMatch() {
            const fuse = new Fuse([searchInValue], params);
            // each item in the "list" is searched within "search_item", if any matches it returns the matched "item"
            for (const searchItem of list) {
                const result = fuse.search(searchItem);
                console.debug('/fuzzy: result', result);
                if (result.length > 0) {
                    console.info('/fuzzy: first matched', searchItem);
                    return searchItem;
                }
            }

            console.info('/fuzzy: no match');
            return '';
        }

        function getBestMatch() {
            const fuse = new Fuse(list, params);
            const result = fuse.search(searchInValue);
            console.debug('/fuzzy: result', result);
            if (result.length > 0) {
                console.info('/fuzzy: best matched', result[0].item);
                return result[0].item;
            }

            console.info('/fuzzy: no match');
            return '';
        }

        switch (String(args.mode).trim().toLowerCase()) {
            case 'best':
                return getBestMatch();
            case 'first':
            default:
                return getFirstMatch();
        }
    } catch {
        console.warn('WARN: Invalid list argument provided for /fuzzy command');
        return '';
    }
}

function setEphemeralStopStrings(value) {
    if (typeof value === 'string' && value.length) {
        try {
            const stopStrings = JSON.parse(value);
            if (Array.isArray(stopStrings)) {
                stopStrings.forEach(stopString => addEphemeralStoppingString(stopString));
            }
        } catch {
            // Do nothing
        }
    }
}

async function generateRawCallback(args, value) {
    if (!value) {
        console.warn('WARN: No argument provided for /genraw command');
        return '';
    }

    // Prevent generate recursion
    $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));
    const lock = isTrueBoolean(args?.lock);
    const as = args?.as || 'system';
    const quietToLoud = as === 'char';
    const systemPrompt = resolveVariable(args?.system) || '';
    const prefillPrompt = resolveVariable(args?.prefill) || '';
    const length = Number(resolveVariable(args?.length) ?? 0) || 0;
    const trimNames = !isFalseBoolean(args?.trim);

    try {
        if (lock) {
            deactivateSendButtons();
        }

        setEphemeralStopStrings(resolveVariable(args?.stop));
        /** @type {import('../script.js').GenerateRawParams} */
        const params = {
            prompt: value,
            instructOverride: isFalseBoolean(args?.instruct),
            quietToLoud: quietToLoud,
            systemPrompt: systemPrompt,
            responseLength: length,
            trimNames: trimNames,
            prefill: prefillPrompt,
        };
        const result = await generateRaw(params);
        return result;
    } catch (err) {
        console.error('Error on /genraw generation', err);
        toastr.error(err.message, t`API Error`, { preventDuplicates: true });
    } finally {
        if (lock) {
            activateSendButtons();
        }
        flushEphemeralStoppingStrings();
    }
    return '';
}

/**
 * Callback for the /gen command
 * @param {object} args Named arguments
 * @param {string} value Unnamed argument
 * @returns {Promise<string>} The generated text
 */
async function generateCallback(args, value) {
    // Prevent generate recursion
    $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));
    const lock = isTrueBoolean(args?.lock);
    const trim = isTrueBoolean(args?.trim?.toString());
    const as = args?.as || 'system';
    const quietToLoud = as === 'char';
    const length = Number(resolveVariable(args?.length) ?? 0) || 0;

    try {
        if (lock) {
            deactivateSendButtons();
        }

        setEphemeralStopStrings(resolveVariable(args?.stop));
        const name = args?.name;
        const char = name ? findChar({ name: name }) : null;
        /** @type {import('../script.js').GenerateQuietPromptParams} */
        const params = {
            quietPrompt: value,
            quietToLoud: quietToLoud,
            quietName: char?.name ?? name,
            responseLength: length,
            trimToSentence: trim,
            forceChId: char ? characters.indexOf(char) : null,
        };
        const result = await generateQuietPrompt(params);
        return result;
    } catch (err) {
        console.error('Error on /gen generation', err);
        toastr.error(err.message, t`API Error`, { preventDuplicates: true });
    } finally {
        if (lock) {
            activateSendButtons();
        }
        flushEphemeralStoppingStrings();
    }
    return '';
}

/**
 *
 * @param {{title?: string, severity?: string, timeout?: string, extendedTimeout?: string, preventDuplicates?: string, awaitDismissal?: string, cssClass?: string, color?: string, escapeHtml?: string, onClick?: SlashCommandClosure}} args - named arguments from the slash command
 * @param {string} value - The string to echo (unnamed argument from the slash command)
 * @returns {Promise<string>} The text that was echoed
 */
async function echoCallback(args, value) {
    // Note: We don't need to sanitize input, as toastr is set up by default to escape HTML via toastr options
    if (value === '') {
        console.warn('WARN: No argument provided for /echo command');
        return '';
    }

    if (args.severity && !['error', 'warning', 'success', 'info'].includes(args.severity)) {
        toastr.warning(t`Invalid severity provided for /echo command: ${args.severity}`);
        args.severity = null;
    }

    // Make sure that the value is a string
    value = String(value);

    let title = args.title ? args.title : undefined;
    const severity = args.severity ? args.severity : 'info';

    /** @type {ToastrOptions} */
    const options = {};
    if (args.timeout && !isNaN(parseInt(args.timeout))) options.timeOut = parseInt(args.timeout);
    if (args.extendedTimeout && !isNaN(parseInt(args.extendedTimeout))) options.extendedTimeOut = parseInt(args.extendedTimeout);
    if (isTrueBoolean(args.preventDuplicates)) options.preventDuplicates = true;
    if (args.cssClass) options.toastClass = args.cssClass;
    options.escapeHtml = args.escapeHtml !== undefined ? isTrueBoolean(args.escapeHtml) : true;

    // Prepare possible await handling
    let awaitDismissal = isTrueBoolean(args.awaitDismissal);
    let resolveToastDismissal;

    if (awaitDismissal) {
        options.onHidden = () => resolveToastDismissal(value);
    }
    if (args.onClick) {
        if (args.onClick instanceof SlashCommandClosure) {
            options.onclick = async () => {
                // Execute the slash command directly, with its internal scope and everything. Clear progress handler so it doesn't interfere with command execution progress.
                args.onClick.onProgress = null;
                await args.onClick.execute();
            };
        } else {
            toastr.warning(t`Invalid onClick provided for /echo command. This is not a closure`);
        }
    }

    // If we allow HTML, we need to sanitize it to prevent security risks
    if (!options.escapeHtml) {
        if (title) title = DOMPurify.sanitize(title, { FORBID_TAGS: ['style'] });
        value = DOMPurify.sanitize(value, { FORBID_TAGS: ['style'] });
    }

    let toast;
    switch (severity) {
        case 'error':
            toast = toastr.error(value, title, options);
            break;
        case 'warning':
            toast = toastr.warning(value, title, options);
            break;
        case 'success':
            toast = toastr.success(value, title, options);
            break;
        case 'info':
        default:
            toast = toastr.info(value, title, options);
            break;
    }

    if (args.color) {
        toast.css('background-color', args.color);
    }

    if (awaitDismissal) {
        return new Promise((resolve) => {
            resolveToastDismissal = resolve;
        });
    } else {
        return value;
    }
}

/**
 * @param {{switch?: string}} args - named arguments
 * @param {string} value - The swipe text to add (unnamed argument)
 */
async function addSwipeCallback(args, value) {
    const lastMessage = chat[chat.length - 1];

    if (!lastMessage) {
        toastr.warning(t`No messages to add swipes to.`);
        return '';
    }

    if (!value) {
        console.warn('WARN: No argument provided for /addswipe command');
        return '';
    }

    if (lastMessage.is_user) {
        toastr.warning(t`Can't add swipes to user messages.`);
        return '';
    }

    if (lastMessage.is_system) {
        toastr.warning(t`Can't add swipes to system messages.`);
        return '';
    }

    if (lastMessage.extra?.image) {
        toastr.warning(t`Can't add swipes to message containing an image.`);
        return '';
    }

    if (!Array.isArray(lastMessage.swipes)) {
        lastMessage.swipes = [lastMessage.mes];
        lastMessage.swipe_info = [{}];
        lastMessage.swipe_id = 0;
    }
    if (!Array.isArray(lastMessage.swipe_info)) {
        lastMessage.swipe_info = lastMessage.swipes.map(() => ({}));
    }

    lastMessage.swipes.push(value);
    lastMessage.swipe_info.push({
        send_date: getMessageTimeStamp(),
        gen_started: null,
        gen_finished: null,
        extra: {
            bias: extractMessageBias(value),
            gen_id: Date.now(),
            api: 'manual',
            model: 'slash command',
        },
    });

    const newSwipeId = lastMessage.swipes.length - 1;

    if (isTrueBoolean(args.switch)) {
        // Make sure ad-hoc changes to extras are saved before swiping away
        syncMesToSwipe();
        lastMessage.swipe_id = newSwipeId;
        lastMessage.mes = lastMessage.swipes[newSwipeId];
        lastMessage.extra = structuredClone(lastMessage.swipe_info?.[newSwipeId]?.extra ?? lastMessage.extra ?? {});
    }

    await saveChatConditional();
    await reloadCurrentChat();

    return String(newSwipeId);
}

async function deleteSwipeCallback(_, arg) {
    // Take the provided argument. Null if none provided, which will target the current swipe.
    const swipeId = arg && !isNaN(Number(arg)) ? (Number(arg) - 1) : null;

    const newSwipeId = await deleteSwipe(swipeId);

    return String(newSwipeId);
}

async function askCharacter(args, text) {
    // Prevent generate recursion
    $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));

    // Not supported in group chats
    // TODO: Maybe support group chats?
    if (selected_group) {
        toastr.warning(t`Cannot run /ask command in a group chat!`);
        return '';
    }

    if (!args.name) {
        toastr.warning(t`You must specify a name of the character to ask.`);
        return '';
    }

    const prevChId = this_chid;

    // Find the character
    const character = findChar({ name: args?.name });
    if (!character) {
        toastr.error(t`Character not found.`);
        return '';
    }

    const chId = getCharIndex(character);

    if (text) {
        const mesText = getRegexedString(text.trim(), regex_placement.SLASH_COMMAND);
        // Sending a message implicitly saves the chat, so this needs to be done before changing the character
        // Otherwise, a corruption will occur
        await sendMessageAsUser(mesText, '');
    }

    // Override character and send a user message
    setCharacterId(String(chId));

    const { name, force_avatar, original_avatar } = getNameAndAvatarForMessage(character, args?.name);

    setCharacterName(name);

    const restoreCharacter = () => {
        if (String(this_chid) !== String(chId)) {
            return;
        }

        if (prevChId !== undefined) {
            setCharacterId(prevChId);
            setCharacterName(characters[prevChId].name);
        } else {
            setCharacterId(undefined);
            setCharacterName(neutralCharacterName);
        }

        // Only force the new avatar if the character name is the same
        // This skips if an error was fired
        const lastMessage = chat[chat.length - 1];
        if (lastMessage && lastMessage?.name === name) {
            lastMessage.force_avatar = force_avatar;
            lastMessage.original_avatar = original_avatar;
        }
    };

    let askResult = '';

    // Run generate and restore previous character
    try {
        eventSource.once(event_types.MESSAGE_RECEIVED, restoreCharacter);
        toastr.info(t`Asking ${name} something...`);
        askResult = await Generate('normal');
    } catch (error) {
        restoreCharacter();
        console.error('Error running /ask command', error);
    } finally {
        if (String(this_chid) === String(prevChId)) {
            await saveChatConditional();
        } else {
            toastr.error(t`It is strongly recommended to reload the page.`, t`Something went wrong`);
        }
    }

    const message = askResult ? chat[chat.length - 1] : null;

    return await slashCommandReturnHelper.doReturn(args.return ?? 'pipe', message, { objectToStringFunc: x => x.mes });
}

async function hideMessageCallback(args, value) {
    const range = value ? stringToRange(value, 0, chat.length - 1) : { start: chat.length - 1, end: chat.length - 1 };

    if (!range) {
        console.warn(`WARN: Invalid range provided for /hide command: ${value}`);
        return '';
    }

    const nameFilter = String(args.name ?? '').trim();
    await hideChatMessageRange(range.start, range.end, false, nameFilter);
    return '';
}

async function unhideMessageCallback(args, value) {
    const range = value ? stringToRange(value, 0, chat.length - 1) : { start: chat.length - 1, end: chat.length - 1 };

    if (!range) {
        console.warn(`WARN: Invalid range provided for /unhide command: ${value}`);
        return '';
    }

    const nameFilter = String(args.name ?? '').trim();
    await hideChatMessageRange(range.start, range.end, true, nameFilter);
    return '';
}

/**
 * Copium for running group actions when the member is offscreen.
 * @param {number} chid - character ID
 * @param {string} action - one of 'enable', 'disable', 'up', 'down', 'view', 'remove'
 * @returns {void}
 */
function performGroupMemberAction(chid, action) {
    const memberSelector = `.group_member[data-chid="${chid}"]`;
    // Do not optimize. Paginator gets recreated on every action
    const paginationSelector = '#rm_group_members_pagination';
    const pageSizeSelector = '#rm_group_members_pagination select';
    let wasOffscreen = false;
    let paginationValue = null;
    let pageValue = null;

    if ($(memberSelector).length === 0) {
        wasOffscreen = true;
        paginationValue = Number($(pageSizeSelector).val());
        pageValue = $(paginationSelector).pagination('getCurrentPageNum');
        $(pageSizeSelector).val($(pageSizeSelector).find('option').last().val()).trigger('change');
    }

    $(memberSelector).find(`[data-action="${action}"]`).trigger('click');

    if (wasOffscreen) {
        $(pageSizeSelector).val(paginationValue).trigger('change');
        if ($(paginationSelector).length) {
            $(paginationSelector).pagination('go', pageValue);
        }
    }
}

async function disableGroupMemberCallback(_, arg) {
    if (!selected_group) {
        toastr.warning(t`Cannot run /member-disable command outside of a group chat.`);
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'disable');
    return '';
}

async function enableGroupMemberCallback(_, arg) {
    if (!selected_group) {
        toastr.warning(t`Cannot run /member-enable command outside of a group chat.`);
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'enable');
    return '';
}

async function moveGroupMemberUpCallback(_, arg) {
    if (!selected_group) {
        toastr.warning(t`Cannot run /member-up command outside of a group chat.`);
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'up');
    return '';
}

async function moveGroupMemberDownCallback(_, arg) {
    if (!selected_group) {
        toastr.warning(t`Cannot run /member-down command outside of a group chat.`);
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'down');
    return '';
}

async function peekCallback(_, arg) {
    if (!selected_group) {
        toastr.warning(t`Cannot run /member-peek command outside of a group chat.`);
        return '';
    }

    if (is_group_generating) {
        toastr.warning(t`Cannot run /member-peek command while the group reply is generating.`);
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'view');
    return '';
}

async function countGroupMemberCallback() {
    if (!selected_group) {
        toastr.warning(t`Cannot run /member-count command outside of a group chat.`);
        return '';
    }

    return String(getGroupMembers(selected_group).length);
}

async function removeGroupMemberCallback(_, arg) {
    if (!selected_group) {
        toastr.warning(t`Cannot run /member-remove command outside of a group chat.`);
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'remove');
    return '';
}

async function addGroupMemberCallback(_, name) {
    if (!selected_group) {
        toastr.warning(t`Cannot run /memberadd command outside of a group chat.`);
        return '';
    }

    if (!name) {
        console.warn('WARN: No argument provided for /memberadd command');
        return '';
    }

    const character = findChar({ name: name, preferCurrentChar: false });
    if (!character) {
        console.warn(`WARN: No character found for argument ${name}`);
        return '';
    }

    const group = groups.find(x => x.id === selected_group);

    if (!group || !Array.isArray(group.members)) {
        console.warn(`WARN: No group found for ID ${selected_group}`);
        return '';
    }

    const avatar = character.avatar;

    if (group.members.includes(avatar)) {
        toastr.warning(t`${character.name} is already a member of this group.`);
        return '';
    }

    group.members.push(avatar);
    await saveGroupChat(selected_group, true);

    // Trigger to reload group UI
    $('#rm_button_selected_ch').trigger('click');
    return character.name;
}

async function triggerGenerationCallback(args, value) {
    const shouldAwait = isTrueBoolean(args?.await);
    const outerPromise = new Promise((outerResolve) => setTimeout(async () => {
        try {
            await waitUntilCondition(() => !is_send_press && !is_group_generating, 10000, 100);
        } catch {
            console.warn('Timeout waiting for generation unlock');
            toastr.warning(t`Cannot run /trigger command while the reply is being generated.`);
            outerResolve(Promise.resolve(''));
            return '';
        }

        // Prevent generate recursion
        $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));

        let chid = undefined;

        if (selected_group && value) {
            chid = findGroupMemberId(value);

            if (chid === undefined) {
                console.warn(`WARN: No group member found for argument ${value}`);
            }
        }

        outerResolve(new Promise(innerResolve => setTimeout(() => innerResolve(Generate('normal', { force_chid: chid })), 100)));
    }, 1));

    if (shouldAwait) {
        const innerPromise = await outerPromise;
        await innerPromise;
    }

    return '';
}
/**
 * Find persona by name.
 * @param {string} name Name to search for
 * @returns {string} Persona name
 */
function findPersonaByName(name) {
    if (!name) {
        return null;
    }

    for (const persona of Object.entries(power_user.personas)) {
        if (equalsIgnoreCaseAndAccents(persona[1], name)) {
            return persona[0];
        }
    }
    return null;
}

async function sendUserMessageCallback(args, text) {
    text = String(text ?? '').trim();
    const compact = isTrueBoolean(args?.compact);
    const bias = extractMessageBias(text);

    let insertAt = Number(args?.at);

    // Convert possible depth parameter to index
    if (!isNaN(insertAt) && (insertAt < 0 || Object.is(insertAt, -0))) {
        // Negative value means going back from current chat length. (E.g.: 8 messages, Depth 1 means insert at index 7)
        insertAt = chat.length + insertAt;
    }

    let message;
    if ('name' in args) {
        const name = args.name || '';
        const avatar = findPersonaByName(name) || user_avatar;
        message = await sendMessageAsUser(text, bias, insertAt, compact, name, avatar);
    }
    else {
        message = await sendMessageAsUser(text, bias, insertAt, compact);
    }

    return await slashCommandReturnHelper.doReturn(args.return ?? 'none', message, { objectToStringFunc: x => x.mes });
}

async function deleteMessagesByNameCallback(_, name) {
    if (!name) {
        console.warn('WARN: No name provided for /delname command');
        return;
    }

    // Search for a matching character to get the real name, or take the name provided
    const character = findChar({ name: name });
    name = character?.name || name;

    const messagesToDelete = [];
    chat.forEach((value) => {
        if (value.name === name) {
            messagesToDelete.push(value);
        }
    });

    if (!messagesToDelete.length) {
        console.debug('/delname: Nothing to delete');
        return;
    }

    for (const message of messagesToDelete) {
        const index = chat.indexOf(message);
        if (index !== -1) {
            console.debug(`/delname: Deleting message #${index}`, message);
            chat.splice(index, 1);
        }
    }

    await saveChatConditional();
    await reloadCurrentChat();

    toastr.info(t`Deleted ${messagesToDelete.length} messages from ${name}`);
    return '';
}

async function goToCharacterCallback(_, name) {
    if (!name) {
        console.warn('WARN: No character name provided for /go command');
        return;
    }

    const character = findChar({ name: name });
    if (character) {
        const chid = getCharIndex(character);
        await openChat(String(chid));
        setActiveCharacter(character.avatar);
        setActiveGroup(null);
        return character.name;
    }
    const group = groups.find(it => equalsIgnoreCaseAndAccents(it.name, name));
    if (group) {
        await openGroupById(group.id);
        setActiveCharacter(null);
        setActiveGroup(group.id);
        return group.name;
    }
    console.warn(`No matches found for name "${name}"`);
    return '';
}

async function openChat(chid) {
    resetSelectedGroup();
    setCharacterId(chid);
    await delay(1);
    await reloadCurrentChat();
}

async function continueChatCallback(args, prompt) {
    const shouldAwait = isTrueBoolean(args?.await);

    const outerPromise = new Promise(async (resolve, reject) => {
        try {
            await waitUntilCondition(() => !is_send_press && !is_group_generating, 10000, 100);
        } catch {
            console.warn('Timeout waiting for generation unlock');
            toastr.warning(t`Cannot run /continue command while the reply is being generated.`);
            return reject();
        }

        try {
            // Prevent infinite recursion
            $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));

            const options = prompt?.trim() ? { quiet_prompt: prompt.trim(), quietToLoud: true } : {};
            await Generate('continue', options);

            resolve();
        } catch (error) {
            console.error('Error running /continue command:', error);
            reject(error);
        }
    });

    if (shouldAwait) {
        await outerPromise;
    }

    return '';
}

export async function generateSystemMessage(args, prompt) {
    $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));

    if (!prompt) {
        console.warn('WARN: No prompt provided for /sysgen command');
        toastr.warning(t`You must provide a prompt for the system message`);
        return '';
    }

    const trim = isTrueBoolean(args?.trim?.toString());

    // Generate and regex the output if applicable
    const toast = toastr.info(t`Please wait`, t`Generating...`);
    const message = await generateQuietPrompt({ quietPrompt: prompt, trimToSentence: trim });
    toastr.clear(toast);

    return await sendNarratorMessage(args, getRegexedString(message, regex_placement.SLASH_COMMAND));
}

function setStoryModeCallback() {
    $('#chat_display').val(chat_styles.DOCUMENT).trigger('change');
    return '';
}

function setBubbleModeCallback() {
    $('#chat_display').val(chat_styles.BUBBLES).trigger('change');
    return '';
}

function setFlatModeCallback() {
    $('#chat_display').val(chat_styles.DEFAULT).trigger('change');
    return '';
}

async function setNarratorName(_, text) {
    const name = text || NARRATOR_NAME_DEFAULT;
    chat_metadata[NARRATOR_NAME_KEY] = name;
    toastr.info(t`System narrator name set to ${name}`);
    await saveChatConditional();
    return '';
}

/**
 * Checks if an argument is a string array (or undefined), and if not, throws an error
 * @param {string|SlashCommandClosure|(string|SlashCommandClosure)[]|undefined} arg The named argument to check
 * @param {string} name The name of the argument for the error message
 * @param {object} [options={}] - The optional arguments
 * @param {boolean} [options.allowUndefined=false] - Whether the argument can be undefined
 * @throws {Error} If the argument is not an array
 * @returns {string[]}
 */
export function validateArrayArgString(arg, name, { allowUndefined = true } = {}) {
    if (arg === undefined) {
        if (allowUndefined) return undefined;
        throw new Error(t`Argument "${name}" is undefined, but must be a string array`);
    }
    if (!Array.isArray(arg)) throw new Error(t`Argument "${name}" must be an array`);
    if (!arg.every(x => typeof x === 'string')) throw new Error(t`Argument "${name}" must be an array of strings`);
    return arg;
}

/**
 * Checks if an argument is a string or closure array (or undefined), and if not, throws an error
 * @param {string|SlashCommandClosure|(string|SlashCommandClosure)[]|undefined} arg The named argument to check
 * @param {string} name The name of the argument for the error message
 * @param {object} [options={}] - The optional arguments
 * @param {boolean} [options.allowUndefined=false] - Whether the argument can be undefined
 * @throws {Error} If the argument is not an array of strings or closures
 * @returns {(string|SlashCommandClosure)[]}
 */
export function validateArrayArg(arg, name, { allowUndefined = true } = {}) {
    if (arg === undefined) {
        if (allowUndefined) return [];
        throw new Error(t`Argument "${name}" is undefined, but must be an array of strings or closures`);
    }
    if (!Array.isArray(arg)) throw new Error(t`Argument "${name}" must be an array`);
    if (!arg.every(x => typeof x === 'string' || x instanceof SlashCommandClosure)) throw new Error(t`Argument "${name}" must be an array of strings or closures`);
    return arg;
}


/**
 * Retrieves the name and avatar information for a message
 *
 * The name of the character will always have precendence over the one given as argument. If you want to specify a different name for the message,
 * explicitly implement this in the code using this.
 *
 * @param {object?} character - The character object to get the avatar data for
 * @param {string?} name - The name to get the avatar data for
 * @returns {{name: string, force_avatar: string, original_avatar: string}} An object containing the name for the message, forced avatar URL, and original avatar
 */
export function getNameAndAvatarForMessage(character, name = null) {
    const isNeutralCharacter = !character && name2 === neutralCharacterName && name === neutralCharacterName;
    const currentChar = characters[this_chid];

    let force_avatar, original_avatar;
    if (character?.avatar === currentChar?.avatar || isNeutralCharacter) {
        // If the targeted character is the currently selected one in a solo chat, we don't need to force any avatars
    }
    else if (character && character.avatar !== 'none') {
        force_avatar = getThumbnailUrl('avatar', character.avatar);
        original_avatar = character.avatar;
    }
    else {
        force_avatar = default_avatar;
        original_avatar = default_avatar;
    }

    return {
        name: character?.name || name,
        force_avatar: force_avatar,
        original_avatar: original_avatar,
    };
}

export async function sendMessageAs(args, text) {
    let name = args.name?.trim();

    if (!name) {
        const namelessWarningKey = 'sendAsNamelessWarningShown';
        if (accountStorage.getItem(namelessWarningKey) !== 'true') {
            toastr.warning(t`To avoid confusion, please use /sendas name="Character Name"`, t`Name defaulted to {{char}}`, { timeOut: 10000 });
            accountStorage.setItem(namelessWarningKey, 'true');
        }
        name = name2;
    }

    let mesText = String(text ?? '').trim();

    // Requires a regex check after the slash command is pushed to output
    mesText = getRegexedString(mesText, regex_placement.SLASH_COMMAND, { characterOverride: name });

    // Messages that do nothing but set bias will be hidden from the context
    const bias = extractMessageBias(mesText);
    const isSystem = bias && !removeMacros(mesText).length;
    const compact = isTrueBoolean(args?.compact);

    const character = findChar({ name: name });

    const avatarCharacter = args.avatar ? findChar({ name: args.avatar }) : character;
    if (args.avatar && !avatarCharacter) {
        toastr.warning(t`Character for avatar ${args.avatar} not found`);
        return '';
    }

    const { name: avatarCharName, force_avatar, original_avatar } = getNameAndAvatarForMessage(avatarCharacter, name);

    const message = {
        name: character?.name || name || avatarCharName,
        is_user: false,
        is_system: isSystem,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(mesText),
        force_avatar: force_avatar,
        original_avatar: original_avatar,
        extra: {
            bias: bias.trim().length ? bias : null,
            gen_id: Date.now(),
            isSmallSys: compact,
            api: 'manual',
            model: 'slash command',
        },
    };

    message.swipe_id = 0;
    message.swipes = [message.mes];
    message.swipes_info = [{
        send_date: message.send_date,
        gen_started: null,
        gen_finished: null,
        extra: {
            bias: message.extra.bias,
            gen_id: message.extra.gen_id,
            isSmallSys: compact,
            api: 'manual',
            model: 'slash command',
        },
    }];

    let insertAt = Number(args.at);

    // Convert possible depth parameter to index
    if (!isNaN(insertAt) && (insertAt < 0 || Object.is(insertAt, -0))) {
        // Negative value means going back from current chat length. (E.g.: 8 messages, Depth 1 means insert at index 7)
        insertAt = chat.length + insertAt;
    }

    if (!isNaN(insertAt) && insertAt >= 0 && insertAt <= chat.length) {
        chat.splice(insertAt, 0, message);
        await saveChatConditional();
        await eventSource.emit(event_types.MESSAGE_RECEIVED, insertAt, 'command');
        await reloadCurrentChat();
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, insertAt, 'command');
    } else {
        chat.push(message);
        await eventSource.emit(event_types.MESSAGE_RECEIVED, (chat.length - 1), 'command');
        addOneMessage(message);
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1), 'command');
        await saveChatConditional();
    }

    return await slashCommandReturnHelper.doReturn(args.return ?? 'none', message, { objectToStringFunc: x => x.mes });
}

export async function sendNarratorMessage(args, text) {
    text = String(text ?? '');
    const name = args.name ?? (chat_metadata[NARRATOR_NAME_KEY] || NARRATOR_NAME_DEFAULT);
    // Messages that do nothing but set bias will be hidden from the context
    const bias = extractMessageBias(text);
    const isSystem = bias && !removeMacros(text).length;
    const compact = isTrueBoolean(args?.compact);

    const message = {
        name: name,
        is_user: false,
        is_system: isSystem,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(text.trim()),
        force_avatar: system_avatar,
        extra: {
            type: system_message_types.NARRATOR,
            bias: bias.trim().length ? bias : null,
            gen_id: Date.now(),
            isSmallSys: compact,
            api: 'manual',
            model: 'slash command',
        },
    };

    let insertAt = Number(args.at);

    // Convert possible depth parameter to index
    if (!isNaN(insertAt) && (insertAt < 0 || Object.is(insertAt, -0))) {
        // Negative value means going back from current chat length. (E.g.: 8 messages, Depth 1 means insert at index 7)
        insertAt = chat.length + insertAt;
    }

    if (!isNaN(insertAt) && insertAt >= 0 && insertAt <= chat.length) {
        chat.splice(insertAt, 0, message);
        await saveChatConditional();
        await eventSource.emit(event_types.MESSAGE_SENT, insertAt);
        await reloadCurrentChat();
        await eventSource.emit(event_types.USER_MESSAGE_RENDERED, insertAt);
    } else {
        chat.push(message);
        await eventSource.emit(event_types.MESSAGE_SENT, (chat.length - 1));
        addOneMessage(message);
        await eventSource.emit(event_types.USER_MESSAGE_RENDERED, (chat.length - 1));
        await saveChatConditional();
    }

    return await slashCommandReturnHelper.doReturn(args.return ?? 'none', message, { objectToStringFunc: x => x.mes });
}

export async function promptQuietForLoudResponse(who, text) {

    let character_id = getContext().characterId;
    if (who === 'sys') {
        text = 'System: ' + text;
    } else if (who === 'user') {
        text = name1 + ': ' + text;
    } else if (who === 'char') {
        text = characters[character_id].name + ': ' + text;
    } else if (who === 'raw') {
        // We don't need to modify the text
    }

    //text = `${text}${power_user.instruct.enabled ? '' : '\n'}${(power_user.always_force_name2 && who != 'raw') ? characters[character_id].name + ":" : ""}`

    let reply = await generateQuietPrompt({ quietPrompt: text, quietToLoud: true });
    text = await getRegexedString(reply, regex_placement.SLASH_COMMAND);

    const message = {
        name: characters[character_id].name,
        is_user: false,
        is_name: true,
        is_system: false,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(text.trim()),
        extra: {
            type: system_message_types.COMMENT,
            gen_id: Date.now(),
            api: 'manual',
            model: 'slash command',
        },
    };

    chat.push(message);
    await eventSource.emit(event_types.MESSAGE_SENT, (chat.length - 1));
    addOneMessage(message);
    await eventSource.emit(event_types.USER_MESSAGE_RENDERED, (chat.length - 1));
    await saveChatConditional();

}

async function sendCommentMessage(args, text) {
    const compact = isTrueBoolean(args?.compact);
    const message = {
        name: COMMENT_NAME_DEFAULT,
        is_user: false,
        is_system: true,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(String(text ?? '').trim()),
        force_avatar: comment_avatar,
        extra: {
            type: system_message_types.COMMENT,
            gen_id: Date.now(),
            isSmallSys: compact,
            api: 'manual',
            model: 'slash command',
        },
    };

    let insertAt = Number(args.at);

    // Convert possible depth parameter to index
    if (!isNaN(insertAt) && (insertAt < 0 || Object.is(insertAt, -0))) {
        // Negative value means going back from current chat length. (E.g.: 8 messages, Depth 1 means insert at index 7)
        insertAt = chat.length + insertAt;
    }

    if (!isNaN(insertAt) && insertAt >= 0 && insertAt <= chat.length) {
        chat.splice(insertAt, 0, message);
        await saveChatConditional();
        await eventSource.emit(event_types.MESSAGE_SENT, insertAt);
        await reloadCurrentChat();
        await eventSource.emit(event_types.USER_MESSAGE_RENDERED, insertAt);
    } else {
        chat.push(message);
        await eventSource.emit(event_types.MESSAGE_SENT, (chat.length - 1));
        addOneMessage(message);
        await eventSource.emit(event_types.USER_MESSAGE_RENDERED, (chat.length - 1));
        await saveChatConditional();
    }

    return await slashCommandReturnHelper.doReturn(args.return ?? 'none', message, { objectToStringFunc: x => x.mes });
}

/**
 * Displays a help message from the slash command
 * @param {any} _ Unused
 * @param {string} type Type of help to display
 */
function helpCommandCallback(_, type) {
    switch (type?.trim()?.toLowerCase()) {
        case 'slash':
        case 'commands':
        case 'slashes':
        case 'slash commands':
        case '1':
            sendSystemMessage(system_message_types.SLASH_COMMANDS);
            break;
        case 'format':
        case 'formatting':
        case 'formats':
        case 'chat formatting':
        case '2':
            sendSystemMessage(system_message_types.FORMATTING);
            break;
        case 'hotkeys':
        case 'hotkey':
        case '3':
            sendSystemMessage(system_message_types.HOTKEYS);
            break;
        case 'macros':
        case 'macro':
        case '4':
            sendSystemMessage(system_message_types.MACROS);
            break;
        default:
            sendSystemMessage(system_message_types.HELP);
            break;
    }

    return '';
}

$(document).on('click', '[data-displayHelp]', function (e) {
    e.preventDefault();
    const page = String($(this).data('displayhelp'));
    helpCommandCallback(null, page);
});

function setBackgroundCallback(_, bg) {
    if (!bg) {
        // allow reporting of the background name if called without args
        // for use in ST Scripts via pipe
        return background_settings.name;
    }

    console.log('Set background to ' + bg);

    const bgElements = Array.from(document.querySelectorAll('.bg_example')).map((x) => ({ element: x, bgfile: x.getAttribute('bgfile') }));

    const fuse = new Fuse(bgElements, { keys: ['bgfile'] });
    const result = fuse.search(bg);

    if (!result.length) {
        toastr.error(t`No background found with name "${bg}"`);
        return '';
    }

    const bgElement = result[0].item.element;

    if (bgElement instanceof HTMLElement) {
        bgElement.click();
    }

    return '';
}

/**
 * Retrieves the available model options based on the currently selected main API and its subtype
 * @param {boolean} quiet - Whether to suppress toasts
 *
 * @returns {{control: HTMLSelectElement|HTMLInputElement, options: HTMLOptionElement[]}?} An array of objects representing the available model options, or null if not supported
 */
function getModelOptions(quiet) {
    const nullResult = { control: null, options: null };
    const modelSelectMap = [
        { id: 'generic_model_textgenerationwebui', api: 'textgenerationwebui', type: textgen_types.GENERIC },
        { id: 'custom_model_textgenerationwebui', api: 'textgenerationwebui', type: textgen_types.OOBA },
        { id: 'model_togetherai_select', api: 'textgenerationwebui', type: textgen_types.TOGETHERAI },
        { id: 'openrouter_model', api: 'textgenerationwebui', type: textgen_types.OPENROUTER },
        { id: 'model_infermaticai_select', api: 'textgenerationwebui', type: textgen_types.INFERMATICAI },
        { id: 'model_dreamgen_select', api: 'textgenerationwebui', type: textgen_types.DREAMGEN },
        { id: 'mancer_model', api: 'textgenerationwebui', type: textgen_types.MANCER },
        { id: 'vllm_model', api: 'textgenerationwebui', type: textgen_types.VLLM },
        { id: 'aphrodite_model', api: 'textgenerationwebui', type: textgen_types.APHRODITE },
        { id: 'ollama_model', api: 'textgenerationwebui', type: textgen_types.OLLAMA },
        { id: 'tabby_model', api: 'textgenerationwebui', type: textgen_types.TABBY },
        { id: 'featherless_model', api: 'textgenerationwebui', type: textgen_types.FEATHERLESS },
        { id: 'model_openai_select', api: 'openai', type: chat_completion_sources.OPENAI },
        { id: 'model_claude_select', api: 'openai', type: chat_completion_sources.CLAUDE },
        { id: 'model_openrouter_select', api: 'openai', type: chat_completion_sources.OPENROUTER },
        { id: 'model_ai21_select', api: 'openai', type: chat_completion_sources.AI21 },
        { id: 'model_google_select', api: 'openai', type: chat_completion_sources.MAKERSUITE },
        { id: 'model_vertexai_select', api: 'openai', type: chat_completion_sources.VERTEXAI },
        { id: 'model_mistralai_select', api: 'openai', type: chat_completion_sources.MISTRALAI },
        { id: 'custom_model_id', api: 'openai', type: chat_completion_sources.CUSTOM },
        { id: 'model_cohere_select', api: 'openai', type: chat_completion_sources.COHERE },
        { id: 'model_perplexity_select', api: 'openai', type: chat_completion_sources.PERPLEXITY },
        { id: 'model_groq_select', api: 'openai', type: chat_completion_sources.GROQ },
        { id: 'model_electronhub_select', api: 'openai', type: chat_completion_sources.ELECTRONHUB },
        { id: 'model_nanogpt_select', api: 'openai', type: chat_completion_sources.NANOGPT },
        { id: 'model_deepseek_select', api: 'openai', type: chat_completion_sources.DEEPSEEK },
        { id: 'model_aimlapi_select', api: 'openai', type: chat_completion_sources.AIMLAPI },
        { id: 'model_xai_select', api: 'openai', type: chat_completion_sources.XAI },
        { id: 'model_pollinations_select', api: 'openai', type: chat_completion_sources.POLLINATIONS },
        { id: 'model_moonshot_select', api: 'openai', type: chat_completion_sources.MOONSHOT },
        { id: 'model_fireworks_select', api: 'openai', type: chat_completion_sources.FIREWORKS },
        { id: 'model_cometapi_select', api: 'openai', type: chat_completion_sources.COMETAPI },
        { id: 'model_novel_select', api: 'novel', type: null },
        { id: 'horde_model', api: 'koboldhorde', type: null },
    ];

    function getSubType() {
        switch (main_api) {
            case 'textgenerationwebui':
                return textgenerationwebui_settings.type;
            case 'openai':
                return oai_settings.chat_completion_source;
            default:
                return null;
        }
    }

    const apiSubType = getSubType();
    const modelSelectItem = modelSelectMap.find(x => x.api == main_api && x.type == apiSubType)?.id;

    if (!modelSelectItem) {
        !quiet && toastr.info(t`Setting a model for your API is not supported or not implemented yet.`);
        return nullResult;
    }

    const modelSelectControl = document.getElementById(modelSelectItem);

    if (!(modelSelectControl instanceof HTMLSelectElement) && !(modelSelectControl instanceof HTMLInputElement)) {
        !quiet && toastr.error(t`Model select control not found: ${main_api}[${apiSubType}]`);
        return nullResult;
    }

    /**
     * Get options from a HTMLSelectElement or HTMLInputElement with a list.
     * @param {HTMLSelectElement | HTMLInputElement} control Control containing the options
     * @returns {HTMLOptionElement[]} Array of options
     */
    const getOptions = (control) => {
        if (control instanceof HTMLSelectElement) {
            return Array.from(control.options);
        }

        const valueOption = new Option(control.value, control.value);

        if (control instanceof HTMLInputElement && control.list instanceof HTMLDataListElement) {
            return [valueOption, ...Array.from(control.list.options)];
        }

        return [valueOption];
    };

    const options = getOptions(modelSelectControl).filter(x => x.value).filter(onlyUnique);
    return { control: modelSelectControl, options };
}

/**
 * Sets a model for the current API.
 * @param {object} args Named arguments
 * @param {string} model New model name
 * @returns {string} New or existing model name
 */
function modelCallback(args, model) {
    const quiet = isTrueBoolean(args?.quiet);
    const { control: modelSelectControl, options } = getModelOptions(quiet);

    // If no model was found, the reason was already logged, we just return here
    if (options === null) {
        return '';
    }

    model = String(model || '').trim();

    if (!model) {
        return modelSelectControl.value;
    }

    console.log('Set model to ' + model);

    if (modelSelectControl instanceof HTMLInputElement) {
        modelSelectControl.value = model;
        $(modelSelectControl).trigger('input');
        !quiet && toastr.success(t`Model set to "${model}"`);
        return model;
    }

    if (!options.length) {
        !quiet && toastr.warning(t`No model options found. Check your API settings.`);
        return '';
    }

    let newSelectedOption = null;

    const fuse = new Fuse(options, { keys: ['text', 'value'] });
    const fuzzySearchResult = fuse.search(model);

    const exactValueMatch = options.find(x => x.value.trim().toLowerCase() === model.trim().toLowerCase());
    const exactTextMatch = options.find(x => x.text.trim().toLowerCase() === model.trim().toLowerCase());

    if (exactValueMatch) {
        newSelectedOption = exactValueMatch;
    } else if (exactTextMatch) {
        newSelectedOption = exactTextMatch;
    } else if (fuzzySearchResult.length) {
        newSelectedOption = fuzzySearchResult[0].item;
    }

    if (newSelectedOption) {
        modelSelectControl.value = newSelectedOption.value;
        $(modelSelectControl).trigger('change');
        !quiet && toastr.success(t`Model set to "${newSelectedOption.text}"`);
        return newSelectedOption.value;
    } else {
        !quiet && toastr.warning(t`No model found with name "${model}"`);
        return '';
    }
}

/**
 * Gets the state of prompt entries (toggles) either via identifier/uuid or name.
 * @param {object} args Object containing arguments
 * @param {string} args.identifier Select prompt entry using an identifier (uuid)
 * @param {string} args.name Select prompt entry using name
 * @param {string} args.return The type of return value to use (simple, list, dict)
 * @returns {Object} An object containing the states of the requested prompt entries
 */
function getPromptEntryCallback(args) {
    const prompts = promptManager.serviceSettings.prompts;
    let returnType = args.return ?? 'simple';

    function parseArgs(arg) {
        // Arg is already an array
        if (Array.isArray(arg)) {
            return arg;
        }
        const list = [];
        try {
            // Arg is a JSON-stringified array
            const parsedArg = JSON.parse(arg);
            list.push(...Array.isArray(parsedArg) ? parsedArg : [arg]);
        } catch {
            // Arg is a string
            list.push(arg);
        }
        return list;
    }

    let identifiersList = parseArgs(args.identifier);
    let nameList = parseArgs(args.name);

    // Check if identifiers exists in prompt, else remove from list
    if (identifiersList.length !== 0) {
        identifiersList = identifiersList.filter(identifier => prompts.some(prompt => prompt.identifier === identifier));
    }

    if (nameList.length !== 0) {
        nameList.forEach(name => {
            let identifiers = prompts
                .filter(entry => entry.name === name)
                .map(entry => entry.identifier);
            identifiersList = identifiersList.concat(identifiers);
        });
    }

    // Get the state for each prompt entry
    let promptStates = new Map();
    identifiersList.forEach(identifier => {
        const promptOrderEntry = promptManager.getPromptOrderEntry(promptManager.activeCharacter, identifier);
        if (promptOrderEntry) {
            promptStates.set(identifier, promptOrderEntry.enabled);
        }
    });

    // If return is simple (default) but more than one prompt state was retrieved, then change return type
    if (returnType === 'simple' && promptStates.size > 1) {
        returnType = args.identifier ? 'dict' : 'list';
    }

    const result = (() => {
        if (returnType === 'list') return [...promptStates.values()];
        if (returnType === 'dict') return Object.fromEntries(promptStates);
        return [...promptStates.values()][0];
    })();

    return result;
}

/**
 * Sets state of prompt entries (toggles) either via identifier/uuid or name.
 * @param {object} args Object containing arguments
 * @param {string} args.identifier Select prompt entry using an identifier (uuid)
 * @param {string} args.name Select prompt entry using name
 * @param {string} targetState The targeted state of the entry/entries
 * @returns {String} empty string
 */
function setPromptEntryCallback(args, targetState) {
    // needs promptManager to manipulate prompt entries
    const prompts = promptManager.serviceSettings.prompts;

    function parseArgs(arg) {
        // Arg is already an array
        if (Array.isArray(arg)) {
            return arg;
        }
        const list = [];
        try {
            // Arg is a JSON-stringified array
            const parsedArg = JSON.parse(arg);
            list.push(...Array.isArray(parsedArg) ? parsedArg : [arg]);
        } catch {
            // Arg is a string
            list.push(arg);
        }
        return list;
    }

    let identifiersList = parseArgs(args.identifier);
    let nameList = parseArgs(args.name);

    // Check if identifiers exists in prompt, else remove from list
    if (identifiersList.length !== 0) {
        identifiersList = identifiersList.filter(identifier => prompts.some(prompt => prompt.identifier === identifier));
    }

    if (nameList.length !== 0) {
        nameList.forEach(name => {
            // one name could potentially have multiple entries, find all identifiers that match given name
            let identifiers = [];
            prompts.forEach(entry => {
                if (entry.name === name) {
                    identifiers.push(entry.identifier);
                }
            });
            identifiersList = identifiersList.concat(identifiers);
        });
    }

    // Remove duplicates to allow consistent 'toggle'
    identifiersList = [...new Set(identifiersList)];
    if (identifiersList.length === 0) return '';

    // logic adapted from PromptManager.js, handleToggle
    const getPromptOrderEntryState = (promptOrderEntry) => {
        if (['toggle', 't', ''].includes(targetState.trim().toLowerCase())) {
            return !promptOrderEntry.enabled;
        }

        if (isTrueBoolean(targetState)) {
            return true;
        }

        if (isFalseBoolean(targetState)) {
            return false;
        }

        return promptOrderEntry.enabled;
    };

    identifiersList.forEach(promptID => {
        const promptOrderEntry = promptManager.getPromptOrderEntry(promptManager.activeCharacter, promptID);
        const counts = promptManager.tokenHandler.getCounts();

        counts[promptID] = null;
        promptOrderEntry.enabled = getPromptOrderEntryState(promptOrderEntry);
    });

    // no need to render for each identifier
    promptManager.render();
    promptManager.saveServiceSettings();
    return '';
}

/**
 * Sets the API URL and triggers the text generation web UI button click.
 *
 * @param {object} args - named args
 * @param {string?} [args.api=null] - the API name to set/get the URL for
 * @param {string?} [args.connect=true] - whether to connect to the API after setting
 * @param {string?} [args.quiet=false] - whether to suppress toasts
 * @param {string} url - the API URL to set
 * @returns {Promise<string>}
 */
async function setApiUrlCallback({ api = null, connect = 'true', quiet = 'false' }, url) {
    const isQuiet = isTrueBoolean(quiet);
    const autoConnect = isTrueBoolean(connect);

    // Special handling for Chat Completion Custom OpenAI compatible, that one can also support API url handling
    const isCurrentlyCustomOpenai = main_api === 'openai' && oai_settings.chat_completion_source === chat_completion_sources.CUSTOM;
    if (api === chat_completion_sources.CUSTOM || (!api && isCurrentlyCustomOpenai)) {
        if (!url) {
            return oai_settings.custom_url ?? '';
        }

        if (!isCurrentlyCustomOpenai && autoConnect) {
            toastr.warning(t`Custom OpenAI API is not the currently selected API, so we cannot do an auto-connect. Consider switching to it via /api beforehand.`);
            return '';
        }

        $('#custom_api_url_text').val(url).trigger('input');

        if (autoConnect) {
            $('#api_button_openai').trigger('click');
        }

        return url;
    }

    // Special handling for Kobold Classic API
    const isCurrentlyKoboldClassic = main_api === 'kobold';
    if (api === 'kobold' || (!api && isCurrentlyKoboldClassic)) {
        if (!url) {
            return kai_settings.api_server ?? '';
        }

        if (!isCurrentlyKoboldClassic && autoConnect) {
            toastr.warning(t`Kobold Classic API is not the currently selected API, so we cannot do an auto-connect. Consider switching to it via /api beforehand.`);
            return '';
        }

        $('#api_url_text').val(url).trigger('input');
        // trigger blur debounced, so we hide the autocomplete menu
        setTimeout(() => $('#api_url_text').trigger('blur'), 1);

        if (autoConnect) {
            $('#api_button').trigger('click');
        }

        return kai_settings.api_server ?? '';
    }

    // Do some checks and get the api type we are targeting with this command
    if (api && !Object.values(textgen_types).includes(api)) {
        !isQuiet && toastr.warning(t`API '${api}' is not a valid text_gen API.`);
        return '';
    }
    if (!api && !Object.values(textgen_types).includes(textgenerationwebui_settings.type)) {
        !isQuiet && toastr.warning(t`API '${textgenerationwebui_settings.type}' is not a valid text_gen API.`);
        return '';
    }
    if (!api && main_api !== 'textgenerationwebui') {
        !isQuiet && toastr.warning(t`API type '${main_api}' does not support setting the server URL.`);
        return '';
    }
    if (api && url && autoConnect && api !== textgenerationwebui_settings.type) {
        !isQuiet && toastr.warning(t`API '${api}' is not the currently selected API, so we cannot do an auto-connect. Consider switching to it via /api beforehand.`);
        return '';
    }
    const type = api || textgenerationwebui_settings.type;

    const inputSelector = SERVER_INPUTS[type];
    if (!inputSelector) {
        !isQuiet && toastr.warning(t`API '${type}' does not have a server url input.`);
        return '';
    }

    // If no url was provided, return the current one
    if (!url) {
        return textgenerationwebui_settings.server_urls[type] ?? '';
    }

    // else, we want to actually set the url
    $(inputSelector).val(url).trigger('input');
    // trigger blur debounced, so we hide the autocomplete menu
    setTimeout(() => $(inputSelector).trigger('blur'), 1);

    // Trigger the auto connect via connect button, if requested
    if (autoConnect) {
        $('#api_button_textgenerationwebui').trigger('click');
    }

    // We still re-acquire the value, as it might have been modified by the validation on connect
    return textgenerationwebui_settings.server_urls[type] ?? '';
}

async function selectTokenizerCallback(_, name) {
    if (!name) {
        return getAvailableTokenizers().find(tokenizer => tokenizer.tokenizerId === power_user.tokenizer)?.tokenizerKey ?? '';
    }

    const tokenizers = getAvailableTokenizers();
    const fuse = new Fuse(tokenizers, { keys: ['tokenizerKey', 'tokenizerName'] });
    const result = fuse.search(name);

    if (result.length === 0) {
        toastr.warning(t`Tokenizer "${name}" not found`);
        return '';
    }

    /** @type {import('./tokenizers.js').Tokenizer} */
    const foundTokenizer = result[0].item;
    selectTokenizer(foundTokenizer.tokenizerId);

    return foundTokenizer.tokenizerKey;
}

export let isExecutingCommandsFromChatInput = false;
export let commandsFromChatInputAbortController;

/**
 * Show command execution pause/stop buttons next to chat input.
 */
export function activateScriptButtons() {
    document.querySelector('#form_sheld').classList.add('isExecutingCommandsFromChatInput');
}

/**
 * Hide command execution pause/stop buttons next to chat input.
 */
export function deactivateScriptButtons() {
    document.querySelector('#form_sheld').classList.remove('isExecutingCommandsFromChatInput');
}

/**
 * Toggle pause/continue command execution. Only for commands executed via chat input.
 */
export function pauseScriptExecution() {
    if (commandsFromChatInputAbortController) {
        if (commandsFromChatInputAbortController.signal.paused) {
            commandsFromChatInputAbortController.continue('Clicked pause button');
            document.querySelector('#form_sheld').classList.remove('script_paused');
        } else {
            commandsFromChatInputAbortController.pause('Clicked pause button');
            document.querySelector('#form_sheld').classList.add('script_paused');
        }
    }
}

/**
 * Stop command execution. Only for commands executed via chat input.
 */
export function stopScriptExecution() {
    commandsFromChatInputAbortController?.abort('Clicked stop button');
}

/**
 * Clear up command execution progress bar above chat input.
 * @returns Promise<void>
 */
async function clearCommandProgress() {
    if (isExecutingCommandsFromChatInput) return;
    const ta = document.getElementById('send_textarea');
    const fs = document.getElementById('form_sheld');
    if (!ta || !fs) return;
    ta.style.setProperty('--progDone', '1');
    await delay(250);
    if (isExecutingCommandsFromChatInput) return;
    ta.style.transition = 'none';
    await delay(1);
    ta.style.setProperty('--prog', '0%');
    ta.style.setProperty('--progDone', '0');
    fs.classList.remove('script_success');
    fs.classList.remove('script_error');
    fs.classList.remove('script_aborted');
    await delay(1);
    ta.style.transition = null;
}
/**
 * Debounced version of clearCommandProgress.
 */
const clearCommandProgressDebounced = debounce(clearCommandProgress);

/**
 * @typedef ExecuteSlashCommandsOptions
 * @prop {boolean} [handleParserErrors] (true) Whether to handle parser errors (show toast on error) or throw.
 * @prop {SlashCommandScope} [scope] (null) The scope to be used when executing the commands.
 * @prop {boolean} [handleExecutionErrors] (false) Whether to handle execution errors (show toast on error) or throw
 * @prop {import('./slash-commands/SlashCommandParser.js').ParserFlags} [parserFlags] (null) Parser flags to apply
 * @prop {SlashCommandAbortController} [abortController] (null) Controller used to abort or pause command execution
 * @prop {SlashCommandDebugController} [debugController] (null) Controller used to control debug execution
 * @prop {(done:number, total:number)=>void} [onProgress] (null) Callback to handle progress events
 * @prop {string} [source] (null) String indicating where the code come from (e.g., QR name)
 */

/**
 * @typedef ExecuteSlashCommandsOnChatInputOptions
 * @prop {SlashCommandScope} [scope] (null) The scope to be used when executing the commands.
 * @prop {import('./slash-commands/SlashCommandParser.js').ParserFlags} [parserFlags] (null) Parser flags to apply
 * @prop {boolean} [clearChatInput] (false) Whether to clear the chat input textarea
 * @prop {string} [source] (null) String indicating where the code come from (e.g., QR name)
 */

/**
 * Execute slash commands while showing progress indicator and pause/stop buttons on
 * chat input.
 * @param {string} text Slash command text
 * @param {ExecuteSlashCommandsOnChatInputOptions} options
 */
export async function executeSlashCommandsOnChatInput(text, options = {}) {
    if (isExecutingCommandsFromChatInput) return null;

    options = Object.assign({
        scope: null,
        parserFlags: null,
        clearChatInput: false,
        source: null,
    }, options);

    isExecutingCommandsFromChatInput = true;
    commandsFromChatInputAbortController?.abort('processCommands was called');
    activateScriptButtons();

    /** @type {HTMLTextAreaElement} */
    const ta = document.querySelector('#send_textarea');
    const fs = document.querySelector('#form_sheld');

    if (options.clearChatInput) {
        ta.value = '';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    ta.style.setProperty('--prog', '0%');
    ta.style.setProperty('--progDone', '0');
    fs.classList.remove('script_success');
    fs.classList.remove('script_error');
    fs.classList.remove('script_aborted');

    /**@type {SlashCommandClosureResult} */
    let result = null;
    let currentProgress = 0;
    try {
        commandsFromChatInputAbortController = new SlashCommandAbortController();
        result = await executeSlashCommandsWithOptions(text, {
            abortController: commandsFromChatInputAbortController,
            onProgress: (done, total) => {
                const newProgress = done / total;
                if (newProgress > currentProgress) {
                    currentProgress = newProgress;
                    ta.style.setProperty('--prog', `${newProgress * 100}%`);
                }
            },
            parserFlags: options.parserFlags,
            scope: options.scope,
            source: options.source,
        });
        if (commandsFromChatInputAbortController.signal.aborted) {
            document.querySelector('#form_sheld').classList.add('script_aborted');
        } else {
            document.querySelector('#form_sheld').classList.add('script_success');
        }
    } catch (e) {
        document.querySelector('#form_sheld').classList.add('script_error');
        result = new SlashCommandClosureResult();
        result.isError = true;
        result.errorMessage = e.message || t`An unknown error occurred`;
        if (e.cause !== 'abort') {
            if (e instanceof SlashCommandExecutionError) {
                /**@type {SlashCommandExecutionError}*/
                const ex = e;
                const toast = `
                    <div>${ex.message}</div>
                    <div>${t`Line`}: ${ex.line} ${t`Column`}: ${ex.column}</div>
                    <pre style="text-align:left;">${ex.hint}</pre>
                    `;
                const clickHint = `<p>${t`Click to see details`}</p>`;
                toastr.error(
                    `${toast}${clickHint}`,
                    'Slash Command Execution Error',
                    { escapeHtml: false, timeOut: 10000, onclick: () => callGenericPopup(toast, POPUP_TYPE.TEXT, '', { allowHorizontalScrolling: true, allowVerticalScrolling: true }) },
                );
            } else {
                toastr.error(result.errorMessage);
            }
        }
    } finally {
        delay(1000).then(() => clearCommandProgressDebounced());

        commandsFromChatInputAbortController = null;
        deactivateScriptButtons();
        isExecutingCommandsFromChatInput = false;
    }
    return result;
}

/**
 *
 * @param {string} text Slash command text
 * @param {ExecuteSlashCommandsOptions} [options]
 * @returns {Promise<SlashCommandClosureResult>}
 */
async function executeSlashCommandsWithOptions(text, options = {}) {
    if (!text) {
        return null;
    }
    options = Object.assign({
        handleParserErrors: true,
        scope: null,
        handleExecutionErrors: false,
        parserFlags: null,
        abortController: null,
        debugController: null,
        onProgress: null,
        source: null,
    }, options);

    let closure;
    try {
        closure = parser.parse(text, true, options.parserFlags, options.abortController ?? new SlashCommandAbortController());
        closure.scope.parent = options.scope;
        closure.onProgress = options.onProgress;
        closure.debugController = options.debugController;
        closure.source = options.source;
    } catch (e) {
        if (options.handleParserErrors && e instanceof SlashCommandParserError) {
            /**@type {SlashCommandParserError}*/
            const ex = e;
            const toast = `
                <div>${ex.message}</div>
                <div>${t`Line`}: ${ex.line} ${t`Column`}: ${ex.column}</div>
                <pre style="text-align:left;">${ex.hint}</pre>
                `;
            const clickHint = `<p>${t`Click to see details`}</p>`;
            toastr.error(
                `${toast}${clickHint}`,
                'SlashCommandParserError',
                { escapeHtml: false, timeOut: 10000, onclick: () => callGenericPopup(toast, POPUP_TYPE.TEXT, '', { allowHorizontalScrolling: true, allowVerticalScrolling: true }) },
            );
            const result = new SlashCommandClosureResult();
            return result;
        } else {
            throw e;
        }
    }

    try {
        const result = await closure.execute();
        if (result.isAborted && !result.isQuietlyAborted) {
            toastr.warning(result.abortReason, t`Command execution aborted`);
            closure.abortController.signal.isQuiet = true;
        }
        return result;
    } catch (e) {
        if (options.handleExecutionErrors) {
            if (e instanceof SlashCommandExecutionError) {
                /**@type {SlashCommandExecutionError}*/
                const ex = e;
                const toast = `
                    <div>${ex.message}</div>
                    <div>Line: ${ex.line} Column: ${ex.column}</div>
                    <pre style="text-align:left;">${ex.hint}</pre>
                    `;
                const clickHint = '<p>Click to see details</p>';
                toastr.error(
                    `${toast}${clickHint}`,
                    'SlashCommandExecutionError',
                    { escapeHtml: false, timeOut: 10000, onclick: () => callGenericPopup(toast, POPUP_TYPE.TEXT, '', { allowHorizontalScrolling: true, allowVerticalScrolling: true }) },
                );
            } else {
                toastr.error(e.message);
            }
            const result = new SlashCommandClosureResult();
            result.isError = true;
            result.errorMessage = e.message;
            return result;
        } else {
            throw e;
        }
    }
}
/**
 * Executes slash commands in the provided text
 * @deprecated Use executeSlashCommandWithOptions instead
 * @param {string} text Slash command text
 * @param {boolean} handleParserErrors Whether to handle parser errors (show toast on error) or throw
 * @param {SlashCommandScope} scope The scope to be used when executing the commands.
 * @param {boolean} handleExecutionErrors Whether to handle execution errors (show toast on error) or throw
 * @param {{[id:import('./slash-commands/SlashCommandParser.js').PARSER_FLAG]:boolean}} parserFlags Parser flags to apply
 * @param {SlashCommandAbortController} abortController Controller used to abort or pause command execution
 * @param {(done:number, total:number)=>void} onProgress Callback to handle progress events
 * @returns {Promise<SlashCommandClosureResult>}
 */
async function executeSlashCommands(text, handleParserErrors = true, scope = null, handleExecutionErrors = false, parserFlags = null, abortController = null, onProgress = null) {
    return executeSlashCommandsWithOptions(text, {
        handleParserErrors,
        scope,
        handleExecutionErrors,
        parserFlags,
        abortController,
        onProgress,
    });
}

/**
 *
 * @param {HTMLTextAreaElement} textarea The textarea to receive autocomplete
 * @param {Boolean} isFloating Whether to show the auto complete as a floating window (e.g., large QR editor)
 * @returns {Promise<AutoComplete>}
 */
export async function setSlashCommandAutoComplete(textarea, isFloating = false) {
    function canUseNegativeLookbehind() {
        try {
            new RegExp('(?<!_)');
            return true;
        } catch (e) {
            return false;
        }
    }

    if (!canUseNegativeLookbehind()) {
        console.warn('Cannot use negative lookbehind in this browser');
        return;
    }

    const parser = new SlashCommandParser();
    const ac = new AutoComplete(
        textarea,
        () => ac.text[0] == '/' && (power_user.stscript.autocomplete.state === AUTOCOMPLETE_STATE.ALWAYS || power_user.stscript.autocomplete.state === AUTOCOMPLETE_STATE.MIN_LENGTH && ac.text.length > 2),
        async (text, index) => await parser.getNameAt(text, index),
        isFloating,
    );
    return ac;
}
/**@type {HTMLTextAreaElement} */
const sendTextarea = document.querySelector('#send_textarea');
setSlashCommandAutoComplete(sendTextarea);
sendTextarea.addEventListener('input', () => {
    if (sendTextarea.value[0] == '/') {
        sendTextarea.style.fontFamily = 'var(--monoFontFamily, monospace)';
    } else {
        sendTextarea.style.fontFamily = null;
    }
});
