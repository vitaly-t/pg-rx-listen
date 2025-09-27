const {Pool} = require('pg');
import {PgListenConnection} from '../src';

const pool = new Pool({
    user: 'postgres',
    password: 'Harmony1',
    database: 'postgres',
    port: 5436,
    keepAlive: true,
    allowExitOnIdle: true
});

const ls = new PgListenConnection({pool});

ls.onDisconnect.subscribe(a => {
    console.log(`Disconnected`);
});

ls.onConnect.subscribe(a => {
    console.log(`Connected`);
});

ls.onQuery.subscribe((a) => {
    console.log(`Query: ${a}`);
});

const sub1 = ls.listen(['channel_1'], async () => {
    console.log('First Ready');
})
    .subscribe(async msg => {
        console.log(msg);
        await ls.notify(['channel_2'], 'First Msg');
        sub1.unsubscribe();
    });

setTimeout(() => {
    const sub2 = ls.listen(['channel_2'], async () => {
        console.log('Second Ready');
        await ls.notify(['channel_1'], 'Second Msg');
    })
        .subscribe(msg => {
            console.log(msg);
            sub2.unsubscribe();
        });
}, 1000);
