import {MessageEngine} from "../models/messages";
import {AIClient, AIResponse, ChatMessage, EliError, Role, SendMessageOption} from "../models/core";
import {randomUUID} from "crypto";
import {HttpsProxyAgent} from "https-proxy-agent";
import {RequestInit} from "node-fetch";
// import {RawData} from "ws";
// import Websocket from 'ws'
const Websocket = require('ws')
import {RawData, WebSocket} from "ws";
// import fetch from 'node-fetch'
// import delay from 'delay'
const fetch = require('node-fetch')
import {setTimeout as delay} from 'node:timers/promises';

export interface SydneyLLMClientOption {
    baseUrl?: string;
    proxy?: string;

    cookie?: string;

    storage: MessageEngine;

    debug?: boolean;

    websocketUseReverseProxy?: boolean;

    wsBaseUrl?: string;

    saveMaxNumUserMessagesInConversationFn?: (maxNumUserMessagesInConversation: number) => void | Promise<void>;

    getMaxNumUserMessagesInConversationFn?: () => number | Promise<number>;

    timeout?: number;

    firstMessageTimeout?: number;
}


export class SydneyLLMClient implements AIClient {
    private readonly host: string;
    private readonly debug: boolean;
    private storage: MessageEngine;
    private readonly cookie: string | undefined;
    private readonly agent: HttpsProxyAgent<string> | undefined;
    private readonly websocketUseReverseProxy: boolean;
    private readonly wsHost: string;
    private readonly getMaxNumUserMessagesInConversationFn: () => (number | Promise<number>);
    private saveMaxNumUserMessagesInConversationFn: (maxNumUserMessagesInConversation: number) => (void | Promise<void>);
    private readonly timeout: number;
    private readonly firstMessageTimeout: number;


    constructor(opts: SydneyLLMClientOption) {
        this.wsHost = opts.wsBaseUrl || 'https://sydney.bing.com'
        this.host = opts.baseUrl || 'https://edgeservices.bing.com/edgesvc'
        // if (opts.proxy && !Config.sydneyForceUseReverse) {
        //   this.opts.host = 'https://www.bing.com'
        // }
        this.debug = opts.debug || false
        this.storage = opts.storage
        this.cookie = opts.cookie
        this.websocketUseReverseProxy = opts.websocketUseReverseProxy || false;
        this.saveMaxNumUserMessagesInConversationFn = opts.saveMaxNumUserMessagesInConversationFn || ((_n: number) => {
        })
        this.getMaxNumUserMessagesInConversationFn = opts.getMaxNumUserMessagesInConversationFn || (() => 20)
        this.timeout = opts.timeout || 12000;
        this.firstMessageTimeout = opts.firstMessageTimeout || 24000;
        if (opts.proxy) {
            this.agent = new HttpsProxyAgent(opts.proxy)
        }
    }

    async destroyConversation(conversationId: string): Promise<void> {
        return Promise.resolve(undefined);
    }

    async getHistory(conversationId: string): Promise<ChatMessage[]> {
        return Promise.resolve([]);
    }

