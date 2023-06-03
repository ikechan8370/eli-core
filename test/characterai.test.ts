import { expect } from 'chai';
import {AIResponse} from "../src/models/core";
import {CharacterAIClient} from "../src/clients/charaterai";
describe('character.ai', () => {
    it('should return the correct result', () => {
        let client = new CharacterAIClient()
        return client.sendMessage("你好，你是谁？", {
           characterId: 'YntB_ZeqRq2l_aVf2gWDCZl4oBttQzDvhj9cXafWcF8'
        }).then((res: AIResponse) => {
            console.log(JSON.stringify(res.content))
            expect(res.content).to.be.a('string').and.not.null.and.not.undefined;
        })
    }).timeout(20000);
})
