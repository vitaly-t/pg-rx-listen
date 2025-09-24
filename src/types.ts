import {Pool, PoolClient} from 'pg';
import {RetryOptions} from './retry-async';

export interface IPgListenConfig {
    pool: Pool;
    defer?: boolean;
    retryAll?: RetryOptions;
    retryInit?: RetryOptions;
    onConnect?: (client: PoolClient, count: number) => void;
    onDisconnect?: (err: any, client: PoolClient) => void;
    onEnd?: (err: any) => void;
}

/*
    So currently we cannot add/remove channels, we can only create a new listener
    with a new list of channels.
*/

/**
 * Notification message received from Postgres.
 */
export interface IListenMessage {
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
