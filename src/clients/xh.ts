import fetch from 'node-fetch'
import { createParser } from 'eventsource-parser'
import {AIClient, AIResponse, ChatMessage, EliError, Role, SendMessageOption} from "../models/core";
import {IncomingMessage} from "http";
const https = require('https')

const referer = atob('aHR0cHM6Ly94aW5naHVvLnhmeXVuLmNuL2NoYXQ/aWQ9')
const origin = atob('aHR0cHM6Ly94aW5naHVvLnhmeXVuLmNu')
const createChatUrl = atob('aHR0cHM6Ly94aW5naHVvLnhmeXVuLmNuL2lmbHlncHQvdS9jaGF0LWxpc3QvdjEvY3JlYXRlLWNoYXQtbGlzdA==')
const chatUrl = atob('aHR0cHM6Ly94aW5naHVvLnhmeXVuLmNuL2lmbHlncHQtY2hhdC91L2NoYXRfbWVzc2FnZS9jaGF0')
const FormData = require('form-data')


export interface XingHuoClientOption {
    ssoSessionId: string;
    debug: string;
}

export interface XingHuoSendMessageOption extends SendMessageOption {

}

export class XinghuoClient implements AIClient{
    private readonly ssoSessionId: string;
    private readonly headers: Record<string, string>;
    private option: XingHuoClientOption;
    constructor (opts: XingHuoClientOption) {
        this.option = opts
        this.ssoSessionId = opts.ssoSessionId
        this.headers = {
            Referer: referer,
            Cookie: 'ssoSessionId=' + this.ssoSessionId + ';',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/113.0.5672.69 Mobile/15E148 Safari/604.1',
            Origin: origin
        }
    }

    async sendMessage (prompt: string, options: XingHuoSendMessageOption, role: Role = 'user'): Promise<AIResponse> {
        let chatId = options.conversationId
        if (!chatId) {
            chatId = (await this.createChatList()).chatListId
        }
        let _this = this;
        let requestP: Promise<{error?: string, response: string}> = new Promise((resolve, reject) => {
            let formData = new FormData()
            formData.setBoundary('----WebKitFormBoundarycATE2QFHDn9ffeWF')
            formData.append('clientType', '2')
            formData.append('chatId', chatId)
            formData.append('text', prompt)
            let randomNumber = Math.floor(Math.random() * 1000)
            let fd = '439' + randomNumber.toString().padStart(3, '0')
            formData.append('fd', fd)
            this.headers.Referer = referer + chatId
            let option = {
                method: 'POST',
                headers: Object.assign(this.headers, {
                    Accept: 'text/event-stream',
                    'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundarycATE2QFHDn9ffeWF'
                }),
                // body: formData,
                referrer: this.headers.Referer
            }
            let statusCode: number
            const req = https.request(chatUrl, option, (res: IncomingMessage) => {
                statusCode = res.statusCode as number;
                if (statusCode !== 200) {
                    console.error('星火statusCode：' + statusCode)
                }
                let response = ''
                function onMessage (data: string) {
                    // console.log(data)
                    if (data === '<end>') {
                        return resolve({
                            response
                        })
                    }
                    try {
                        if (data) {
                            response += atob(data.trim())
                            if (_this.option.debug) {
                                console.log(response)
                            }
                        }
                    } catch (err) {
                        console.warn('fetchSSE onMessage unexpected error', err)
                        reject(err)
                    }
                }

                const parser = createParser((event) => {
                    if (event.type === 'event') {
                        onMessage(event.data)
                    }
                })
                const errBody: Buffer[] = []
                res.on('data', (chunk) => {
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
                    // logger.info({ resString })
                    reject(resString)
                })
            })
            formData.pipe(req)
            req.on('error', (err: Error) => {
                console.error(err)
                reject(err)
            })
            req.on('timeout', () => {
                req.destroy()
                reject(new Error('Request time out'))
            })
            // req.write(formData.stringify())
            req.end()
        })
        const { response } = await requestP
        // logger.info(response)
        // let responseText = atob(response)
        return {
            raw: response,
            source: 'xh',
            success: true,
            type: 'llm',
            content: response
        }
    }

    async createChatList () {
        let createChatListRes = await fetch(createChatUrl, {
            method: 'POST',
            headers: Object.assign(this.headers, {
                'Content-Type': 'application/json'
            }),
            body: '{}'
        })
        if (createChatListRes.status !== 200) {
            let errorRes = await createChatListRes.text()
            let errorText = '星火对话创建失败：' + errorRes
            console.error(errorText)
            throw new EliError(errorText)
        }
        let createChatListResJson: CreateChatListResp = (await createChatListRes.json()) as CreateChatListResp
        if (createChatListResJson.data?.id) {
            console.log('星火对话创建成功：' + createChatListResJson.data.id)
        } else {
            console.error('星火对话创建成功: ' + JSON.stringify(createChatListResJson))
            throw new Error('星火对话创建成功:'  + JSON.stringify(createChatListResJson))
        }
        return {
            chatListId: createChatListResJson.data?.id,
            title: createChatListResJson.data?.title
        }
    }

    destroyConversation(conversationId: string): Promise<void> {
        throw new EliError('not implemented yet')
    }

    getHistory(conversationId: string): Promise<ChatMessage[]> {
        throw new EliError('not implemented yet')
    }
}

interface CreateChatListResp {
    data?: {
        id: string;
        title: string;
    }
}

function atob (s: string) {
    return Buffer.from(s, 'base64').toString()
}
