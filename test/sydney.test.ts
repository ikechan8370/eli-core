import { expect } from 'chai';
import {KeyvFileMessageEngine} from "../src/models/messages";
import {SydneyLLMClient} from "../src/clients/sydney";
import {AIResponse, EliError} from "../src/models/core";

describe('sydney', () => {
    it('should return the correct result', (done) => {
        // Test your function here
        let client: SydneyLLMClient = new SydneyLLMClient({
            baseUrl: 'https://bing.roki.best',
            storage: new KeyvFileMessageEngine({
                filename: 'cache.json',
                namespace: 'sydney'
            }),
            websocketUseReverseProxy: true,
            wsBaseUrl: 'wss://bing.roki.best',
            debug: true,
            timeout: 24000,
            firstMessageTimeout: 24000
        })
        client.sendMessage("你好，请你给我画一幅画，关于墨西哥鳄梨酱的", {}).then((res: AIResponse) => {
            console.log(JSON.stringify(res))
            expect(res.content).to.be.a('string').and.not.null.and.not.undefined;
            done()
        }).catch((err: EliError) => {
            console.error(err)
            done(err)
        })
        // done();
    }).timeout(120000);
});
