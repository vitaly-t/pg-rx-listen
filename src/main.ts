import {Observable, Subject, defer, switchAll, switchMap, filter} from 'rxjs';
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

    private onNotify = new Observable<IListenMessage>;

    /**
     * Channel-to-ref count map, so we only disconnect when all refs are at zero.
     * @private
     */
    private refs: { [channel: string]: number } = {};

    listen(...channels: string[]): Observable<IListenMessage> {
        const listen = (client: PoolClient) => new Observable<void>(obs => {
            // establish listening here and then emit, if successful, else error;
            const list = channels.map(c => {
                // or filter first?
                return this.refs[c] = (this.refs[c] || 0) + 1;
                // map into:
                // client.query(`LISTEN ${channels.join(', ')}`);
            });
            obs.next();
        });
        const notify = () => this.onNotify.pipe(filter(a => channels.indexOf(a.channel) >= 0));
        return this.connect().pipe(switchMap(listen), switchMap(notify));
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
    private connect(): Observable<PoolClient> {
        const s = new Subject<PoolClient>();
        // connect here and pump the client once connected
        return s;

        /*
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
                return d ? defer(() => deferredObs ??= start()) : start();*/
    }
}
