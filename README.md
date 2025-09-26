# pg-rx-listen

[RxJs] solution for handling `LISTEN` / `NOTIFY`, supporting any library that exposes a [Pool] instance
from [node-postgres].

It implements automatic re-connections, with the help of [retry-async].

## Installation

```
$ npm i pg-rx-listen
```

When using from TypeScript, you will also need to install [pg] type definitions:

```
$ npm i --save-dev @types/pg
```

The libary uses [pg] / [node-postgres] as a peer-dependency, which you need to include in your project,
either directly (if you are using [pg]) or indirectly (for any other library).

## Usage

* With [node-postgres] module:

```ts
import {PgListenConnection} from 'pg-rx-listen';
import {Pool} from 'pg';

const pool = new Pool({/* db connection details */});

const ls = new PgListenConnection({pool});

ls.listen(['channel1', 'channel2'])
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

ls.listen(['channel1', 'channel2'])
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
