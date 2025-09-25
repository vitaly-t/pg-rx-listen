import {Observable, Subject, defer, switchMap, filter, from, finalize, tap} from 'rxjs';
import {IConnectParams, IDisconnectParams, IPgListenConfig} from './types';
import {retryAsync, RetryOptions} from './retry-async';
import {Notification, PoolClient} from 'pg';

/**
 * Default retry options, to be used when `retryAll` and `retryInitial` are not specified.
 */
const retryDefault: RetryOptions = {
    retry: 10, // up to 5 retries
    delay: s => 5 ** (s.index + 1) // Exponential delays: 5, 25, 125, 625, 3125 ms
};

export class PgListenConnection {

    private client: PoolClient | undefined;

    private live = true;

    private connection: Observable<PoolClient>; // internal connection
    private onNotify = new Subject<Notification>;

    readonly onConnect: Observable<IConnectParams>;
    readonly onDisconnect: Observable<IDisconnectParams>;
    readonly onEnd: Observable<any>;
    readonly onQuery: Observable<string>;

    constructor(private cfg: IPgListenConfig) {
        this.onConnect = new Subject();
        this.onDisconnect = new Subject();
        this.onEnd = new Subject();
        this.onQuery = new Subject();
        this.connection = this.createConnection();
    }

    /**
     * Channel-to-ref count map, so we only disconnect when all refs are at zero.
     * @private
     */
    private refs: { [channel: string]: number } = {};

    listen(channels: string[], ready?: () => void): Observable<Notification> {
        const uniqueChannels = channels.filter((x, i, a) => a.indexOf(x) === i);
        const execQuery = async (client: PoolClient, sql: string) => {
            (this.onQuery as Subject<string>).next(sql);
            await client.query(sql);
        };
        const startListen = async (client: PoolClient) => {
            const inactiveChannels: string[] = [];
            for (const c of uniqueChannels) {
                if (this.refs[c]) {
                    this.refs[c]++;
                } else {
                    this.refs[c] = 1;
                    inactiveChannels.push(c);
                }
            }
            const sql = inactiveChannels.map(c => `LISTEN ${c}`).join(';');
            await execQuery(client, sql);
        }
        const stopListen = async (client: PoolClient) => {
            const activeChannels = uniqueChannels.filter(c => !--this.refs[c]);
            if (activeChannels.length) {
                const sql = activeChannels.map(c => `UNLISTEN ${c}`).join(';');
                await execQuery(client, sql);
            }
        }
        const messageInChannels = (msg: Notification) => uniqueChannels.indexOf(msg.channel) >= 0;
        return this.connection.pipe(
            switchMap(client => from(startListen(client))),
            tap(() => ready?.()),
            switchMap(() => this.onNotify.pipe(filter(messageInChannels), finalize(() => {
                stopListen(this.client!).catch();
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

    /**
     * Returns the list of channels that are currently being listened to.
     */
    get channels(): string[] {
        return Object.entries(this.refs)
            .filter(a => a[1])
            .map(a => a[0]);
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

        const onClientError = (err: any) => {
            this.client?.removeListener('notification', onNotify);
            const onDisconnect = this.onDisconnect as Subject<IDisconnectParams>;
            onDisconnect.next({auto: false, err, client: this.client!});
            this.client = undefined;
            connect(retryAll || retryDefault);
        };

        const setup = (client: PoolClient) => {
            this.client = client;
            client.on('notification', onNotify);
            client.on('error', onClientError);
            count++;
            const onConnect = this.onConnect as Subject<IConnectParams>;
            onConnect.next({client, count});
            s.next(client);
        };

        const stop = (err: any) => {
            this.client?.removeListener('error', onClientError);
            this.client = undefined;
            this.live = false;
            const onEnd = this.onEnd as Subject<any>;
            onEnd.next(err);
            s.error(err);
        };

        let deferredObs: Observable<PoolClient> | undefined;

        const start = () => {
            connect(retryInit || retryAll || retryDefault);
            return s.pipe(finalize(() => {
                if (!s.observed) {
                    setTimeout(() => {
                        if (this.client) {
                            this.client.release();
                            this.client.removeListener('notification', onNotify);
                            const onDisconnect = this.onDisconnect as Subject<IDisconnectParams>;
                            onDisconnect.next({auto: true, client: this.client});
                            this.client = undefined;
                            deferredObs = undefined;
                        }
                    });
                }
            }));
        };
        return defer(() => deferredObs ??= start());
    }
}
