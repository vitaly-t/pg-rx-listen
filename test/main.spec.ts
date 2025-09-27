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
    it.skip('can share live connection', (done) => {
        const ls = new PgListenConnection({pool});
        const onConnect = jest.fn();
        const onDisconnect = jest.fn();
        ls.onConnect.subscribe(onConnect);
        ls.onDisconnect.subscribe(onDisconnect);
        const sub1 = ls.listen(['channel_1']).subscribe();
        const sub2 = ls.listen(['channel_2']).subscribe();
        const sub3 = ls.listen(['channel_3']).subscribe();
        pause(100).then(() => {
            sub1.unsubscribe();
            sub2.unsubscribe();
            sub3.unsubscribe();
            expect(onConnect).toHaveBeenCalledTimes(1);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            done();
        });
    });
});