    async sendMessage(prompt: string, options: SydneySendMessageOption, role: Role = 'user'): Promise<AIResponse> {
        let parentMessageId: string | undefined = options.parentId;
        let conversationId: string = options.conversationId || randomUUID();
        let messages: ChatMessage[] = await this.storage.getMessages(parentMessageId, conversationId);
        let createRes: CreateBingConversationResponse = await this.createNewConversation();
        let ws: WebSocket = await this.createWebSocketConnection();
        let abortController = new AbortController();
        const stopToken = '\n\nUser:'
        if (options.preMessages) {
            messages = ([] as ChatMessage[]).concat(options.preMessages, messages)
            // todo check if there is order error
        }
        let previousMessages = messages.map((message) => {
            return {
                text: message.content,
                author: message.role === 'user' ? 'user' : 'bot'
            }
        })
        let context: string = options.context || "";
        let exceedConversations: { text: string, author: string }[] = [], pm: { text: string, author: string }[] = []
        let maxNumUserMessagesInConversation = await this.getMaxNumUserMessagesInConversationFn();
        previousMessages.reverse().forEach(m => {
            if (pm.filter(m => m.author === 'user').length < maxNumUserMessagesInConversation - 1) {
                pm.push(m)
            } else {
                exceedConversations.push(m)
            }
        })
        pm = pm.reverse()
        if (exceedConversations.length > 0) {
            context += '\nThese are some conversations records between you and I: \n'
            context += exceedConversations.map(m => {
                return `${m.author}: ${m.text}`
            }).join('\n')
            context += '\n'
        }
        const toneOption = 'h3imaginative'
        let optionsSets = [
            'nlu_direct_response_filter',
            'deepleo',
            'disable_emoji_spoken_text',
            'responsible_ai_policy_235',
            'enablemm',
            toneOption,
            'dagslnv1',
            'sportsansgnd',
            'dl_edge_desc',
            'noknowimg',
            // 'dtappid',
            // 'cricinfo',
            // 'cricinfov2',
            'dv3sugg',
            'gencontentv3'
        ]
        const obj = {
            arguments: [
                {
                    source: 'cib',
                    optionsSets,
                    sliceIds: [
                        '222dtappid',
                        '225cricinfo',
                        '224locals0'
                    ],
                    traceId: genRanHex(32),
                    isStartOfSession: true,
                    message: {
                        locale: 'zh-CN',
                        market: 'zh-CN',
                        region: 'HK',
                        location: 'lat:47.639557;long:-122.128159;re=1000m;',
                        locationHints: [
                            {
                                Center: {
                                    Latitude: 39.971031896331,
                                    Longitude: 116.33522679576237
                                },
                                RegionType: 2,
                                SourceType: 11
                            },
                            {
                                country: 'Hong Kong',
                                timezoneoffset: 8,
                                countryConfidence: 9,
                                Center: {
                                    Latitude: 22.15,
                                    Longitude: 114.1
                                },
                                RegionType: 2,
                                SourceType: 1
                            }
                        ],
                        author: 'user',
                        inputMethod: 'Keyboard',
                        text: prompt,
                        messageType: options.messageType || 'SearchQuery'
                        // messageType: 'SearchQuery'
                    },
                    conversationSignature: createRes.conversationSignature,
                    participant: {
                        id: createRes.clientId
                    },
                    conversationId: createRes.conversationId,
                    previousMessages: pm
                }
            ],
            invocationId: '0',
            target: 'chat',
            type: 4
        }
        if (context) {
            obj.arguments[0].previousMessages.push({
                author: 'user',
                // @ts-ignore
                description: context,
                contextType: 'WebPage',
                messageType: 'Context',
                messageId: 'discover-web--page-ping-mriduna-----'
            })
        }

        let apology = false
        const messagePromise: Promise<SydneyWsMessage> = new Promise((resolve, reject) => {
            let replySoFar = ['']
            let adaptiveCardsSoFar: adaptiveCard[] = []
            let suggestedResponsesSoFar: suggestedResponse[] = []
            let stopTokenFound = false

            const messageTimeout = setTimeout(() => {
                this.cleanupWebSocketConnection(ws)
                if (replySoFar[0]) {
                    let message: SydneyMessage = {
                        adaptiveCards: adaptiveCardsSoFar,
                        text: replySoFar.join('')
                    }
                    resolve({
                        message
                    })
                } else {
                    reject(new Error('Timed out waiting for response. Try enabling debug mode to see more information.'))
                }
            }, this.timeout)
            const firstTimeout = setTimeout(() => {
                if (!replySoFar[0]) {
                    this.cleanupWebSocketConnection(ws)
                    reject(new Error('等待必应服务器响应超时。请尝试调整超时时间配置或减少设定量以避免此问题。'))
                }
            }, this.firstMessageTimeout)

            // abort the request if the abort controller is aborted
            abortController.signal.addEventListener('abort', () => {
                clearTimeout(messageTimeout)
                clearTimeout(firstTimeout)
                this.cleanupWebSocketConnection(ws)
                if (replySoFar[0]) {
                    let message = {
                        adaptiveCards: adaptiveCardsSoFar,
                        text: replySoFar.join('')
                    }
                    resolve({
                        message
                    })
                } else {
                    reject('Request aborted')
                }
            })
            let cursor = 0
            // let apology = false
            ws.on('message', (data) => {
                const objects = data.toString().split('')
                const events = objects.map((object) => {
                    try {
                        return JSON.parse(object)
                    } catch (error) {
                        return object
                    }
                }).filter(message => message)
                if (events.length === 0) {
                    return
                }
                const eventFiltered = events.filter(e => e.type === 1 || e.type === 2)
                if (eventFiltered.length === 0) {
                    return
                }
                const event = eventFiltered[0]
                switch (event.type) {
                    case 1: {
                        // reject(new Error('test'))
                        if (stopTokenFound || apology) {
                            return
                        }
                        const messages = event?.arguments?.[0]?.messages
                        if (!messages?.length || messages[0].author !== 'bot') {
                            if (event?.arguments?.[0]?.throttling?.maxNumUserMessagesInConversation) {
                                maxNumUserMessagesInConversation = event?.arguments?.[0]?.throttling?.maxNumUserMessagesInConversation
                            }
                            return
                        }
                        const message = messages.length
                            ? messages[messages.length - 1]
                            : {
                                adaptiveCards: adaptiveCardsSoFar,
                                text: replySoFar.join('')
                            }
                        if (messages[0].contentOrigin === 'Apology') {
                            console.log('Apology found')
                            if (!replySoFar[0]) {
                                apology = true
                            }
                            stopTokenFound = true
                            clearTimeout(messageTimeout)
                            clearTimeout(firstTimeout)
                            this.cleanupWebSocketConnection(ws)
                            // adaptiveCardsSoFar || (message.adaptiveCards[0].body[0].text = replySoFar)
                            console.log({replySoFar, message})
                            message.adaptiveCards = adaptiveCardsSoFar
                            message.text = replySoFar.join('') || message.spokenText
                            message.suggestedResponses = suggestedResponsesSoFar
                            // 遇到Apology不发送默认建议回复
                            // message.suggestedResponses = suggestedResponsesSoFar || message.suggestedResponses
                            resolve({
                                message,
                                conversationExpiryTime: event?.item?.conversationExpiryTime
                            })
                            return
                        } else {
                            adaptiveCardsSoFar = message.adaptiveCards
                            suggestedResponsesSoFar = message.suggestedResponses
                        }
                        const updatedText = messages[0].text
                        if (!updatedText || updatedText === replySoFar[cursor]) {
                            return
                        }
                        // get the difference between the current text and the previous text
                        if (replySoFar[cursor] && updatedText.startsWith(replySoFar[cursor])) {
                            if (updatedText.trim().endsWith(stopToken)) {
                                // apology = true
                                // remove stop token from updated text
                                replySoFar[cursor] = updatedText.replace(stopToken, '').trim()
                                return
                            }
                            replySoFar[cursor] = updatedText
                        } else if (replySoFar[cursor]) {
                            cursor += 1
                            replySoFar.push(updatedText)
                        } else {
                            replySoFar[cursor] = replySoFar[cursor] + updatedText
                        }

                        // onProgress(difference)
                        return
                    }
                    case 2: {
                        if (apology) {
                            return
                        }
                        clearTimeout(messageTimeout)
                        clearTimeout(firstTimeout)
                        this.cleanupWebSocketConnection(ws)
                        let item: SydneyItem = event.item
                        if (item?.result?.value === 'InvalidSession') {
                            reject(`${event.item.result.value}: ${event.item.result.message}`)
                            return
                        }
                        let messages: SydneyMessage[] = event.item?.messages || []
                        // messages = messages.filter(m => m.author === 'bot')
                        const message: SydneyMessage = messages.length
                            ? messages[messages.length - 1]
                            : {
                                adaptiveCards: adaptiveCardsSoFar,
                                text: replySoFar.join('')
                            } as SydneyMessage
                        // 获取到图片内容
                        if (message.contentType === 'IMAGE') {
                            message.imageTag = messages.filter(m => m.contentType === 'IMAGE').map(m => m.text).join('')
                        }
                        message.text = messages.filter(m => m.author === 'bot' && m.contentType != 'IMAGE').map(m => m.text).join('')
                        if (!message) {
                            reject('No message was generated.')
                            return
                        }
                        if (message?.author !== 'bot') {
                            if (event.item?.result) {
                                if (event.item?.result?.exception?.indexOf('maximum context length') > -1) {
                                    reject('对话长度太长啦！超出8193token，请结束对话重新开始')
                                } else if (event.item?.result.value === 'Throttled') {
                                    reject('该账户的SERP请求已被限流')
                                    console.warn('该账户的SERP请求已被限流')
                                    console.warn(JSON.stringify(event.item?.result))
                                } else {
                                    reject(`${event.item?.result.value}\n${event.item?.result.error}\n${event.item?.result.exception}`)
                                }
                            } else {
                                reject('Unexpected message author.')
                            }

                            return
                        }
                        if (message.contentOrigin === 'Apology') {
                            if (!replySoFar[0]) {
                                apology = true
                            }
                            console.log('Apology found')
                            stopTokenFound = true
                            clearTimeout(messageTimeout)
                            clearTimeout(firstTimeout)
                            this.cleanupWebSocketConnection(ws)
                            // message.adaptiveCards[0].body[0].text = replySoFar || message.spokenText
                            message.adaptiveCards = adaptiveCardsSoFar
                            message.text = replySoFar.join('') || message.spokenText
                            message.suggestedResponses = suggestedResponsesSoFar
                            // 遇到Apology不发送默认建议回复
                            // message.suggestedResponses = suggestedResponsesSoFar || message.suggestedResponses
                            resolve({
                                message,
                                conversationExpiryTime: event?.item?.conversationExpiryTime
                            })
                            return
                        }
                        if (event.item?.result?.error) {
                            if (this.debug) {
                                console.debug(event.item.result.value, event.item.result.message)
                                console.debug(event.item.result.error)
                                console.debug(event.item.result.exception)
                            }
                            if (replySoFar[0]) {
                                message.text = replySoFar.join('')
                                resolve({
                                    message,
                                    conversationExpiryTime: event?.item?.conversationExpiryTime
                                })
                                return
                            }
                            reject(`${event.item.result.value}: ${event.item.result.message}`)
                            return
                        }
                        // The moderation filter triggered, so just return the text we have so far
                        if (stopTokenFound || event.item.messages[0].topicChangerText) {
                            // message.adaptiveCards[0].body[0].text = replySoFar
                            message.adaptiveCards = adaptiveCardsSoFar
                            message.text = replySoFar.join('')
                        }
                        resolve({
                            message,
                            conversationExpiryTime: event?.item?.conversationExpiryTime
                        })
                    }
                    default:
                }
            })
            ws.on('error', err => {
                reject(err)
            })
        })
        const userMessage = {
            id: randomUUID(),
            parentMessageId,
            role: 'User',
            message: prompt
        }
        const messageJson: string = JSON.stringify(obj)
        if (this.debug) {
            console.debug(messageJson)
            console.debug('\n\n\n\n')
        }
        try {
            ws.send(`${messageJson}`)
            const {
                message: reply,
                conversationExpiryTime
            } = await messagePromise
            const replyMessage = {
                id: randomUUID(),
                parentMessageId: userMessage.id,
                role: 'Bing',
                message: reply?.text,
                details: reply
            }
            if (!options.sydneyApologyIgnored || !apology) {
                this.storage.saveMessage(parentMessageId as string, conversationId, prompt, 'user', userMessage.id)
                this.storage.saveMessage(userMessage.id, conversationId, reply.text as string, 'user', userMessage.id)
            }
            return {
                parentId: parentMessageId,
                id: replyMessage.id,
                content: reply.text,
                raw: reply,
                source: 'sydney',
                success: true,
                type: 'llm'
            }
        } catch (err) {
            throw err
        }


    }

