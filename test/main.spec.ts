import {initDb} from './db';
import {PgListenConnection} from '../src';

const {pool} = initDb();

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
});
