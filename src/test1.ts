import {Pool} from 'pg';
import {PgListenConnection} from './main';
import {setInterval} from 'node:timers';

const pool = new Pool({
    user: 'postgres',
    password: 'Harmony1',
    database: 'postgres',
    port: 5436,
    keepAlive: true,
    allowExitOnIdle: true
});

const ls = new PgListenConnection({pool});

ls.onQuery.subscribe(sql => {
    console.log('QUERY:', sql);
});

ls.onConnect.subscribe(async ({count}) => {
    console.log('Connected:', count);
});

ls.onDisconnect.subscribe(({auto}) => {
    console.log('Disconnected:', auto);
})

ls.onEnd.subscribe(async err => {
    console.log('Ended:', err);
});

const obs1 = ls.listen(['channel_1'], async () => {
    await ls.notify(['channel_1'], 'hello-1');
});

const obs2 = ls.listen(['channel_2'], async () => {
    await ls.notify(['channel_2'], 'hello-2');
});

const sub1 = obs1.subscribe(msg => console.log('msg1:', msg));
const sub2 = obs2.subscribe(msg => console.log('msg2:', msg));

setInterval(async () => {
    const res = await ls.notify(['channel_1', 'channel_2'], Date.now().toString());
    console.log('notify:', res);
}, 1000);