    async cleanupWebSocketConnection(ws: WebSocket) {
        // @ts-ignore
        clearInterval(ws.bingPingInterval)
        ws.close()
        ws.removeAllListeners()
    }

    async createNewConversation(): Promise<CreateBingConversationResponse> {
        const fetchOptions: RequestInit = {
            headers: {
                accept: 'application/json',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                'content-type': 'application/json',
                'sec-ch-ua': '"Microsoft Edge";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
                // 'sec-ch-ua-arch': '"x86"',
                // 'sec-ch-ua-bitness': '"64"',
                // 'sec-ch-ua-full-version': '"112.0.1722.7"',
                // 'sec-ch-ua-full-version-list': '"Chromium";v="112.0.5615.20", "Microsoft Edge";v="112.0.1722.7", "Not:A-Brand";v="99.0.0.0"',
                'sec-ch-ua-mobile': '?0',
                // 'sec-ch-ua-model': '',
                'sec-ch-ua-platform': '"macOS"',
                // 'sec-ch-ua-platform-version': '"15.0.0"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'x-ms-client-request-id': randomUUID(),
                'x-ms-useragent': 'azsdk-js-api-client-factory/1.0.0-beta.1 core-rest-pipeline/1.10.3 OS/macOS',
                // cookie: this.opts.cookies || `_U=${this.opts.userToken}`,
                Referer: 'https://edgeservices.bing.com/edgesvc/chat?udsframed=1&form=SHORUN&clientscopes=chat,noheader,channelstable,',
                'Referrer-Policy': 'origin-when-cross-origin',
                cookie: ""
            }
        }
        if (this.cookie) {
            // 疑似无需token了
            // @ts-ignore
            fetchOptions.headers['cookie'] = `_U=${this.cookie}`
        }
        fetchOptions.agent = this.agent
        let response = await fetch(`${this.host}/turing/conversation/create`, fetchOptions)
        let text = await response.text()
        let retry = 10
        while (retry >= 0 && response.status === 200 && !text) {
            await delay(400)
            response = await fetch(`${this.host}/turing/conversation/create`, fetchOptions)
            text = await response.text()
            retry--
        }
        if (response.status !== 200) {
            console.error('创建sydney对话失败: status code: ' + response.status + response.statusText)
            console.error('response body：' + text)
            throw new Error('创建sydney对话失败: status code: ' + response.status + response.statusText)
        }
        try {
            return JSON.parse(text) as CreateBingConversationResponse
        } catch (err) {
            console.error('创建sydney对话失败: status code: ' + response.status + response.statusText)
            console.error(text)
            throw new Error(text)
        }
    }

