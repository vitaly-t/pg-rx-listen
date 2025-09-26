import {Observable, Subject, defer, switchMap, filter, from, finalize, tap} from 'rxjs';
import {IConnectParams, IDisconnectParams, INotificationMessage, IPgListenConfig, IPoolClient} from './types';
import {retryAsync, RetryOptions} from './retry-async';

type IClient = IPoolClient<INotificationMessage>;

/**
 * Default retry options, to be used when `retryAll` and `retryInitial` are not specified.
 */
const retryDefault: RetryOptions = {
    retry: 10, // up to 5 retries
    delay: s => 5 ** (s.index + 1) // Exponential delays: 5, 25, 125, 625, 3125 ms
};

export class PgListenConnection {

    private client: IClient | undefined;

    private live = true;

    private connection: Observable<IClient>; // internal connection
    private onNotify = new Subject<INotificationMessage>;

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

    private async executeSql(sql: string): Promise<boolean> {
        if (this.client && sql.length > 0) {
            await this.client.query(sql);
            (this.onQuery as Subject<string>).next(sql);
            return true;
        }
        return false;
    }

    /**
     * Channel-to-ref count map, so we only disconnect when all refs are at zero.
     * @private
     */
    private refs: { [channel: string]: number } = {};

    listen(channels: string[], ready?: () => void): Observable<INotificationMessage> {
        const uniqueChannels = channels.filter((x, i, a) => a.indexOf(x) === i);
        const startListen = async () => {
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
            await this.executeSql(sql);
        }
        const stopListen = async () => {
            const activeChannels = uniqueChannels.filter(c => !--this.refs[c]);
            if (activeChannels.length) {
                const sql = activeChannels.map(c => `UNLISTEN ${c}`).join(';');
                await this.executeSql(sql);
            }
        }
        const messageInChannels = (msg: INotificationMessage) => uniqueChannels.indexOf(msg.channel) >= 0;
        return this.connection.pipe(
            switchMap(() => from(startListen())),
            tap(() => ready?.()),
            switchMap(() => this.onNotify.pipe(filter(messageInChannels), finalize(() => {
                if (!this.onNotify.observed) {
                    stopListen().catch();
                }
            })))
        );
    }

    notify(channels: string[], payload?: string): Promise<boolean> {
        const p = payload ? `,'${payload}'` : '';
        const sql = channels.map(c => `NOTIFY ${c}${p}`).join(';');
        return this.executeSql(sql);
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

    private createConnection(): Observable<IClient> {

        const s = new Subject<IClient>();
        let count = 0;

        const {pool, retryInit, retryAll} = this.cfg;

        const connect = (retry: RetryOptions): void => {
            retryAsync(() => pool.connect(), retry).then(setup).catch(stop);
        };

        const onNotify = (msg: INotificationMessage) => {
            // below we extract only what's useful from the
            // underlying NotificationResponseMessage type:
            this.onNotify.next({
                channel: msg.channel,
                length: msg.length,
                payload: msg.payload,
                processId: msg.processId
            });
        };

        const onClientError = (err: any) => {
            const client = this.client!;
            this.client = undefined;
            client.removeListener('notification', onNotify);
            client.release(err);
            client.removeListener('error', onClientError);
            clearReferences();
            const onDisconnect = this.onDisconnect as Subject<IDisconnectParams>;
            onDisconnect.next({auto: false, err, client});
            setTimeout(() => {
                connect(retryAll || retryDefault);
            });
        };

        const setup = (client: IClient) => {
            this.client = client;
            client.on('notification', onNotify);
            client.on('error', onClientError);
            count++;
            const onConnect = this.onConnect as Subject<IConnectParams>;
            onConnect.next({client, count});
            s.next(client);
        };

        const stop = (err: any) => {
            if (this.client) {
                this.client.release(err);
                this.client.removeListener('notification', onNotify);
                this.client.removeListener('error', onClientError);
                this.client = undefined;
            }
            this.live = false;
            const onEnd = this.onEnd as Subject<any>;
            onEnd.next(err);
            s.error(err);
        };

        const clearReferences = () => {
            for (const c of Object.keys(this.refs)) {
                delete this.refs[c];
            }
        };

        let deferredObs: Observable<IClient> | undefined;

        const start = () => {
            connect(retryInit || retryAll || retryDefault);
            return s.pipe(finalize(() => {
                if (!s.observed) {
                    setTimeout(() => {
                        if (this.client) {
                            this.client.removeListener('notification', onNotify);
                            this.client.removeListener('error', onClientError);
                            this.client.release();
                            const onDisconnect = this.onDisconnect as Subject<IDisconnectParams>;
                            onDisconnect.next({auto: true, client: this.client});
                            this.client = undefined;
                            deferredObs = undefined;
                        }
                    });
                }
            }));
        };
        pool.on('error', () => {
            // do nothing
        });
        return defer(() => deferredObs ??= start());
    }
}
