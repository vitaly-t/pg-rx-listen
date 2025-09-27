import {Observable, Subject, defer, switchMap, filter, from, finalize, tap, shareReplay} from 'rxjs';
import {IConnectParams, IDisconnectParams, INotificationMessage, IPgListenConfig, IPoolClient} from './types';
import {retryAsync, RetryOptions} from './retry-async';

type IClient = IPoolClient<INotificationMessage>;

/**
 * Default retry options, to be used when `retryAll` and `retryInit` are not specified.
 */
const retryDefault: RetryOptions = {
    retry: 5, // up to 5 retries
    delay: s => 5 ** (s.index + 1) // Exponential delays: 5, 25, 125, 625, 3125 ms
};

/**
 * A class that represents a single connection to a PostgreSQL database
 * and provides methods for listening to and sending notifications.
 */
export class PgListenConnection {

    private client: IClient | undefined;
    private live = true;
    private connection: Observable<IClient>; // internal connection
    private onNotify = new Subject<INotificationMessage>;

    /**
     * Emits when a new connection has been established.
     */
    readonly onConnect: Observable<IConnectParams>;

    /**
     * Emits when a connection has been lost (temporarily),
     * and is due for automatic reconnection.
     */
    readonly onDisconnect: Observable<IDisconnectParams>;

    /**
     * Emits when the connection has been lost permanently.
     *
     * After this event, all `LISTEN` subscribers have received the `error` event,
     * and the class is no longer usable.
     *
     * This is for monitoring / logging purposes.
     */
    readonly onEnd: Observable<any>;

    /**
     * Emits all SQL queries being executed.
     *
     * This is for monitoring / logging purposes.
     */
    readonly onQuery: Observable<string>;

    /**
     * Map of listen counters (references) for each channel,
     * so we issue `LISTEN` / `UNLISTEN` only when needed.
     *
     * @private
     */
    private listenRefs: { [channel: string]: number } = {};

    constructor(private cfg: IPgListenConfig) {
        this.onConnect = new Subject();
        this.onDisconnect = new Subject();
        this.onEnd = new Subject();
        this.onQuery = new Subject();
        this.connection = this.createConnection();
    }

    /**
     * Creates an observable that emits `LISTEN` notifications for the specified channels.
     *
     * Note that it does not trigger a connection with listening. That happens only after
     * you subscribe to the returned observable.
     *
     * @param channels - List of channels to listen to.
     * @param [ready] - Optional callback for when it is ready to send notifications (if you need those), i.e.
     *                when a connection has been established + `LISTEN` queries finished execution.
     */
    listen(channels: string[], ready?: () => void): Observable<INotificationMessage> {
        const uniqueChannels = channels.filter((x, i, a) => a.indexOf(x) === i);
        const startListen = async () => {
            const inactiveChannels: string[] = [];
            for (const c of uniqueChannels) {
                if (this.listenRefs[c]) {
                    this.listenRefs[c]++;
                } else {
                    this.listenRefs[c] = 1;
                    inactiveChannels.push(c);
                }
            }
            const sql = inactiveChannels.map(c => `LISTEN ${c}`).join(';');
            await this.executeSql(sql);
        }
        const stopListen = async () => {
            const activeChannels = uniqueChannels.filter(c => !--this.listenRefs[c]);
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
                stopListen().catch();
            })))
        );
    }

    /**
     * Sends a notification into the specified channels, with optional payload.
     *
     * @param channels - List of channels to notify.
     * @param payload - Optional payload to send with the notification.
     * @returns `true` if the notification was sent successfully, `false` otherwise.
     *
     * @example
     * ```ts
     * // "ls" is of type "PgListenConnection"
     * ls.listen(['channel_1', 'channel_2'], async () => {
     *     await ls.notify(['channel_1', 'channel_2'], 'Hello World!');
     * })
     *     .subscribe(msg => {
     *         console.log(msg);
     *     });
     * ```
     * > Output:
     * ```js
     * {
     *   channel: 'channel_1',
     *   length: 31,
     *   payload: 'Hello World!',
     *   processId: 644
     * }
     * {
     *   channel: 'channel_2',
     *   length: 31,
     *   payload: 'Hello World!',
     *   processId: 644
     * }
     * ```
     */
    notify(channels: string[], payload?: string): Promise<boolean> {
        const p = payload ? `,'${payload}'` : '';
        const sql = channels.map(c => `NOTIFY ${c}${p}`).join(';');
        return this.executeSql(sql);
    }

    /**
     * Returns `true` if the connection is either active or being established.
     *
     * Returns `false` when the connection is lost permanently, and {@link onEnd} has been emitted.
     */
    get isLive() {
        return this.live;
    }

    /**
     * Returns true if the connection is currently active.
     */
    get isConnected() {
        return !!this.client;
    }

    /**
     * List of channels that are currently being listened to.
     */
    get liveChannels(): string[] {
        return Object.entries(this.listenRefs)
            .filter(a => a[1])
            .map(a => a[0]);
    }

    /**
     * Creates a reusable connection observable, which ends only after we fail to re-connect,
     * and {@link onEnd} has been emitted.
     *
     * @private
     */
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
            for (const c of Object.keys(this.listenRefs)) {
                delete this.listenRefs[c];
            }
        };

        let deferredObs: Observable<IClient> | undefined;

        const start = () => {
            connect(retryInit || retryAll || retryDefault);
            return s.pipe(
                shareReplay({bufferSize: 1, refCount: true}),
                finalize(() => {
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

    /**
     * Safely executes a given SQL query string + sends notification to the client.
     *
     * @param {string} sql - The SQL query string to be executed. Must be a non-empty string.
     * @return {Promise<boolean>} A promise that resolves to true if the query is successfully executed, false otherwise.
     *
     * @private
     */
    private async executeSql(sql: string): Promise<boolean> {
        if (this.client && sql.length > 0) {
            (this.onQuery as Subject<string>).next(sql);
            await this.client.query(sql);
            return true;
        }
        return false;
    }

}
