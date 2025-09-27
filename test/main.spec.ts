import {initDb} from './db';
import {PgListenConnection} from '../src';

const {pool} = initDb();

describe('listen', () => {
    it('must work', async () => {
        const ls = new PgListenConnection({pool});
        expect(ls.isLive).toBe(true);
    });
});
