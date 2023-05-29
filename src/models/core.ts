interface AIClient {
    sendMessage(prompt: string, options: SendMessageOption, role: Role): Promise<AIResponse>;

    destroyConversation(conversationId: string): Promise<void>;

    getHistory(conversationId: string): Promise<ChatMessage[]>;
}

interface AIResponse {
    type: 'llm' | 'image';
    content: string;
    parentId: string | undefined;
    id: string | undefined;
    raw: any;
    success: boolean;
    error: string | undefined;
    source: source;
}


type source = 'openai' | 'chatgpt' | 'bing' | 'sydney' | 'xh' | 'chatglm' | 'slack-claude';

class EliError extends Error {
    // source: source;
}

interface SendMessageOption {
    id: string;
    conversationId: string;
    parentId: string | undefined;
    model: string | undefined;
    temperature: number;
    topK: number;
    maxTokens: number;
    /**
     * chatgpt only
     */
    action: undefined | 'next' | 'continue';

    debug: boolean;
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