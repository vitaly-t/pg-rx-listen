import {RetryOptions} from './retry-async';
import {EventEmitter} from 'events';

export interface IPoolClient<M = any> extends EventEmitter {
    query(sql: string, values?: any[]): Promise<any>;

    release(err?: any): void;

    on(event: 'error', listener: (err: any) => void): any;

    on(event: 'notification', listener: (msg: M) => void): any;
}

export interface IPostgresPool<M = any> extends EventEmitter {
    connect(): Promise<IPoolClient<M>>;

    on(event: 'error', listener: (err: any) => void): any;
}

export interface IPgListenConfig {
    pool: IPostgresPool;
    retryAll?: RetryOptions;
    retryInit?: RetryOptions;
}

export interface IConnectParams {
    client: IPoolClient;
    count: number;
}

export interface IDisconnectParams {
    auto: boolean;
    client: IPoolClient;
    err?: any;
}

/*
    So currently we cannot add/remove channels, we can only create a new listener
    with a new list of channels.
*/

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
