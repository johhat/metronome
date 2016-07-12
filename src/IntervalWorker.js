// --NOTE: THIS IS A JS FILE, NOT TS LIKE THE REST---
//
// Interval worker - sends a 'tick' every interval milliseconds.
//
var intervalId = 0;

self.onmessage = function (event) {

    var interval = event.data.interval;

    if (interval === 0) {
        postMessage('Clearing interval');
        clearInterval(intervalId);
        return;
    }

    if (!interval || isNaN(interval)) {
        postMessage('Error - Interval not valid. Interval: ' + interval);
        return;
    }

    interval = Number(interval);

    if (interval > 0) {
        postMessage('Setting interval with interval ' + interval);
        intervalId = setInterval(function () {
            postMessage('tick');
        }, interval);
    }
};

postMessage('Interval worker initialized');