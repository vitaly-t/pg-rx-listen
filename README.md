# pg-rx-listen

RxJs solution for handling `LISTEN` / `NOTIFY`, using `Pool` from `node-postgres`.

## Protocol

* listen({pool, defer, retryAll, retryInit, onConnect, onDisconnect, onEnd}) => IListener

IListener = {add, remove, notify, cancel, isLive, isConnected}

## Usage

```ts
import {listen} from 'pg-rx-listen';

const ls = listen();
```
