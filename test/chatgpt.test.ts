import { expect } from 'chai';
import {ChatGPTClient} from "../src/clients/chatgpt";
import {AIResponse} from "../src/models/core";

describe('chatgpt', () => {
    it('should return the correct result', () => {
        // Test your function here
        let client = new ChatGPTClient({
            accessToken: "",
            apiReverseUrl: "https://chatgpt.ikechan8370.com/backend-api/conversation"
        })
        return client.sendMessage("你好", {
            model: 'text-davinci-002-render-sha',
            action: 'next',
            debug: true
        }).then((res: AIResponse) => {
            console.log(JSON.stringify(res.content))
            expect(res.content).to.be.a('string').and.not.null.and.not.undefined;
        })
        // done();
    }).timeout(20000);
});
