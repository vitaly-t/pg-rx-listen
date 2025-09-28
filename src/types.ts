import {RetryOptions} from './retry-async';
import {EventEmitter} from 'events';

/**
 * Configuration for the {@link PgListenConnection} class.
 */
export interface IPgListenConfig {
    /**
     * The PostgreSQL connection pool to use for listening.
     */
    pool: IPostgresPool;

    /**
     * Retry options for reconnection attempts, plus for the
     * initial connection (if {@link retryInit} is not specified).
     *
     * When not specified, internal `retryDefault` is used, configured as follows:
     *
     * ```ts
     * const retryDefault: RetryOptions = {
     *     retry: 5, // up to 5 retries
     *     delay: s => 5 ** (s.index + 1) // Exponential delays: 5, 25, 125, 625, 3125 ms
     * };
     * ```
     */
    retryAll?: RetryOptions;

    /**
     * Retry options for the initial connection only.
     *
     * When not specified, {@link retryAll} is used, and if not available either,
     * then internal `retryDefault`, which is configured as follows:
     *
     * ```ts
     * const retryDefault: RetryOptions = {
     *     retry: 5, // up to 5 retries
     *     delay: s => 5 ** (s.index + 1) // Exponential delays: 5, 25, 125, 625, 3125 ms
     * };
     * ```
     */
    retryInit?: RetryOptions;
}

/**
 * Parameters for the {@link PgListenConnection.onConnect} event.
 */
export interface IConnectParams {
    /**
     * Instance of the client that got connected.
     */
    client: IPoolClient;

    /**
     * Number of times the connection has been established.
     */
    count: number;
}

/**
 * Parameters for the {@link PgListenConnection.onDisconnect} event.
 */
export interface IDisconnectParams {
    /**
     * Automatic-disconnection flag, when no more subscribers left.
     * When `false`, the disconnection is due to a connectivity issue.
     */
    auto: boolean;

    /**
     * Instance of the client that got disconnected.
     */
    client: IPoolClient;

    /**
     * Error that caused the disconnection.
     * It is only set when `auto` is `false`.
     */
    error?: any;
}

/**
 * Notification Message received from Postgres.
 */
export interface INotificationMessage {
    /**
     * Name of the channel that sent the notification.
     */
    channel: string;

    /**
     * Length of the notification payload, in bytes.
     *
     * Note: this is different from the number of characters
     * in the payload, as the payload may contain binary data.
     */
    length: number;

    /**
     * Notification Payload: the actual data sent with the notification.
     */
    payload: string;

    /**
     * PID of the Postgres process that sent the notification.
     */
    processId: number;
}

/**
 * Minimum connection-client interface required by this library,
 * and compatible with the {@link https://node-postgres.com/apis/client Client}
 * interface from `node-postgres`.
 */
export interface IPoolClient<M = any> extends EventEmitter {
    query(sql: string, values?: any[]): Promise<any>;

    release(err?: any): void;

    on(event: 'error', listener: (err: any) => void): any;

    on(event: 'notification', listener: (msg: M) => void): any;
}

/**
 * Minimum connection-pool interface required by this library,
 * and compatible with the {@link https://node-postgres.com/apis/pool Pool}
 * interface from `node-postgres`.
 */
export interface IPostgresPool<M = any> extends EventEmitter {
    connect(): Promise<IPoolClient<M>>;

    on(event: 'error', listener: (err: any) => void): any;
}
