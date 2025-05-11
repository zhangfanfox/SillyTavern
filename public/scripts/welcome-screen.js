import {
    characters,
    displayVersion,
    event_types,
    eventSource,
    getCurrentChatId,
    getRequestHeaders,
    getThumbnailUrl,
    openCharacterChat,
    selectCharacterById,
    sendSystemMessage,
    system_message_types,
} from '../script.js';
import { t } from './i18n.js';
import { renderTemplateAsync } from './templates.js';
import { timestampToMoment } from './utils.js';

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
        const chatElement =  document.getElementById('chat');
        if (!chatElement) {
            console.error('Chat element not found');
            return;
        }
        const chats = await getRecentChats();
        const templateData = {
            chats,
            empty: !chats.length ,
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
            toastr.info('This button does nothing at the moment. Try again later.');
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

    data.sort((a, b) =>  b.last_mes - a.last_mes).forEach((chat, index) => {
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

export function initWelcomeScreen() {
    const events = [event_types.CHAT_CHANGED, event_types.APP_READY];
    for (const event of events) {
        eventSource.makeFirst(event, openWelcomeScreen);
    }
}
