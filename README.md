# pg-rx-listen

[RxJs] solution for handling `LISTEN` / `NOTIFY`, supporting any library that exposes [Pool] from [node-postgres].

**Main Features:**

* Automatically restores lost connections, with the help of [retry-async].
* Auto-connects on the first subscription and disconnects on the last one.

> **NOTE: This library, though fully functional, is in active development, so you may use it at your own risk.
> Contributors are very welcome! In the meantime, specifically for [pg-promise] you can use [pg-listener]**

## Installation

```
$ npm i pg-rx-listen
```

The library uses [pg] / [node-postgres] (>=v8.7.0) as a peer-dependency, which you need to include in your project,
either directly (if you are using [pg]) or indirectly (through any other library).

## Usage

* With [node-postgres] module:

```ts
import {PgListenConnection} from 'pg-rx-listen';
import {Pool} from 'pg';

const pool = new Pool(/* db connection details */);

const ls = new PgListenConnection({pool});

ls.listen(['channel_1', 'channel_2'])
    .subscribe(msg => {
        console.log(msg.payload);
    });
```

* With [pg-promise] module:

```ts
import {PgListenConnection} from 'pg-rx-listen';
import pgPromise from 'pg-promise';

const pgp = pgPromise(/* init options */);
const db = pgp(/* db connection details */);

const ls = new PgListenConnection({pool: db.$pool as any});

ls.listen(['channel_1', 'channel_2'])
    .subscribe(msg => {
        console.log(msg.payload);
    });
```

And so on, you can use it with any other library that exposes [Pool] instance.

[node-postgres]:https://github.com/brianc/node-postgres

[pg]:https://github.com/brianc/node-postgres

[Pool]:https://node-postgres.com/apis/pool

[pg-promise]:https://github.com/vitaly-t/pg-promise

[RxJs]:https://github.com/ReactiveX/rxjs

[retry-async]:https://github.com/vitaly-t/retry-async

[pg-listener]:https://github.com/vitaly-t/pg-listener
