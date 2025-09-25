import {Pool} from 'pg';
import {PgListenConnection} from './main';

const pool = new Pool({
    user: 'postgres',
    password: 'Harmony1',
    database: 'postgres',
    port: 5436,
    keepAlive: true,
    allowExitOnIdle: true
});

const ls = new PgListenConnection({pool});

const obs1 = ls.listen(['channel_1', 'channel_2'], async () => {
    await ls.notify(['channel_1', 'channel_2'], 'hello-123');
});

/*
const obs2 = ls.listen(['channel_1'], async () => {
    await ls.notify(['channel_1'], 'hello-2');
});
*/
const sub1 = obs1.subscribe(msg => {
    console.log('ONE:', msg);
});
/*
const sub2 = obs2.subscribe(msg => {
    console.log('TWO:', msg);
});*/

ls.onConnect.subscribe(async () => {
    console.log('Connected');
});

setTimeout(() => {
    sub1.unsubscribe();
    setTimeout(() => {
        const obs2 = ls.listen(['channel_2'], async () => {
            await ls.notify(['channel_2'], 'hello-2');
        });
        const sub2 = obs2.subscribe(msg => {
            console.log('TWO:', msg);
            sub2.unsubscribe();
        });
    }, 100);
}, 100);
