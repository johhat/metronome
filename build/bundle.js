(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
/**
 * InputDisplay
 */
var inputReactDelay = 500; // ms.
var State;
(function (State) {
    State[State["OK"] = 0] = "OK";
    State[State["INFO"] = 1] = "INFO";
    State[State["WARNING"] = 2] = "WARNING";
    State[State["ERROR"] = 3] = "ERROR";
})(State || (State = {}));
var InputDisplay = (function () {
    function InputDisplay(inputDisplay, label, initialValue, defaultHelpText, validator, onNewValidValue) {
        var _this = this;
        this.inputDisplay = inputDisplay;
        this.label = label;
        this.defaultHelpText = defaultHelpText;
        this.validator = validator;
        this.onNewValidValue = onNewValidValue;
        this.inputTimerId = 0;
        this.messageTimerId = 0;
        this.value = initialValue;
        this.inputDisplay.value = initialValue.toString();
        this.state = State.OK;
        this.handleNewValue(initialValue.toString());
        this.inputDisplay.addEventListener('input', function (event) {
            _this.handleInputEvent(event);
        });
    }
    InputDisplay.prototype.setValue = function (value) {
        this.value = Math.round(value * 100) / 100;
        this.inputDisplay.value = this.value.toString();
        this.handleNewValue(value.toString());
    };
    InputDisplay.prototype.setTimedError = function (message, duration) {
        var _this = this;
        clearTimeout(this.messageTimerId);
        this.setState(State.OK);
        this.setLabelMessage(message);
        this.messageTimerId = setTimeout(function () {
            // Go back to state corresponding to current display value
            _this.handleNewValue(_this.inputDisplay.value);
        }, duration);
    };
    InputDisplay.prototype.setTimedInfo = function (message, duration) {
        var _this = this;
        clearTimeout(this.messageTimerId);
        this.setState(State.INFO);
        this.setLabelMessage(message);
        this.messageTimerId = setTimeout(function () {
            // Go back to state corresponding to current display value
            _this.handleNewValue(_this.inputDisplay.value);
        }, duration);
    };
    InputDisplay.prototype.blinkInfo = function (message) {
        var _this = this;
        this.setState(State.INFO);
        this.setLabelMessage(message);
        var blink1Off = 100;
        var blink2On = 100;
        var messageTimeout = 1000;
        setTimeout(function () {
            _this.setState(State.OK);
        }, blink1Off);
        setTimeout(function () {
            _this.setState(State.INFO);
        }, blink1Off + blink2On);
        this.messageTimerId = setTimeout(function () {
            // Go back to state corresponding to current display value
            _this.handleNewValue(_this.inputDisplay.value);
        }, blink1Off + blink2On + messageTimeout);
    };
    InputDisplay.prototype.handleNewValue = function (value) {
        if (value.toString().length < 2) {
            this.setLabelMessage('The value must have at least two digits.');
            this.setState(State.WARNING);
            return false;
        }
        if (isNaN(Number(value))) {
            this.setLabelMessage('The entered value is not a number. Please enter a number');
            this.setState(State.WARNING);
            return false;
        }
        var valueAsNumber = Number(value);
        var _a = this.validator(valueAsNumber), valid = _a.valid, error = _a.error;
        if (!valid) {
            this.setLabelMessage(error);
            this.setState(State.ERROR);
            return false;
        }
        this.setState(State.OK);
        this.setLabelMessage(this.defaultHelpText);
        return true;
    };
    InputDisplay.prototype.handleInputEvent = function (event) {
        var _this = this;
        clearTimeout(this.inputTimerId);
        clearTimeout(this.messageTimerId);
        this.inputTimerId = setTimeout(function () {
            var value = _this.inputDisplay.value;
            if (!_this.handleNewValue(value)) {
                return;
            }
            _this.onNewValidValue(Number(value));
        }, inputReactDelay);
    };
    InputDisplay.prototype.setState = function (nextState) {
        // Set CSS classes corresponding to the element state
        var currentStateClass = this.getStateClass(this.state);
        var nextStateClass = this.getStateClass(nextState);
        if (currentStateClass !== '') {
            this.inputDisplay.classList.remove(currentStateClass);
            this.label.classList.remove(currentStateClass);
        }
        if (nextStateClass !== '') {
            this.inputDisplay.classList.add(nextStateClass);
            this.label.classList.add(nextStateClass);
        }
        this.state = nextState;
    };
    InputDisplay.prototype.getStateClass = function (state) {
        switch (state) {
            case State.OK:
                return 'ok';
            case State.INFO:
                return 'has-info';
            case State.WARNING:
                return 'has-warning';
            case State.ERROR:
                return 'has-error';
            default:
                console.log('Tried to get class corresponding to non-existing state:', state);
                return '';
        }
    };
    InputDisplay.prototype.setLabelMessage = function (message) {
        this.label.textContent = message;
    };
    return InputDisplay;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = InputDisplay;

},{}],2:[function(require,module,exports){
"use strict";
/**
 * Metronome
 */
var minTempo = 40; // BPM
var maxTempo = 250; // BPM
var numBeatsPerBar = 4;
var maxNoteQueLength = 5;
var noteLength = 0.05; // Seconds
var scheduleInterval = 25.0; // ms. How often the scheduling is called.
var scheduleAheadTime = 0.1; // Seconds
var Pitch;
(function (Pitch) {
    Pitch[Pitch["HIGH"] = 0] = "HIGH";
    Pitch[Pitch["MID"] = 1] = "MID";
    Pitch[Pitch["LOW"] = 2] = "LOW";
})(Pitch || (Pitch = {}));
;
var Metronome = (function () {
    function Metronome(tempo) {
        var _this = this;
        this.isPlaying = false;
        this.canSuspend = false;
        this.usesWorker = false;
        this.suspendTimerId = 0;
        this.nextNoteTime = 0;
        this.next4thNote = 0;
        // Safari needs prefix webkitAudioContext
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.setTempo(tempo);
        // --Suspend/resume--
        this.canSuspend = (function () {
            if (typeof _this.audioContext.resume !== 'function') {
                return false;
            }
            if (typeof _this.audioContext.suspend !== 'function') {
                return false;
            }
            return true;
        })();
        if (this.canSuspend) {
            clearTimeout(this.suspendTimerId);
            this.audioContext.suspend();
        }
        // --Web worker--
        this.usesWorker = window.Worker ? true : false;
        if (this.usesWorker) {
            this.intervalWorker = new Worker('build/IntervalWorker.js');
            this.intervalWorker.onmessage = function (event) {
                if (event.data === 'tick') {
                    _this.scheduler();
                }
                else {
                    console.log('Data from intervalWorker: ', event.data);
                }
            };
        }
    }
    Metronome.prototype.play = function () {
        if (!this.isPlaying) {
            if (this.canSuspend)
                this.audioContext.resume();
            this.isPlaying = true;
            this.audioLoop();
        }
    };
    Metronome.prototype.pause = function () {
        var _this = this;
        if (this.isPlaying) {
            this.stopAudioLoop();
            this.isPlaying = false;
            if (this.canSuspend) {
                this.suspendTimerId = setTimeout(function () {
                    _this.audioContext.suspend();
                }, scheduleAheadTime * 1000 * 2);
            }
        }
    };
    Metronome.prototype.toggle = function () {
        if (this.isPlaying) {
            this.pause();
        }
        else {
            this.play();
        }
        return this.isPlaying;
    };
    Metronome.prototype.validateTempo = function (tempo) {
        if (isNaN(tempo)) {
            return { valid: false, error: 'You must enter a number' };
        }
        tempo = Number(tempo);
        if (tempo < minTempo) {
            return { valid: false, error: 'Minimum tempo is ' + minTempo };
        }
        if (tempo > maxTempo) {
            return { valid: false, error: 'Max tempo is ' + maxTempo };
        }
        return { valid: true, error: '' };
    };
    Metronome.prototype.setTempo = function (tempo) {
        if (this.tempo === tempo) {
            // Do nothing if it is the same
            return;
        }
        var valid = this.validateTempo(tempo).valid;
        if (!valid) {
            return;
        }
        this.tempo = Number(tempo);
    };
    Metronome.prototype.getMinTempo = function () {
        return minTempo;
    };
    Metronome.prototype.getMaxTempo = function () {
        return maxTempo;
    };
    Metronome.prototype.getCurrentTime = function () {
        return this.audioContext.currentTime;
    };
    Metronome.prototype.readNoteQue = function () {
        return this.noteQue.pop();
    };
    Metronome.prototype.flushNoteQue = function () {
        while (this.noteQue.length > 0) {
            this.noteQue.pop();
        }
    };
    Metronome.prototype.stopAudioLoop = function () {
        if (this.usesWorker) {
            this.intervalWorker.postMessage({ 'interval': 0 });
        }
        else {
            clearInterval(this.audioLoopTimerHandle);
        }
        this.flushNoteQue();
    };
    Metronome.prototype.audioLoop = function () {
        var _this = this;
        this.nextNoteTime = this.audioContext.currentTime + 0.1;
        this.next4thNote = 0;
        this.noteQue = [];
        this.noteQue.push({
            time: this.nextNoteTime,
            tempo: this.tempo,
            progress: this.next4thNote / 4,
        });
        if (this.usesWorker) {
            this.intervalWorker.postMessage({ 'interval': scheduleInterval });
        }
        else {
            this.audioLoopTimerHandle = setInterval(function () {
                if (!_this.isPlaying)
                    return;
                _this.scheduler();
            }, scheduleInterval);
        }
    };
    Metronome.prototype.scheduler = function () {
        while (this.nextNoteTime < this.audioContext.currentTime + scheduleAheadTime) {
            this.scheduleTone(this.nextNoteTime, this.next4thNote % numBeatsPerBar ? Pitch.MID : Pitch.HIGH);
            var secondsPerBeat = 60.0 / this.tempo;
            this.nextNoteTime += secondsPerBeat;
            this.next4thNote = (this.next4thNote + 1) % numBeatsPerBar;
            if (this.noteQue.length > maxNoteQueLength)
                this.noteQue.pop();
            this.noteQue.push({
                time: this.nextNoteTime,
                tempo: this.tempo,
                progress: (this.next4thNote) / 4,
            });
        }
    };
    Metronome.prototype.scheduleTone = function (startTime, pitch) {
        var osc = this.audioContext.createOscillator();
        osc.connect(this.audioContext.destination);
        var frequency = 0;
        switch (pitch) {
            case Pitch.HIGH:
                frequency = 880;
                break;
            case Pitch.MID:
                frequency = 440;
                break;
            case Pitch.LOW:
                frequency = 220;
                break;
            default:
                console.log('Invalid pitch');
                frequency = 220;
                break;
        }
        osc.frequency.value = frequency;
        osc.start(startTime);
        osc.stop(startTime + noteLength);
    };
    return Metronome;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Metronome;

},{}],3:[function(require,module,exports){
/**
 * MetronomeAnimation
 */
"use strict";
/*
    Default coordinate framefor canvas:
    
    (0,0)-----> x
    |
    |
    y

    Where the origin is to the top left of the canvas.

    The animation uses a translated coordinate frame where the origin is moved down to the right.
    The y-axis wraps around such that the last 7/8 of a bar are animated as a right-movement from the left edge of the canvas,
    while the first 7/8 are animated as a right movement from the translated origin.
 */
var sigma = 0.027;
var radius = 10;
var MetronomeAnimation = (function () {
    function MetronomeAnimation(getCurrentTime, readNoteQue) {
        this.getCurrentTime = getCurrentTime;
        this.readNoteQue = readNoteQue;
        this.animationFrameId = 0;
        this.running = false;
        this.container = document.getElementById('animationContainer');
        this.gridCanvas = document.getElementById('bottom-canvas');
        this.ballCanvas = document.getElementById('top-canvas');
        this.width = this.container.clientWidth * 2;
        this.height = this.container.clientHeight * 2;
        this.setSize(this.width, this.height);
        this.gridContext = this.gridCanvas.getContext('2d');
        this.ballContext = this.ballCanvas.getContext('2d');
        this.drawPath();
    }
    MetronomeAnimation.prototype.start = function () {
        var _this = this;
        this.updateNoteInfo();
        this.running = true;
        this.animationFrameId = window.requestAnimationFrame(function () { _this.drawBall(); });
    };
    MetronomeAnimation.prototype.stop = function () {
        this.running = false;
        window.cancelAnimationFrame(this.animationFrameId);
    };
    MetronomeAnimation.prototype.toggle = function () {
        if (this.running) {
            this.stop();
        }
        else {
            this.start();
        }
    };
    MetronomeAnimation.prototype.setSize = function (width, height) {
        this.gridCanvas.width = width;
        this.gridCanvas.height = height;
        this.ballCanvas.width = width;
        this.ballCanvas.height = height;
    };
    MetronomeAnimation.prototype.updateNoteInfo = function () {
        var data = this.readNoteQue();
        if (!data)
            return;
        this.nextNote = data;
    };
    MetronomeAnimation.prototype.transformToNoteFrame = function (context) {
        context.translate(this.width / 8, this.height - radius);
    };
    MetronomeAnimation.prototype.drawBall = function () {
        var _this = this;
        var ctx = this.ballContext;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(51,86,56,0.9)';
        ctx.fillStyle = 'rgba(51,86,56,0.5)';
        ctx.save();
        var barPosition = this.getBarPosition();
        this.transformToNoteFrame(ctx);
        // Translate to desired position
        ctx.translate(this.getXoffset(barPosition), this.getYoffset(barPosition));
        // Add circle path at the place we've translated to
        this.circle(ctx, radius);
        // Do stroke
        ctx.restore();
        ctx.stroke();
        ctx.fill();
        this.animationFrameId = window.requestAnimationFrame(function () { _this.drawBall(); });
    };
    MetronomeAnimation.prototype.drawPath = function () {
        var ctx = this.gridContext;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgb(103,177,104)';
        ctx.save();
        this.transformToNoteFrame(ctx);
        var precision = 0.001;
        // Draw the curve to the right in the note fram
        for (var barPosition = 0; barPosition < 7 / 8; barPosition += precision) {
            ctx.lineTo(this.getXoffset(barPosition), this.getYoffset(barPosition));
        }
        // Move to the left side of the canvas
        ctx.moveTo(this.getXoffset(7 / 8), this.getYoffset(7 / 8));
        // Draw the curve to the left in the note fram
        for (var barPosition = 7 / 8; barPosition < 1; barPosition += precision) {
            ctx.lineTo(this.getXoffset(barPosition), this.getYoffset(barPosition));
        }
        ctx.restore();
        ctx.stroke();
    };
    // Returns percentage of a bar completed. Eg. at exactly two beats it will be 0.5. 
    MetronomeAnimation.prototype.getBarPosition = function () {
        this.updateNoteInfo();
        var secondsPerBeat = 60.0 / this.nextNote.tempo;
        var expectedPosition = this.nextNote.progress - 0.25 * (this.nextNote.time - this.getCurrentTime()) / secondsPerBeat;
        if (expectedPosition < 0) {
            expectedPosition = (expectedPosition % 1) + 1;
        }
        return expectedPosition;
    };
    // How much x should be offset from the origin in the note coordinate frame - implements the wrapping at 7/8
    MetronomeAnimation.prototype.getXoffset = function (barPosition) {
        if (barPosition < 7 / 8) {
            return barPosition * this.width;
        }
        else {
            return (-1 / 8 + (barPosition - 7 / 8)) * this.width;
        }
    };
    // How much y should be offset from the origin in the note coordinate frame
    MetronomeAnimation.prototype.getYoffset = function (barPosition) {
        var distanceToOrigin = (barPosition > 0.5) ? 1 - barPosition : barPosition;
        // Gaussian functions to get peaks at the beats
        var amplitude = 2 * Math.exp(-0.5 * Math.pow(distanceToOrigin / sigma, 2));
        amplitude += Math.exp(-0.5 * Math.pow((barPosition - 0.25) / sigma, 2));
        amplitude += Math.exp(-0.5 * Math.pow((barPosition - 0.50) / sigma, 2));
        amplitude += Math.exp(-0.5 * Math.pow((barPosition - 0.75) / sigma, 2));
        var scaling = -this.height * 1 / 2 * 0.7;
        return scaling * amplitude;
    };
    MetronomeAnimation.prototype.circle = function (context, radius) {
        context.beginPath(); // Note to self: Adding moveTo here creates a line from center of circle on stroke.
        context.arc(0, 0, radius, 0, 2 * Math.PI);
    };
    return MetronomeAnimation;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MetronomeAnimation;

},{}],4:[function(require,module,exports){
"use strict";
/**
 * MetronomeUi
 */
var Metronome_1 = require('./Metronome');
var Tapper_1 = require('./Tapper');
var WhilePressedBtn_1 = require('./WhilePressedBtn');
var InputDisplay_1 = require('./InputDisplay');
var MetronomeAnimation_1 = require('./MetronomeAnimation');
var defaultTempo = 120; // BPM
var defaultHelpText = 'Tempo in beats per minute (BPM):';
var hasLocalStorage = (function () {
    var test = 'metronome-test-string';
    try {
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    }
    catch (e) {
        return false;
    }
})();
var KeyCodes;
(function (KeyCodes) {
    KeyCodes[KeyCodes["SPACE"] = 32] = "SPACE";
})(KeyCodes || (KeyCodes = {}));
;
var MouseCodes;
(function (MouseCodes) {
    MouseCodes[MouseCodes["LEFT"] = 1] = "LEFT";
})(MouseCodes || (MouseCodes = {}));
;
var MetronomeUi = (function () {
    function MetronomeUi(playPauseBtn, tapBtn, plussBtn, minusBtn, resetBtn, inputDisplay, inputDisplayLabel) {
        var _this = this;
        this.playPauseBtn = playPauseBtn;
        this.tapBtn = tapBtn;
        this.resetBtn = resetBtn;
        this.isPlaying = false;
        this.displayValue = defaultTempo;
        this.enterIsPressed = false;
        this.spaceIsPressed = false;
        this.metronome = new Metronome_1.default(defaultTempo);
        this.metronomeAnimation = new MetronomeAnimation_1.default(function () {
            return _this.metronome.getCurrentTime();
        }, function () {
            return _this.metronome.readNoteQue();
        });
        this.minTempo = this.metronome.getMinTempo();
        this.maxTempo = this.metronome.getMaxTempo();
        this.tapper = new Tapper_1.default(function () {
            // called onReset
            _this.inputDisplay.blinkInfo('Tapper reset.');
        });
        this.plussBtn = new WhilePressedBtn_1.default(plussBtn, function () { _this.incrementDisplayValue(); });
        this.minusBtn = new WhilePressedBtn_1.default(minusBtn, function () { _this.decrementDisplayValue(); });
        this.inputDisplay = new InputDisplay_1.default(inputDisplay, inputDisplayLabel, defaultTempo, defaultHelpText, function (value) {
            // Validator function
            return _this.metronome.validateTempo(value);
        }, function (value) {
            // Handle new valid value
            _this.displayValue = value;
            _this.setMetronomeTempo(value);
        });
        this.setDisplayValue(this.getTempoFromStorage());
        // Set event handlers
        playPauseBtn.addEventListener('click', function () {
            _this.togglePlayPause();
        });
        tapBtn.addEventListener('click', function () {
            _this.tap();
        });
        resetBtn.addEventListener('click', function () {
            _this.reset();
        });
        document.addEventListener('keydown', function (event) {
            _this.handleKeyDown(event);
        });
        document.addEventListener('keyup', function (event) {
            _this.handleKeyUp(event);
        });
    }
    MetronomeUi.prototype.tap = function () {
        var _a = this.tapper.tap(), averageTempo = _a.averageTempo, numValuesAveraged = _a.numValuesAveraged;
        if (numValuesAveraged === 0) {
            this.inputDisplay.setTimedInfo('Tap one more time to estimate tempo.', 4000);
            return;
        }
        this.setDisplayValue(averageTempo);
        this.inputDisplay.setTimedInfo('Average of ' + numValuesAveraged + ' intervals. The tapper resets after 5 seconds.', 4000);
    };
    MetronomeUi.prototype.togglePlayPause = function () {
        this.isPlaying = this.metronome.toggle();
        this.metronomeAnimation.toggle();
    };
    MetronomeUi.prototype.incrementDisplayValue = function () {
        var newValue = this.displayValue + 1;
        var _a = this.metronome.validateTempo(newValue), valid = _a.valid, error = _a.error;
        if (!valid) {
            if (newValue > this.maxTempo)
                this.setDisplayValue(this.maxTempo);
            if (newValue < this.minTempo)
                this.setDisplayValue(this.minTempo);
            this.inputDisplay.setTimedError(error, 2000);
            this.plussBtn.setTimedError(2000);
            return;
        }
        this.setDisplayValue(newValue);
    };
    MetronomeUi.prototype.decrementDisplayValue = function () {
        var newValue = this.displayValue - 1;
        var _a = this.metronome.validateTempo(newValue), valid = _a.valid, error = _a.error;
        if (!valid) {
            if (newValue < this.minTempo)
                this.setDisplayValue(this.minTempo);
            if (newValue > this.maxTempo)
                this.setDisplayValue(this.maxTempo);
            this.inputDisplay.setTimedError(error, 2000);
            this.minusBtn.setTimedError(2000);
            return;
        }
        this.setDisplayValue(newValue);
    };
    MetronomeUi.prototype.reset = function () {
        this.setDisplayValue(defaultTempo);
        if (this.isPlaying)
            this.togglePlayPause();
        this.metronome.setTempo(defaultTempo);
        this.tapper.reset();
        localStorage.clear();
    };
    MetronomeUi.prototype.handleKeyDown = function (event) {
        var keyName = event.key;
        if (keyName === 'ArrowUp') {
            event.preventDefault();
            this.incrementDisplayValue();
        }
        if (keyName === 'ArrowDown') {
            event.preventDefault();
            this.decrementDisplayValue();
        }
        if (keyName === 'Enter') {
            // May not be very intuitive. Eg. enter on reset button will not "press" reset
            event.preventDefault();
            if (!this.enterIsPressed) {
                this.togglePlayPause();
                this.enterIsPressed = true;
            }
        }
        if (event.keyCode === KeyCodes.SPACE) {
            // May not be very intuitive. Eg. space on reset button will not "press" reset
            event.preventDefault();
            if (!this.spaceIsPressed) {
                this.tap();
                this.spaceIsPressed = true;
            }
        }
    };
    MetronomeUi.prototype.handleKeyUp = function (event) {
        if (event.key === 'Enter') {
            this.enterIsPressed = false;
        }
        if (event.keyCode === KeyCodes.SPACE) {
            this.spaceIsPressed = false;
        }
    };
    MetronomeUi.prototype.setDisplayValue = function (value) {
        value = Math.round(value * 100) / 100;
        this.displayValue = value;
        this.inputDisplay.setValue(value);
        var valid = this.metronome.validateTempo(value).valid;
        if (valid) {
            this.setMetronomeTempo(value);
            this.setTempoInStorage(value);
        }
    };
    MetronomeUi.prototype.setMetronomeTempo = function (tempo) {
        this.metronome.setTempo(tempo);
    };
    MetronomeUi.prototype.getTempoFromStorage = function () {
        if (!hasLocalStorage)
            return defaultTempo;
        var item = localStorage.getItem('tempo');
        if (!item) {
            localStorage.setItem('tempo', defaultTempo.toString());
            return defaultTempo;
        }
        if (isNaN(item)) {
            localStorage.setItem('tempo', defaultTempo.toString());
            return defaultTempo;
        }
        return Number(item);
    };
    MetronomeUi.prototype.setTempoInStorage = function (tempo) {
        if (!hasLocalStorage)
            return;
        localStorage.setItem('tempo', tempo.toString());
    };
    return MetronomeUi;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MetronomeUi;

},{"./InputDisplay":1,"./Metronome":2,"./MetronomeAnimation":3,"./Tapper":5,"./WhilePressedBtn":6}],5:[function(require,module,exports){
"use strict";
/**
 * Tapper - a tempo tapper module. The tapper averages consecutive values before resetting after resetAfter milliseconds.
 */
var resetAfter = 5000; // ms
var Tapper = (function () {
    function Tapper(onReset) {
        this.onReset = onReset;
        this.previousTap = 0;
        this.averageInterval = 0;
        this.numValuesAveraged = 0;
        this.timerHandle = 0;
    }
    Tapper.prototype.tap = function () {
        var _this = this;
        clearTimeout(this.timerHandle);
        this.timerHandle = setTimeout(function () {
            _this.reset();
        }, resetAfter);
        if (!this.previousTap) {
            this.previousTap = new Date().getTime();
            return {
                averageTempo: 0,
                numValuesAveraged: 0
            };
        }
        var currentTime = new Date().getTime();
        var interval = currentTime - this.previousTap;
        this.previousTap = currentTime;
        this.numValuesAveraged++;
        // Recursive algorithm for linear averaging
        this.averageInterval = this.averageInterval + (1 / this.numValuesAveraged) * (interval - this.averageInterval);
        var bpm = 1000 * 60.0 / this.averageInterval;
        // Return value rounded to two decimals
        return {
            averageTempo: Math.round(bpm * 100) / 100,
            numValuesAveraged: this.numValuesAveraged
        };
    };
    Tapper.prototype.reset = function () {
        if (this.previousTap) {
            this.previousTap = 0;
            this.numValuesAveraged = 0;
            this.averageInterval = 0;
            this.onReset();
        }
    };
    return Tapper;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Tapper;

},{}],6:[function(require,module,exports){
"use strict";
/**
 * WhilePressedBtn. A button which repeatedly triggers an event while pressed.
 */
var MouseCodes;
(function (MouseCodes) {
    MouseCodes[MouseCodes["LEFT"] = 1] = "LEFT";
})(MouseCodes || (MouseCodes = {}));
;
var keyDownRepeatDelay = 500; // ms. Same as Chrome.
var keyDownRepeatInterval = 30; // ms. Same as Chrome.
var WhilePressedBtn = (function () {
    function WhilePressedBtn(btnElement, handlerFunction) {
        var _this = this;
        this.errorTimerId = 0;
        this.mouseIsPressed = false;
        this.mouseDownTimerHandle = 0;
        this.btn = btnElement;
        this.mouseDownHandlerFunction = handlerFunction;
        this.btn.addEventListener('mousedown', function (event) {
            if (event.which !== MouseCodes.LEFT)
                return;
            _this.mouseIsPressed = true;
            _this.mouseDownHandlerFunction();
            _this.mouseDownTimerHandle = setTimeout(function () { _this.mouseDownLoop(); }, keyDownRepeatDelay);
        });
        this.btn.addEventListener('touchstart', function (event) {
            event.preventDefault();
            _this.btn.focus(); // TODO: Check problem in chrome iPhone emulator where hover is not removed from previously focused element. Known as the sticky hover problem.
            _this.mouseIsPressed = true;
            _this.mouseDownHandlerFunction();
            _this.mouseDownTimerHandle = setTimeout(function () { _this.mouseDownLoop(); }, keyDownRepeatDelay);
        });
        // Add mouseup eventlistener to document in case the mouse is moved away from btn before it is released.
        document.addEventListener('mouseup', function (event) {
            if (event.which !== MouseCodes.LEFT)
                return;
            _this.mouseIsPressed = false;
            clearTimeout(_this.mouseDownTimerHandle);
        });
        // End of touch events
        this.btn.addEventListener('touchend', function (event) {
            _this.mouseIsPressed = false;
            clearTimeout(_this.mouseDownTimerHandle);
        });
        this.btn.addEventListener('touchcancel', function (event) {
            _this.mouseIsPressed = false;
            clearTimeout(_this.mouseDownTimerHandle);
        });
    }
    WhilePressedBtn.prototype.setTimedError = function (duration) {
        var _this = this;
        clearTimeout(this.errorTimerId);
        this.btn.classList.add('has-error');
        this.errorTimerId = setTimeout(function () {
            _this.btn.classList.remove('has-error');
        }, duration);
    };
    WhilePressedBtn.prototype.mouseDownLoop = function () {
        var _this = this;
        if (!this.mouseIsPressed) {
            return;
        }
        this.mouseDownHandlerFunction();
        this.mouseDownTimerHandle = setTimeout(function () { _this.mouseDownLoop(); }, keyDownRepeatInterval);
    };
    return WhilePressedBtn;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WhilePressedBtn;

},{}],7:[function(require,module,exports){
"use strict";
var MetronomeUi_1 = require('./MetronomeUi');
// Can use Document.querySelector() instead
var ui = new MetronomeUi_1.default(document.getElementById('playPauseBtn'), document.getElementById('tapBtn'), document.getElementById('plussBtn'), document.getElementById('minusBtn'), document.getElementById('resetBtn'), document.getElementById('inputDisplay'), document.getElementById('inputDisplayLabel'));

},{"./MetronomeUi":4}]},{},[7])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvSW5wdXREaXNwbGF5LnRzIiwic3JjL01ldHJvbm9tZS50cyIsInNyYy9NZXRyb25vbWVBbmltYXRpb24udHMiLCJzcmMvTWV0cm9ub21lVWkudHMiLCJzcmMvVGFwcGVyLnRzIiwic3JjL1doaWxlUHJlc3NlZEJ0bi50cyIsInNyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBOztHQUVHO0FBQ0gsSUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDLENBQUMsTUFBTTtBQUNuQyxJQUFLLEtBQWtDO0FBQXZDLFdBQUssS0FBSztJQUFHLDZCQUFFLENBQUE7SUFBRSxpQ0FBSSxDQUFBO0lBQUUsdUNBQU8sQ0FBQTtJQUFFLG1DQUFLLENBQUE7QUFBQyxDQUFDLEVBQWxDLEtBQUssS0FBTCxLQUFLLFFBQTZCO0FBRXZDO0lBT0ksc0JBQW9CLFlBQThCLEVBQVUsS0FBdUIsRUFDL0UsWUFBb0IsRUFDWixlQUF1QixFQUN2QixTQUErRCxFQUMvRCxlQUF3QztRQVh4RCxpQkE4SkM7UUF2SnVCLGlCQUFZLEdBQVosWUFBWSxDQUFrQjtRQUFVLFVBQUssR0FBTCxLQUFLLENBQWtCO1FBRXZFLG9CQUFlLEdBQWYsZUFBZSxDQUFRO1FBQ3ZCLGNBQVMsR0FBVCxTQUFTLENBQXNEO1FBQy9ELG9CQUFlLEdBQWYsZUFBZSxDQUF5QjtRQVA1QyxpQkFBWSxHQUFXLENBQUMsQ0FBQztRQUN6QixtQkFBYyxHQUFXLENBQUMsQ0FBQztRQVEvQixJQUFJLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQztRQUMxQixJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDbEQsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDO1FBRXRCLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxD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Q0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXBDLElBQUksQ0FBQyxZQUFZLEdBQUcsVUFBVSxDQUFDO1lBQzNCLEtBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMzQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDakIsQ0FBQztJQUVPLHVDQUFhLEdBQXJCO1FBQUEsaUJBU0M7UUFQRyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLE1BQU0sQ0FBQztRQUNYLENBQUM7UUFFRCxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUVoQyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsVUFBVSxDQUFDLGNBQVEsS0FBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFDbkcsQ0FBQztJQUNMLHNCQUFDO0FBQUQsQ0FwRUEsQUFvRUMsSUFBQTtBQXBFRDtpQ0FvRUMsQ0FBQTs7OztBQzVFRCw0QkFBd0IsZUFBZSxDQUFDLENBQUE7QUFFeEMsMkNBQTJDO0FBQzNDLElBQUksRUFBRSxHQUFHLElBQUkscUJBQVcsQ0FBbUIsUUFBUSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsRUFDNUQsUUFBUSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFDakMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDbkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDbkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDbkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsRUFDdkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBJbnB1dERpc3BsYXlcbiAqL1xuY29uc3QgaW5wdXRSZWFjdERlbGF5ID0gNTAwOyAvLyBtcy5cbmVudW0gU3RhdGUgeyBPSywgSU5GTywgV0FSTklORywgRVJST1IgfVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJbnB1dERpc3BsYXkge1xuXG4gICAgcHJpdmF0ZSBzdGF0ZTogU3RhdGU7XG4gICAgcHJpdmF0ZSB2YWx1ZTogbnVtYmVyO1xuICAgIHByaXZhdGUgaW5wdXRUaW1lcklkOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbWVzc2FnZVRpbWVySWQ6IG51bWJlciA9IDA7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIGlucHV0RGlzcGxheTogSFRNTElucHV0RWxlbWVudCwgcHJpdmF0ZSBsYWJlbDogSFRNTExhYmVsRWxlbWVudCxcbiAgICAgICAgaW5pdGlhbFZhbHVlOiBudW1iZXIsXG4gICAgICAgIHByaXZhdGUgZGVmYXVsdEhlbHBUZXh0OiBzdHJpbmcsXG4gICAgICAgIHByaXZhdGUgdmFsaWRhdG9yOiAodmFsdWU6IG51bWJlcikgPT4geyB2YWxpZDogYm9vbGVhbiwgZXJyb3I6IHN0cmluZyB9LFxuICAgICAgICBwcml2YXRlIG9uTmV3VmFsaWRWYWx1ZTogKHZhbHVlOiBudW1iZXIpID0+IHZvaWQpIHtcblxuICAgICAgICB0aGlzLnZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IGluaXRpYWxWYWx1ZS50b1N0cmluZygpO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuT0s7XG5cbiAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZShpbml0aWFsVmFsdWUudG9TdHJpbmcoKSk7XG5cbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlSW5wdXRFdmVudChldmVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldFZhbHVlKHZhbHVlOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy52YWx1ZSA9IE1hdGgucm91bmQodmFsdWUgKiAxMDApIC8gMTAwO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IHRoaXMudmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZSh2YWx1ZS50b1N0cmluZygpKTtcbiAgICB9XG5cbiAgICBzZXRUaW1lZEVycm9yKG1lc3NhZ2U6IHN0cmluZywgZHVyYXRpb246IG51bWJlcikge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tZXNzYWdlVGltZXJJZCk7XG5cbiAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5PSyk7XG4gICAgICAgIHRoaXMuc2V0TGFiZWxNZXNzYWdlKG1lc3NhZ2UpO1xuXG4gICAgICAgIHRoaXMubWVzc2FnZVRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIC8vIEdvIGJhY2sgdG8gc3RhdGUgY29ycmVzcG9uZGluZyB0byBjdXJyZW50IGRpc3BsYXkgdmFsdWVcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlTmV3VmFsdWUodGhpcy5pbnB1dERpc3BsYXkudmFsdWUpO1xuICAgICAgICB9LCBkdXJhdGlvbik7XG4gICAgfVxuXG4gICAgc2V0VGltZWRJbmZvKG1lc3NhZ2U6IHN0cmluZywgZHVyYXRpb246IG51bWJlcikge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tZXNzYWdlVGltZXJJZCk7XG5cbiAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5JTkZPKTtcbiAgICAgICAgdGhpcy5zZXRMYWJlbE1lc3NhZ2UobWVzc2FnZSk7XG5cbiAgICAgICAgdGhpcy5tZXNzYWdlVGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgLy8gR28gYmFjayB0byBzdGF0ZSBjb3JyZXNwb25kaW5nIHRvIGN1cnJlbnQgZGlzcGxheSB2YWx1ZVxuICAgICAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZSh0aGlzLmlucHV0RGlzcGxheS52YWx1ZSk7XG4gICAgICAgIH0sIGR1cmF0aW9uKTtcbiAgICB9XG5cbiAgICBibGlua0luZm8obWVzc2FnZTogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuSU5GTyk7XG4gICAgICAgIHRoaXMuc2V0TGFiZWxNZXNzYWdlKG1lc3NhZ2UpO1xuXG4gICAgICAgIGxldCBibGluazFPZmYgPSAxMDA7XG4gICAgICAgIGxldCBibGluazJPbiA9IDEwMDtcbiAgICAgICAgbGV0IG1lc3NhZ2VUaW1lb3V0ID0gMTAwMDtcblxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuT0spO1xuICAgICAgICB9LCBibGluazFPZmYpO1xuXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5JTkZPKTtcbiAgICAgICAgfSwgYmxpbmsxT2ZmICsgYmxpbmsyT24pO1xuXG4gICAgICAgIHRoaXMubWVzc2FnZVRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIC8vIEdvIGJhY2sgdG8gc3RhdGUgY29ycmVzcG9uZGluZyB0byBjdXJyZW50IGRpc3BsYXkgdmFsdWVcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlTmV3VmFsdWUodGhpcy5pbnB1dERpc3BsYXkudmFsdWUpO1xuICAgICAgICB9LCBibGluazFPZmYgKyBibGluazJPbiArIG1lc3NhZ2VUaW1lb3V0KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZU5ld1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHZhbHVlLnRvU3RyaW5nKCkubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgdGhpcy5zZXRMYWJlbE1lc3NhZ2UoJ1RoZSB2YWx1ZSBtdXN0IGhhdmUgYXQgbGVhc3QgdHdvIGRpZ2l0cy4nKTtcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuV0FSTklORyk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOYU4oTnVtYmVyKHZhbHVlKSkpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0TGFiZWxNZXNzYWdlKCdUaGUgZW50ZXJlZCB2YWx1ZSBpcyBub3QgYSBudW1iZXIuIFBsZWFzZSBlbnRlciBhIG51bWJlcicpO1xuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5XQVJOSU5HKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB2YWx1ZUFzTnVtYmVyID0gTnVtYmVyKHZhbHVlKTtcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLnZhbGlkYXRvcih2YWx1ZUFzTnVtYmVyKTtcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICB0aGlzLnNldExhYmVsTWVzc2FnZShlcnJvcik7XG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLkVSUk9SKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuT0spO1xuICAgICAgICB0aGlzLnNldExhYmVsTWVzc2FnZSh0aGlzLmRlZmF1bHRIZWxwVGV4dCk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVJbnB1dEV2ZW50KGV2ZW50OiBFdmVudCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5pbnB1dFRpbWVySWQpO1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tZXNzYWdlVGltZXJJZCk7XG5cbiAgICAgICAgdGhpcy5pbnB1dFRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGxldCB2YWx1ZSA9IHRoaXMuaW5wdXREaXNwbGF5LnZhbHVlO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuaGFuZGxlTmV3VmFsdWUodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm9uTmV3VmFsaWRWYWx1ZShOdW1iZXIodmFsdWUpKTtcblxuICAgICAgICB9LCBpbnB1dFJlYWN0RGVsYXkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2V0U3RhdGUobmV4dFN0YXRlOiBTdGF0ZSkge1xuICAgICAgICAvLyBTZXQgQ1NTIGNsYXNzZXMgY29ycmVzcG9uZGluZyB0byB0aGUgZWxlbWVudCBzdGF0ZVxuICAgICAgICBsZXQgY3VycmVudFN0YXRlQ2xhc3MgPSB0aGlzLmdldFN0YXRlQ2xhc3ModGhpcy5zdGF0ZSk7XG4gICAgICAgIGxldCBuZXh0U3RhdGVDbGFzcyA9IHRoaXMuZ2V0U3RhdGVDbGFzcyhuZXh0U3RhdGUpO1xuXG4gICAgICAgIGlmIChjdXJyZW50U3RhdGVDbGFzcyAhPT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LmNsYXNzTGlzdC5yZW1vdmUoY3VycmVudFN0YXRlQ2xhc3MpO1xuICAgICAgICAgICAgdGhpcy5sYWJlbC5jbGFzc0xpc3QucmVtb3ZlKGN1cnJlbnRTdGF0ZUNsYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXh0U3RhdGVDbGFzcyAhPT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LmNsYXNzTGlzdC5hZGQobmV4dFN0YXRlQ2xhc3MpO1xuICAgICAgICAgICAgdGhpcy5sYWJlbC5jbGFzc0xpc3QuYWRkKG5leHRTdGF0ZUNsYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXh0U3RhdGU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRTdGF0ZUNsYXNzKHN0YXRlOiBTdGF0ZSk6IHN0cmluZyB7XG4gICAgICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgICAgICAgIGNhc2UgU3RhdGUuT0s6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdvayc7XG4gICAgICAgICAgICBjYXNlIFN0YXRlLklORk86XG4gICAgICAgICAgICAgICAgcmV0dXJuICdoYXMtaW5mbyc7XG4gICAgICAgICAgICBjYXNlIFN0YXRlLldBUk5JTkc6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdoYXMtd2FybmluZyc7XG4gICAgICAgICAgICBjYXNlIFN0YXRlLkVSUk9SOlxuICAgICAgICAgICAgICAgIHJldHVybiAnaGFzLWVycm9yJztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1RyaWVkIHRvIGdldCBjbGFzcyBjb3JyZXNwb25kaW5nIHRvIG5vbi1leGlzdGluZyBzdGF0ZTonLCBzdGF0ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRMYWJlbE1lc3NhZ2UobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIHRoaXMubGFiZWwudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIH1cbn0iLCIvKipcbiAqIE1ldHJvbm9tZVxuICovXG5jb25zdCBtaW5UZW1wbyA9IDQwOyAvLyBCUE1cbmNvbnN0IG1heFRlbXBvID0gMjUwOyAvLyBCUE1cbmNvbnN0IG51bUJlYXRzUGVyQmFyID0gNDtcbmNvbnN0IG1heE5vdGVRdWVMZW5ndGggPSA1O1xuXG5jb25zdCBub3RlTGVuZ3RoID0gMC4wNTsgLy8gU2Vjb25kc1xuY29uc3Qgc2NoZWR1bGVJbnRlcnZhbCA9IDI1LjA7IC8vIG1zLiBIb3cgb2Z0ZW4gdGhlIHNjaGVkdWxpbmcgaXMgY2FsbGVkLlxuY29uc3Qgc2NoZWR1bGVBaGVhZFRpbWUgPSAwLjE7IC8vIFNlY29uZHNcblxuZW51bSBQaXRjaCB7IEhJR0gsIE1JRCwgTE9XIH07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1ldHJvbm9tZSB7XG5cbiAgICBwcml2YXRlIHRlbXBvOiBudW1iZXI7IC8vIGJlYXRzIHBlciBtaW51dGUgKEJQTSlcbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgYXVkaW9Db250ZXh0OiBBdWRpb0NvbnRleHQ7XG4gICAgcHJpdmF0ZSBhdWRpb0xvb3BUaW1lckhhbmRsZTogbnVtYmVyO1xuXG4gICAgcHJpdmF0ZSBjYW5TdXNwZW5kOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICBwcml2YXRlIHVzZXNXb3JrZXI6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIGludGVydmFsV29ya2VyOiBXb3JrZXI7XG5cbiAgICBwcml2YXRlIHN1c3BlbmRUaW1lcklkOiBudW1iZXIgPSAwO1xuXG4gICAgcHJpdmF0ZSBuZXh0Tm90ZVRpbWU6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBuZXh0NHRoTm90ZTogbnVtYmVyID0gMDtcblxuICAgIHByaXZhdGUgbm90ZVF1ZTogeyBwcm9ncmVzczogbnVtYmVyLCB0aW1lOiBudW1iZXIsIHRlbXBvOiBudW1iZXIgfVtdO1xuXG4gICAgY29uc3RydWN0b3IodGVtcG86IG51bWJlcikge1xuICAgICAgICAvLyBTYWZhcmkgbmVlZHMgcHJlZml4IHdlYmtpdEF1ZGlvQ29udGV4dFxuICAgICAgICB0aGlzLmF1ZGlvQ29udGV4dCA9IG5ldyAoKDxhbnk+d2luZG93KS5BdWRpb0NvbnRleHQgfHwgKDxhbnk+d2luZG93KS53ZWJraXRBdWRpb0NvbnRleHQpKCk7XG4gICAgICAgIHRoaXMuc2V0VGVtcG8odGVtcG8pO1xuXG4gICAgICAgIC8vIC0tU3VzcGVuZC9yZXN1bWUtLVxuICAgICAgICB0aGlzLmNhblN1c3BlbmQgPSAoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiAoPGFueT50aGlzLmF1ZGlvQ29udGV4dCkucmVzdW1lICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5zdXNwZW5kICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuY2FuU3VzcGVuZCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3VzcGVuZFRpbWVySWQpO1xuICAgICAgICAgICAgKDxhbnk+dGhpcy5hdWRpb0NvbnRleHQpLnN1c3BlbmQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tV2ViIHdvcmtlci0tXG4gICAgICAgIHRoaXMudXNlc1dvcmtlciA9ICg8YW55PndpbmRvdykuV29ya2VyID8gdHJ1ZSA6IGZhbHNlO1xuXG4gICAgICAgIGlmICh0aGlzLnVzZXNXb3JrZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJ2YWxXb3JrZXIgPSBuZXcgV29ya2VyKCdidWlsZC9JbnRlcnZhbFdvcmtlci5qcycpO1xuXG4gICAgICAgICAgICB0aGlzLmludGVydmFsV29ya2VyLm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChldmVudC5kYXRhID09PSAndGljaycpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zY2hlZHVsZXIoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRGF0YSBmcm9tIGludGVydmFsV29ya2VyOiAnLCBldmVudC5kYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcGxheSgpOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLmlzUGxheWluZykge1xuICAgICAgICAgICAgaWYgKHRoaXMuY2FuU3VzcGVuZCkgKDxhbnk+dGhpcy5hdWRpb0NvbnRleHQpLnJlc3VtZSgpO1xuICAgICAgICAgICAgdGhpcy5pc1BsYXlpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5hdWRpb0xvb3AoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBhdXNlKCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcEF1ZGlvTG9vcCgpO1xuICAgICAgICAgICAgdGhpcy5pc1BsYXlpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuY2FuU3VzcGVuZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3VzcGVuZFRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgKDxhbnk+dGhpcy5hdWRpb0NvbnRleHQpLnN1c3BlbmQoKTtcbiAgICAgICAgICAgICAgICB9LCBzY2hlZHVsZUFoZWFkVGltZSAqIDEwMDAgKiAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRvZ2dsZSgpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5pc1BsYXlpbmc7XG4gICAgfVxuXG4gICAgdmFsaWRhdGVUZW1wbyh0ZW1wbzogbnVtYmVyKTogeyB2YWxpZDogYm9vbGVhbiwgZXJyb3I6IHN0cmluZyB9IHtcbiAgICAgICAgaWYgKGlzTmFOKHRlbXBvKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcjogJ1lvdSBtdXN0IGVudGVyIGEgbnVtYmVyJyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGVtcG8gPSBOdW1iZXIodGVtcG8pO1xuXG4gICAgICAgIGlmICh0ZW1wbyA8IG1pblRlbXBvKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UsIGVycm9yOiAnTWluaW11bSB0ZW1wbyBpcyAnICsgbWluVGVtcG8gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0ZW1wbyA+IG1heFRlbXBvKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UsIGVycm9yOiAnTWF4IHRlbXBvIGlzICcgKyBtYXhUZW1wbyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IHRydWUsIGVycm9yOiAnJyB9O1xuICAgIH1cblxuICAgIHNldFRlbXBvKHRlbXBvOiBudW1iZXIpOiB2b2lkIHtcblxuICAgICAgICBpZiAodGhpcy50ZW1wbyA9PT0gdGVtcG8pIHtcbiAgICAgICAgICAgIC8vIERvIG5vdGhpbmcgaWYgaXQgaXMgdGhlIHNhbWVcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB7dmFsaWR9ID0gdGhpcy52YWxpZGF0ZVRlbXBvKHRlbXBvKTtcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRlbXBvID0gTnVtYmVyKHRlbXBvKTtcbiAgICB9XG5cbiAgICBnZXRNaW5UZW1wbygpIHtcbiAgICAgICAgcmV0dXJuIG1pblRlbXBvO1xuICAgIH1cblxuICAgIGdldE1heFRlbXBvKCkge1xuICAgICAgICByZXR1cm4gbWF4VGVtcG87XG4gICAgfVxuXG4gICAgZ2V0Q3VycmVudFRpbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICB9XG5cbiAgICByZWFkTm90ZVF1ZSgpOiB7IHByb2dyZXNzOiBudW1iZXIsIHRpbWU6IG51bWJlciwgdGVtcG86IG51bWJlciB9IHtcbiAgICAgICAgcmV0dXJuIHRoaXMubm90ZVF1ZS5wb3AoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGZsdXNoTm90ZVF1ZSgpIHtcbiAgICAgICAgd2hpbGUgKHRoaXMubm90ZVF1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLm5vdGVRdWUucG9wKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHN0b3BBdWRpb0xvb3AoKSB7XG4gICAgICAgIGlmICh0aGlzLnVzZXNXb3JrZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJ2YWxXb3JrZXIucG9zdE1lc3NhZ2UoeyAnaW50ZXJ2YWwnOiAwIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmF1ZGlvTG9vcFRpbWVySGFuZGxlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZsdXNoTm90ZVF1ZSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXVkaW9Mb29wKCkge1xuXG4gICAgICAgIHRoaXMubmV4dE5vdGVUaW1lID0gdGhpcy5hdWRpb0NvbnRleHQuY3VycmVudFRpbWUgKyAwLjE7XG4gICAgICAgIHRoaXMubmV4dDR0aE5vdGUgPSAwO1xuXG4gICAgICAgIHRoaXMubm90ZVF1ZSA9IFtdO1xuXG4gICAgICAgIHRoaXMubm90ZVF1ZS5wdXNoKHtcbiAgICAgICAgICAgIHRpbWU6IHRoaXMubmV4dE5vdGVUaW1lLFxuICAgICAgICAgICAgdGVtcG86IHRoaXMudGVtcG8sXG4gICAgICAgICAgICBwcm9ncmVzczogdGhpcy5uZXh0NHRoTm90ZSAvIDQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICh0aGlzLnVzZXNXb3JrZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJ2YWxXb3JrZXIucG9zdE1lc3NhZ2UoeyAnaW50ZXJ2YWwnOiBzY2hlZHVsZUludGVydmFsIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5hdWRpb0xvb3BUaW1lckhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNQbGF5aW5nKSByZXR1cm47XG4gICAgICAgICAgICAgICAgdGhpcy5zY2hlZHVsZXIoKTtcbiAgICAgICAgICAgIH0sIHNjaGVkdWxlSW50ZXJ2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzY2hlZHVsZXIoKSB7XG4gICAgICAgIHdoaWxlICh0aGlzLm5leHROb3RlVGltZSA8IHRoaXMuYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lICsgc2NoZWR1bGVBaGVhZFRpbWUpIHtcbiAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVUb25lKHRoaXMubmV4dE5vdGVUaW1lLCB0aGlzLm5leHQ0dGhOb3RlICUgbnVtQmVhdHNQZXJCYXIgPyBQaXRjaC5NSUQgOiBQaXRjaC5ISUdIKTtcbiAgICAgICAgICAgIGxldCBzZWNvbmRzUGVyQmVhdCA9IDYwLjAgLyB0aGlzLnRlbXBvO1xuICAgICAgICAgICAgdGhpcy5uZXh0Tm90ZVRpbWUgKz0gc2Vjb25kc1BlckJlYXQ7XG4gICAgICAgICAgICB0aGlzLm5leHQ0dGhOb3RlID0gKHRoaXMubmV4dDR0aE5vdGUgKyAxKSAlIG51bUJlYXRzUGVyQmFyO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5ub3RlUXVlLmxlbmd0aCA+IG1heE5vdGVRdWVMZW5ndGgpIHRoaXMubm90ZVF1ZS5wb3AoKTtcblxuICAgICAgICAgICAgdGhpcy5ub3RlUXVlLnB1c2goe1xuICAgICAgICAgICAgICAgIHRpbWU6IHRoaXMubmV4dE5vdGVUaW1lLFxuICAgICAgICAgICAgICAgIHRlbXBvOiB0aGlzLnRlbXBvLFxuICAgICAgICAgICAgICAgIHByb2dyZXNzOiAodGhpcy5uZXh0NHRoTm90ZSApIC8gNCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzY2hlZHVsZVRvbmUoc3RhcnRUaW1lOiBudW1iZXIsIHBpdGNoOiBQaXRjaCk6IHZvaWQge1xuXG4gICAgICAgIGxldCBvc2MgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gICAgICAgIG9zYy5jb25uZWN0KHRoaXMuYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgICAgICBsZXQgZnJlcXVlbmN5ID0gMDtcblxuICAgICAgICBzd2l0Y2ggKHBpdGNoKSB7XG4gICAgICAgICAgICBjYXNlIFBpdGNoLkhJR0g6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gODgwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5NSUQ6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gNDQwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5MT1c6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gMjIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBwaXRjaCcpO1xuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDIyMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIG9zYy5mcmVxdWVuY3kudmFsdWUgPSBmcmVxdWVuY3k7XG4gICAgICAgIG9zYy5zdGFydChzdGFydFRpbWUpO1xuICAgICAgICBvc2Muc3RvcChzdGFydFRpbWUgKyBub3RlTGVuZ3RoKTtcbiAgICB9XG59XG5cbiIsIi8qKlxuICogTWV0cm9ub21lQW5pbWF0aW9uXG4gKi9cblxuLypcbiAgICBEZWZhdWx0IGNvb3JkaW5hdGUgZnJhbWVmb3IgY2FudmFzOlxuICAgIFxuICAgICgwLDApLS0tLS0+IHhcbiAgICB8XG4gICAgfFxuICAgIHlcblxuICAgIFdoZXJlIHRoZSBvcmlnaW4gaXMgdG8gdGhlIHRvcCBsZWZ0IG9mIHRoZSBjYW52YXMuXG5cbiAgICBUaGUgYW5pbWF0aW9uIHVzZXMgYSB0cmFuc2xhdGVkIGNvb3JkaW5hdGUgZnJhbWUgd2hlcmUgdGhlIG9yaWdpbiBpcyBtb3ZlZCBkb3duIHRvIHRoZSByaWdodC5cbiAgICBUaGUgeS1heGlzIHdyYXBzIGFyb3VuZCBzdWNoIHRoYXQgdGhlIGxhc3QgNy84IG9mIGEgYmFyIGFyZSBhbmltYXRlZCBhcyBhIHJpZ2h0LW1vdmVtZW50IGZyb20gdGhlIGxlZnQgZWRnZSBvZiB0aGUgY2FudmFzLFxuICAgIHdoaWxlIHRoZSBmaXJzdCA3LzggYXJlIGFuaW1hdGVkIGFzIGEgcmlnaHQgbW92ZW1lbnQgZnJvbSB0aGUgdHJhbnNsYXRlZCBvcmlnaW4uXG4gKi9cblxuY29uc3Qgc2lnbWEgPSAwLjAyNztcbmNvbnN0IHJhZGl1cyA9IDEwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWVBbmltYXRpb24ge1xuXG4gICAgcHJpdmF0ZSB3aWR0aDogbnVtYmVyO1xuICAgIHByaXZhdGUgaGVpZ2h0OiBudW1iZXI7XG5cbiAgICBwcml2YXRlIGNvbnRhaW5lcjogSFRNTERpdkVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBncmlkQ2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudDtcbiAgICBwcml2YXRlIGJhbGxDYW52YXM6IEhUTUxDYW52YXNFbGVtZW50O1xuXG4gICAgcHJpdmF0ZSBncmlkQ29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xuICAgIHByaXZhdGUgYmFsbENvbnRleHQ6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRDtcblxuICAgIHByaXZhdGUgYW5pbWF0aW9uRnJhbWVJZDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIHJ1bm5pbmcgPSBmYWxzZTtcblxuICAgIHByaXZhdGUgbmV4dE5vdGU6IHsgcHJvZ3Jlc3M6IG51bWJlciwgdGltZTogbnVtYmVyLCB0ZW1wbzogbnVtYmVyIH07XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIGdldEN1cnJlbnRUaW1lOiAoKSA9PiBudW1iZXIsIHByaXZhdGUgcmVhZE5vdGVRdWU6ICgpID0+IHsgcHJvZ3Jlc3M6IG51bWJlciwgdGltZTogbnVtYmVyLCB0ZW1wbzogbnVtYmVyIH0pIHtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSA8SFRNTERpdkVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FuaW1hdGlvbkNvbnRhaW5lcicpO1xuICAgICAgICB0aGlzLmdyaWRDYW52YXMgPSA8SFRNTENhbnZhc0VsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JvdHRvbS1jYW52YXMnKTtcbiAgICAgICAgdGhpcy5iYWxsQ2FudmFzID0gPEhUTUxDYW52YXNFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b3AtY2FudmFzJyk7XG5cbiAgICAgICAgdGhpcy53aWR0aCA9IHRoaXMuY29udGFpbmVyLmNsaWVudFdpZHRoICogMjtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLmNvbnRhaW5lci5jbGllbnRIZWlnaHQgKiAyO1xuXG4gICAgICAgIHRoaXMuc2V0U2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICAgICAgdGhpcy5ncmlkQ29udGV4dCA9IHRoaXMuZ3JpZENhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICB0aGlzLmJhbGxDb250ZXh0ID0gdGhpcy5iYWxsQ2FudmFzLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICAgICAgdGhpcy5kcmF3UGF0aCgpO1xuICAgIH1cblxuICAgIHN0YXJ0KCkge1xuICAgICAgICB0aGlzLnVwZGF0ZU5vdGVJbmZvKCk7XG4gICAgICAgIHRoaXMucnVubmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuYW5pbWF0aW9uRnJhbWVJZCA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4geyB0aGlzLmRyYXdCYWxsKCk7IH0pO1xuICAgIH1cblxuICAgIHN0b3AoKSB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUodGhpcy5hbmltYXRpb25GcmFtZUlkKTtcbiAgICB9XG5cbiAgICB0b2dnbGUoKSB7XG4gICAgICAgIGlmICh0aGlzLnJ1bm5pbmcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zdGFydCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRTaXplKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuZ3JpZENhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgICAgICB0aGlzLmdyaWRDYW52YXMuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICB0aGlzLmJhbGxDYW52YXMud2lkdGggPSB3aWR0aDtcbiAgICAgICAgdGhpcy5iYWxsQ2FudmFzLmhlaWdodCA9IGhlaWdodDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHVwZGF0ZU5vdGVJbmZvKCkge1xuICAgICAgICBsZXQgZGF0YSA9IHRoaXMucmVhZE5vdGVRdWUoKTtcbiAgICAgICAgaWYgKCFkYXRhKSByZXR1cm47XG4gICAgICAgIHRoaXMubmV4dE5vdGUgPSBkYXRhO1xuICAgIH1cblxuICAgIHByaXZhdGUgdHJhbnNmb3JtVG9Ob3RlRnJhbWUoY29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEKSB7XG4gICAgICAgIGNvbnRleHQudHJhbnNsYXRlKHRoaXMud2lkdGggLyA4LCB0aGlzLmhlaWdodCAtIHJhZGl1cyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBkcmF3QmFsbCgpIHtcbiAgICAgICAgbGV0IGN0eCA9IHRoaXMuYmFsbENvbnRleHQ7XG5cbiAgICAgICAgY3R4LmNsZWFyUmVjdCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICAgICAgY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9ICdyZ2JhKDUxLDg2LDU2LDAuOSknO1xuICAgICAgICBjdHguZmlsbFN0eWxlID0gJ3JnYmEoNTEsODYsNTYsMC41KSc7XG5cbiAgICAgICAgY3R4LnNhdmUoKTtcblxuICAgICAgICBsZXQgYmFyUG9zaXRpb24gPSB0aGlzLmdldEJhclBvc2l0aW9uKCk7XG5cbiAgICAgICAgdGhpcy50cmFuc2Zvcm1Ub05vdGVGcmFtZShjdHgpO1xuXG4gICAgICAgIC8vIFRyYW5zbGF0ZSB0byBkZXNpcmVkIHBvc2l0aW9uXG4gICAgICAgIGN0eC50cmFuc2xhdGUodGhpcy5nZXRYb2Zmc2V0KGJhclBvc2l0aW9uKSwgdGhpcy5nZXRZb2Zmc2V0KGJhclBvc2l0aW9uKSk7XG5cbiAgICAgICAgLy8gQWRkIGNpcmNsZSBwYXRoIGF0IHRoZSBwbGFjZSB3ZSd2ZSB0cmFuc2xhdGVkIHRvXG4gICAgICAgIHRoaXMuY2lyY2xlKGN0eCwgcmFkaXVzKTtcblxuICAgICAgICAvLyBEbyBzdHJva2VcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcbiAgICAgICAgY3R4LnN0cm9rZSgpO1xuICAgICAgICBjdHguZmlsbCgpO1xuXG4gICAgICAgIHRoaXMuYW5pbWF0aW9uRnJhbWVJZCA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4geyB0aGlzLmRyYXdCYWxsKCk7IH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgZHJhd1BhdGgoKSB7XG4gICAgICAgIGxldCBjdHggPSB0aGlzLmdyaWRDb250ZXh0O1xuXG4gICAgICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXG4gICAgICAgIGN0eC5saW5lV2lkdGggPSAxO1xuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSAncmdiKDEwMywxNzcsMTA0KSc7XG4gICAgICAgIGN0eC5zYXZlKCk7XG5cbiAgICAgICAgdGhpcy50cmFuc2Zvcm1Ub05vdGVGcmFtZShjdHgpO1xuXG4gICAgICAgIGxldCBwcmVjaXNpb24gPSAwLjAwMTtcblxuICAgICAgICAvLyBEcmF3IHRoZSBjdXJ2ZSB0byB0aGUgcmlnaHQgaW4gdGhlIG5vdGUgZnJhbVxuICAgICAgICBmb3IgKGxldCBiYXJQb3NpdGlvbiA9IDA7IGJhclBvc2l0aW9uIDwgNyAvIDg7IGJhclBvc2l0aW9uICs9IHByZWNpc2lvbikge1xuICAgICAgICAgICAgY3R4LmxpbmVUbyh0aGlzLmdldFhvZmZzZXQoYmFyUG9zaXRpb24pLCB0aGlzLmdldFlvZmZzZXQoYmFyUG9zaXRpb24pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1vdmUgdG8gdGhlIGxlZnQgc2lkZSBvZiB0aGUgY2FudmFzXG4gICAgICAgIGN0eC5tb3ZlVG8odGhpcy5nZXRYb2Zmc2V0KDcgLyA4KSwgdGhpcy5nZXRZb2Zmc2V0KDcgLyA4KSk7XG5cbiAgICAgICAgLy8gRHJhdyB0aGUgY3VydmUgdG8gdGhlIGxlZnQgaW4gdGhlIG5vdGUgZnJhbVxuICAgICAgICBmb3IgKGxldCBiYXJQb3NpdGlvbiA9IDcgLyA4OyBiYXJQb3NpdGlvbiA8IDE7IGJhclBvc2l0aW9uICs9IHByZWNpc2lvbikge1xuICAgICAgICAgICAgY3R4LmxpbmVUbyh0aGlzLmdldFhvZmZzZXQoYmFyUG9zaXRpb24pLCB0aGlzLmdldFlvZmZzZXQoYmFyUG9zaXRpb24pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGN0eC5yZXN0b3JlKCk7XG4gICAgICAgIGN0eC5zdHJva2UoKTtcbiAgICB9XG5cbiAgICAvLyBSZXR1cm5zIHBlcmNlbnRhZ2Ugb2YgYSBiYXIgY29tcGxldGVkLiBFZy4gYXQgZXhhY3RseSB0d28gYmVhdHMgaXQgd2lsbCBiZSAwLjUuIFxuICAgIHByaXZhdGUgZ2V0QmFyUG9zaXRpb24oKTogbnVtYmVyIHtcbiAgICAgICAgdGhpcy51cGRhdGVOb3RlSW5mbygpO1xuXG4gICAgICAgIGxldCBzZWNvbmRzUGVyQmVhdCA9IDYwLjAgLyB0aGlzLm5leHROb3RlLnRlbXBvO1xuICAgICAgICBsZXQgZXhwZWN0ZWRQb3NpdGlvbiA9IHRoaXMubmV4dE5vdGUucHJvZ3Jlc3MgLSAwLjI1ICogKHRoaXMubmV4dE5vdGUudGltZSAtIHRoaXMuZ2V0Q3VycmVudFRpbWUoKSkgLyBzZWNvbmRzUGVyQmVhdDtcblxuICAgICAgICBpZiAoZXhwZWN0ZWRQb3NpdGlvbiA8IDApIHtcbiAgICAgICAgICAgIGV4cGVjdGVkUG9zaXRpb24gPSAoZXhwZWN0ZWRQb3NpdGlvbiAlIDEpICsgMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHBlY3RlZFBvc2l0aW9uO1xuICAgIH1cblxuICAgIC8vIEhvdyBtdWNoIHggc2hvdWxkIGJlIG9mZnNldCBmcm9tIHRoZSBvcmlnaW4gaW4gdGhlIG5vdGUgY29vcmRpbmF0ZSBmcmFtZSAtIGltcGxlbWVudHMgdGhlIHdyYXBwaW5nIGF0IDcvOFxuICAgIHByaXZhdGUgZ2V0WG9mZnNldChiYXJQb3NpdGlvbjogbnVtYmVyKTogbnVtYmVyIHtcbiAgICAgICAgaWYgKGJhclBvc2l0aW9uIDwgNyAvIDgpIHtcbiAgICAgICAgICAgIHJldHVybiBiYXJQb3NpdGlvbiAqIHRoaXMud2lkdGg7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gKC0gMSAvIDggKyAoYmFyUG9zaXRpb24gLSA3IC8gOCkpICogdGhpcy53aWR0aDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhvdyBtdWNoIHkgc2hvdWxkIGJlIG9mZnNldCBmcm9tIHRoZSBvcmlnaW4gaW4gdGhlIG5vdGUgY29vcmRpbmF0ZSBmcmFtZVxuICAgIHByaXZhdGUgZ2V0WW9mZnNldChiYXJQb3NpdGlvbjogbnVtYmVyKTogbnVtYmVyIHtcblxuICAgICAgICBsZXQgZGlzdGFuY2VUb09yaWdpbiA9IChiYXJQb3NpdGlvbiA+IDAuNSkgPyAxIC0gYmFyUG9zaXRpb24gOiBiYXJQb3NpdGlvbjtcblxuICAgICAgICAvLyBHYXVzc2lhbiBmdW5jdGlvbnMgdG8gZ2V0IHBlYWtzIGF0IHRoZSBiZWF0c1xuICAgICAgICBsZXQgYW1wbGl0dWRlID0gMiAqIE1hdGguZXhwKC0gMC41ICogTWF0aC5wb3coZGlzdGFuY2VUb09yaWdpbiAvIHNpZ21hLCAyKSk7XG4gICAgICAgIGFtcGxpdHVkZSArPSBNYXRoLmV4cCgtIDAuNSAqIE1hdGgucG93KChiYXJQb3NpdGlvbiAtIDAuMjUpIC8gc2lnbWEsIDIpKTtcbiAgICAgICAgYW1wbGl0dWRlICs9IE1hdGguZXhwKC0gMC41ICogTWF0aC5wb3coKGJhclBvc2l0aW9uIC0gMC41MCkgLyBzaWdtYSwgMikpO1xuICAgICAgICBhbXBsaXR1ZGUgKz0gTWF0aC5leHAoLSAwLjUgKiBNYXRoLnBvdygoYmFyUG9zaXRpb24gLSAwLjc1KSAvIHNpZ21hLCAyKSk7XG5cbiAgICAgICAgbGV0IHNjYWxpbmcgPSAtIHRoaXMuaGVpZ2h0ICogMSAvIDIgKiAwLjc7XG4gICAgICAgIHJldHVybiBzY2FsaW5nICogYW1wbGl0dWRlO1xuICAgIH1cblxuICAgIHByaXZhdGUgY2lyY2xlKGNvbnRleHQ6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRCwgcmFkaXVzOiBudW1iZXIpIHtcbiAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTsgLy8gTm90ZSB0byBzZWxmOiBBZGRpbmcgbW92ZVRvIGhlcmUgY3JlYXRlcyBhIGxpbmUgZnJvbSBjZW50ZXIgb2YgY2lyY2xlIG9uIHN0cm9rZS5cbiAgICAgICAgY29udGV4dC5hcmMoMCwgMCwgcmFkaXVzLCAwLCAyICogTWF0aC5QSSk7XG4gICAgfVxufSIsIi8qKlxuICogTWV0cm9ub21lVWlcbiAqL1xuaW1wb3J0IE1ldHJvbm9tZSBmcm9tICcuL01ldHJvbm9tZSc7XG5pbXBvcnQgVGFwcGVyIGZyb20gJy4vVGFwcGVyJztcbmltcG9ydCBXaGlsZVByZXNzZWRCdG4gZnJvbSAnLi9XaGlsZVByZXNzZWRCdG4nO1xuaW1wb3J0IElucHV0RGlzcGxheSBmcm9tICcuL0lucHV0RGlzcGxheSc7XG5pbXBvcnQgTWV0cm9ub21lQW5pbWF0aW9uIGZyb20gJy4vTWV0cm9ub21lQW5pbWF0aW9uJztcblxuY29uc3QgZGVmYXVsdFRlbXBvID0gMTIwOyAvLyBCUE1cbmNvbnN0IGRlZmF1bHRIZWxwVGV4dCA9ICdUZW1wbyBpbiBiZWF0cyBwZXIgbWludXRlIChCUE0pOic7XG5cbmxldCBoYXNMb2NhbFN0b3JhZ2UgPSAoKCkgPT4ge1xuICAgIGxldCB0ZXN0ID0gJ21ldHJvbm9tZS10ZXN0LXN0cmluZyc7XG4gICAgdHJ5IHtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGVzdCwgdGVzdCk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHRlc3QpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KSgpO1xuXG5lbnVtIEtleUNvZGVzIHsgU1BBQ0UgPSAzMiB9O1xuZW51bSBNb3VzZUNvZGVzIHsgTEVGVCA9IDEgfTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWV0cm9ub21lVWkge1xuXG4gICAgcHJpdmF0ZSBpc1BsYXlpbmc6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIGRpc3BsYXlWYWx1ZTogbnVtYmVyID0gZGVmYXVsdFRlbXBvO1xuXG4gICAgcHJpdmF0ZSBlbnRlcklzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgc3BhY2VJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAgIHByaXZhdGUgbWV0cm9ub21lOiBNZXRyb25vbWU7XG4gICAgcHJpdmF0ZSB0YXBwZXI6IFRhcHBlcjtcblxuICAgIHByaXZhdGUgbWluVGVtcG86IG51bWJlcjtcbiAgICBwcml2YXRlIG1heFRlbXBvOiBudW1iZXI7XG5cbiAgICBwcml2YXRlIHBsdXNzQnRuOiBXaGlsZVByZXNzZWRCdG47XG4gICAgcHJpdmF0ZSBtaW51c0J0bjogV2hpbGVQcmVzc2VkQnRuO1xuICAgIHByaXZhdGUgaW5wdXREaXNwbGF5OiBJbnB1dERpc3BsYXk7XG5cbiAgICBwcml2YXRlIG1ldHJvbm9tZUFuaW1hdGlvbjogTWV0cm9ub21lQW5pbWF0aW9uO1xuXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSBwbGF5UGF1c2VCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIHByaXZhdGUgdGFwQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBwbHVzc0J0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgbWludXNCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIHByaXZhdGUgcmVzZXRCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIGlucHV0RGlzcGxheTogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgaW5wdXREaXNwbGF5TGFiZWw6IEhUTUxMYWJlbEVsZW1lbnQpIHtcblxuICAgICAgICB0aGlzLm1ldHJvbm9tZSA9IG5ldyBNZXRyb25vbWUoZGVmYXVsdFRlbXBvKTtcblxuICAgICAgICB0aGlzLm1ldHJvbm9tZUFuaW1hdGlvbiA9IG5ldyBNZXRyb25vbWVBbmltYXRpb24oKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWV0cm9ub21lLmdldEN1cnJlbnRUaW1lKCk7XG4gICAgICAgIH0sICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1ldHJvbm9tZS5yZWFkTm90ZVF1ZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm1pblRlbXBvID0gdGhpcy5tZXRyb25vbWUuZ2V0TWluVGVtcG8oKTtcbiAgICAgICAgdGhpcy5tYXhUZW1wbyA9IHRoaXMubWV0cm9ub21lLmdldE1heFRlbXBvKCk7XG5cbiAgICAgICAgdGhpcy50YXBwZXIgPSBuZXcgVGFwcGVyKCgpID0+IHtcbiAgICAgICAgICAgIC8vIGNhbGxlZCBvblJlc2V0XG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5ibGlua0luZm8oJ1RhcHBlciByZXNldC4nKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5wbHVzc0J0biA9IG5ldyBXaGlsZVByZXNzZWRCdG4ocGx1c3NCdG4sICgpID0+IHsgdGhpcy5pbmNyZW1lbnREaXNwbGF5VmFsdWUoKTsgfSk7XG4gICAgICAgIHRoaXMubWludXNCdG4gPSBuZXcgV2hpbGVQcmVzc2VkQnRuKG1pbnVzQnRuLCAoKSA9PiB7IHRoaXMuZGVjcmVtZW50RGlzcGxheVZhbHVlKCk7IH0pO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheSA9IG5ldyBJbnB1dERpc3BsYXkoaW5wdXREaXNwbGF5LCBpbnB1dERpc3BsYXlMYWJlbCwgZGVmYXVsdFRlbXBvLCBkZWZhdWx0SGVscFRleHQsXG4gICAgICAgICAgICAodmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRvciBmdW5jdGlvblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKHZhbHVlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAodmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBuZXcgdmFsaWQgdmFsdWVcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlWYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0TWV0cm9ub21lVGVtcG8odmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMuZ2V0VGVtcG9Gcm9tU3RvcmFnZSgpKTtcblxuICAgICAgICAvLyBTZXQgZXZlbnQgaGFuZGxlcnNcbiAgICAgICAgcGxheVBhdXNlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy50b2dnbGVQbGF5UGF1c2UoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGFwQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy50YXAoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmVzZXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlS2V5RG93bihldmVudCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZUtleVVwKGV2ZW50KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB0YXAoKTogdm9pZCB7XG4gICAgICAgIGxldCB7YXZlcmFnZVRlbXBvLCBudW1WYWx1ZXNBdmVyYWdlZH0gPSB0aGlzLnRhcHBlci50YXAoKTtcblxuICAgICAgICBpZiAobnVtVmFsdWVzQXZlcmFnZWQgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LnNldFRpbWVkSW5mbygnVGFwIG9uZSBtb3JlIHRpbWUgdG8gZXN0aW1hdGUgdGVtcG8uJywgNDAwMCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShhdmVyYWdlVGVtcG8pO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5zZXRUaW1lZEluZm8oJ0F2ZXJhZ2Ugb2YgJyArIG51bVZhbHVlc0F2ZXJhZ2VkICsgJyBpbnRlcnZhbHMuIFRoZSB0YXBwZXIgcmVzZXRzIGFmdGVyIDUgc2Vjb25kcy4nLCA0MDAwKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHRvZ2dsZVBsYXlQYXVzZSgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5pc1BsYXlpbmcgPSB0aGlzLm1ldHJvbm9tZS50b2dnbGUoKTtcbiAgICAgICAgdGhpcy5tZXRyb25vbWVBbmltYXRpb24udG9nZ2xlKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBpbmNyZW1lbnREaXNwbGF5VmFsdWUoKTogdm9pZCB7XG5cbiAgICAgICAgbGV0IG5ld1ZhbHVlID0gdGhpcy5kaXNwbGF5VmFsdWUgKyAxO1xuXG4gICAgICAgIGxldCB7dmFsaWQsIGVycm9yfSA9IHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8obmV3VmFsdWUpO1xuXG4gICAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA+IHRoaXMubWF4VGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMubWF4VGVtcG8pO1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlIDwgdGhpcy5taW5UZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUodGhpcy5taW5UZW1wbyk7XG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5zZXRUaW1lZEVycm9yKGVycm9yLCAyMDAwKTtcbiAgICAgICAgICAgIHRoaXMucGx1c3NCdG4uc2V0VGltZWRFcnJvcigyMDAwKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGRlY3JlbWVudERpc3BsYXlWYWx1ZSgpOiB2b2lkIHtcbiAgICAgICAgbGV0IG5ld1ZhbHVlID0gdGhpcy5kaXNwbGF5VmFsdWUgLSAxO1xuXG4gICAgICAgIGxldCB7dmFsaWQsIGVycm9yfSA9IHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8obmV3VmFsdWUpO1xuXG4gICAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA8IHRoaXMubWluVGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMubWluVGVtcG8pO1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlID4gdGhpcy5tYXhUZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUodGhpcy5tYXhUZW1wbyk7XG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5zZXRUaW1lZEVycm9yKGVycm9yLCAyMDAwKTtcbiAgICAgICAgICAgIHRoaXMubWludXNCdG4uc2V0VGltZWRFcnJvcigyMDAwKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlc2V0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShkZWZhdWx0VGVtcG8pO1xuICAgICAgICBpZiAodGhpcy5pc1BsYXlpbmcpIHRoaXMudG9nZ2xlUGxheVBhdXNlKCk7XG4gICAgICAgIHRoaXMubWV0cm9ub21lLnNldFRlbXBvKGRlZmF1bHRUZW1wbyk7XG4gICAgICAgIHRoaXMudGFwcGVyLnJlc2V0KCk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5jbGVhcigpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlS2V5RG93bihldmVudDogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgICAgICBjb25zdCBrZXlOYW1lID0gZXZlbnQua2V5O1xuXG4gICAgICAgIGlmIChrZXlOYW1lID09PSAnQXJyb3dVcCcpIHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB0aGlzLmluY3JlbWVudERpc3BsYXlWYWx1ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdBcnJvd0Rvd24nKSB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5kZWNyZW1lbnREaXNwbGF5VmFsdWUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXlOYW1lID09PSAnRW50ZXInKSB7XG4gICAgICAgICAgICAvLyBNYXkgbm90IGJlIHZlcnkgaW50dWl0aXZlLiBFZy4gZW50ZXIgb24gcmVzZXQgYnV0dG9uIHdpbGwgbm90IFwicHJlc3NcIiByZXNldFxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmVudGVySXNQcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50b2dnbGVQbGF5UGF1c2UoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVudGVySXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudC5rZXlDb2RlID09PSBLZXlDb2Rlcy5TUEFDRSkge1xuICAgICAgICAgICAgLy8gTWF5IG5vdCBiZSB2ZXJ5IGludHVpdGl2ZS4gRWcuIHNwYWNlIG9uIHJlc2V0IGJ1dHRvbiB3aWxsIG5vdCBcInByZXNzXCIgcmVzZXRcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5zcGFjZUlzUHJlc3NlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMudGFwKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zcGFjZUlzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUtleVVwKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgICAgIGlmIChldmVudC5rZXkgPT09ICdFbnRlcicpIHtcbiAgICAgICAgICAgIHRoaXMuZW50ZXJJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudC5rZXlDb2RlID09PSBLZXlDb2Rlcy5TUEFDRSkge1xuICAgICAgICAgICAgdGhpcy5zcGFjZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXREaXNwbGF5VmFsdWUodmFsdWU6IG51bWJlcik6IHZvaWQge1xuXG4gICAgICAgIHZhbHVlID0gTWF0aC5yb3VuZCh2YWx1ZSAqIDEwMCkgLyAxMDA7XG5cbiAgICAgICAgdGhpcy5kaXNwbGF5VmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuc2V0VmFsdWUodmFsdWUpO1xuXG4gICAgICAgIGxldCB7dmFsaWR9ID0gdGhpcy5tZXRyb25vbWUudmFsaWRhdGVUZW1wbyh2YWx1ZSk7XG5cbiAgICAgICAgaWYgKHZhbGlkKSB7XG4gICAgICAgICAgICB0aGlzLnNldE1ldHJvbm9tZVRlbXBvKHZhbHVlKTtcbiAgICAgICAgICAgIHRoaXMuc2V0VGVtcG9JblN0b3JhZ2UodmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRNZXRyb25vbWVUZW1wbyh0ZW1wbzogbnVtYmVyKTogdm9pZCB7XG4gICAgICAgIHRoaXMubWV0cm9ub21lLnNldFRlbXBvKHRlbXBvKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFRlbXBvRnJvbVN0b3JhZ2UoKTogbnVtYmVyIHtcblxuICAgICAgICBpZiAoIWhhc0xvY2FsU3RvcmFnZSkgcmV0dXJuIGRlZmF1bHRUZW1wbztcblxuICAgICAgICBsZXQgaXRlbSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd0ZW1wbycpO1xuXG4gICAgICAgIGlmICghaXRlbSkge1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3RlbXBvJywgZGVmYXVsdFRlbXBvLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRUZW1wbztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc05hTihpdGVtKSkge1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3RlbXBvJywgZGVmYXVsdFRlbXBvLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRUZW1wbztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBOdW1iZXIoaXRlbSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRUZW1wb0luU3RvcmFnZSh0ZW1wbzogbnVtYmVyKSB7XG4gICAgICAgIGlmICghaGFzTG9jYWxTdG9yYWdlKSByZXR1cm47XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0ZW1wbycsIHRlbXBvLnRvU3RyaW5nKCkpO1xuICAgIH1cbn0iLCIvKipcbiAqIFRhcHBlciAtIGEgdGVtcG8gdGFwcGVyIG1vZHVsZS4gVGhlIHRhcHBlciBhdmVyYWdlcyBjb25zZWN1dGl2ZSB2YWx1ZXMgYmVmb3JlIHJlc2V0dGluZyBhZnRlciByZXNldEFmdGVyIG1pbGxpc2Vjb25kcy5cbiAqL1xuY29uc3QgcmVzZXRBZnRlciA9IDUwMDA7IC8vIG1zXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRhcHBlciB7XG5cbiAgICBwcml2YXRlIHByZXZpb3VzVGFwOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgYXZlcmFnZUludGVydmFsOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbnVtVmFsdWVzQXZlcmFnZWQ6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSB0aW1lckhhbmRsZTogbnVtYmVyID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHByaXZhdGUgb25SZXNldDogKCkgPT4gdm9pZCkgeyB9XG5cbiAgICB0YXAoKTogeyBhdmVyYWdlVGVtcG86IG51bWJlciwgbnVtVmFsdWVzQXZlcmFnZWQ6IG51bWJlciB9IHtcblxuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lckhhbmRsZSk7XG5cbiAgICAgICAgdGhpcy50aW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICB9LCByZXNldEFmdGVyKTtcblxuICAgICAgICBpZiAoIXRoaXMucHJldmlvdXNUYXApIHtcbiAgICAgICAgICAgIHRoaXMucHJldmlvdXNUYXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgYXZlcmFnZVRlbXBvOiAwLFxuICAgICAgICAgICAgICAgIG51bVZhbHVlc0F2ZXJhZ2VkOiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGN1cnJlbnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIGxldCBpbnRlcnZhbCA9IGN1cnJlbnRUaW1lIC0gdGhpcy5wcmV2aW91c1RhcDtcbiAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IGN1cnJlbnRUaW1lO1xuXG4gICAgICAgIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQrKztcblxuICAgICAgICAvLyBSZWN1cnNpdmUgYWxnb3JpdGhtIGZvciBsaW5lYXIgYXZlcmFnaW5nXG4gICAgICAgIHRoaXMuYXZlcmFnZUludGVydmFsID0gdGhpcy5hdmVyYWdlSW50ZXJ2YWwgKyAoMSAvIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQpICogKGludGVydmFsIC0gdGhpcy5hdmVyYWdlSW50ZXJ2YWwpO1xuXG4gICAgICAgIGxldCBicG0gPSAxMDAwICogNjAuMCAvIHRoaXMuYXZlcmFnZUludGVydmFsO1xuXG4gICAgICAgIC8vIFJldHVybiB2YWx1ZSByb3VuZGVkIHRvIHR3byBkZWNpbWFsc1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXZlcmFnZVRlbXBvOiBNYXRoLnJvdW5kKGJwbSAqIDEwMCkgLyAxMDAsXG4gICAgICAgICAgICBudW1WYWx1ZXNBdmVyYWdlZDogdGhpcy5udW1WYWx1ZXNBdmVyYWdlZFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJlc2V0KCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5wcmV2aW91c1RhcCkge1xuICAgICAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IDA7XG4gICAgICAgICAgICB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkID0gMDtcbiAgICAgICAgICAgIHRoaXMuYXZlcmFnZUludGVydmFsID0gMDtcbiAgICAgICAgICAgIHRoaXMub25SZXNldCgpO1xuICAgICAgICB9XG4gICAgfVxufSIsIi8qKlxuICogV2hpbGVQcmVzc2VkQnRuLiBBIGJ1dHRvbiB3aGljaCByZXBlYXRlZGx5IHRyaWdnZXJzIGFuIGV2ZW50IHdoaWxlIHByZXNzZWQuXG4gKi9cbmVudW0gTW91c2VDb2RlcyB7IExFRlQgPSAxIH07XG5cbmNvbnN0IGtleURvd25SZXBlYXREZWxheSA9IDUwMDsgLy8gbXMuIFNhbWUgYXMgQ2hyb21lLlxuY29uc3Qga2V5RG93blJlcGVhdEludGVydmFsID0gMzA7IC8vIG1zLiBTYW1lIGFzIENocm9tZS5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV2hpbGVQcmVzc2VkQnRuIHtcblxuICAgIHByaXZhdGUgYnRuOiBIVE1MSW5wdXRFbGVtZW50O1xuICAgIHByaXZhdGUgZXJyb3JUaW1lcklkOiBudW1iZXIgPSAwO1xuXG4gICAgcHJpdmF0ZSBtb3VzZUlzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgbW91c2VEb3duVGltZXJIYW5kbGU6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBtb3VzZURvd25IYW5kbGVyRnVuY3Rpb246ICgpID0+IHZvaWQ7XG5cbiAgICBjb25zdHJ1Y3RvcihidG5FbGVtZW50OiBIVE1MSW5wdXRFbGVtZW50LCBoYW5kbGVyRnVuY3Rpb246ICgpID0+IHZvaWQpIHtcblxuICAgICAgICB0aGlzLmJ0biA9IGJ0bkVsZW1lbnQ7XG4gICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uID0gaGFuZGxlckZ1bmN0aW9uO1xuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBNb3VzZUNvZGVzLkxFRlQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCk7IH0sIGtleURvd25SZXBlYXREZWxheSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB0aGlzLmJ0bi5mb2N1cygpOyAvLyBUT0RPOiBDaGVjayBwcm9ibGVtIGluIGNocm9tZSBpUGhvbmUgZW11bGF0b3Igd2hlcmUgaG92ZXIgaXMgbm90IHJlbW92ZWQgZnJvbSBwcmV2aW91c2x5IGZvY3VzZWQgZWxlbWVudC4gS25vd24gYXMgdGhlIHN0aWNreSBob3ZlciBwcm9ibGVtLlxuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4geyB0aGlzLm1vdXNlRG93bkxvb3AoKTsgfSwga2V5RG93blJlcGVhdERlbGF5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWRkIG1vdXNldXAgZXZlbnRsaXN0ZW5lciB0byBkb2N1bWVudCBpbiBjYXNlIHRoZSBtb3VzZSBpcyBtb3ZlZCBhd2F5IGZyb20gYnRuIGJlZm9yZSBpdCBpcyByZWxlYXNlZC5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBNb3VzZUNvZGVzLkxFRlQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRW5kIG9mIHRvdWNoIGV2ZW50c1xuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGNhbmNlbCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXRUaW1lZEVycm9yKGR1cmF0aW9uOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuZXJyb3JUaW1lcklkKTtcblxuICAgICAgICB0aGlzLmJ0bi5jbGFzc0xpc3QuYWRkKCdoYXMtZXJyb3InKTtcblxuICAgICAgICB0aGlzLmVycm9yVGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5idG4uY2xhc3NMaXN0LnJlbW92ZSgnaGFzLWVycm9yJyk7XG4gICAgICAgIH0sIGR1cmF0aW9uKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG1vdXNlRG93bkxvb3AoKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKCF0aGlzLm1vdXNlSXNQcmVzc2VkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbigpO1xuXG4gICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCk7IH0sIGtleURvd25SZXBlYXRJbnRlcnZhbCk7XG4gICAgfVxufSIsImltcG9ydCBNZXRyb25vbWVVaSBmcm9tICcuL01ldHJvbm9tZVVpJztcblxuLy8gQ2FuIHVzZSBEb2N1bWVudC5xdWVyeVNlbGVjdG9yKCkgaW5zdGVhZFxubGV0IHVpID0gbmV3IE1ldHJvbm9tZVVpKDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5UGF1c2VCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGFwQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsdXNzQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21pbnVzQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc2V0QnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lucHV0RGlzcGxheScpLFxuICAgIDxIVE1MTGFiZWxFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbnB1dERpc3BsYXlMYWJlbCcpKTtcbiJdfQ==
