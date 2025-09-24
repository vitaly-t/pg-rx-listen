import {Pool} from 'pg';
import {RetryOptions} from './retry-async';

export interface IPgListenConfig {
    pool: Pool;
    defer: boolean;
    retryAll: RetryOptions;
    retryInit: RetryOptions;
    onConnect: any;
    onDisconnect: any;
    onEnd: any;
}

/*
    So currently we cannot add/remove channels, we can only create a new listener
    with a new list of channels.
*/

export interface IListenMessage {

}
