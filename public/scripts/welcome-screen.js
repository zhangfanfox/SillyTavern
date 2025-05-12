import {
    addOneMessage,
    characters,
    chat,
    displayVersion,
    doNewChat,
    event_types,
    eventSource,
    getCharacters,
    getCurrentChatId,
    getRequestHeaders,
    getThumbnailUrl,
    is_send_press,
    neutralCharacterName,
    newAssistantChat,
    openCharacterChat,
    printCharactersDebounced,
    selectCharacterById,
    sendSystemMessage,
    system_avatar,
    system_message_types,
    this_chid,
} from '../script.js';
import { is_group_generating } from './group-chats.js';
import { t } from './i18n.js';
import { renderTemplateAsync } from './templates.js';
import { accountStorage } from './util/AccountStorage.js';
import { timestampToMoment } from './utils.js';

const assistantAvatarKey = 'assistant';
const defaultAssistantAvatar = 'default_Assistant.png';

export function getPermanentAssistantAvatar() {
    const assistantAvatar = accountStorage.getItem(assistantAvatarKey);
    if (assistantAvatar === null) {
        return defaultAssistantAvatar;
    }

    const character = characters.find(x => x.avatar === assistantAvatar);
    if (character === undefined) {
        accountStorage.removeItem(assistantAvatarKey);
        return defaultAssistantAvatar;
    }

    return assistantAvatar;
}

export async function openWelcomeScreen() {
    const currentChatId = getCurrentChatId();
    if (currentChatId !== undefined) {
        return;
    }

    await sendWelcomePanel();
    sendAssistantMessage();
    sendSystemMessage(system_message_types.WELCOME_PROMPT);
}

function sendAssistantMessage() {
    const currentAssistantAvatar = getPermanentAssistantAvatar();
    const character = characters.find(x => x.avatar === currentAssistantAvatar);
    const name = character ? character.name : neutralCharacterName;
    const avatar = character ? getThumbnailUrl('avatar', character.avatar) : system_avatar;

    const message = {
        name: name,
        force_avatar: avatar,
        mes: t`If you're connected to an API, try asking me something!`,
        is_system: false,
        is_user: false,
        extra: {},
    };

    chat.push(message);
    addOneMessage(message);
}

async function sendWelcomePanel() {
    try {
        const chatElement = document.getElementById('chat');
        if (!chatElement) {
            console.error('Chat element not found');
            return;
        }
        const chats = await getRecentChats();
        const templateData = {
            chats,
            empty: !chats.length,
            version: displayVersion,
            more: chats.some(chat => chat.hidden),
        };
        const template = await renderTemplateAsync('welcomePanel', templateData);
        const fragment = document.createRange().createContextualFragment(template);
        fragment.querySelectorAll('.recentChat').forEach((item) => {
            item.addEventListener('click', () => {
                const avatarId = item.getAttribute('data-avatar');
                const fileName = item.getAttribute('data-file');
                if (avatarId && fileName) {
                    void openRecentChat(avatarId, fileName);
                }
            });
        });
        const hiddenChats = fragment.querySelectorAll('.recentChat.hidden');
        fragment.querySelectorAll('button.showMoreChats').forEach((button) => {
            button.addEventListener('click', () => {
                hiddenChats.forEach((chatItem) => {
                    chatItem.classList.remove('hidden');
                });
                button.remove();
            });
        });
        fragment.querySelectorAll('button.openTemporaryChat').forEach((button) => {
            button.addEventListener('click', () => {
                void newAssistantChat({ temporary: true });
            });
        });
        chatElement.append(fragment.firstChild);
    } catch (error) {
        console.error('Welcome screen error:', error);
    }
}

/**
 * Opens a recent chat.
 * @param {string} avatarId Avatar file name
 * @param {string} fileName Chat file name
 */
async function openRecentChat(avatarId, fileName) {
    const characterId = characters.findIndex(x => x.avatar === avatarId);
    if (characterId === -1) {
        console.error(`Character not found for avatar ID: ${avatarId}`);
        return;
    }

    try {
        await selectCharacterById(characterId);
        const currentChatId = getCurrentChatId();
        if (currentChatId === fileName) {
            console.debug(`Chat ${fileName} is already open.`);
            return;
        }
        await openCharacterChat(fileName);
    } catch (error) {
        console.error('Error opening recent chat:', error);
        toastr.error(t`Failed to open recent chat. See console for details.`);
    }
}

/**
 * Gets the list of recent chats from the server.
 * @returns {Promise<RecentChat[]>} List of recent chats
 *
 * @typedef {object} RecentChat
 * @property {string} file_name Name of the chat file
 * @property {string} chat_name Name of the chat (without extension)
 * @property {string} file_size Size of the chat file
 * @property {number} chat_items Number of items in the chat
 * @property {string} mes Last message content
 * @property {number} last_mes Timestamp of the last message
 * @property {string} avatar Avatar URL
 * @property {string} char_thumbnail Thumbnail URL
 * @property {string} char_name Character name
 * @property {string} date_short Date in short format
 * @property {string} date_long Date in long format
 * @property {boolean} hidden Chat will be hidden by default
 */
