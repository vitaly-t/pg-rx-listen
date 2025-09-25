import {Observable, Subject, defer, switchMap, filter, from, finalize} from 'rxjs';
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

    private client: PoolClient | undefined;
    private live = true;
    private connecting = false;

    private connection: Observable<PoolClient>;
    private onNotify = new Subject<IListenMessage>;

    readonly onConnect: Observable<{ client: PoolClient, count: number }>;
    readonly onDisconnect: Observable<{ err: any, client: PoolClient }>;
    readonly onEnd: Observable<any>;

    constructor(private cfg: IPgListenConfig) {
        this.onConnect = new Subject();
        this.onDisconnect = new Subject();
        this.onEnd = new Subject();

        this.connection = this.createConnection();
    }

    /**
     * Channel-to-ref count map, so we only disconnect when all refs are at zero.
     * @private
     */
    private refs: { [channel: string]: number } = {};

    listen(...channels: string[]): Observable<IListenMessage> {

        const uniqueChannels = channels.filter((x, i, a) => a.indexOf(x) === i);
        const messageInChannels = (msg: IListenMessage) => uniqueChannels.indexOf(msg.channel) >= 0;

        const createQueries = async (client: PoolClient) => {
            const sql = uniqueChannels.map(c => `LISTEN ${c}`).join(';');
            await client.query(sql);
            // Plus, add here the reference control
        }

        return this.connection.pipe(
            switchMap(client => from(createQueries(client))),
            switchMap(() => this.onNotify.pipe(
                filter(messageInChannels),
                finalize(() => {
                    if (!this.onNotify.observed) {
                        // TODO: release the client
                    }
                })
            ))
        );
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
     * We need this because multiple calls can be made for `listen` at once,
     * and all those callers need to get the notification when we are connected.
     *
     * @private
     */
    private createConnection(): Observable<PoolClient> {

        const s = new Subject<PoolClient>();
        let count = 0;

        const {pool, retryInit, retryAll} = this.cfg;

        const connect = (retry: RetryOptions): void => {
            this.connecting = true;
            retryAsync(pool.connect.bind(pool), retry).then(setup).catch(stop);
        };

        const onNotify = (msg: IListenMessage) => {
            this.onNotify.next(msg);
        };

        const onPoolError = (err: any, client: PoolClient) => {
            this.client = undefined;
            client.removeListener('notification', onNotify);
            const onDisconnect = this.onDisconnect as Subject<{ err: any, client: PoolClient }>;
            onDisconnect.next({err, client});
            connect(retryAll || retryDefault);
        };

        const setup = (client: PoolClient) => {
            this.client = client;
            this.connecting = false;
            client.on('notification', onNotify);
            count++;
            const onConnect = this.onConnect as Subject<{ client: PoolClient, count: number }>;
            onConnect.next({client, count});
            s.next(client);
        };

        const stop = (err: any) => {
            this.connecting = false;
            this.live = false;
            pool.removeListener('error', onPoolError);
            const onEnd = this.onEnd as Subject<any>;
            onEnd.next(err);
            s.error(err);
        };

        const start = () => {
            connect(retryInit || retryAll || retryDefault);
            return s;
        };

        pool.on('error', onPoolError);
        const {defer: d} = this.cfg;

        let deferredObs: Subject<PoolClient> | undefined;
        return d ? defer(() => deferredObs ??= start()) : start();
    }
}
