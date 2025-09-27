import {shareReplay, Subject} from 'rxjs';

const myConnection = new Subject<number>();

const cn = myConnection.pipe(shareReplay(1));

cn.subscribe(value => {
    console.log('Early:', value);
});

myConnection.next(1);
myConnection.next(2);

cn.subscribe(value => {
    console.log('Late:', value);
});

setTimeout(() => {
    cn.subscribe(value => {
        console.log('Very Late:', value);
    });
}, 1000);
