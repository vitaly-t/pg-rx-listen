import {Observable} from 'rxjs';

interface IPgListenConfig {
    pool: any;
    defer: boolean;
    retryAll: any;
    retryInit: any;
    onConnect: any;
    onDisconnect: any;
    onEnd: any;
}

interface IMessage {

}

export class PgListenConnection {
    constructor(cfg: IPgListenConfig) {
    }

    listen(...channels: string[]): Observable<IMessage> {
        // starts listening, if it is not already listening,
        // and subscribes to those channels;
        return null as any;
    }

    async notify(channels: string[], payload?: string) {
        // send notification to the channels
    }

    get isLive() {
        return true;
    }

    get isConnected() {
        return true;
    }

    async cancel() {
        // stops listening + disconnects
    }
}
