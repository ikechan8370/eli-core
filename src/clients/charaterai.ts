import {AIClient, AIResponse, ChatMessage, GetHistoryOption, Role, SendMessageOption} from "../models/core";

const CharacterAI = require('node_characterai')


export interface CharacterAIClientOption {
    token?: string;
    headless?: boolean;
    proxy?: boolean;
}

export interface CharacterAISendMessageOption extends SendMessageOption {
    characterId?: string;
    singleResponse?: boolean;
}

export interface CharacterGetHistoryOption extends GetHistoryOption {
    characterId: string;
}

export interface CharacterAIResponse extends AIResponse {
    // if guest, please use this token to continue chatting
    token: string;
}

export class CharacterAIClient implements AIClient {
    private _client: typeof CharacterAI;
    private token: string | undefined;

    constructor(props: CharacterAIClientOption = {}) {
        this._client = new CharacterAI();
        this.token = props.token;
    }


    destroyConversation(conversationId: string): Promise<void> {
        return Promise.resolve(undefined);
    }

    async getHistory(options: CharacterGetHistoryOption): Promise<ChatMessage[]> {
        if (!this._client.isAuthenticated()) {
            if (this.token) {
                await this._client.authenticateWithToken(this.token)
            } else {
                throw new Error("you must give token if you want to query history conversations")
            }
        }
        const chat = await this._client.createOrContinueChat(options.characterId, options.conversationId ? options.conversationId : null)
        let history = await chat.fetchHistory();
        let messages: any[] = history.messages;
        while (history.hasMore && history.nextPage < 99999) {
            history = await chat.fetchHistory(history.nextPage);
            if (history.messages && history.messages.length > 0) {
                if (messages.find(m => m.id === history.messages[0].id)) {
                    break;
                } else {
                    messages.push(...history.messages)
                }
            }
        }
        return messages.map(msg => {
            return {
                role: msg.srcIsHuman ? 'user' : 'AI',
                content: msg.text,
                id: msg.id + '',
                // they are in order so parentId is not needed
                parentId: ''
            }
        })
    }

    async sendMessage(prompt: string, options: CharacterAISendMessageOption, role: Role = 'user'): Promise<CharacterAIResponse> {
        if (!this._client.isAuthenticated()) {
            if (this.token) {
                await this._client.authenticateWithToken(this.token)
            } else {
                this.token = await this._client.authenticateAsGuest()
            }
        }

        const chat = await this._client.createOrContinueChat(options.characterId, options.conversationId)

        const response = await chat.sendAndAwaitResponse(prompt, options.singleResponse || true)

        return {
            content: response.text,
            raw: {
                chat, response
            },
            source: "character.ai",
            success: true,
            type: 'llm',
            conversationId: chat.externalId,
            token: this.token
        }

    }

}