    async createWebSocketConnection(): Promise<WebSocket> {
        // let WebSocket = await getWebSocket()
        return new Promise((resolve, reject) => {
            let agent
            let sydneyHost: string = 'wss://sydney.bing.com'
            if (this.agent) {
                agent = this.agent
            }
            if (this.websocketUseReverseProxy) {
                sydneyHost = this.wsHost || this.host;
                if (!sydneyHost) {
                    throw new EliError('you must specify wsHost if websocketUseReverseProxy is set to true')
                }
                if (sydneyHost.startsWith("http")) {
                    sydneyHost = sydneyHost.replace('https://', 'wss://').replace('http://', 'ws://')
                }
            }
            console.log(`use sydney websocket host: ${sydneyHost}`)
            let ws: WebSocket = new Websocket(sydneyHost + '/sydney/ChatHub', undefined, {
                agent,
                origin: 'https://edgeservices.bing.com'
            })
            ws.on('error', (err: Error) => {
                console.error(err)
                reject(err)
            })

            ws.on('open', () => {
                if (this.debug) {
                    console.debug('performing handshake')
                }
                ws.send('{"protocol":"json","version":1}')
            })

            ws.on('close', () => {
                if (this.debug) {
                    console.debug('disconnected')
                }
            })

            ws.on('message', (data: RawData) => {
                const objects = data.toString().split('')
                const messages = objects.map((object) => {
                    try {
                        return JSON.parse(object)
                    } catch (error) {
                        return object
                    }
                }).filter(message => message)
                if (messages.length === 0) {
                    return
                }
                if (typeof messages[0] === 'object' && Object.keys(messages[0]).length === 0) {
                    if (this.debug) {
                        console.debug('handshake established')
                    }
                    // ping
                    // @ts-ignore
                    ws.bingPingInterval = setInterval(() => {
                        ws.send('{"type":6}')
                        // same message is sent back on/after 2nd time as a pong
                    }, 15 * 1000)
                    resolve(ws)
                    return
                }
                if (this.debug) {
                    console.debug(JSON.stringify(messages))
                    console.debug()
                }
            })
        })
    }
}

