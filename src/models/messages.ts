import {ChatMessage, EliError, Role} from "./core";
import * as os from "os";

const Keyv = require('keyv')
const {KeyvFile} = require('keyv-file')

export interface MessageEngine {
    /**
     * return all the messages of the conversation which are before the id. The messages after parentId would be ignored
     * @param id
     * @param conversationId
     */
    getMessages: (id: string | undefined, conversationId: string) => ChatMessage[] | Promise<ChatMessage[]>;
    /**
     * save a single message. It should be called at least twice in a round of conversation (AI and user both)
     * @param parentId
     * @param conversationId
     * @param content
     * @param role
     * @param id
     */
    saveMessage: (parentId: string, conversationId: string, content: string, role: Role, id: string) => void | Promise<void>;
    /**
     * delete all the message of the conversation after id
     * @param id
     * @param conversationId
     */
    deleteMessageAfter: (id: string, conversationId: string) => void | Promise<void>;
    /**
     * delete the whole conversation
     * @param conversationId
     */
    deleteConversation: (conversationId: string) => void | Promise<void>;
    /**
     * delete all conversations
     */
    deleteAll: () => void | Promise<void>;
    /**
     * get the current namespace
     */
    getNamespace: () => string;
}

export interface KeyvFileMessageEngineOption {
    filename: string;
    namespace: string;

}

/**
 * default implement of the engine with local machine file storage
 */
export class KeyvFileMessageEngine implements MessageEngine {
    private engine: typeof Keyv;
    private readonly namespace: string;

    constructor(props: KeyvFileMessageEngineOption) {
        this.namespace = props.namespace || 'default'
        this.engine = new Keyv({
            namespace: this.namespace,
            store: new KeyvFile({
                filename: props.filename || `${os.tmpdir()}/keyv-file/${this.namespace}.json`,
                encode: JSON.stringify, // serialize function
                decode: JSON.parse // deserialize function
            })
        });

    }

    async deleteAll(): Promise<void> {
        await this.engine.clear();
    }

    async deleteConversation(conversationId: string): Promise<void> {
        await this.engine.delete(conversationId)
    }

    async deleteMessageAfter(id: string, conversationId: string): Promise<void> {
        if (!id) {
            throw new EliError(`id shouldn't be blank`)
        }
        let conv: ChatMessage[] | undefined = await this.engine.get(conversationId)
        if (!conv || conv.length === 0) {
            return
        }
        let index = conv.findIndex(c => c.id === id);
        if (index > 0) {
            conv = conv.slice(0, index + 1)
            await this.engine.set(conversationId, conv)
        } else {
            throw new EliError(`id ${id} doesn't exist`)
        }
    }

    async getMessages(id: string | undefined, conversationId: string): Promise<ChatMessage[]> {
        let conv: ChatMessage[] | undefined = await this.engine.get(conversationId)
        if (!conv || conv.length === 0) {
            return []
        } else {
            let result: ChatMessage[] = [];
            // the first element of the array should be the root message
            let cur: string = conv[0].id
            for (let i = 0; i < conv.length; i++) {
                let currentMessage: ChatMessage | undefined = conv.find(c => c.id === cur);
                if (!currentMessage) {
                    throw new EliError("get message error: unexpected parentId " + cur)
                }
                result.push(currentMessage);
                if (id && currentMessage.id === id) {
                    break;
                }
                cur = currentMessage.id
            }
            return result
        }
    }

    getNamespace(): string {
        return this.namespace;
    }

    async saveMessage(parentId: string, conversationId: string, content: string, role: Role, id: string): Promise<void> {
        let conv: ChatMessage[] | undefined = await this.engine.get(conversationId)
        if (conv) {
            let message: ChatMessage = {
                content, role, id, parentId
            };
            conv.push(message);
        } else {
            conv = [{
                content, role, id, parentId
            }]
        }
        await this.engine.set(conversationId, conv)
    }

}