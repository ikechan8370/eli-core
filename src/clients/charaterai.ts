import {AIClient, AIResponse, ChatMessage, Role, SendMessageOption} from "../models/core";
const CharacterAI = require('node_characterai')


export interface CharacterAIClientOption {
    token?: string;
    headless?: boolean;
    proxy?: boolean;
}

export interface CharacterAISendMessageOption extends SendMessageOption{
    characterId?: string;
    singleResponse?: boolean;
}
export class CharacterAIClient implements AIClient {
    private _client: typeof CharacterAI;
    private readonly token: string | undefined;

    constructor(props: CharacterAIClientOption = {}) {
        this._client = new CharacterAI();
        this.token = props.token;
    }


    destroyConversation(conversationId: string): Promise<void> {
        return Promise.resolve(undefined);
    }

    getHistory(conversationId: string): Promise<ChatMessage[]> {
        return Promise.resolve([]);
    }

    async sendMessage(prompt: string, options: CharacterAISendMessageOption, role: Role = 'user'): Promise<AIResponse> {
        if (!this._client.isAuthenticated()) {
            if (this.token) {
                await this._client.authenticateWithToken(this.token)
            } else {
                await this._client.authenticateAsGuest()
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
            conversationId: chat.externalId
        }

    }

}