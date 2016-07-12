// --NOTE: THIS IS A JS FILE, NOT TS LIKE THE REST---
//
// Interval worker - sends a 'tick' every interval milliseconds.
//
var intervalId = 0;

self.onmessage = function (event) {

    var interval = event.data.interval;

    if (interval === 0) {
        console.log('INTERVAL-WORKER: Clearing interval')
        clearInterval(intervalId);
        return;
    }

    if (!interval || isNaN(interval)) {
        console.log('INTERVAL-WORKER: Error. Interval not valid. Interval:', interval);
        return;
    }

    interval = Number(interval);

    if (interval > 0) {
        console.log('INTERVAL-WORKER: Setting interval with interval ', interval)
        intervalId = setInterval(function () {
            postMessage('tick')
        }, interval);
    }
}

console.log('INTERVAL-WORKER: Interval worker initialized');
postMessage('Interval worker initialized');