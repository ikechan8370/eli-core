import { expect } from 'chai';
import {ChatGPTClient} from "../src/clients/chatgpt";
import {AIResponse} from "../src/models/core";

describe('chatgpt', () => {
    it('should return the correct result', () => {
        // Test your function here
        let client = new ChatGPTClient({
            accessToken: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1UaEVOVUpHTkVNMVFURTRNMEZCTWpkQ05UZzVNRFUxUlRVd1FVSkRNRU13UmtGRVFrRXpSZyJ9.eyJodHRwczovL2FwaS5vcGVuYWkuY29tL3Byb2ZpbGUiOnsiZW1haWwiOiJnZXlpbmNoaUBmb3htYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7InVzZXJfaWQiOiJ1c2VyLTRTNVE4RHVNa2lwUXI5S0dUSHVHQWtqNCJ9LCJpc3MiOiJodHRwczovL2F1dGgwLm9wZW5haS5jb20vIiwic3ViIjoiYXV0aDB8NjM4ZTlmZWMxMmFlZGEzMmM0MTJiNzRmIiwiYXVkIjpbImh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEiLCJodHRwczovL29wZW5haS5vcGVuYWkuYXV0aDBhcHAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTY4NDc1ODE4MiwiZXhwIjoxNjg1OTY3NzgyLCJhenAiOiJUZEpJY2JlMTZXb1RIdE45NW55eXdoNUU0eU9vNkl0RyIsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgbW9kZWwucmVhZCBtb2RlbC5yZXF1ZXN0IG9yZ2FuaXphdGlvbi5yZWFkIG9yZ2FuaXphdGlvbi53cml0ZSJ9.iC_JZlA3y3lZl_L4BaXP8rYsz16Wv1QkbTWRiZxTv5ert4WJRemEcS_Tq69JGUi8XF_2IpzT8fwRcvaJn8xh_whGlZQ8f5Byi2cjxZGAQWGthJQuM2frfzr0geyh7g6uyZWU8Lzqiw-TIbNToaQw5BZBY1aLFGi3faGnJnxsefgW9Bmjh6teX1c5R5GZ4ukbQtxQLkaOSFlD6W-kWARd4CNypFg5FoQFO_ekHTgk6EpD4iRU7WSycl1tJP5mk4jECHs5EbyH_rFStSB6ltzrnwKbWA9ocU9gwWlPhZIUi3HF-9cUC2eYSEn3adW30LzKW1iLqhSkwquwJHK03lAV8A",
            apiReverseUrl: "https://pimon.d201.cn/backend-api/conversation"
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
    });


});
