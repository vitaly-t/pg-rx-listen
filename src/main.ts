import {Observable, Subject, defer, switchMap, filter, from, finalize, tap} from 'rxjs';
import {IPgListenConfig} from './types';
import {retryAsync, RetryOptions} from './retry-async';
import {Notification, PoolClient} from 'pg';

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

    private connection: Observable<PoolClient>; // internal connection
    private onNotify = new Subject<Notification>;

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

    listen(channels: string[], ready?: () => void): Observable<Notification> {

        const uniqueChannels = channels.filter((x, i, a) => a.indexOf(x) === i);
        const messageInChannels = (msg: Notification) => uniqueChannels.indexOf(msg.channel) >= 0;

        const createQueries = async (client: PoolClient) => {
            const sql = uniqueChannels.map(c => `LISTEN ${c}`).join(';');
            await client.query(sql);
            // Plus, add here the reference control
        }

        return this.connection.pipe(
            switchMap(client => from(createQueries(client))),
            tap(() => ready?.()),
            switchMap(() => this.onNotify.pipe(filter(messageInChannels), finalize(() => {
                if (uniqueChannels.length /*&& this.client && no more references*/) {
                    console.log('UNLISTEN...');
                    // TODO: UNLISTEN from the channels;
                    //   And update the references;
                }
            })))
        );
    }

    async notify(channels: string[], payload?: string) {
        if (this.client) {
            const p = payload ? `,'${payload}'` : '';
            const sql = channels.map(c => `NOTIFY ${c}${p}`).join(';');
            await this.client.query(sql);
        }
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

    private createConnection(): Observable<PoolClient> {

        const s = new Subject<PoolClient>();
        let count = 0;

        const {pool, retryInit, retryAll} = this.cfg;

        const connect = (retry: RetryOptions): void => {
            retryAsync(() => pool.connect(), retry).then(setup).catch(stop);
        };

        const onNotify = (msg: Notification) => {
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
            client.on('notification', onNotify);
            count++;
            const onConnect = this.onConnect as Subject<{ client: PoolClient, count: number }>;
            onConnect.next({client, count});
            s.next(client);
        };

        const stop = (err: any) => {
            this.client = undefined;
            this.live = false;
            pool.removeListener('error', onPoolError);
            const onEnd = this.onEnd as Subject<any>;
            onEnd.next(err);
            s.error(err);
        };

        const start = () => {
            connect(retryInit || retryAll || retryDefault);
            return s.pipe(finalize(() => {
                if (!s.observed) {
                    console.log('DICONNECT...');
                    // TODO: UNLISTEN from all the channels + release the connection
                    //  Maybe no UNLISTEN, if 'listen' method does it.
                }
            }));
        };

        pool.on('error', onPoolError);
        const {defer: d} = this.cfg;

        let deferredObs: Observable<PoolClient> | undefined;
        return d ? defer(() => deferredObs ??= start()) : start();
    }
}

