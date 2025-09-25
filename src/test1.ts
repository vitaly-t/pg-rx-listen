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

const obs1 = ls.listen('channel_1');

const obs2 = ls.listen('channel_2');

const sub1 = obs1.subscribe(msg => {
    console.log('ONE:', msg);
});

const sub2 = obs2.subscribe(msg => {
    console.log('TWO:', msg);
});

ls.onConnect.subscribe(async () => {
    console.log('Connected');
    await ls.notify(['channel_1'], 'hello-1');
});

// TODO: Because LISTEN queries aren't completed yet!
setTimeout(async () => {
    await ls.notify(['channel_1'], 'hello-2');
}, 100);
