interface AIClient {
    sendMessage(prompt: string, options: SendMessageOption, role: Role): Promise<AIResponse>;

    destroyConversation(conversationId: string): Promise<void>;

    getHistory(conversationId: string): Promise<ChatMessage[]>;
}

interface AIResponse {
    type: 'llm' | 'image';
    content?: string;
    parentId?: string;
    id?: string;
    raw: any;
    success: boolean;
    error?: string;
    source: source;
    conversationId?: string;
}


type source = 'openai' | 'chatgpt' | 'bing' | 'sydney' | 'xh' | 'chatglm' | 'slack-claude' | 'character.ai';

class EliError extends Error {
    // source: source;
}

interface SendMessageOption {
    id?: string;
    conversationId?: string;
    parentId?: string;
    model?: string;
    temperature?: number;
    topK?: number;
    maxTokens?: number;
    /**
     * chatgpt only
     */
    action?: 'next' | 'continue';

    debug?: boolean;
}
type Role = 'AI' | 'system' | 'user';
interface ChatMessage {
    role: Role;
    content: string;
    id: string;
    parentId: string;
}

export {
    AIClient,
    AIResponse,
    EliError,
    SendMessageOption,
    ChatMessage,
    Role
}