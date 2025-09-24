import {Observable, Subject, defer} from 'rxjs';
import {IListenMessage, IPgListenConfig} from './types';
import {retryAsync, RetryOptions} from './retry-async';
import {PoolClient} from 'pg';

/**
 * Default retry options, to be used when `retryAll` and `retryInitial` are not specified.
 */
const retryDefault: RetryOptions = {
    retry: 5, // up to 5 retries
    delay: s => 5 ** (s.index + 1) // Exponential delays: 5, 25, 125, 625, 3125 ms
};

export class PgListenConnection {
    constructor(private cfg: IPgListenConfig) {
    }

    private client: PoolClient | undefined;
    private live = true;
    private connecting = false;

    /**
     * Channel-to-ref count map, so we only disconnect when all refs are at zero.
     * @private
     */
    private refs: { [channel: string]: number } = {};

    listen(...channels: string[]): Observable<IListenMessage> {
        // starts listening, if it is not already listening (unless deferred),
        // and subscribes to those channels;
        const s = new Subject<IListenMessage>();
        const {defer: d} = this.cfg;

        const {pool, retryInit, retryAll} = this.cfg;

        const onError = (err: any) => {
            this.cfg.onDisconnect?.(err, this.client);
            this.client = undefined;
        };

        const onNotify = (msg: any) => {
            s.next(msg);
        };

        const setup = (client: PoolClient) => {
            this.connecting = false;
            this.client = client;
            pool.on('error', onError);
            client.on('notification', onNotify);
        };

        const connect = async (): Promise<void> => {
            this.connecting = true;
            await retryAsync(pool.connect.bind(pool), retryAll || retryDefault)
                .then(setup)
                .catch(err => {
                    this.connecting = false;
                    this.live = false;
                    this.cfg.onEnd?.(err);
                });
        };
        this.connecting = true;
        retryAsync(pool.connect.bind(pool), retryInit || retryAll || retryDefault)
            .then(setup)
            .catch(err => {
                this.connecting = false;
                this.live = false;
                s.error(err);
                this.cfg.onEnd?.(err);
            });

        const start = () => {
            return s.pipe();
        };

        let deferredObs: Observable<IListenMessage> | undefined;
        return d ? defer(() => deferredObs ??= start()) : start();
    }

    async notify(channels: string[], payload?: string) {
        // send notification to the channels
    }

    get isLive() {
        return this.live;
    }

    get isConnected() {
        return !!this.client;
    }

    async end() {
        // stops listening + disconnect
    }

    get channels(): string[] {
        // gets a list of channels we are currently listen to,
        // across all observables.
        return [];
    }

    /**
     * We need this, because multiple calls can be made for `listen` at once,
     * and all those callers need to get the notification when we are connected.
     *
     * For that, they need to subscribe to the returned observable.
     *
     * Maybe NOT? :)))
     *
     * @private
     */

    /*
    private connect(): Observable<PoolClient> {
        const s = new Subject<PoolClient>();
    }*/
}