interface CreateBingConversationResponse {
    conversationId: string;
    clientId: string;
    conversationSignature: string;
    result: {
        value: string;
        message: string;
    }
}

/**
 * https://stackoverflow.com/a/58326357
 * @param {number} size
 */
const genRanHex = (size: number) => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')

interface SydneySendMessageOption extends SendMessageOption {
    generateContent?: boolean;
    messageType?: 'Chat' | 'SearchQuery';

    /**
     * these messages will be put on the top of the previous messages.
     */
    preMessages?: ChatMessage[];

    /**
     * web context content
     */
    context?: string;

    /**
     * if true, the apology response will not be stored as conversation
     */
    sydneyApologyIgnored?: boolean;

}

interface adaptiveCard {
    type: string;
    version: string;
    body: {
        type: string;
        text: string;
        wrap: boolean;
    }[]
}

interface suggestedResponse {
    text?: string;
    author?: string;
    createdAt?: string;
    timestamp?: string;
    messageId?: string;
    messageType?: string;
    offense?: string;
    feedback?: any;
    contentOrigin?: string;
    privacy?: any;
}


interface SydneyMessage extends suggestedResponse {
    adaptiveCards?: adaptiveCard[] | undefined;
    sourceAttributions?: any[] | undefined;
    suggestedResponses?: suggestedResponse[] | undefined;

    contentType?: string | undefined;

    imageTag?: string | undefined;
    spokenText?: string | undefined;

}

interface SydneyItem {
    messages: SydneyMessage[];
    firstNewMessageIndex: number;
    defaultChatName: string;
    conversationId: string;
    requestId: string;
    conversationExpiryTime: string;
    shouldInitiateConversation: boolean;
    telemetry: {
        metrics: any;
        startTime: string;
    };

    throttling: {
        maxNumUserMessageInConversation: number;
        numUserMessagesInConversation: number;
    };

    result: {
        value: string;
        message: string;
        serviceVersion: string;
    }
}

interface SydneyWsMessage {
    message: SydneyMessage;
    conversationExpiryTime?: string | undefined;
}