import {AIClient, AIResponse, ChatMessage, EliError, Role, SendMessageOption} from "../models/core";
import {MessageEngine} from "../models/messages";
import {CreateChatCompletionResponse} from "openai/api";
import {HttpsProxyAgent} from "https-proxy-agent";

const {randomUUID} = require('crypto')
const {Configuration, OpenAIApi} = require("openai");


interface OpenAIClientOption {
    apiKey: string;
    apiBaseUrl?: string;
    storage: MessageEngine;
    proxy?: string;
}

export class OpenAIClient implements AIClient {
    private readonly client: typeof OpenAIApi;
    private storage: MessageEngine;
    private readonly agent: HttpsProxyAgent<string> | undefined;

    constructor(props: OpenAIClientOption) {
        const configuration = new Configuration({
            apiKey: props.apiKey,
            basePath: props.apiBaseUrl
        });
        this.client = new OpenAIApi(configuration)
        this.storage = props.storage;
        if (props.proxy) {
            this.agent = new HttpsProxyAgent(props.proxy)
        }
    }

    async destroyConversation(conversationId: string): Promise<void> {
        await this.storage.deleteConversation(conversationId);
    }

    async getHistory(conversationId: string): Promise<ChatMessage[]> {
        return this.storage.getMessages(undefined, conversationId);
    }

    async sendMessage(prompt: string, options: SendMessageOption, role: Role = 'user'): Promise<AIResponse> {
        let id = randomUUID()
        let messages = await this.storage.getMessages(options.parentId as string, options.conversationId);
        messages.push({
            content: prompt,
            role,
            parentId: options.parentId as string,
            id
        })
        let openai = this.client;
        let messagesConverted = messages.map(message => {
            return {
                role: this.convertRole(message.role),
                content: message.content
            }
        })
        const completion: CreateChatCompletionResponse = (await openai.createChatCompletion({
            model: options.model,
            messages: messagesConverted
        }, {
            httpsAgent: this.agent
        })).data
        let content = completion.choices[0].message?.content;
        if (!content) {
            throw new EliError(JSON.stringify(completion) || "no response from OpenAI")
        }
        messages.push({
            content,
            role: "AI",
            id: completion.id,
            parentId: id
        })
        return {
            id: completion.id,
            type: 'llm',
            source: 'openai',
            content,
            parentId: options.parentId,
            success: true,
            raw: completion,
            error: undefined
        }

    }

    convertRole(role: Role): string {
        switch (role) {
            case "AI": {
                return 'assistant'
            }
            default: {
                return role as string
            }
        }
    }

}