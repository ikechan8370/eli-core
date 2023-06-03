import {AIClient, AIResponse, ChatMessage, EliError, Role, SendMessageOption} from "../models/core";
import {HttpsProxyAgent} from "https-proxy-agent";
import {ParseEvent} from "eventsource-parser";

const https = require('https')
const http = require('http')
import {IncomingMessage} from "http";
const {createParser} = require('eventsource-parser')
const {randomUUID} = require('crypto')

export interface ChatGPTClientOption {
    accessToken: string;
    apiReverseUrl: string;

    proxy?: string;

}
export class ChatGPTClient implements AIClient {
    private readonly _accessToken: string;
    private readonly _apiReverseUrl: string;
    private agent: HttpsProxyAgent<string> | undefined;
    constructor (opts: ChatGPTClientOption) {
        const {
            accessToken,
            apiReverseUrl
        } = opts
        this._accessToken = accessToken
        this._apiReverseUrl = apiReverseUrl
        if (opts.proxy) {
            this.agent = new HttpsProxyAgent(opts.proxy)
        }
    }

    async sendMessage (prompt: string, options: SendMessageOption, role: Role = 'user'): Promise<AIResponse> {
        if (role !== 'user') {
            throw new EliError("chatgpt client doesn't support role " + role as string)
        }
        let {
            conversationId,
            parentId = randomUUID(),
            id = randomUUID(),
            action = 'next'
        } = options
        let url = this._apiReverseUrl
        const body = {
            action,
            messages: [
                {
                    id,
                    role: 'user',
                    content: {
                        content_type: 'text',
                        parts: [prompt]
                    }
                }
            ],
            model: options.model || 'text-davinci-002-render-sha',
            parent_message_id: parentId,
            conversation_id: undefined as string | undefined
        }
        if (conversationId) {
            body.conversation_id = conversationId
        }
        let conversationResponse: object
        let statusCode: number = 0
        let requestP = new Promise((resolve, reject) => {
            let option = {
                method: 'POST',
                headers: {
                    accept: 'text/event-stream',
                    'x-openai-assistant-app-id': '',
                    authorization: `Bearer ${this._accessToken}`,
                    'content-type': 'application/json',
                    referer: 'https://chat.openai.com/chat',
                    library: 'eli-core'
                },
                referrer: 'https://chat.openai.com/chat'
            }
            let requestLib = url.startsWith('https') ? https : http
            const req = requestLib.request(url, option, (res: IncomingMessage) => {
                statusCode = res.statusCode as number
                let response: string
                function onMessage (data: string) {
                    if (data === '[DONE]') {
                        return resolve({
                            error: null,
                            response,
                            conversationId,
                            messageId: id,
                            conversationResponse
                        })
                    }
                    try {
                        JSON.parse(data)
                    } catch (error) {
                        return
                    }
                    try {
                        const convoResponseEvent = JSON.parse(data)
                        conversationResponse = convoResponseEvent
                        if (convoResponseEvent.conversation_id) {
                            conversationId = convoResponseEvent.conversation_id
                        }

                        if (convoResponseEvent.message?.id) {
                            id = convoResponseEvent.message.id
                        }

                        const partialResponse =
                            convoResponseEvent.message?.content?.parts?.[0]
                        if (partialResponse) {
                            if (options.debug) {
                                console.log(JSON.stringify(convoResponseEvent))
                            }
                            response = partialResponse
                        }
                    } catch (err) {
                        console.warn('fetchSSE onMessage unexpected error', err)
                        reject(err)
                    }
                }

                const parser = createParser((event: ParseEvent) => {
                    if (event.type === 'event') {
                        onMessage(event.data)
                    }
                })
                const errBody: Buffer[] = []
                res.on('data', (chunk: Buffer) => {
                    // logger.mark('成功连接到chat.openai.com，准备读取数据流')
                    if (statusCode === 200) {
                        let str = chunk.toString()
                        parser.feed(str)
                    }
                    errBody.push(chunk)
                })

                // const body = []
                // res.on('data', (chunk) => body.push(chunk))
                res.on('end', () => {
                    const resString = Buffer.concat(errBody).toString()
                    reject(resString)
                })
            })
            req.on('error', (err: Error) => {
                reject(err)
            })

            req.on('timeout', () => {
                req.destroy()
                reject(new Error('Request time out'))
            })

            req.write(JSON.stringify(body))
            req.end()
        })
        let response: string | Record<string, any> = (await requestP) as string | object
        if (statusCode === 200) {
            response = response as object
            return {
                content: response.response,
                id: response.messageId,
                error: undefined,
                raw: response,
                source: 'chatgpt',
                success: true,
                type: 'llm',
                parentId
            }
        } else {
            console.error(response)
            throw new EliError(response as string)
        }
    }

    async destroyConversation(conversationId: string): Promise<void> {
        throw new EliError("not implemented yet")
    }

    async getHistory(conversationId: string): Promise<ChatMessage[]> {
        throw new EliError("not implemented yet")
    }
}
