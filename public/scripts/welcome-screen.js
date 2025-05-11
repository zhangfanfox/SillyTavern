import {
    characters,
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
    selectCharacterById,
    sendSystemMessage,
    system_message_types,
} from '../script.js';
import { is_group_generating } from './group-chats.js';
import { t } from './i18n.js';
import { renderTemplateAsync } from './templates.js';
import { timestampToMoment } from './utils.js';

const permanentAssistantAvatar = 'default_Assistant.png';

export async function openWelcomeScreen() {
    const currentChatId = getCurrentChatId();
    if (currentChatId !== undefined) {
        return;
    }

    await sendWelcomePanel();
    sendSystemMessage(system_message_types.WELCOME_PROMPT);
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
        fragment.querySelector('button.openTemporaryChat').addEventListener('click', () => {
            void newAssistantChat({ temporary: true });
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

    data.sort((a, b) => b.last_mes - a.last_mes).forEach((chat, index) => {
        const character = characters.find(x => x.avatar === chat.avatar);
        if (!character) {
            console.warn(`Character not found for chat: ${chat.file_name}`);
            data.splice(index, 1);
            return;
        }

        const chatTimestamp = timestampToMoment(chat.last_mes);
        chat.char_name = character.name;
        chat.date_short = chatTimestamp.format('l');
        chat.date_long = chatTimestamp.format('LL LT');
        chat.chat_name = chat.file_name.replace('.jsonl', '');
        chat.char_thumbnail = getThumbnailUrl('avatar', character.avatar);
    });

    return data;
}

export async function openPermanentAssistantChat({ tryCreate = true } = {}) {
    const characterId = characters.findIndex(x => x.avatar === permanentAssistantAvatar);
    if (characterId === -1) {
        if (!tryCreate) {
            console.error(`Character not found for avatar ID: ${permanentAssistantAvatar}. Cannot create.`);
            return;
        }

        try {
            console.log(`Character not found for avatar ID: ${permanentAssistantAvatar}. Creating new assistant.`);
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
    formData.append('file_name', permanentAssistantAvatar.replace('.png', ''));

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
    const characterId = characters.findIndex(x => x.avatar === permanentAssistantAvatar);
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
}
