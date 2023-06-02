import { expect } from 'chai';
import {OpenAIClient} from "../src/clients/openai";
import {KeyvFileMessageEngine} from "../src/models/messages";

describe('openai', () => {
    it('should return the correct result', (done) => {
        // Test your function here
        let client = new OpenAIClient({
            apiBaseUrl: "https://c.d201.cn/v1",
            apiKey: "123",
            storage: new KeyvFileMessageEngine({
                filename: 'cache.json',
                namespace: 'openai'
            })
        })
        client.sendMessage("你好", {
            debug: true,
            model: "gpt-3.5-turbo",
            temperature: 2
        }).then(res => {
            console.log(JSON.stringify(res.content))
            expect(res.content).to.be.a('string').and.not.null.and.not.undefined;
            done()
        }).catch(err => {
            console.error(err)
            done(err)
        })
        // done();
    }).timeout(120000);


});
