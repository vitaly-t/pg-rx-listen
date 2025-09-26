import {Pool} from 'pg';
import {PgListenConnection} from './main';
import {clearInterval, setInterval} from 'node:timers';

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
    console.log('CONNECTED:', count);
});

ls.onDisconnect.subscribe(({auto}) => {
    console.log('DISCONNECTED:', auto);
})

ls.onEnd.subscribe(async err => {
    console.log('ENDED:', err);
});

const obs1 = ls.listen(['channel_1'], async () => {
    await ls.notify(['channel_1'], 'hello-1');
});

const obs2 = ls.listen(['channel_2'], async () => {
    await ls.notify(['channel_2'], 'hello-2');
});

const sub1 = obs1.subscribe({
    next: msg => console.log('msg1:', msg),
    error: err => console.log('err1:', err),
    complete: () => console.log('complete1')
});

// sub1.unsubscribe();

const sub2 = obs2.subscribe({
    next: msg => console.log('msg2:', msg),
    error: err => console.log('err2:', err),
    complete: () => console.log('complete2')
});

let count = 0;
const int = setInterval(async () => {
    const res = await ls.notify(['channel_1', 'channel_2'], count.toString());
    console.log('notify:', count, res,);
    if (res && count++ > 5) {
        sub1.unsubscribe();
        sub2.unsubscribe();
        clearInterval(int);
    }
}, 1000);
