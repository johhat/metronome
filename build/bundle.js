(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
/**
 * InputDisplay
 */
var inputReactDelay = 500; // ms.
var State;
(function (State) {
    State[State["OK"] = 0] = "OK";
    State[State["WARNING"] = 1] = "WARNING";
    State[State["ERROR"] = 2] = "ERROR";
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
        this.setState(State.ERROR);
        this.setErrorMessage(message);
        this.messageTimerId = setTimeout(function () {
            // Go back to state corresponding to current display value
            _this.handleNewValue(_this.inputDisplay.value);
        }, duration);
    };
    InputDisplay.prototype.handleNewValue = function (value) {
        if (value.toString().length < 2) {
            this.setErrorMessage('The value must have at least two digits.');
            this.setState(State.WARNING);
            return false;
        }
        if (isNaN(Number(value))) {
            this.setErrorMessage('The entered value is not a number. Please enter a number');
            this.setState(State.WARNING);
            return false;
        }
        var valueAsNumber = Number(value);
        var _a = this.validator(valueAsNumber), valid = _a.valid, error = _a.error;
        if (!valid) {
            this.setErrorMessage(error);
            this.setState(State.ERROR);
            return false;
        }
        this.setState(State.OK);
        this.setErrorMessage(this.defaultHelpText);
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
            case State.WARNING:
                return 'has-warning';
            case State.ERROR:
                return 'has-error';
            default:
                console.log('Tried to get class corresponding to non-existing state:', state);
                return '';
        }
    };
    InputDisplay.prototype.setErrorMessage = function (message) {
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
            // Change to error state
            return { valid: false, error: 'You must enter a number' };
        }
        tempo = Number(tempo);
        if (tempo < minTempo) {
            // Signal error
            return { valid: false, error: 'Minimum tempo is ' + minTempo };
        }
        if (tempo > maxTempo) {
            // Signal error
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
        // Draw the curve
        for (var barPosition = 0; barPosition < 7 / 8; barPosition += 0.001) {
            ctx.lineTo(this.getXoffset(barPosition), this.getYoffset(barPosition));
        }
        ctx.moveTo(this.getXoffset(7 / 8), this.getYoffset(7 / 8));
        for (var barPosition = 7 / 8; barPosition < 1; barPosition += 0.001) {
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
        this.tapper = new Tapper_1.default();
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
            return;
        }
        console.log('Num values averaged:', numValuesAveraged);
        this.setDisplayValue(averageTempo);
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
    function Tapper() {
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
        this.previousTap = 0;
        this.numValuesAveraged = 0;
        this.averageInterval = 0;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvSW5wdXREaXNwbGF5LnRzIiwic3JjL01ldHJvbm9tZS50cyIsInNyYy9NZXRyb25vbWVBbmltYXRpb24udHMiLCJzcmMvTWV0cm9ub21lVWkudHMiLCJzcmMvVGFwcGVyLnRzIiwic3JjL1doaWxlUHJlc3NlZEJ0bi50cyIsInNyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBOztHQUVHO0FBQ0gsSUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDLENBQUMsTUFBTTtBQUNuQyxJQUFLLEtBQTRCO0FBQWpDLFdBQUssS0FBSztJQUFHLDZCQUFFLENBQUE7SUFBRSx1Q0FBTyxDQUFBO0lBQUUsbUNBQUssQ0FBQTtBQUFDLENBQUMsRUFBNUIsS0FBSyxLQUFMLEtBQUssUUFBdUI7QUFFakM7SUFPSSxzQkFBb0IsWUFBOEIsRUFBVSxLQUF1QixFQUMvRSxZQUFvQixFQUNaLGVBQXVCLEVBQ3ZCLFNBQStELEVBQy9ELGVBQXdDO1FBWHhELGlCQTBIQztRQW5IdUIsaUJBQVksR0FBWixZQUFZLENBQWtCO1FBQVUsVUFBSyxHQUFMLEtBQUssQ0FBa0I7UUFFdkUsb0JBQWUsR0FBZixlQUFlLENBQVE7UUFDdkIsY0FBUyxHQUFULFNBQVMsQ0FBc0Q7UUFDL0Qsb0JBQWUsR0FBZixlQUFlLENBQXlCO1FBUDVDLGlCQUFZLEdBQVcsQ0FBQyxDQUFDO1FBQ3pCLG1CQUFjLEdBQVcsQ0FBQyxDQUFDO1FBUS9CLElBQUksQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDO1FBQzFCLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNsRCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFFdEIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUU3QyxJQUFJLENBQUMsWUFBWSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxVQUFDLEtBQUs7WUFDOUMsS0FBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVELCtCQUFRLEdBQVIsVUFBUyxLQUFhO1FBQ2xCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQzNDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDaEQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQsb0NBQWEsR0FBYixVQUFjLE9BQWUsRUFBRSxRQUFnQjtRQUEvQyxpQkFVQztRQVRHLFlBQVksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFbEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDM0IsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU5QixJQUFJLENBQUMsY0FBYyxHQUFHLFVBQVUsQ0FBQztZQUM3QiwwREFBMEQ7WUFDMUQsS0FBSSxDQUFDLGNBQWMsQ0FBQyxLQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pELENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNqQixDQUFDO0lBRU8scUNBQWMsR0FBdEIsVUFBdUIsS0FBYTtRQUNoQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFDLGVBQWUsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO1lBQ2pFLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxLQUFLLENBQUM7UUFDakIsQ0FBQztRQUVELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLGVBQWUsQ0FBQywwREFBMEQsQ0FBQyxDQUFDO1lBQ2pGLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxLQUFLLENBQUM7UUFDakIsQ0FBQztRQUVELElBQUksYUFBYSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVsQyxJQUFBLGtDQUFrRCxFQUE3QyxnQkFBSyxFQUFFLGdCQUFLLENBQWtDO1FBRW5ELEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNULElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDNUIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDM0IsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUNqQixDQUFDO1FBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDeEIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFM0MsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRU8sdUNBQWdCLEdBQXhCLFVBQXlCLEtBQVk7UUFBckMsaUJBY0M7UUFiRyxZQUFZLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2hDLFlBQVksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFbEMsSUFBSSxDQUFDLFlBQVksR0FBRyxVQUFVLENBQUM7WUFDM0IsSUFBSSxLQUFLLEdBQUcsS0FBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUM7WUFFcEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDOUIsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELEtBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFFeEMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFFTywrQkFBUSxHQUFoQixVQUFpQixTQUFnQjtRQUM3QixxREFBcUQ7UUFDckQsSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2RCxJQUFJLGNBQWMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRW5ELEVBQUUsQ0FBQyxDQUFDLGlCQUFpQixLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDM0IsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDdEQsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDbkQsQ0FBQztRQUVELEVBQUUsQ0FBQyxDQUFDLGNBQWMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3hCLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUNoRCxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDN0MsQ0FBQztRQUVELElBQUksQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDO0lBQzNCLENBQUM7SUFFTyxvQ0FBYSxHQUFyQixVQUFzQixLQUFZO1FBQzlCLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDWixLQUFLLEtBQUssQ0FBQyxFQUFFO2dCQUNULE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFDaEIsS0FBSyxLQUFLLENBQUMsT0FBTztnQkFDZCxNQUFNLENBQUMsYUFBYSxDQUFDO1lBQ3pCLEtBQUssS0FBSyxDQUFDLEtBQUs7Z0JBQ1osTUFBTSxDQUFDLFdBQVcsQ0FBQztZQUN2QjtnQkFDSSxPQUFPLENBQUMsR0FBRyxDQUFDLHlEQUF5RCxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUM5RSxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ2xCLENBQUM7SUFDTCxDQUFDO0lBRU8sc0NBQWUsR0FBdkIsVUFBd0IsT0FBZTtRQUNuQyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUM7SUFDckMsQ0FBQztJQUNMLG1CQUFDO0FBQUQsQ0ExSEEsQUEwSEMsSUFBQTtBQTFIRDs4QkEwSEMsQ0FBQTs7OztBQ2hJRDs7R0FFRztBQUNILElBQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxDQUFDLE1BQU07QUFDM0IsSUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLENBQUMsTUFBTTtBQUM1QixJQUFNLGNBQWMsR0FBRyxDQUFDLENBQUM7QUFDekIsSUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7QUFFM0IsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVTtBQUNuQyxJQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxDQUFDLDBDQUEwQztBQUN6RSxJQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQyxDQUFDLFVBQVU7QUFFekMsSUFBSyxLQUF3QjtBQUE3QixXQUFLLEtBQUs7SUFBRyxpQ0FBSSxDQUFBO0lBQUUsK0JBQUcsQ0FBQTtJQUFFLCtCQUFHLENBQUE7QUFBQyxDQUFDLEVBQXhCLEtBQUssS0FBTCxLQUFLLFFBQW1CO0FBQUEsQ0FBQztBQUU5QjtJQW1CSSxtQkFBWSxLQUFhO1FBbkI3QixpQkE4TkM7UUEzTlcsY0FBUyxHQUFZLEtBQUssQ0FBQztRQUkzQixlQUFVLEdBQVksS0FBSyxDQUFDO1FBRTVCLGVBQVUsR0FBWSxLQUFLLENBQUM7UUFHNUIsbUJBQWMsR0FBVyxDQUFDLENBQUM7UUFFM0IsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFDekIsZ0JBQVcsR0FBVyxDQUFDLENBQUM7UUFLNUIseUNBQXlDO1FBQ3pDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFPLE1BQU8sQ0FBQyxZQUFZLElBQVUsTUFBTyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQztRQUMzRixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXJCLHFCQUFxQjtRQUNyQixJQUFJLENBQUMsVUFBVSxHQUFHLENBQUM7WUFDZixFQUFFLENBQUMsQ0FBQyxPQUFhLEtBQUksQ0FBQyxZQUFhLENBQUMsTUFBTSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hELE1BQU0sQ0FBQyxLQUFLLENBQUM7WUFDakIsQ0FBQztZQUVELEVBQUUsQ0FBQyxDQUFDLE9BQWEsS0FBSSxDQUFDLFlBQWEsQ0FBQyxPQUFPLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDekQsTUFBTSxDQUFDLEtBQUssQ0FBQztZQUNqQixDQUFDO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNoQixDQUFDLENBQUMsRUFBRSxDQUFDO1FBRUwsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDbEIsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsWUFBYSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3ZDLENBQUM7UUFFRCxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLFVBQVUsR0FBUyxNQUFPLENBQUMsTUFBTSxHQUFHLElBQUksR0FBRyxLQUFLLENBQUM7UUFFdEQsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDbEIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1lBRTVELElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxHQUFHLFVBQUMsS0FBSztnQkFDbEMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUN4QixLQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ3JCLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ0osT0FBTyxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzFELENBQUM7WUFDTCxDQUFDLENBQUM7UUFDTixDQUFDO0lBQ0wsQ0FBQztJQUVELHdCQUFJLEdBQUo7UUFDSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ2xCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7Z0JBQU8sSUFBSSxDQUFDLFlBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN2RCxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztZQUN0QixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDckIsQ0FBQztJQUNMLENBQUM7SUFFRCx5QkFBSyxHQUFMO1FBQUEsaUJBV0M7UUFWRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNqQixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7WUFFdkIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xCLElBQUksQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDO29CQUN2QixLQUFJLENBQUMsWUFBYSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUN2QyxDQUFDLEVBQUUsaUJBQWlCLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3JDLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVELDBCQUFNLEdBQU47UUFDSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNqQixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDakIsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ0osSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2hCLENBQUM7UUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUMxQixDQUFDO0lBRUQsaUNBQWEsR0FBYixVQUFjLEtBQWE7UUFDdkIsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNmLHdCQUF3QjtZQUN4QixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSx5QkFBeUIsRUFBRSxDQUFDO1FBQzlELENBQUM7UUFFRCxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXRCLEVBQUUsQ0FBQyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ25CLGVBQWU7WUFDZixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxtQkFBbUIsR0FBRyxRQUFRLEVBQUUsQ0FBQztRQUNuRSxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDbkIsZUFBZTtZQUNmLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLGVBQWUsR0FBRyxRQUFRLEVBQUUsQ0FBQztRQUMvRCxDQUFDO1FBRUQsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUM7SUFDdEMsQ0FBQztJQUVELDRCQUFRLEdBQVIsVUFBUyxLQUFhO1FBRWxCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQztZQUN2QiwrQkFBK0I7WUFDL0IsTUFBTSxDQUFDO1FBQ1gsQ0FBQztRQUVJLDJDQUFLLENBQThCO1FBRXhDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNULE1BQU0sQ0FBQztRQUNYLENBQUM7UUFFRCxJQUFJLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsK0JBQVcsR0FBWDtRQUNJLE1BQU0sQ0FBQyxRQUFRLENBQUM7SUFDcEIsQ0FBQztJQUVELCtCQUFXLEdBQVg7UUFDSSxNQUFNLENBQUMsUUFBUSxDQUFDO0lBQ3BCLENBQUM7SUFFRCxrQ0FBYyxHQUFkO1FBQ0ksTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDO0lBQ3pDLENBQUM7SUFFRCwrQkFBVyxHQUFYO1FBQ0ksTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDOUIsQ0FBQztJQUVPLGdDQUFZLEdBQXBCO1FBQ0ksT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM3QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLENBQUM7SUFDTCxDQUFDO0lBRU8saUNBQWEsR0FBckI7UUFDSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUNsQixJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNKLGFBQWEsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUM3QyxDQUFDO1FBQ0QsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFFTyw2QkFBUyxHQUFqQjtRQUFBLGlCQXFCQztRQW5CRyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQztRQUN4RCxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQztRQUVyQixJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUVsQixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNkLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWTtZQUN2QixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7WUFDakIsUUFBUSxFQUFFLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQztTQUNqQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUNsQixJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxFQUFFLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7UUFDdEUsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ0osSUFBSSxDQUFDLG9CQUFvQixHQUFHLFdBQVcsQ0FBQztnQkFDcEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFJLENBQUMsU0FBUyxDQUFDO29CQUFDLE1BQU0sQ0FBQztnQkFDNUIsS0FBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3JCLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3pCLENBQUM7SUFDTCxDQUFDO0lBRU8sNkJBQVMsR0FBakI7UUFDSSxPQUFPLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQztZQUMzRSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLFdBQVcsR0FBRyxjQUFjLEdBQUcsS0FBSyxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakcsSUFBSSxjQUFjLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDdkMsSUFBSSxDQUFDLFlBQVksSUFBSSxjQUFjLENBQUM7WUFDcEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDLEdBQUcsY0FBYyxDQUFDO1lBRTNELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLGdCQUFnQixDQUFDO2dCQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7WUFFL0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7Z0JBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxZQUFZO2dCQUN2QixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7Z0JBQ2pCLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUUsR0FBRyxDQUFDO2FBQ3BDLENBQUMsQ0FBQztRQUNQLENBQUM7SUFDTCxDQUFDO0lBRU8sZ0NBQVksR0FBcEIsVUFBcUIsU0FBaUIsRUFBRSxLQUFZO1FBRWhELElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUMvQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFM0MsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBRWxCLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDWixLQUFLLEtBQUssQ0FBQyxJQUFJO2dCQUNYLFNBQVMsR0FBRyxHQUFHLENBQUM7Z0JBQ2hCLEtBQUssQ0FBQztZQUNWLEtBQUssS0FBSyxDQUFDLEdBQUc7Z0JBQ1YsU0FBUyxHQUFHLEdBQUcsQ0FBQztnQkFDaEIsS0FBSyxDQUFDO1lBQ1YsS0FBSyxLQUFLLENBQUMsR0FBRztnQkFDVixTQUFTLEdBQUcsR0FBRyxDQUFDO2dCQUNoQixLQUFLLENBQUM7WUFDVjtnQkFDSSxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUM3QixTQUFTLEdBQUcsR0FBRyxDQUFDO2dCQUNoQixLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDO1FBQ2hDLEdBQUcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckIsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUNMLGdCQUFDO0FBQUQsQ0E5TkEsQUE4TkMsSUFBQTtBQTlORDsyQkE4TkMsQ0FBQTs7O0FDNU9EOztHQUVHOztBQUVIOzs7Ozs7Ozs7Ozs7OztHQWNHO0FBRUgsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBQ3BCLElBQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQztBQUVsQjtJQWlCSSw0QkFBb0IsY0FBNEIsRUFBVSxXQUFvRTtRQUExRyxtQkFBYyxHQUFkLGNBQWMsQ0FBYztRQUFVLGdCQUFXLEdBQVgsV0FBVyxDQUF5RDtRQUx0SCxxQkFBZ0IsR0FBVyxDQUFDLENBQUM7UUFDN0IsWUFBTyxHQUFHLEtBQUssQ0FBQztRQUtwQixJQUFJLENBQUMsU0FBUyxHQUFtQixRQUFRLENBQUMsY0FBYyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDL0UsSUFBSSxDQUFDLFVBQVUsR0FBc0IsUUFBUSxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUM5RSxJQUFJLENBQUMsVUFBVSxHQUFzQixRQUFRLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTNFLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO1FBQzVDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBRTlDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFdEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXBELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNwQixDQUFDO0lBRUQsa0NBQUssR0FBTDtRQUFBLGlCQUlDO1FBSEcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1FBQ3BCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMscUJBQXFCLENBQUMsY0FBUSxLQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyRixDQUFDO0lBRUQsaUNBQUksR0FBSjtRQUNJLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQsbUNBQU0sR0FBTjtRQUNJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2YsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2hCLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNKLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNqQixDQUFDO0lBQ0wsQ0FBQztJQUVPLG9DQUFPLEdBQWYsVUFBZ0IsS0FBYSxFQUFFLE1BQWM7UUFDekMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQzlCLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNoQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDOUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3BDLENBQUM7SUFFTywyQ0FBYyxHQUF0QjtRQUNJLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUM5QixFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUFDLE1BQU0sQ0FBQztRQUNsQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztJQUN6QixDQUFDO0lBRU8saURBQW9CLEdBQTVCLFVBQTZCLE9BQWlDO1FBQzFELE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBRU8scUNBQVEsR0FBaEI7UUFBQSxpQkEyQkM7UUExQkcsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUUzQixHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFN0MsR0FBRyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7UUFDbEIsR0FBRyxDQUFDLFdBQVcsR0FBRyxvQkFBb0IsQ0FBQztRQUN2QyxHQUFHLENBQUMsU0FBUyxHQUFHLG9CQUFvQixDQUFDO1FBRXJDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUVYLElBQUksV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUV4QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFL0IsZ0NBQWdDO1FBQ2hDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFFMUUsbURBQW1EO1FBQ25ELElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRXpCLFlBQVk7UUFDWixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDZCxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDYixHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFWCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLHFCQUFxQixDQUFDLGNBQVEsS0FBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckYsQ0FBQztJQUVPLHFDQUFRLEdBQWhCO1FBQ0ksSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUUzQixHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFN0MsR0FBRyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7UUFDbEIsR0FBRyxDQUFDLFdBQVcsR0FBRyxrQkFBa0IsQ0FBQztRQUNyQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFWCxJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFL0IsaUJBQWlCO1FBQ2pCLEdBQUcsQ0FBQyxDQUFDLElBQUksV0FBVyxHQUFHLENBQUMsRUFBRSxXQUFXLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxXQUFXLElBQUksS0FBSyxFQUFFLENBQUM7WUFDbEUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUMzRSxDQUFDO1FBRUQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTNELEdBQUcsQ0FBQyxDQUFDLElBQUksV0FBVyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsV0FBVyxHQUFHLENBQUMsRUFBRSxXQUFXLElBQUksS0FBSyxFQUFFLENBQUM7WUFDbEUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUMzRSxDQUFDO1FBRUQsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2QsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ2pCLENBQUM7SUFFRCxtRkFBbUY7SUFDM0UsMkNBQWMsR0FBdEI7UUFDSSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFFdEIsSUFBSSxjQUFjLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO1FBQ2hELElBQUksZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLEdBQUcsY0FBYyxDQUFDO1FBRXJILEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkIsZ0JBQWdCLEdBQUcsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEQsQ0FBQztRQUVELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztJQUM1QixDQUFDO0lBRUQsNEdBQTRHO0lBQ3BHLHVDQUFVLEdBQWxCLFVBQW1CLFdBQW1CO1FBQ2xDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0QixNQUFNLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDcEMsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ0osTUFBTSxDQUFDLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsV0FBVyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDMUQsQ0FBQztJQUNMLENBQUM7SUFFRCwyRUFBMkU7SUFDbkUsdUNBQVUsR0FBbEIsVUFBbUIsV0FBbUI7UUFFbEMsSUFBSSxnQkFBZ0IsR0FBRyxDQUFDLFdBQVcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUUzRSwrQ0FBK0M7UUFDL0MsSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsR0FBRyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM1RSxTQUFTLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pFLFNBQVMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekUsU0FBUyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUV6RSxJQUFJLE9BQU8sR0FBRyxDQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7UUFDMUMsTUFBTSxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUM7SUFDL0IsQ0FBQztJQUVPLG1DQUFNLEdBQWQsVUFBZSxPQUFpQyxFQUFFLE1BQWM7UUFDNUQsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsbUZBQW1GO1FBQ3hHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUNMLHlCQUFDO0FBQUQsQ0F0S0EsQUFzS0MsSUFBQTtBQXRLRDtvQ0FzS0MsQ0FBQTs7OztBQzdMRDs7R0FFRztBQUNILDBCQUFzQixhQUFhLENBQUMsQ0FBQTtBQUNwQyx1QkFBbUIsVUFBVSxDQUFDLENBQUE7QUFDOUIsZ0NBQTRCLG1CQUFtQixDQUFDLENBQUE7QUFDaEQsNkJBQXlCLGdCQUFnQixDQUFDLENBQUE7QUFDMUMsbUNBQStCLHNCQUFzQixDQUFDLENBQUE7QUFFdEQsSUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLENBQUMsTUFBTTtBQUNoQyxJQUFNLGVBQWUsR0FBRyxrQ0FBa0MsQ0FBQztBQUUzRCxJQUFJLGVBQWUsR0FBRyxDQUFDO0lBQ25CLElBQUksSUFBSSxHQUFHLHVCQUF1QixDQUFDO0lBQ25DLElBQUksQ0FBQztRQUNELFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pDLFlBQVksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUIsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNoQixDQUFFO0lBQUEsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNULE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFDakIsQ0FBQztBQUNMLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFFTCxJQUFLLFFBQXVCO0FBQTVCLFdBQUssUUFBUTtJQUFHLDBDQUFVLENBQUE7QUFBQyxDQUFDLEVBQXZCLFFBQVEsS0FBUixRQUFRLFFBQWU7QUFBQSxDQUFDO0FBQzdCLElBQUssVUFBdUI7QUFBNUIsV0FBSyxVQUFVO0lBQUcsMkNBQVEsQ0FBQTtBQUFDLENBQUMsRUFBdkIsVUFBVSxLQUFWLFVBQVUsUUFBYTtBQUFBLENBQUM7QUFFN0I7SUFvQkkscUJBQW9CLFlBQThCLEVBQ3RDLE1BQXdCLEVBQ2hDLFFBQTBCLEVBQzFCLFFBQTBCLEVBQ2xCLFFBQTBCLEVBQ2xDLFlBQThCLEVBQzlCLGlCQUFtQztRQTFCM0MsaUJBOE5DO1FBMU11QixpQkFBWSxHQUFaLFlBQVksQ0FBa0I7UUFDdEMsV0FBTSxHQUFOLE1BQU0sQ0FBa0I7UUFHeEIsYUFBUSxHQUFSLFFBQVEsQ0FBa0I7UUF0QjlCLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFDM0IsaUJBQVksR0FBVyxZQUFZLENBQUM7UUFFcEMsbUJBQWMsR0FBWSxLQUFLLENBQUM7UUFDaEMsbUJBQWMsR0FBWSxLQUFLLENBQUM7UUFzQnBDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxtQkFBUyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLDRCQUFrQixDQUFDO1lBQzdDLE1BQU0sQ0FBQyxLQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzNDLENBQUMsRUFBRTtZQUNDLE1BQU0sQ0FBQyxLQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3hDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzdDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUU3QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksZ0JBQU0sRUFBRSxDQUFDO1FBRTNCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSx5QkFBZSxDQUFDLFFBQVEsRUFBRSxjQUFRLEtBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkYsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLHlCQUFlLENBQUMsUUFBUSxFQUFFLGNBQVEsS0FBSSxDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2RixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksc0JBQVksQ0FBQyxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFDL0YsVUFBQyxLQUFhO1lBQ1YscUJBQXFCO1lBQ3JCLE1BQU0sQ0FBQyxLQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQyxDQUFDLEVBQ0QsVUFBQyxLQUFhO1lBQ1YseUJBQXlCO1lBQ3pCLEtBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDO1lBQzFCLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNsQyxDQUFDLENBQ0osQ0FBQztRQUVGLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUMsQ0FBQztRQUVqRCxxQkFBcUI7UUFDckIsWUFBWSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRTtZQUNuQyxLQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDM0IsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFO1lBQzdCLEtBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNmLENBQUMsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRTtZQUMvQixLQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDakIsQ0FBQyxDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFVBQUMsS0FBSztZQUN2QyxLQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlCLENBQUMsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxVQUFDLEtBQUs7WUFDckMsS0FBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM1QixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyx5QkFBRyxHQUFYO1FBQ0ksSUFBQSxzQkFBeUQsRUFBcEQsOEJBQVksRUFBRSx3Q0FBaUIsQ0FBc0I7UUFFMUQsRUFBRSxDQUFDLENBQUMsaUJBQWlCLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQixNQUFNLENBQUM7UUFDWCxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVPLHFDQUFlLEdBQXZCO1FBQ0ksSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUNyQyxDQUFDO0lBRU8sMkNBQXFCLEdBQTdCO1FBRUksSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUM7UUFFckMsSUFBQSwyQ0FBMkQsRUFBdEQsZ0JBQUssRUFBRSxnQkFBSyxDQUEyQztRQUU1RCxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDVCxFQUFFLENBQUMsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztnQkFBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNsRSxFQUFFLENBQUMsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztnQkFBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNsRSxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEMsTUFBTSxDQUFDO1FBQ1gsQ0FBQztRQUVELElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVPLDJDQUFxQixHQUE3QjtRQUNJLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBRXJDLElBQUEsMkNBQTJELEVBQXRELGdCQUFLLEVBQUUsZ0JBQUssQ0FBMkM7UUFFNUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1QsRUFBRSxDQUFDLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7Z0JBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDbEUsRUFBRSxDQUFDLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7Z0JBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDbEUsSUFBSSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzdDLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xDLE1BQU0sQ0FBQztRQUNYLENBQUM7UUFFRCxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTywyQkFBSyxHQUFiO1FBQ0ksSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNuQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQzNDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDcEIsWUFBWSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3pCLENBQUM7SUFFTyxtQ0FBYSxHQUFyQixVQUFzQixLQUFvQjtRQUN0QyxJQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO1FBRTFCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ3hCLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUNqQyxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsT0FBTyxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDMUIsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQ2pDLENBQUM7UUFFRCxFQUFFLENBQUMsQ0FBQyxPQUFPLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN0Qiw4RUFBOEU7WUFDOUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRXZCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7WUFDL0IsQ0FBQztRQUNMLENBQUM7UUFFRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxLQUFLLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ25DLDhFQUE4RTtZQUM5RSxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7WUFFdkIsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNYLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDO1lBQy9CLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVPLGlDQUFXLEdBQW5CLFVBQW9CLEtBQW9CO1FBQ3BDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN4QixJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztRQUNoQyxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sS0FBSyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNuQyxJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztRQUNoQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLHFDQUFlLEdBQXZCLFVBQXdCLEtBQWE7UUFFakMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztRQUV0QyxJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQztRQUMxQixJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU3QixxREFBSyxDQUF3QztRQUVsRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1IsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzlCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNsQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLHVDQUFpQixHQUF6QixVQUEwQixLQUFhO1FBQ25DLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTyx5Q0FBbUIsR0FBM0I7UUFFSSxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQztZQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7UUFFMUMsSUFBSSxJQUFJLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV6QyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDUixZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUN2RCxNQUFNLENBQUMsWUFBWSxDQUFDO1FBQ3hCLENBQUM7UUFFRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2QsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDdkQsTUFBTSxDQUFDLFlBQVksQ0FBQztRQUN4QixDQUFDO1FBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBRU8sdUNBQWlCLEdBQXpCLFVBQTBCLEtBQWE7UUFDbkMsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUM7WUFBQyxNQUFNLENBQUM7UUFDN0IsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUNMLGtCQUFDO0FBQUQsQ0E5TkEsQUE4TkMsSUFBQTtBQTlORDs2QkE4TkMsQ0FBQTs7OztBQ3hQRDs7R0FFRztBQUNILElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxDQUFDLEtBQUs7QUFFOUI7SUFPSTtRQUxRLGdCQUFXLEdBQVcsQ0FBQyxDQUFDO1FBQ3hCLG9CQUFlLEdBQVcsQ0FBQyxDQUFDO1FBQzVCLHNCQUFpQixHQUFXLENBQUMsQ0FBQztRQUM5QixnQkFBVyxHQUFXLENBQUMsQ0FBQztJQUVoQixDQUFDO0lBRWpCLG9CQUFHLEdBQUg7UUFBQSxpQkFnQ0M7UUE5QkcsWUFBWSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUUvQixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztZQUMxQixLQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDakIsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBRWYsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDeEMsTUFBTSxDQUFDO2dCQUNILFlBQVksRUFBRSxDQUFDO2dCQUNmLGlCQUFpQixFQUFFLENBQUM7YUFDdkIsQ0FBQztRQUNOLENBQUM7UUFFRCxJQUFJLFdBQVcsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3ZDLElBQUksUUFBUSxHQUFHLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO1FBQzlDLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBRS9CLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBRXpCLDJDQUEyQztRQUMzQyxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRS9HLElBQUksR0FBRyxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztRQUU3Qyx1Q0FBdUM7UUFDdkMsTUFBTSxDQUFDO1lBQ0gsWUFBWSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUc7WUFDekMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQjtTQUM1QyxDQUFDO0lBQ04sQ0FBQztJQUVELHNCQUFLLEdBQUw7UUFDSSxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQztRQUNyQixJQUFJLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLElBQUksQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFDTCxhQUFDO0FBQUQsQ0FoREEsQUFnREMsSUFBQTtBQWhERDt3QkFnREMsQ0FBQTs7OztBQ3JERDs7R0FFRztBQUNILElBQUssVUFBdUI7QUFBNUIsV0FBSyxVQUFVO0lBQUcsMkNBQVEsQ0FBQTtBQUFDLENBQUMsRUFBdkIsVUFBVSxLQUFWLFVBQVUsUUFBYTtBQUFBLENBQUM7QUFFN0IsSUFBTSxrQkFBa0IsR0FBRyxHQUFHLENBQUMsQ0FBQyxzQkFBc0I7QUFDdEQsSUFBTSxxQkFBcUIsR0FBRyxFQUFFLENBQUMsQ0FBQyxzQkFBc0I7QUFFeEQ7SUFTSSx5QkFBWSxVQUE0QixFQUFFLGVBQTJCO1FBVHpFLGlCQW9FQztRQWpFVyxpQkFBWSxHQUFXLENBQUMsQ0FBQztRQUV6QixtQkFBYyxHQUFZLEtBQUssQ0FBQztRQUNoQyx5QkFBb0IsR0FBVyxDQUFDLENBQUM7UUFLckMsSUFBSSxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUM7UUFDdEIsSUFBSSxDQUFDLHdCQUF3QixHQUFHLGVBQWUsQ0FBQztRQUVoRCxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxVQUFDLEtBQUs7WUFDekMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssS0FBSyxVQUFVLENBQUMsSUFBSSxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUM1QyxLQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQztZQUMzQixLQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztZQUNoQyxLQUFJLENBQUMsb0JBQW9CLEdBQUcsVUFBVSxDQUFDLGNBQVEsS0FBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDaEcsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxVQUFDLEtBQUs7WUFDMUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3ZCLEtBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQywrSUFBK0k7WUFDakssS0FBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7WUFDM0IsS0FBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDaEMsS0FBSSxDQUFDLG9CQUFvQixHQUFHLFVBQVUsQ0FBQyxjQUFRLEtBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2hHLENBQUMsQ0FBQyxDQUFDO1FBRUgsd0dBQXdHO1FBQ3hHLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsVUFBQyxLQUFLO1lBQ3ZDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLEtBQUssVUFBVSxDQUFDLElBQUksQ0FBQztnQkFBQyxNQUFNLENBQUM7WUFDNUMsS0FBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7WUFDNUIsWUFBWSxDQUFDLEtBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDO1FBRUgsc0JBQXNCO1FBQ3RCLElBQUksQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLFVBQUMsS0FBSztZQUN4QyxLQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztZQUM1QixZQUFZLENBQUMsS0FBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxVQUFDLEtBQUs7WUFDM0MsS0FBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7WUFDNUIsWUFBWSxDQUFDLEtBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVELHVDQUFhLEdBQWIsVUFBYyxRQUFnQjtRQUE5QixpQkFRQztRQVBHLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFaEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXBDLElBQUksQ0FBQyxZQUFZLEdBQUcsVUFBVSxDQUFDO1lBQzNCLEtBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMzQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDakIsQ0FBQztJQUVPLHVDQUFhLEdBQXJCO1FBQUEsaUJBU0M7UUFQRyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLE1BQU0sQ0FBQztRQUNYLENBQUM7UUFFRCxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUVoQyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsVUFBVSxDQUFDLGNBQVEsS0FBSSxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFDbkcsQ0FBQztJQUNMLHNCQUFDO0FBQUQsQ0FwRUEsQUFvRUMsSUFBQTtBQXBFRDtpQ0FvRUMsQ0FBQTs7OztBQzVFRCw0QkFBd0IsZUFBZSxDQUFDLENBQUE7QUFFeEMsMkNBQTJDO0FBQzNDLElBQUksRUFBRSxHQUFHLElBQUkscUJBQVcsQ0FBbUIsUUFBUSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsRUFDNUQsUUFBUSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFDakMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDbkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDbkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDbkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsRUFDdkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBJbnB1dERpc3BsYXlcbiAqL1xuY29uc3QgaW5wdXRSZWFjdERlbGF5ID0gNTAwOyAvLyBtcy5cbmVudW0gU3RhdGUgeyBPSywgV0FSTklORywgRVJST1IgfVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJbnB1dERpc3BsYXkge1xuXG4gICAgcHJpdmF0ZSBzdGF0ZTogU3RhdGU7XG4gICAgcHJpdmF0ZSB2YWx1ZTogbnVtYmVyO1xuICAgIHByaXZhdGUgaW5wdXRUaW1lcklkOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbWVzc2FnZVRpbWVySWQ6IG51bWJlciA9IDA7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIGlucHV0RGlzcGxheTogSFRNTElucHV0RWxlbWVudCwgcHJpdmF0ZSBsYWJlbDogSFRNTExhYmVsRWxlbWVudCxcbiAgICAgICAgaW5pdGlhbFZhbHVlOiBudW1iZXIsXG4gICAgICAgIHByaXZhdGUgZGVmYXVsdEhlbHBUZXh0OiBzdHJpbmcsXG4gICAgICAgIHByaXZhdGUgdmFsaWRhdG9yOiAodmFsdWU6IG51bWJlcikgPT4geyB2YWxpZDogYm9vbGVhbiwgZXJyb3I6IHN0cmluZyB9LFxuICAgICAgICBwcml2YXRlIG9uTmV3VmFsaWRWYWx1ZTogKHZhbHVlOiBudW1iZXIpID0+IHZvaWQpIHtcblxuICAgICAgICB0aGlzLnZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IGluaXRpYWxWYWx1ZS50b1N0cmluZygpO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuT0s7XG5cbiAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZShpbml0aWFsVmFsdWUudG9TdHJpbmcoKSk7XG5cbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlSW5wdXRFdmVudChldmVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldFZhbHVlKHZhbHVlOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy52YWx1ZSA9IE1hdGgucm91bmQodmFsdWUgKiAxMDApIC8gMTAwO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IHRoaXMudmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZSh2YWx1ZS50b1N0cmluZygpKTtcbiAgICB9XG5cbiAgICBzZXRUaW1lZEVycm9yKG1lc3NhZ2U6IHN0cmluZywgZHVyYXRpb246IG51bWJlcikge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tZXNzYWdlVGltZXJJZCk7XG5cbiAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5FUlJPUik7XG4gICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKG1lc3NhZ2UpO1xuXG4gICAgICAgIHRoaXMubWVzc2FnZVRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIC8vIEdvIGJhY2sgdG8gc3RhdGUgY29ycmVzcG9uZGluZyB0byBjdXJyZW50IGRpc3BsYXkgdmFsdWVcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlTmV3VmFsdWUodGhpcy5pbnB1dERpc3BsYXkudmFsdWUpO1xuICAgICAgICB9LCBkdXJhdGlvbik7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVOZXdWYWx1ZSh2YWx1ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh2YWx1ZS50b1N0cmluZygpLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKCdUaGUgdmFsdWUgbXVzdCBoYXZlIGF0IGxlYXN0IHR3byBkaWdpdHMuJyk7XG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLldBUk5JTkcpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzTmFOKE51bWJlcih2YWx1ZSkpKSB7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZSgnVGhlIGVudGVyZWQgdmFsdWUgaXMgbm90IGEgbnVtYmVyLiBQbGVhc2UgZW50ZXIgYSBudW1iZXInKTtcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuV0FSTklORyk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdmFsdWVBc051bWJlciA9IE51bWJlcih2YWx1ZSk7XG5cbiAgICAgICAgbGV0IHt2YWxpZCwgZXJyb3J9ID0gdGhpcy52YWxpZGF0b3IodmFsdWVBc051bWJlcik7XG5cbiAgICAgICAgaWYgKCF2YWxpZCkge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvck1lc3NhZ2UoZXJyb3IpO1xuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5FUlJPUik7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLk9LKTtcbiAgICAgICAgdGhpcy5zZXRFcnJvck1lc3NhZ2UodGhpcy5kZWZhdWx0SGVscFRleHQpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlSW5wdXRFdmVudChldmVudDogRXZlbnQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuaW5wdXRUaW1lcklkKTtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubWVzc2FnZVRpbWVySWQpO1xuXG4gICAgICAgIHRoaXMuaW5wdXRUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBsZXQgdmFsdWUgPSB0aGlzLmlucHV0RGlzcGxheS52YWx1ZTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmhhbmRsZU5ld1ZhbHVlKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5vbk5ld1ZhbGlkVmFsdWUoTnVtYmVyKHZhbHVlKSk7XG5cbiAgICAgICAgfSwgaW5wdXRSZWFjdERlbGF5KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHNldFN0YXRlKG5leHRTdGF0ZTogU3RhdGUpIHtcbiAgICAgICAgLy8gU2V0IENTUyBjbGFzc2VzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGVsZW1lbnQgc3RhdGVcbiAgICAgICAgbGV0IGN1cnJlbnRTdGF0ZUNsYXNzID0gdGhpcy5nZXRTdGF0ZUNsYXNzKHRoaXMuc3RhdGUpO1xuICAgICAgICBsZXQgbmV4dFN0YXRlQ2xhc3MgPSB0aGlzLmdldFN0YXRlQ2xhc3MobmV4dFN0YXRlKTtcblxuICAgICAgICBpZiAoY3VycmVudFN0YXRlQ2xhc3MgIT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5jbGFzc0xpc3QucmVtb3ZlKGN1cnJlbnRTdGF0ZUNsYXNzKTtcbiAgICAgICAgICAgIHRoaXMubGFiZWwuY2xhc3NMaXN0LnJlbW92ZShjdXJyZW50U3RhdGVDbGFzcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV4dFN0YXRlQ2xhc3MgIT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5jbGFzc0xpc3QuYWRkKG5leHRTdGF0ZUNsYXNzKTtcbiAgICAgICAgICAgIHRoaXMubGFiZWwuY2xhc3NMaXN0LmFkZChuZXh0U3RhdGVDbGFzcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN0YXRlID0gbmV4dFN0YXRlO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0U3RhdGVDbGFzcyhzdGF0ZTogU3RhdGUpOiBzdHJpbmcge1xuICAgICAgICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgICAgICAgICBjYXNlIFN0YXRlLk9LOlxuICAgICAgICAgICAgICAgIHJldHVybiAnb2snO1xuICAgICAgICAgICAgY2FzZSBTdGF0ZS5XQVJOSU5HOlxuICAgICAgICAgICAgICAgIHJldHVybiAnaGFzLXdhcm5pbmcnO1xuICAgICAgICAgICAgY2FzZSBTdGF0ZS5FUlJPUjpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ2hhcy1lcnJvcic7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdUcmllZCB0byBnZXQgY2xhc3MgY29ycmVzcG9uZGluZyB0byBub24tZXhpc3Rpbmcgc3RhdGU6Jywgc3RhdGUpO1xuICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0RXJyb3JNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICB0aGlzLmxhYmVsLnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICB9XG59IiwiLyoqXG4gKiBNZXRyb25vbWVcbiAqL1xuY29uc3QgbWluVGVtcG8gPSA0MDsgLy8gQlBNXG5jb25zdCBtYXhUZW1wbyA9IDI1MDsgLy8gQlBNXG5jb25zdCBudW1CZWF0c1BlckJhciA9IDQ7XG5jb25zdCBtYXhOb3RlUXVlTGVuZ3RoID0gNTtcblxuY29uc3Qgbm90ZUxlbmd0aCA9IDAuMDU7IC8vIFNlY29uZHNcbmNvbnN0IHNjaGVkdWxlSW50ZXJ2YWwgPSAyNS4wOyAvLyBtcy4gSG93IG9mdGVuIHRoZSBzY2hlZHVsaW5nIGlzIGNhbGxlZC5cbmNvbnN0IHNjaGVkdWxlQWhlYWRUaW1lID0gMC4xOyAvLyBTZWNvbmRzXG5cbmVudW0gUGl0Y2ggeyBISUdILCBNSUQsIExPVyB9O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWUge1xuXG4gICAgcHJpdmF0ZSB0ZW1wbzogbnVtYmVyOyAvLyBiZWF0cyBwZXIgbWludXRlIChCUE0pXG4gICAgcHJpdmF0ZSBpc1BsYXlpbmc6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIGF1ZGlvQ29udGV4dDogQXVkaW9Db250ZXh0O1xuICAgIHByaXZhdGUgYXVkaW9Mb29wVGltZXJIYW5kbGU6IG51bWJlcjtcblxuICAgIHByaXZhdGUgY2FuU3VzcGVuZDogYm9vbGVhbiA9IGZhbHNlO1xuXG4gICAgcHJpdmF0ZSB1c2VzV29ya2VyOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBpbnRlcnZhbFdvcmtlcjogV29ya2VyO1xuXG4gICAgcHJpdmF0ZSBzdXNwZW5kVGltZXJJZDogbnVtYmVyID0gMDtcblxuICAgIHByaXZhdGUgbmV4dE5vdGVUaW1lOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbmV4dDR0aE5vdGU6IG51bWJlciA9IDA7XG5cbiAgICBwcml2YXRlIG5vdGVRdWU6IHsgcHJvZ3Jlc3M6IG51bWJlciwgdGltZTogbnVtYmVyLCB0ZW1wbzogbnVtYmVyIH1bXTtcblxuICAgIGNvbnN0cnVjdG9yKHRlbXBvOiBudW1iZXIpIHtcbiAgICAgICAgLy8gU2FmYXJpIG5lZWRzIHByZWZpeCB3ZWJraXRBdWRpb0NvbnRleHRcbiAgICAgICAgdGhpcy5hdWRpb0NvbnRleHQgPSBuZXcgKCg8YW55PndpbmRvdykuQXVkaW9Db250ZXh0IHx8ICg8YW55PndpbmRvdykud2Via2l0QXVkaW9Db250ZXh0KSgpO1xuICAgICAgICB0aGlzLnNldFRlbXBvKHRlbXBvKTtcblxuICAgICAgICAvLyAtLVN1c3BlbmQvcmVzdW1lLS1cbiAgICAgICAgdGhpcy5jYW5TdXNwZW5kID0gKCgpID0+IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgKDxhbnk+dGhpcy5hdWRpb0NvbnRleHQpLnJlc3VtZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiAoPGFueT50aGlzLmF1ZGlvQ29udGV4dCkuc3VzcGVuZCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KSgpO1xuXG4gICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN1c3BlbmRUaW1lcklkKTtcbiAgICAgICAgICAgICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5zdXNwZW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLVdlYiB3b3JrZXItLVxuICAgICAgICB0aGlzLnVzZXNXb3JrZXIgPSAoPGFueT53aW5kb3cpLldvcmtlciA/IHRydWUgOiBmYWxzZTtcblxuICAgICAgICBpZiAodGhpcy51c2VzV29ya2VyKSB7XG4gICAgICAgICAgICB0aGlzLmludGVydmFsV29ya2VyID0gbmV3IFdvcmtlcignYnVpbGQvSW50ZXJ2YWxXb3JrZXIuanMnKTtcblxuICAgICAgICAgICAgdGhpcy5pbnRlcnZhbFdvcmtlci5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQuZGF0YSA9PT0gJ3RpY2snKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVyKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0RhdGEgZnJvbSBpbnRlcnZhbFdvcmtlcjogJywgZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBsYXkoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5yZXN1bWUoKTtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuYXVkaW9Mb29wKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwYXVzZSgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3BBdWRpb0xvb3AoKTtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN1c3BlbmRUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5zdXNwZW5kKCk7XG4gICAgICAgICAgICAgICAgfSwgc2NoZWR1bGVBaGVhZFRpbWUgKiAxMDAwICogMik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0b2dnbGUoKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh0aGlzLmlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaXNQbGF5aW5nO1xuICAgIH1cblxuICAgIHZhbGlkYXRlVGVtcG8odGVtcG86IG51bWJlcik6IHsgdmFsaWQ6IGJvb2xlYW4sIGVycm9yOiBzdHJpbmcgfSB7XG4gICAgICAgIGlmIChpc05hTih0ZW1wbykpIHtcbiAgICAgICAgICAgIC8vIENoYW5nZSB0byBlcnJvciBzdGF0ZVxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcjogJ1lvdSBtdXN0IGVudGVyIGEgbnVtYmVyJyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGVtcG8gPSBOdW1iZXIodGVtcG8pO1xuXG4gICAgICAgIGlmICh0ZW1wbyA8IG1pblRlbXBvKSB7XG4gICAgICAgICAgICAvLyBTaWduYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3I6ICdNaW5pbXVtIHRlbXBvIGlzICcgKyBtaW5UZW1wbyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRlbXBvID4gbWF4VGVtcG8pIHtcbiAgICAgICAgICAgIC8vIFNpZ25hbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcjogJ01heCB0ZW1wbyBpcyAnICsgbWF4VGVtcG8gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHZhbGlkOiB0cnVlLCBlcnJvcjogJycgfTtcbiAgICB9XG5cbiAgICBzZXRUZW1wbyh0ZW1wbzogbnVtYmVyKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKHRoaXMudGVtcG8gPT09IHRlbXBvKSB7XG4gICAgICAgICAgICAvLyBEbyBub3RoaW5nIGlmIGl0IGlzIHRoZSBzYW1lXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQge3ZhbGlkfSA9IHRoaXMudmFsaWRhdGVUZW1wbyh0ZW1wbyk7XG5cbiAgICAgICAgaWYgKCF2YWxpZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50ZW1wbyA9IE51bWJlcih0ZW1wbyk7XG4gICAgfVxuXG4gICAgZ2V0TWluVGVtcG8oKSB7XG4gICAgICAgIHJldHVybiBtaW5UZW1wbztcbiAgICB9XG5cbiAgICBnZXRNYXhUZW1wbygpIHtcbiAgICAgICAgcmV0dXJuIG1heFRlbXBvO1xuICAgIH1cblxuICAgIGdldEN1cnJlbnRUaW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5hdWRpb0NvbnRleHQuY3VycmVudFRpbWU7XG4gICAgfVxuXG4gICAgcmVhZE5vdGVRdWUoKTogeyBwcm9ncmVzczogbnVtYmVyLCB0aW1lOiBudW1iZXIsIHRlbXBvOiBudW1iZXIgfSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5vdGVRdWUucG9wKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBmbHVzaE5vdGVRdWUoKSB7XG4gICAgICAgIHdoaWxlICh0aGlzLm5vdGVRdWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5ub3RlUXVlLnBvcCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdG9wQXVkaW9Mb29wKCkge1xuICAgICAgICBpZiAodGhpcy51c2VzV29ya2VyKSB7XG4gICAgICAgICAgICB0aGlzLmludGVydmFsV29ya2VyLnBvc3RNZXNzYWdlKHsgJ2ludGVydmFsJzogMCB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5hdWRpb0xvb3BUaW1lckhhbmRsZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mbHVzaE5vdGVRdWUoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGF1ZGlvTG9vcCgpIHtcblxuICAgICAgICB0aGlzLm5leHROb3RlVGltZSA9IHRoaXMuYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lICsgMC4xO1xuICAgICAgICB0aGlzLm5leHQ0dGhOb3RlID0gMDtcblxuICAgICAgICB0aGlzLm5vdGVRdWUgPSBbXTtcblxuICAgICAgICB0aGlzLm5vdGVRdWUucHVzaCh7XG4gICAgICAgICAgICB0aW1lOiB0aGlzLm5leHROb3RlVGltZSxcbiAgICAgICAgICAgIHRlbXBvOiB0aGlzLnRlbXBvLFxuICAgICAgICAgICAgcHJvZ3Jlc3M6IHRoaXMubmV4dDR0aE5vdGUgLyA0LFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAodGhpcy51c2VzV29ya2VyKSB7XG4gICAgICAgICAgICB0aGlzLmludGVydmFsV29ya2VyLnBvc3RNZXNzYWdlKHsgJ2ludGVydmFsJzogc2NoZWR1bGVJbnRlcnZhbCB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYXVkaW9Mb29wVGltZXJIYW5kbGUgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmlzUGxheWluZykgcmV0dXJuO1xuICAgICAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVyKCk7XG4gICAgICAgICAgICB9LCBzY2hlZHVsZUludGVydmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2NoZWR1bGVyKCkge1xuICAgICAgICB3aGlsZSAodGhpcy5uZXh0Tm90ZVRpbWUgPCB0aGlzLmF1ZGlvQ29udGV4dC5jdXJyZW50VGltZSArIHNjaGVkdWxlQWhlYWRUaW1lKSB7XG4gICAgICAgICAgICB0aGlzLnNjaGVkdWxlVG9uZSh0aGlzLm5leHROb3RlVGltZSwgdGhpcy5uZXh0NHRoTm90ZSAlIG51bUJlYXRzUGVyQmFyID8gUGl0Y2guTUlEIDogUGl0Y2guSElHSCk7XG4gICAgICAgICAgICBsZXQgc2Vjb25kc1BlckJlYXQgPSA2MC4wIC8gdGhpcy50ZW1wbztcbiAgICAgICAgICAgIHRoaXMubmV4dE5vdGVUaW1lICs9IHNlY29uZHNQZXJCZWF0O1xuICAgICAgICAgICAgdGhpcy5uZXh0NHRoTm90ZSA9ICh0aGlzLm5leHQ0dGhOb3RlICsgMSkgJSBudW1CZWF0c1BlckJhcjtcblxuICAgICAgICAgICAgaWYgKHRoaXMubm90ZVF1ZS5sZW5ndGggPiBtYXhOb3RlUXVlTGVuZ3RoKSB0aGlzLm5vdGVRdWUucG9wKCk7XG5cbiAgICAgICAgICAgIHRoaXMubm90ZVF1ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICB0aW1lOiB0aGlzLm5leHROb3RlVGltZSxcbiAgICAgICAgICAgICAgICB0ZW1wbzogdGhpcy50ZW1wbyxcbiAgICAgICAgICAgICAgICBwcm9ncmVzczogKHRoaXMubmV4dDR0aE5vdGUgKSAvIDQsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2NoZWR1bGVUb25lKHN0YXJ0VGltZTogbnVtYmVyLCBwaXRjaDogUGl0Y2gpOiB2b2lkIHtcblxuICAgICAgICBsZXQgb3NjID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpO1xuICAgICAgICBvc2MuY29ubmVjdCh0aGlzLmF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAgICAgbGV0IGZyZXF1ZW5jeSA9IDA7XG5cbiAgICAgICAgc3dpdGNoIChwaXRjaCkge1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5ISUdIOlxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDg4MDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUGl0Y2guTUlEOlxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDQ0MDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUGl0Y2guTE9XOlxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDIyMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgcGl0Y2gnKTtcbiAgICAgICAgICAgICAgICBmcmVxdWVuY3kgPSAyMjA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBvc2MuZnJlcXVlbmN5LnZhbHVlID0gZnJlcXVlbmN5O1xuICAgICAgICBvc2Muc3RhcnQoc3RhcnRUaW1lKTtcbiAgICAgICAgb3NjLnN0b3Aoc3RhcnRUaW1lICsgbm90ZUxlbmd0aCk7XG4gICAgfVxufVxuXG4iLCIvKipcbiAqIE1ldHJvbm9tZUFuaW1hdGlvblxuICovXG5cbi8qXG4gICAgRGVmYXVsdCBjb29yZGluYXRlIGZyYW1lZm9yIGNhbnZhczpcbiAgICBcbiAgICAoMCwwKS0tLS0tPiB4XG4gICAgfFxuICAgIHxcbiAgICB5XG5cbiAgICBXaGVyZSB0aGUgb3JpZ2luIGlzIHRvIHRoZSB0b3AgbGVmdCBvZiB0aGUgY2FudmFzLlxuXG4gICAgVGhlIGFuaW1hdGlvbiB1c2VzIGEgdHJhbnNsYXRlZCBjb29yZGluYXRlIGZyYW1lIHdoZXJlIHRoZSBvcmlnaW4gaXMgbW92ZWQgZG93biB0byB0aGUgcmlnaHQuXG4gICAgVGhlIHktYXhpcyB3cmFwcyBhcm91bmQgc3VjaCB0aGF0IHRoZSBsYXN0IDcvOCBvZiBhIGJhciBhcmUgYW5pbWF0ZWQgYXMgYSByaWdodC1tb3ZlbWVudCBmcm9tIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGNhbnZhcyxcbiAgICB3aGlsZSB0aGUgZmlyc3QgNy84IGFyZSBhbmltYXRlZCBhcyBhIHJpZ2h0IG1vdmVtZW50IGZyb20gdGhlIHRyYW5zbGF0ZWQgb3JpZ2luLlxuXG4gKi9cblxuY29uc3Qgc2lnbWEgPSAwLjAyNztcbmNvbnN0IHJhZGl1cyA9IDEwO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWVBbmltYXRpb24ge1xuXG4gICAgcHJpdmF0ZSB3aWR0aDogbnVtYmVyO1xuICAgIHByaXZhdGUgaGVpZ2h0OiBudW1iZXI7XG5cbiAgICBwcml2YXRlIGNvbnRhaW5lcjogSFRNTERpdkVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBncmlkQ2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudDtcbiAgICBwcml2YXRlIGJhbGxDYW52YXM6IEhUTUxDYW52YXNFbGVtZW50O1xuXG4gICAgcHJpdmF0ZSBncmlkQ29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xuICAgIHByaXZhdGUgYmFsbENvbnRleHQ6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRDtcblxuICAgIHByaXZhdGUgYW5pbWF0aW9uRnJhbWVJZDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIHJ1bm5pbmcgPSBmYWxzZTtcblxuICAgIHByaXZhdGUgbmV4dE5vdGU6IHsgcHJvZ3Jlc3M6IG51bWJlciwgdGltZTogbnVtYmVyLCB0ZW1wbzogbnVtYmVyIH07XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIGdldEN1cnJlbnRUaW1lOiAoKSA9PiBudW1iZXIsIHByaXZhdGUgcmVhZE5vdGVRdWU6ICgpID0+IHsgcHJvZ3Jlc3M6IG51bWJlciwgdGltZTogbnVtYmVyLCB0ZW1wbzogbnVtYmVyIH0pIHtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSA8SFRNTERpdkVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FuaW1hdGlvbkNvbnRhaW5lcicpO1xuICAgICAgICB0aGlzLmdyaWRDYW52YXMgPSA8SFRNTENhbnZhc0VsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JvdHRvbS1jYW52YXMnKTtcbiAgICAgICAgdGhpcy5iYWxsQ2FudmFzID0gPEhUTUxDYW52YXNFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b3AtY2FudmFzJyk7XG5cbiAgICAgICAgdGhpcy53aWR0aCA9IHRoaXMuY29udGFpbmVyLmNsaWVudFdpZHRoICogMjtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLmNvbnRhaW5lci5jbGllbnRIZWlnaHQgKiAyO1xuXG4gICAgICAgIHRoaXMuc2V0U2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICAgICAgdGhpcy5ncmlkQ29udGV4dCA9IHRoaXMuZ3JpZENhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICB0aGlzLmJhbGxDb250ZXh0ID0gdGhpcy5iYWxsQ2FudmFzLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICAgICAgdGhpcy5kcmF3UGF0aCgpO1xuICAgIH1cblxuICAgIHN0YXJ0KCkge1xuICAgICAgICB0aGlzLnVwZGF0ZU5vdGVJbmZvKCk7XG4gICAgICAgIHRoaXMucnVubmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuYW5pbWF0aW9uRnJhbWVJZCA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4geyB0aGlzLmRyYXdCYWxsKCk7IH0pO1xuICAgIH1cblxuICAgIHN0b3AoKSB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUodGhpcy5hbmltYXRpb25GcmFtZUlkKTtcbiAgICB9XG5cbiAgICB0b2dnbGUoKSB7XG4gICAgICAgIGlmICh0aGlzLnJ1bm5pbmcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zdGFydCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRTaXplKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuZ3JpZENhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgICAgICB0aGlzLmdyaWRDYW52YXMuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICB0aGlzLmJhbGxDYW52YXMud2lkdGggPSB3aWR0aDtcbiAgICAgICAgdGhpcy5iYWxsQ2FudmFzLmhlaWdodCA9IGhlaWdodDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHVwZGF0ZU5vdGVJbmZvKCkge1xuICAgICAgICBsZXQgZGF0YSA9IHRoaXMucmVhZE5vdGVRdWUoKTtcbiAgICAgICAgaWYgKCFkYXRhKSByZXR1cm47XG4gICAgICAgIHRoaXMubmV4dE5vdGUgPSBkYXRhO1xuICAgIH1cblxuICAgIHByaXZhdGUgdHJhbnNmb3JtVG9Ob3RlRnJhbWUoY29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEKSB7XG4gICAgICAgIGNvbnRleHQudHJhbnNsYXRlKHRoaXMud2lkdGggLyA4LCB0aGlzLmhlaWdodCAtIHJhZGl1cyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBkcmF3QmFsbCgpIHtcbiAgICAgICAgbGV0IGN0eCA9IHRoaXMuYmFsbENvbnRleHQ7XG5cbiAgICAgICAgY3R4LmNsZWFyUmVjdCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICAgICAgY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgICAgIGN0eC5zdHJva2VTdHlsZSA9ICdyZ2JhKDUxLDg2LDU2LDAuOSknO1xuICAgICAgICBjdHguZmlsbFN0eWxlID0gJ3JnYmEoNTEsODYsNTYsMC41KSc7XG5cbiAgICAgICAgY3R4LnNhdmUoKTtcblxuICAgICAgICBsZXQgYmFyUG9zaXRpb24gPSB0aGlzLmdldEJhclBvc2l0aW9uKCk7XG5cbiAgICAgICAgdGhpcy50cmFuc2Zvcm1Ub05vdGVGcmFtZShjdHgpO1xuXG4gICAgICAgIC8vIFRyYW5zbGF0ZSB0byBkZXNpcmVkIHBvc2l0aW9uXG4gICAgICAgIGN0eC50cmFuc2xhdGUodGhpcy5nZXRYb2Zmc2V0KGJhclBvc2l0aW9uKSwgdGhpcy5nZXRZb2Zmc2V0KGJhclBvc2l0aW9uKSk7XG5cbiAgICAgICAgLy8gQWRkIGNpcmNsZSBwYXRoIGF0IHRoZSBwbGFjZSB3ZSd2ZSB0cmFuc2xhdGVkIHRvXG4gICAgICAgIHRoaXMuY2lyY2xlKGN0eCwgcmFkaXVzKTtcblxuICAgICAgICAvLyBEbyBzdHJva2VcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcbiAgICAgICAgY3R4LnN0cm9rZSgpO1xuICAgICAgICBjdHguZmlsbCgpO1xuXG4gICAgICAgIHRoaXMuYW5pbWF0aW9uRnJhbWVJZCA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4geyB0aGlzLmRyYXdCYWxsKCk7IH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgZHJhd1BhdGgoKSB7XG4gICAgICAgIGxldCBjdHggPSB0aGlzLmdyaWRDb250ZXh0O1xuXG4gICAgICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXG4gICAgICAgIGN0eC5saW5lV2lkdGggPSAxO1xuICAgICAgICBjdHguc3Ryb2tlU3R5bGUgPSAncmdiKDEwMywxNzcsMTA0KSc7XG4gICAgICAgIGN0eC5zYXZlKCk7XG5cbiAgICAgICAgdGhpcy50cmFuc2Zvcm1Ub05vdGVGcmFtZShjdHgpO1xuXG4gICAgICAgIC8vIERyYXcgdGhlIGN1cnZlXG4gICAgICAgIGZvciAobGV0IGJhclBvc2l0aW9uID0gMDsgYmFyUG9zaXRpb24gPCA3IC8gODsgYmFyUG9zaXRpb24gKz0gMC4wMDEpIHtcbiAgICAgICAgICAgIGN0eC5saW5lVG8odGhpcy5nZXRYb2Zmc2V0KGJhclBvc2l0aW9uKSwgdGhpcy5nZXRZb2Zmc2V0KGJhclBvc2l0aW9uKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjdHgubW92ZVRvKHRoaXMuZ2V0WG9mZnNldCg3IC8gOCksIHRoaXMuZ2V0WW9mZnNldCg3IC8gOCkpO1xuXG4gICAgICAgIGZvciAobGV0IGJhclBvc2l0aW9uID0gNyAvIDg7IGJhclBvc2l0aW9uIDwgMTsgYmFyUG9zaXRpb24gKz0gMC4wMDEpIHtcbiAgICAgICAgICAgIGN0eC5saW5lVG8odGhpcy5nZXRYb2Zmc2V0KGJhclBvc2l0aW9uKSwgdGhpcy5nZXRZb2Zmc2V0KGJhclBvc2l0aW9uKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjdHgucmVzdG9yZSgpO1xuICAgICAgICBjdHguc3Ryb2tlKCk7XG4gICAgfVxuXG4gICAgLy8gUmV0dXJucyBwZXJjZW50YWdlIG9mIGEgYmFyIGNvbXBsZXRlZC4gRWcuIGF0IGV4YWN0bHkgdHdvIGJlYXRzIGl0IHdpbGwgYmUgMC41LiBcbiAgICBwcml2YXRlIGdldEJhclBvc2l0aW9uKCk6IG51bWJlciB7XG4gICAgICAgIHRoaXMudXBkYXRlTm90ZUluZm8oKTtcblxuICAgICAgICBsZXQgc2Vjb25kc1BlckJlYXQgPSA2MC4wIC8gdGhpcy5uZXh0Tm90ZS50ZW1wbztcbiAgICAgICAgbGV0IGV4cGVjdGVkUG9zaXRpb24gPSB0aGlzLm5leHROb3RlLnByb2dyZXNzIC0gMC4yNSAqICh0aGlzLm5leHROb3RlLnRpbWUgLSB0aGlzLmdldEN1cnJlbnRUaW1lKCkpIC8gc2Vjb25kc1BlckJlYXQ7XG5cbiAgICAgICAgaWYgKGV4cGVjdGVkUG9zaXRpb24gPCAwKSB7XG4gICAgICAgICAgICBleHBlY3RlZFBvc2l0aW9uID0gKGV4cGVjdGVkUG9zaXRpb24gJSAxKSArIDE7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXhwZWN0ZWRQb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvLyBIb3cgbXVjaCB4IHNob3VsZCBiZSBvZmZzZXQgZnJvbSB0aGUgb3JpZ2luIGluIHRoZSBub3RlIGNvb3JkaW5hdGUgZnJhbWUgLSBpbXBsZW1lbnRzIHRoZSB3cmFwcGluZyBhdCA3LzhcbiAgICBwcml2YXRlIGdldFhvZmZzZXQoYmFyUG9zaXRpb246IG51bWJlcik6IG51bWJlciB7XG4gICAgICAgIGlmIChiYXJQb3NpdGlvbiA8IDcgLyA4KSB7XG4gICAgICAgICAgICByZXR1cm4gYmFyUG9zaXRpb24gKiB0aGlzLndpZHRoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuICgtIDEgLyA4ICsgKGJhclBvc2l0aW9uIC0gNyAvIDgpKSAqIHRoaXMud2lkdGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIb3cgbXVjaCB5IHNob3VsZCBiZSBvZmZzZXQgZnJvbSB0aGUgb3JpZ2luIGluIHRoZSBub3RlIGNvb3JkaW5hdGUgZnJhbWVcbiAgICBwcml2YXRlIGdldFlvZmZzZXQoYmFyUG9zaXRpb246IG51bWJlcik6IG51bWJlciB7XG5cbiAgICAgICAgbGV0IGRpc3RhbmNlVG9PcmlnaW4gPSAoYmFyUG9zaXRpb24gPiAwLjUpID8gMSAtIGJhclBvc2l0aW9uIDogYmFyUG9zaXRpb247XG5cbiAgICAgICAgLy8gR2F1c3NpYW4gZnVuY3Rpb25zIHRvIGdldCBwZWFrcyBhdCB0aGUgYmVhdHNcbiAgICAgICAgbGV0IGFtcGxpdHVkZSA9IDIgKiBNYXRoLmV4cCgtIDAuNSAqIE1hdGgucG93KGRpc3RhbmNlVG9PcmlnaW4gLyBzaWdtYSwgMikpO1xuICAgICAgICBhbXBsaXR1ZGUgKz0gTWF0aC5leHAoLSAwLjUgKiBNYXRoLnBvdygoYmFyUG9zaXRpb24gLSAwLjI1KSAvIHNpZ21hLCAyKSk7XG4gICAgICAgIGFtcGxpdHVkZSArPSBNYXRoLmV4cCgtIDAuNSAqIE1hdGgucG93KChiYXJQb3NpdGlvbiAtIDAuNTApIC8gc2lnbWEsIDIpKTtcbiAgICAgICAgYW1wbGl0dWRlICs9IE1hdGguZXhwKC0gMC41ICogTWF0aC5wb3coKGJhclBvc2l0aW9uIC0gMC43NSkgLyBzaWdtYSwgMikpO1xuXG4gICAgICAgIGxldCBzY2FsaW5nID0gLSB0aGlzLmhlaWdodCAqIDEgLyAyICogMC43O1xuICAgICAgICByZXR1cm4gc2NhbGluZyAqIGFtcGxpdHVkZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNpcmNsZShjb250ZXh0OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQsIHJhZGl1czogbnVtYmVyKSB7XG4gICAgICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7IC8vIE5vdGUgdG8gc2VsZjogQWRkaW5nIG1vdmVUbyBoZXJlIGNyZWF0ZXMgYSBsaW5lIGZyb20gY2VudGVyIG9mIGNpcmNsZSBvbiBzdHJva2UuXG4gICAgICAgIGNvbnRleHQuYXJjKDAsIDAsIHJhZGl1cywgMCwgMiAqIE1hdGguUEkpO1xuICAgIH1cbn0iLCIvKipcbiAqIE1ldHJvbm9tZVVpXG4gKi9cbmltcG9ydCBNZXRyb25vbWUgZnJvbSAnLi9NZXRyb25vbWUnO1xuaW1wb3J0IFRhcHBlciBmcm9tICcuL1RhcHBlcic7XG5pbXBvcnQgV2hpbGVQcmVzc2VkQnRuIGZyb20gJy4vV2hpbGVQcmVzc2VkQnRuJztcbmltcG9ydCBJbnB1dERpc3BsYXkgZnJvbSAnLi9JbnB1dERpc3BsYXknO1xuaW1wb3J0IE1ldHJvbm9tZUFuaW1hdGlvbiBmcm9tICcuL01ldHJvbm9tZUFuaW1hdGlvbic7XG5cbmNvbnN0IGRlZmF1bHRUZW1wbyA9IDEyMDsgLy8gQlBNXG5jb25zdCBkZWZhdWx0SGVscFRleHQgPSAnVGVtcG8gaW4gYmVhdHMgcGVyIG1pbnV0ZSAoQlBNKTonO1xuXG5sZXQgaGFzTG9jYWxTdG9yYWdlID0gKCgpID0+IHtcbiAgICBsZXQgdGVzdCA9ICdtZXRyb25vbWUtdGVzdC1zdHJpbmcnO1xuICAgIHRyeSB7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRlc3QsIHRlc3QpO1xuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSh0ZXN0KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufSkoKTtcblxuZW51bSBLZXlDb2RlcyB7IFNQQUNFID0gMzIgfTtcbmVudW0gTW91c2VDb2RlcyB7IExFRlQgPSAxIH07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1ldHJvbm9tZVVpIHtcblxuICAgIHByaXZhdGUgaXNQbGF5aW5nOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBkaXNwbGF5VmFsdWU6IG51bWJlciA9IGRlZmF1bHRUZW1wbztcblxuICAgIHByaXZhdGUgZW50ZXJJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIHNwYWNlSXNQcmVzc2VkOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICBwcml2YXRlIG1ldHJvbm9tZTogTWV0cm9ub21lO1xuICAgIHByaXZhdGUgdGFwcGVyOiBUYXBwZXI7XG5cbiAgICBwcml2YXRlIG1pblRlbXBvOiBudW1iZXI7XG4gICAgcHJpdmF0ZSBtYXhUZW1wbzogbnVtYmVyO1xuXG4gICAgcHJpdmF0ZSBwbHVzc0J0bjogV2hpbGVQcmVzc2VkQnRuO1xuICAgIHByaXZhdGUgbWludXNCdG46IFdoaWxlUHJlc3NlZEJ0bjtcbiAgICBwcml2YXRlIGlucHV0RGlzcGxheTogSW5wdXREaXNwbGF5O1xuXG4gICAgcHJpdmF0ZSBtZXRyb25vbWVBbmltYXRpb246IE1ldHJvbm9tZUFuaW1hdGlvbjtcblxuICAgIGNvbnN0cnVjdG9yKHByaXZhdGUgcGxheVBhdXNlQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBwcml2YXRlIHRhcEJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcGx1c3NCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIG1pbnVzQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBwcml2YXRlIHJlc2V0QnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBpbnB1dERpc3BsYXk6IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIGlucHV0RGlzcGxheUxhYmVsOiBIVE1MTGFiZWxFbGVtZW50KSB7XG5cbiAgICAgICAgdGhpcy5tZXRyb25vbWUgPSBuZXcgTWV0cm9ub21lKGRlZmF1bHRUZW1wbyk7XG5cbiAgICAgICAgdGhpcy5tZXRyb25vbWVBbmltYXRpb24gPSBuZXcgTWV0cm9ub21lQW5pbWF0aW9uKCgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1ldHJvbm9tZS5nZXRDdXJyZW50VGltZSgpO1xuICAgICAgICB9LCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tZXRyb25vbWUucmVhZE5vdGVRdWUoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5taW5UZW1wbyA9IHRoaXMubWV0cm9ub21lLmdldE1pblRlbXBvKCk7XG4gICAgICAgIHRoaXMubWF4VGVtcG8gPSB0aGlzLm1ldHJvbm9tZS5nZXRNYXhUZW1wbygpO1xuXG4gICAgICAgIHRoaXMudGFwcGVyID0gbmV3IFRhcHBlcigpO1xuXG4gICAgICAgIHRoaXMucGx1c3NCdG4gPSBuZXcgV2hpbGVQcmVzc2VkQnRuKHBsdXNzQnRuLCAoKSA9PiB7IHRoaXMuaW5jcmVtZW50RGlzcGxheVZhbHVlKCk7IH0pO1xuICAgICAgICB0aGlzLm1pbnVzQnRuID0gbmV3IFdoaWxlUHJlc3NlZEJ0bihtaW51c0J0biwgKCkgPT4geyB0aGlzLmRlY3JlbWVudERpc3BsYXlWYWx1ZSgpOyB9KTtcbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkgPSBuZXcgSW5wdXREaXNwbGF5KGlucHV0RGlzcGxheSwgaW5wdXREaXNwbGF5TGFiZWwsIGRlZmF1bHRUZW1wbywgZGVmYXVsdEhlbHBUZXh0LFxuICAgICAgICAgICAgKHZhbHVlOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBWYWxpZGF0b3IgZnVuY3Rpb25cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tZXRyb25vbWUudmFsaWRhdGVUZW1wbyh2YWx1ZSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgKHZhbHVlOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBIYW5kbGUgbmV3IHZhbGlkIHZhbHVlXG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5VmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldE1ldHJvbm9tZVRlbXBvKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZSh0aGlzLmdldFRlbXBvRnJvbVN0b3JhZ2UoKSk7XG5cbiAgICAgICAgLy8gU2V0IGV2ZW50IGhhbmRsZXJzXG4gICAgICAgIHBsYXlQYXVzZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudG9nZ2xlUGxheVBhdXNlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRhcEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudGFwKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJlc2V0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZUtleURvd24oZXZlbnQpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVLZXlVcChldmVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgdGFwKCk6IHZvaWQge1xuICAgICAgICBsZXQge2F2ZXJhZ2VUZW1wbywgbnVtVmFsdWVzQXZlcmFnZWR9ID0gdGhpcy50YXBwZXIudGFwKCk7XG5cbiAgICAgICAgaWYgKG51bVZhbHVlc0F2ZXJhZ2VkID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnTnVtIHZhbHVlcyBhdmVyYWdlZDonLCBudW1WYWx1ZXNBdmVyYWdlZCk7XG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKGF2ZXJhZ2VUZW1wbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB0b2dnbGVQbGF5UGF1c2UoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdGhpcy5tZXRyb25vbWUudG9nZ2xlKCk7XG4gICAgICAgIHRoaXMubWV0cm9ub21lQW5pbWF0aW9uLnRvZ2dsZSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaW5jcmVtZW50RGlzcGxheVZhbHVlKCk6IHZvaWQge1xuXG4gICAgICAgIGxldCBuZXdWYWx1ZSA9IHRoaXMuZGlzcGxheVZhbHVlICsgMTtcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKG5ld1ZhbHVlKTtcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgPiB0aGlzLm1heFRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZSh0aGlzLm1heFRlbXBvKTtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA8IHRoaXMubWluVGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMubWluVGVtcG8pO1xuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuc2V0VGltZWRFcnJvcihlcnJvciwgMjAwMCk7XG4gICAgICAgICAgICB0aGlzLnBsdXNzQnRuLnNldFRpbWVkRXJyb3IoMjAwMCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBkZWNyZW1lbnREaXNwbGF5VmFsdWUoKTogdm9pZCB7XG4gICAgICAgIGxldCBuZXdWYWx1ZSA9IHRoaXMuZGlzcGxheVZhbHVlIC0gMTtcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKG5ld1ZhbHVlKTtcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgPCB0aGlzLm1pblRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZSh0aGlzLm1pblRlbXBvKTtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA+IHRoaXMubWF4VGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMubWF4VGVtcG8pO1xuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuc2V0VGltZWRFcnJvcihlcnJvciwgMjAwMCk7XG4gICAgICAgICAgICB0aGlzLm1pbnVzQnRuLnNldFRpbWVkRXJyb3IoMjAwMCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUoZGVmYXVsdFRlbXBvKTtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB0aGlzLnRvZ2dsZVBsYXlQYXVzZSgpO1xuICAgICAgICB0aGlzLm1ldHJvbm9tZS5zZXRUZW1wbyhkZWZhdWx0VGVtcG8pO1xuICAgICAgICB0aGlzLnRhcHBlci5yZXNldCgpO1xuICAgICAgICBsb2NhbFN0b3JhZ2UuY2xlYXIoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUtleURvd24oZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qga2V5TmFtZSA9IGV2ZW50LmtleTtcblxuICAgICAgICBpZiAoa2V5TmFtZSA9PT0gJ0Fycm93VXAnKSB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5pbmNyZW1lbnREaXNwbGF5VmFsdWUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXlOYW1lID09PSAnQXJyb3dEb3duJykge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHRoaXMuZGVjcmVtZW50RGlzcGxheVZhbHVlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5TmFtZSA9PT0gJ0VudGVyJykge1xuICAgICAgICAgICAgLy8gTWF5IG5vdCBiZSB2ZXJ5IGludHVpdGl2ZS4gRWcuIGVudGVyIG9uIHJlc2V0IGJ1dHRvbiB3aWxsIG5vdCBcInByZXNzXCIgcmVzZXRcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5lbnRlcklzUHJlc3NlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMudG9nZ2xlUGxheVBhdXNlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRlcklzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZXMuU1BBQ0UpIHtcbiAgICAgICAgICAgIC8vIE1heSBub3QgYmUgdmVyeSBpbnR1aXRpdmUuIEVnLiBzcGFjZSBvbiByZXNldCBidXR0b24gd2lsbCBub3QgXCJwcmVzc1wiIHJlc2V0XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuc3BhY2VJc1ByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRhcCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3BhY2VJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVLZXlVcChldmVudDogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgICAgICBpZiAoZXZlbnQua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICAgICAgICB0aGlzLmVudGVySXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZXMuU1BBQ0UpIHtcbiAgICAgICAgICAgIHRoaXMuc3BhY2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0RGlzcGxheVZhbHVlKHZhbHVlOiBudW1iZXIpOiB2b2lkIHtcblxuICAgICAgICB2YWx1ZSA9IE1hdGgucm91bmQodmFsdWUgKiAxMDApIC8gMTAwO1xuXG4gICAgICAgIHRoaXMuZGlzcGxheVZhbHVlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LnNldFZhbHVlKHZhbHVlKTtcblxuICAgICAgICBsZXQge3ZhbGlkfSA9IHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8odmFsdWUpO1xuXG4gICAgICAgIGlmICh2YWxpZCkge1xuICAgICAgICAgICAgdGhpcy5zZXRNZXRyb25vbWVUZW1wbyh2YWx1ZSk7XG4gICAgICAgICAgICB0aGlzLnNldFRlbXBvSW5TdG9yYWdlKHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0TWV0cm9ub21lVGVtcG8odGVtcG86IG51bWJlcik6IHZvaWQge1xuICAgICAgICB0aGlzLm1ldHJvbm9tZS5zZXRUZW1wbyh0ZW1wbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRUZW1wb0Zyb21TdG9yYWdlKCk6IG51bWJlciB7XG5cbiAgICAgICAgaWYgKCFoYXNMb2NhbFN0b3JhZ2UpIHJldHVybiBkZWZhdWx0VGVtcG87XG5cbiAgICAgICAgbGV0IGl0ZW0gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndGVtcG8nKTtcblxuICAgICAgICBpZiAoIWl0ZW0pIHtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0ZW1wbycsIGRlZmF1bHRUZW1wby50b1N0cmluZygpKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZhdWx0VGVtcG87XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOYU4oaXRlbSkpIHtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0ZW1wbycsIGRlZmF1bHRUZW1wby50b1N0cmluZygpKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZhdWx0VGVtcG87XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTnVtYmVyKGl0ZW0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2V0VGVtcG9JblN0b3JhZ2UodGVtcG86IG51bWJlcikge1xuICAgICAgICBpZiAoIWhhc0xvY2FsU3RvcmFnZSkgcmV0dXJuO1xuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndGVtcG8nLCB0ZW1wby50b1N0cmluZygpKTtcbiAgICB9XG59IiwiLyoqXG4gKiBUYXBwZXIgLSBhIHRlbXBvIHRhcHBlciBtb2R1bGUuIFRoZSB0YXBwZXIgYXZlcmFnZXMgY29uc2VjdXRpdmUgdmFsdWVzIGJlZm9yZSByZXNldHRpbmcgYWZ0ZXIgcmVzZXRBZnRlciBtaWxsaXNlY29uZHMuXG4gKi9cbmNvbnN0IHJlc2V0QWZ0ZXIgPSA1MDAwOyAvLyBtc1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUYXBwZXIge1xuXG4gICAgcHJpdmF0ZSBwcmV2aW91c1RhcDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIGF2ZXJhZ2VJbnRlcnZhbDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIG51bVZhbHVlc0F2ZXJhZ2VkOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgdGltZXJIYW5kbGU6IG51bWJlciA9IDA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHsgfVxuXG4gICAgdGFwKCk6IHsgYXZlcmFnZVRlbXBvOiBudW1iZXIsIG51bVZhbHVlc0F2ZXJhZ2VkOiBudW1iZXIgfSB7XG5cbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZXJIYW5kbGUpO1xuXG4gICAgICAgIHRoaXMudGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKTtcbiAgICAgICAgfSwgcmVzZXRBZnRlcik7XG5cbiAgICAgICAgaWYgKCF0aGlzLnByZXZpb3VzVGFwKSB7XG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzVGFwID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGF2ZXJhZ2VUZW1wbzogMCxcbiAgICAgICAgICAgICAgICBudW1WYWx1ZXNBdmVyYWdlZDogMFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjdXJyZW50VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgICBsZXQgaW50ZXJ2YWwgPSBjdXJyZW50VGltZSAtIHRoaXMucHJldmlvdXNUYXA7XG4gICAgICAgIHRoaXMucHJldmlvdXNUYXAgPSBjdXJyZW50VGltZTtcblxuICAgICAgICB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkKys7XG5cbiAgICAgICAgLy8gUmVjdXJzaXZlIGFsZ29yaXRobSBmb3IgbGluZWFyIGF2ZXJhZ2luZ1xuICAgICAgICB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCA9IHRoaXMuYXZlcmFnZUludGVydmFsICsgKDEgLyB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkKSAqIChpbnRlcnZhbCAtIHRoaXMuYXZlcmFnZUludGVydmFsKTtcblxuICAgICAgICBsZXQgYnBtID0gMTAwMCAqIDYwLjAgLyB0aGlzLmF2ZXJhZ2VJbnRlcnZhbDtcblxuICAgICAgICAvLyBSZXR1cm4gdmFsdWUgcm91bmRlZCB0byB0d28gZGVjaW1hbHNcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGF2ZXJhZ2VUZW1wbzogTWF0aC5yb3VuZChicG0gKiAxMDApIC8gMTAwLFxuICAgICAgICAgICAgbnVtVmFsdWVzQXZlcmFnZWQ6IHRoaXMubnVtVmFsdWVzQXZlcmFnZWRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IDA7XG4gICAgICAgIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQgPSAwO1xuICAgICAgICB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCA9IDA7XG4gICAgfVxufSIsIi8qKlxuICogV2hpbGVQcmVzc2VkQnRuLiBBIGJ1dHRvbiB3aGljaCByZXBlYXRlZGx5IHRyaWdnZXJzIGFuIGV2ZW50IHdoaWxlIHByZXNzZWQuXG4gKi9cbmVudW0gTW91c2VDb2RlcyB7IExFRlQgPSAxIH07XG5cbmNvbnN0IGtleURvd25SZXBlYXREZWxheSA9IDUwMDsgLy8gbXMuIFNhbWUgYXMgQ2hyb21lLlxuY29uc3Qga2V5RG93blJlcGVhdEludGVydmFsID0gMzA7IC8vIG1zLiBTYW1lIGFzIENocm9tZS5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV2hpbGVQcmVzc2VkQnRuIHtcblxuICAgIHByaXZhdGUgYnRuOiBIVE1MSW5wdXRFbGVtZW50O1xuICAgIHByaXZhdGUgZXJyb3JUaW1lcklkOiBudW1iZXIgPSAwO1xuXG4gICAgcHJpdmF0ZSBtb3VzZUlzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgbW91c2VEb3duVGltZXJIYW5kbGU6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBtb3VzZURvd25IYW5kbGVyRnVuY3Rpb246ICgpID0+IHZvaWQ7XG5cbiAgICBjb25zdHJ1Y3RvcihidG5FbGVtZW50OiBIVE1MSW5wdXRFbGVtZW50LCBoYW5kbGVyRnVuY3Rpb246ICgpID0+IHZvaWQpIHtcblxuICAgICAgICB0aGlzLmJ0biA9IGJ0bkVsZW1lbnQ7XG4gICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uID0gaGFuZGxlckZ1bmN0aW9uO1xuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBNb3VzZUNvZGVzLkxFRlQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCk7IH0sIGtleURvd25SZXBlYXREZWxheSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB0aGlzLmJ0bi5mb2N1cygpOyAvLyBUT0RPOiBDaGVjayBwcm9ibGVtIGluIGNocm9tZSBpUGhvbmUgZW11bGF0b3Igd2hlcmUgaG92ZXIgaXMgbm90IHJlbW92ZWQgZnJvbSBwcmV2aW91c2x5IGZvY3VzZWQgZWxlbWVudC4gS25vd24gYXMgdGhlIHN0aWNreSBob3ZlciBwcm9ibGVtLlxuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4geyB0aGlzLm1vdXNlRG93bkxvb3AoKTsgfSwga2V5RG93blJlcGVhdERlbGF5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWRkIG1vdXNldXAgZXZlbnRsaXN0ZW5lciB0byBkb2N1bWVudCBpbiBjYXNlIHRoZSBtb3VzZSBpcyBtb3ZlZCBhd2F5IGZyb20gYnRuIGJlZm9yZSBpdCBpcyByZWxlYXNlZC5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBNb3VzZUNvZGVzLkxFRlQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRW5kIG9mIHRvdWNoIGV2ZW50c1xuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGNhbmNlbCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXRUaW1lZEVycm9yKGR1cmF0aW9uOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuZXJyb3JUaW1lcklkKTtcblxuICAgICAgICB0aGlzLmJ0bi5jbGFzc0xpc3QuYWRkKCdoYXMtZXJyb3InKTtcblxuICAgICAgICB0aGlzLmVycm9yVGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5idG4uY2xhc3NMaXN0LnJlbW92ZSgnaGFzLWVycm9yJyk7XG4gICAgICAgIH0sIGR1cmF0aW9uKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG1vdXNlRG93bkxvb3AoKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKCF0aGlzLm1vdXNlSXNQcmVzc2VkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbigpO1xuXG4gICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCk7IH0sIGtleURvd25SZXBlYXRJbnRlcnZhbCk7XG4gICAgfVxufSIsImltcG9ydCBNZXRyb25vbWVVaSBmcm9tICcuL01ldHJvbm9tZVVpJztcblxuLy8gQ2FuIHVzZSBEb2N1bWVudC5xdWVyeVNlbGVjdG9yKCkgaW5zdGVhZFxubGV0IHVpID0gbmV3IE1ldHJvbm9tZVVpKDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5UGF1c2VCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGFwQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsdXNzQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21pbnVzQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc2V0QnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lucHV0RGlzcGxheScpLFxuICAgIDxIVE1MTGFiZWxFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbnB1dERpc3BsYXlMYWJlbCcpKTtcbiJdfQ==
