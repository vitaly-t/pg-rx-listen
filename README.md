# pg-rx-listen

RxJs solution for handling `LISTEN` / `NOTIFY`, using `Pool` instance from `node-postgres`.

## Protocol

**TODO: NO, This needs to be changed, to make sense.**

* createListener({pool, defer, retryAll, retryInit, onConnect, onDisconnect, onEnd}) => IListener

IListener = {add, remove, notify, cancel, isLive, isConnected}

## Usage

```ts
import {listen} from 'pg-rx-listen';

const ls = listen({pool: myPool, channels: ['channel_1']});

await ls.add();
```