async function getRecentChats() {
    const response = await fetch('/api/characters/recent', {
        method: 'POST',
        headers: getRequestHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch recent chats');
    }

    /** @type {RecentChat[]} */
    const data = await response.json();

    data.sort((a, b) => b.last_mes - a.last_mes)
        .map(chat => ({ chat, character: characters.find(x => x.avatar === chat.avatar) }))
        .filter(t => t.character)
        .forEach(({ chat, character }, index) => {
            const DEFAULT_DISPLAYED = 5;
            const chatTimestamp = timestampToMoment(chat.last_mes);
            chat.char_name = character.name;
            chat.date_short = chatTimestamp.format('l');
            chat.date_long = chatTimestamp.format('LL LT');
            chat.chat_name = chat.file_name.replace('.jsonl', '');
            chat.char_thumbnail = getThumbnailUrl('avatar', character.avatar);
            chat.hidden = index >= DEFAULT_DISPLAYED;
        });

    return data;
}

export async function openPermanentAssistantChat({ tryCreate = true } = {}) {
    const avatar = getPermanentAssistantAvatar();
    const characterId = characters.findIndex(x => x.avatar === avatar);
    if (characterId === -1) {
        if (!tryCreate) {
            console.error(`Character not found for avatar ID: ${avatar}. Cannot create.`);
            return;
        }

        try {
            console.log(`Character not found for avatar ID: ${avatar}. Creating new assistant.`);
            await createPermanentAssistant();
            return openPermanentAssistantChat({ tryCreate: false });
        }
        catch (error) {
            console.error('Error creating permanent assistant:', error);
            toastr.error(t`Failed to create ${neutralCharacterName}. See console for details.`);
            return;
        }
    }

    try {
        await selectCharacterById(characterId);
        await doNewChat({ deleteCurrentChat: false });
        console.log(`Opened permanent assistant chat for ${neutralCharacterName}.`, getCurrentChatId());
    } catch (error) {
        console.error('Error opening permanent assistant chat:', error);
        toastr.error(t`Failed to open permanent assistant chat. See console for details.`);
    }
}

async function createPermanentAssistant() {
    if (is_group_generating || is_send_press) {
        throw new Error(t`Cannot create while generating.`);
    }

    const formData = new FormData();
    formData.append('ch_name', neutralCharacterName);
    formData.append('file_name', defaultAssistantAvatar.replace('.png', ''));
    formData.append('creator_notes', t`Automatically created character. Feel free to edit.`);

    try {
        const avatarResponse = await fetch(system_avatar);
        const avatarBlob = await avatarResponse.blob();
        formData.append('avatar', avatarBlob, defaultAssistantAvatar);
    } catch (error) {
        console.warn('Error fetching system avatar. Fallback image will be used.', error);
    }

    const headers = getRequestHeaders();
    delete headers['Content-Type'];

    const fetchResult = await fetch('/api/characters/create', {
        method: 'POST',
        headers: headers,
        body: formData,
        cache: 'no-cache',
    });

    if (!fetchResult.ok) {
        throw new Error(t`Creation request did not succeed.`);
    }

    await getCharacters();
}

export async function openPermanentAssistantCard() {
    const avatar = getPermanentAssistantAvatar();
    const characterId = characters.findIndex(x => x.avatar === avatar);
    if (characterId === -1) {
        toastr.info(t`Assistant not found. Try sending a chat message.`);
        return;
    }

    await selectCharacterById(characterId);
}

export function initWelcomeScreen() {
    const events = [event_types.CHAT_CHANGED, event_types.APP_READY];
    for (const event of events) {
        eventSource.makeFirst(event, openWelcomeScreen);
    }

    eventSource.on(event_types.CHARACTER_MANAGEMENT_DROPDOWN, (target) =>{
        if (target !== 'set_as_assistant') {
            return;
        }
        if (this_chid === undefined) {
            return;
        }
        /** @type {import('./char-data.js').v1CharData} */
        const character = characters[this_chid];
        if (!character) {
            return;
        }

        const currentAssistantAvatar = getPermanentAssistantAvatar();
        if (currentAssistantAvatar === character.avatar) {
            if (character.avatar === defaultAssistantAvatar) {
                toastr.info(t`${character.name} is a system assistant. Choose another character.`);
                return;
            }

            toastr.info(t`${character.name} is no longer your assistant.`);
            accountStorage.removeItem(assistantAvatarKey);
            return;
        }

        accountStorage.setItem(assistantAvatarKey, character.avatar);
        printCharactersDebounced();
        toastr.success(t`Set ${character.name} as your assistant.`);
    });

    eventSource.on(event_types.CHARACTER_RENAMED, (oldAvatar, newAvatar) => {
        if (oldAvatar === getPermanentAssistantAvatar()) {
            accountStorage.setItem(assistantAvatarKey, newAvatar);
        }
    });
}
