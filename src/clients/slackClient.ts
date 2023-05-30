import {AIClient, AIResponse, ChatMessage, EliError, Role, SendMessageOption} from "../models/core";
import {StringIndexed} from "@slack/bolt/dist/types/helpers";
import {limitString} from "../utils/tools";
import {
    ChatPostMessageResponse,
    ConversationsListResponse,
    ConversationsRepliesResponse
} from "@slack/web-api/dist/response";
import delay from "delay";
// import {App} from '@slack/bolt'
const {App} = require('@slack/bolt')
const HttpsProxyAgent = require('https-proxy-agent')
import * as _ from "lodash"
// import _ from 'lodash'
export interface SlackClaudeOption {
    signingSecret: string;
    botUserToken: string;
    userToken: string;
    proxy?: string;
    debug?: boolean;
    specifiedChannel: string;
    createChannel: boolean;
    claudeUserId: string;
}

export interface SlackClaudeSendMessageOption extends SendMessageOption {
    times?: number;
}
export class SlackClaudeClient implements AIClient {
    private agent: any;
    private app: typeof App;
    private option: SlackClaudeOption;
    constructor (props: SlackClaudeOption) {
        if (props.signingSecret && props.botUserToken && props.userToken) {
            let option = {
                signingSecret: props.signingSecret,
                token: props.botUserToken,
                // socketMode: true,
                appToken: props.userToken,
                // port: 45912
                logLevel: 'info'
            }
            if (props.proxy) {
                this.agent = HttpsProxyAgent(props.proxy)
            }
            if (props.debug) {
                option.logLevel = 'debug'
            }
            this.app = new App(option)
            this.option = props;
        } else {
            throw new EliError('未配置Slack信息')
        }
    }

    async sendMessage (prompt: string, options: SlackClaudeSendMessageOption, role: Role = 'user'): Promise<AIResponse> {
        if (options.times && options.times > 10) {
            throw new EliError('Claude doesn\'t responde')
        }
        if (prompt.length > 3990) {
            console.warn('消息长度大于slack限制，长度剪切至3990')
            prompt = limitString(prompt, 3990, false)
        }
        let channel
        if (!this.option.createChannel) {
            channel = { id: this.option.specifiedChannel }
        } else {
            let channels: ConversationsListResponse = await this.app.client.conversations.list({
                token: this.option.userToken,
                types: 'public_channel,private_channel'
            })
            channel = channels.channels?.filter(c => c.name === this.option.specifiedChannel)
            if (!channel || channel.length === 0) {
                let createChannelResponse = await this.app.client.conversations.create({
                    token: this.option.userToken,
                    name: this.option.specifiedChannel,
                    is_private: true
                })
                channel = createChannelResponse.channel
                await this.app.client.conversations.invite({
                    token: this.option.userToken,
                    channel: channel.id,
                    users: this.option.claudeUserId
                })
                await delay(1000)
            } else {
                channel = channel[0]
            }
        }
        let conversationId = options.conversationId;
        if (!conversationId) {
            let sendResponse: ChatPostMessageResponse = await this.app.client.chat.postMessage({
                as_user: true,
                text: `<@${this.option.claudeUserId}> ${prompt}`,
                token: this.option.userToken,
                channel: channel.id
            })
            let ts = sendResponse.ts
            let response = '_Typing…_'
            let tryTimes = 0
            // 发完先等3喵
            await delay(3000)
            while (response.trim().endsWith('_Typing…_')) {
                let replies: ConversationsRepliesResponse = await this.app.client.conversations.replies({
                    token: this.option.userToken,
                    channel: channel.id,
                    limit: 1000,
                    ts
                })
                if (replies?.messages?.length && replies?.messages?.length > 0) {
                    let formalMessages = replies.messages
                        .filter(m => m.metadata?.event_type !== 'claude_moderation')
                        .filter(m => !m?.text?.startsWith('_'))
                    if (!formalMessages[formalMessages.length - 1].bot_profile) {
                        // 问题的下一句不是bot回复的，这属于意料之外的问题，可能是多人同时问问题导致 再问一次吧
                        let newOption = _.cloneDeep(options);
                        newOption.times = options.times ? options.times + 1 : 1;
                        return await this.sendMessage(prompt, newOption)
                    }
                    let reply = formalMessages[formalMessages.length - 1]
                    if (reply?.text && !reply.text.startsWith(`<@${this.option.claudeUserId}>`)) {
                        response = reply.text
                        if (this.option.debug) {
                            let text = response.replace('_Typing…_', '')
                            if (text) {
                                console.debug(response.replace('_Typing…_', ''))
                            }
                        }
                    }
                }
                await delay(2000)
                tryTimes++
                if (tryTimes > 3 && response === '_Typing…_') {
                    // 过了6秒还没任何回复，就重新发一下试试
                    console.warn('claude没有响应，重试中')
                    let newOption = _.cloneDeep(options);
                    newOption.times = options.times ? options.times + 1 : 1;
                    return await this.sendMessage(prompt, newOption)
                }
            }
            return {
                raw: response,
                source: 'slack-claude',
                success: true,
                type: 'llm',
                content: response
            }
        } else {
            let postResponse = await this.app.client.chat.postMessage({
                as_user: true,
                text: `<@${this.option.claudeUserId}> ${prompt}`,
                token: this.option.userToken,
                channel: channel.id,
                thread_ts: conversationId
            })
            let postTs = postResponse.ts
            let response = '_Typing…_'
            let tryTimes = 0
            // 发完先等3喵
            await delay(3000)
            while (response.trim().endsWith('_Typing…_')) {
                let replies: ConversationsRepliesResponse = await this.app.client.conversations.replies({
                    token: this.option.userToken,
                    channel: channel.id,
                    limit: 1000,
                    ts: conversationId,
                    oldest: postTs
                })

                if (replies.messages && replies.messages.length > 0) {
                    let formalMessages = replies.messages
                        .filter(m => m.metadata?.event_type !== 'claude_moderation')
                        .filter(m => !m?.text?.startsWith('_'))
                    if (!formalMessages[formalMessages.length - 1].bot_profile) {
                        // 问题的下一句不是bot回复的，这属于意料之外的问题，可能是多人同时问问题导致 再问一次吧
                        let newOption = _.cloneDeep(options);
                        newOption.times = options.times ? options.times + 1 : 1;
                        return await this.sendMessage(prompt, newOption)
                    }
                    let reply = formalMessages[formalMessages.length - 1]
                    if (reply.text && !reply.text.startsWith(`<@${this.option.claudeUserId}>`)) {
                        response = reply.text
                        if (this.option.debug) {
                            let text = response.replace('_Typing…_', '')
                            if (text) {
                                console.log(response.replace('_Typing…_', ''))
                            }
                        }
                    }
                }
                await delay(2000)
                tryTimes++
                if (tryTimes > 3 && response === '_Typing…_') {
                    // 过了6秒还没任何回复，就重新发一下试试
                    console.warn('claude没有响应，重试中')
                    let newOption = _.cloneDeep(options);
                    newOption.times = options.times ? options.times + 1 : 1;
                    return await this.sendMessage(prompt, newOption)
                }
            }
            return {
                raw: response,
                source: 'slack-claude',
                success: true,
                type: 'llm',
                content: response
            }
        }
    }

    destroyConversation(conversationId: string): Promise<void> {
        throw new EliError('not implemented yet')
    }

    getHistory(conversationId: string): Promise<ChatMessage[]> {
        throw new EliError('not implemented yet')
    }
}