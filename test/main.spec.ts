import {initDb} from './db';
import {PgListenConnection} from '../src';

const {pool} = initDb();

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('constructor', () => {
    it('must initialize correctly', async () => {
        const ls = new PgListenConnection({pool});
        expect(ls.isLive).toBe(true);
        expect(ls.isConnected).toBeFalsy();
        expect(ls.liveChannels).toEqual([]);
    });
});

describe('listen', () => {
    it('must loop events and data correctly', (done) => {
        const ls = new PgListenConnection({pool});
        const onReady = jest.fn(async () => {
            await ls.notify(['channel_1'], 'hello');
        });
        const obs = ls.listen(['channel_1'], onReady);
        const sub = obs.subscribe(msg => {
            expect(msg.payload).toEqual('hello');
            expect(onReady).toHaveBeenCalledTimes(1);
            expect(ls.liveChannels).toEqual(['channel_1']);
            expect(ls.isConnected).toBeTruthy();
            sub.unsubscribe();
            done();
        });
    });
    it('can handle instant disconnection', (done) => {
        const ls = new PgListenConnection({pool});
        const onConnect = jest.fn();
        const onDisconnect = jest.fn();
        ls.onConnect.subscribe(onConnect);
        ls.onDisconnect.subscribe(onDisconnect);
        const sub1 = ls.listen(['channel_1']).subscribe();
        const sub2 = ls.listen(['channel_2']).subscribe();
        const sub3 = ls.listen(['channel_3']).subscribe();
        sub1.unsubscribe();
        sub2.unsubscribe();
        sub3.unsubscribe();
        pause(100).then(() => {
            expect(onConnect).toHaveBeenCalledTimes(1);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            expect(onConnect).toHaveBeenCalledWith({client: expect.any(Object), count: 1})
            expect(onDisconnect).toHaveBeenCalledWith({client: expect.any(Object), auto: true, error: undefined});
            done();
        });
    });
    it('can handle zero channels', (done) => {
        const ls = new PgListenConnection({pool});
        const sub1 = ls.listen([]).subscribe();
        pause(100).then(() => {
            expect(ls.liveChannels).toEqual([]);
            sub1.unsubscribe();
            done();
        });
    });
    it.skip('correctly share a listening observable', (done) => {
        const ls = new PgListenConnection({pool});
        const onConnect = jest.fn();
        const onDisconnect = jest.fn();
        const onQuery = jest.fn();
        ls.onConnect.subscribe(onConnect);
        ls.onDisconnect.subscribe(onDisconnect);
        ls.onQuery.subscribe(onQuery);
        const onMessage1 = jest.fn();
        const onMessage2 = jest.fn();
        const onMessage3 = jest.fn();
        const obs = ls.listen(['channel_1'], async () => {
            await ls.notify(['channel_1'], 'hello');
        });
        const sub1 = obs.subscribe(onMessage1);
        const sub2 = obs.subscribe(onMessage2);
        const sub3 = obs.subscribe(onMessage3);
        pause(100).then(() => {
            sub1.unsubscribe();
            sub2.unsubscribe();
            sub3.unsubscribe();
        });
        pause(200).then(() => {
            expect(onConnect).toHaveBeenCalledTimes(1);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            expect(onQuery).toHaveBeenCalledTimes(3); // LISTEN + NOTIFY + UNLISTEN
            expect(onMessage1).toHaveBeenCalledTimes(1);
            expect(onMessage2).toHaveBeenCalledTimes(1);
            expect(onMessage3).toHaveBeenCalledTimes(1);
            done();
        });
    });
});
