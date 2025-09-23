# pg-rx-listen

RxJs solution for handling `LISTEN` / `NOTIFY`, using `Pool` instance from `node-postgres`.

## Protocol

* createListener({pool, defer, retryAll, retryInit, onConnect, onDisconnect, onEnd}) => IListener

IListener = {add, remove, notify, cancel, isLive, isConnected}

**TODO: NO, This needs to be changed, to make sense.**

I need something that at the end I can do `listen(channels: ...string[])` to create an observable, and that's it.

How about:

```ts
// manages just 1 connection, with many listeners on it;
class PgListenConnection {
    constructor(cfg: {pool, defer, retryAll, retryInit, onConnect, onDisconnect, onEnd}) {
    }

    listen(channels: ...string[]):Observable<IMessage>{

    }

    // Q: How do we notify?
    notify(channels:string[], payload?:string){
    }

    get isLive(){
   }

  get isConnected(){
  }

  cancel() {
     // stops listening + disconnects
  }
}
```

## Usage

```ts
import {listen} from 'pg-rx-listen';

const ls = listen({pool: myPool, channels: ['channel_1']});

await ls.add();
```
