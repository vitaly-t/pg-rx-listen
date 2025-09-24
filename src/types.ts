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

export interface IListenMessage {

}
