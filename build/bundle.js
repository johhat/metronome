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
    Metronome.prototype.stopAudioLoop = function () {
        if (this.usesWorker) {
            this.intervalWorker.postMessage({ 'interval': 0 });
        }
        else {
            clearInterval(this.audioLoopTimerHandle);
        }
    };
    Metronome.prototype.audioLoop = function () {
        var _this = this;
        this.nextNoteTime = this.audioContext.currentTime + 0.1;
        this.next4thNote = 0;
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
"use strict";
/**
 * MetronomeUi
 */
var Metronome_1 = require('./Metronome');
var Tapper_1 = require('./Tapper');
var WhilePressedBtn_1 = require('./WhilePressedBtn');
var InputDisplay_1 = require('./InputDisplay');
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
        this.metronome.pause();
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

},{"./InputDisplay":1,"./Metronome":2,"./Tapper":4,"./WhilePressedBtn":5}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
"use strict";
var MetronomeUi_1 = require('./MetronomeUi');
// Can use Document.querySelector() instead
var ui = new MetronomeUi_1.default(document.getElementById('playPauseBtn'), document.getElementById('tapBtn'), document.getElementById('plussBtn'), document.getElementById('minusBtn'), document.getElementById('resetBtn'), document.getElementById('inputDisplay'), document.getElementById('inputDisplayLabel'));

},{"./MetronomeUi":3}]},{},[6])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvSW5wdXREaXNwbGF5LnRzIiwic3JjL01ldHJvbm9tZS50cyIsInNyYy9NZXRyb25vbWVVaS50cyIsInNyYy9UYXBwZXIudHMiLCJzcmMvV2hpbGVQcmVzc2VkQnRuLnRzIiwic3JjL21haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7O0dBRUc7QUFDSCxJQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsQ0FBQyxNQUFNO0FBQ25DLElBQUssS0FBNEI7QUFBakMsV0FBSyxLQUFLO0lBQUcsNkJBQUUsQ0FBQTtJQUFFLHVDQUFPLENBQUE7SUFBRSxtQ0FBSyxDQUFBO0FBQUMsQ0FBQyxFQUE1QixLQUFLLEtBQUwsS0FBSyxRQUF1QjtBQUVqQztJQU9JLHNCQUFvQixZQUE4QixFQUFVLEtBQXVCLEVBQy9FLFlBQW9CLEVBQ1osZUFBdUIsRUFDdkIsU0FBK0QsRUFDL0QsZUFBd0M7UUFYeEQsaUJBMEhDO1FBbkh1QixpQkFBWSxHQUFaLFlBQVksQ0FBa0I7UUFBVSxVQUFLLEdBQUwsS0FBSyxDQUFrQjtRQUV2RSxvQkFBZSxHQUFmLGVBQWUsQ0FBUTtRQUN2QixjQUFTLEdBQVQsU0FBUyxDQUFzRDtRQUMvRCxvQkFBZSxHQUFmLGVBQWUsQ0FBeUI7UUFQNUMsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFDekIsbUJBQWMsR0FBVyxDQUFDLENBQUM7UUFRL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUM7UUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2xELElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUV0QixJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFVBQUMsS0FBSztZQUM5QyxLQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDakMsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQsK0JBQVEsR0FBUixVQUFTLEtBQWE7UUFDbEIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7UUFDM0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNoRCxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxvQ0FBYSxHQUFiLFVBQWMsT0FBZSxFQUFFLFFBQWdCO1FBQS9DLGlCQVVDO1FBVEcsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVsQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTlCLElBQUksQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDO1lBQzdCLDBEQUEwRDtZQUMxRCxLQUFJLENBQUMsY0FBYyxDQUFDLEtBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDakQsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pCLENBQUM7SUFFTyxxQ0FBYyxHQUF0QixVQUF1QixLQUFhO1FBQ2hDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM5QixJQUFJLENBQUMsZUFBZSxDQUFDLDBDQUEwQyxDQUFDLENBQUM7WUFDakUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDN0IsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUNqQixDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QixJQUFJLENBQUMsZUFBZSxDQUFDLDBEQUEwRCxDQUFDLENBQUM7WUFDakYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDN0IsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUNqQixDQUFDO1FBRUQsSUFBSSxhQUFhLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRWxDLElBQUEsa0NBQWtELEVBQTdDLGdCQUFLLEVBQUUsZ0JBQUssQ0FBa0M7UUFFbkQsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMzQixNQUFNLENBQUMsS0FBSyxDQUFDO1FBQ2pCLENBQUM7UUFFRCxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUUzQyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFTyx1Q0FBZ0IsR0FBeEIsVUFBeUIsS0FBWTtRQUFyQyxpQkFjQztRQWJHLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDaEMsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVsQyxJQUFJLENBQUMsWUFBWSxHQUFHLFVBQVUsQ0FBQztZQUMzQixJQUFJLEtBQUssR0FBRyxLQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQztZQUVwQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM5QixNQUFNLENBQUM7WUFDWCxDQUFDO1lBRUQsS0FBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUV4QyxDQUFDLEVBQUUsZUFBZSxDQUFDLENBQUM7SUFDeEIsQ0FBQztJQUVPLCtCQUFRLEdBQWhCLFVBQWlCLFNBQWdCO1FBQzdCLHFEQUFxRDtRQUNyRCxJQUFJLGlCQUFpQixHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3ZELElBQUksY0FBYyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFbkQsRUFBRSxDQUFDLENBQUMsaUJBQWlCLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzQixJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUN0RCxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNuRCxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsY0FBYyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDeEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ2hELElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM3QyxDQUFDO1FBRUQsSUFBSSxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUM7SUFDM0IsQ0FBQztJQUVPLG9DQUFhLEdBQXJCLFVBQXNCLEtBQVk7UUFDOUIsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNaLEtBQUssS0FBSyxDQUFDLEVBQUU7Z0JBQ1QsTUFBTSxDQUFDLElBQUksQ0FBQztZQUNoQixLQUFLLEtBQUssQ0FBQyxPQUFPO2dCQUNkLE1BQU0sQ0FBQyxhQUFhLENBQUM7WUFDekIsS0FBSyxLQUFLLENBQUMsS0FBSztnQkFDWixNQUFNLENBQUMsV0FBVyxDQUFDO1lBQ3ZCO2dCQUNJLE9BQU8sQ0FBQyxHQUFHLENBQUMseURBQXlELEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQzlFLE1BQU0sQ0FBQyxFQUFFLENBQUM7UUFDbEIsQ0FBQztJQUNMLENBQUM7SUFFTyxzQ0FBZSxHQUF2QixVQUF3QixPQUFlO1FBQ25DLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQztJQUNyQyxDQUFDO0lBQ0wsbUJBQUM7QUFBRCxDQTFIQSxBQTBIQyxJQUFBO0FBMUhEOzhCQTBIQyxDQUFBOzs7O0FDaElEOztHQUVHO0FBQ0gsSUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUMsTUFBTTtBQUMzQixJQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsQ0FBQyxNQUFNO0FBQzVCLElBQU0sY0FBYyxHQUFHLENBQUMsQ0FBQztBQUV6QixJQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVO0FBQ25DLElBQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLENBQUMsMENBQTBDO0FBQ3pFLElBQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDLENBQUMsVUFBVTtBQUV6QyxJQUFLLEtBQXdCO0FBQTdCLFdBQUssS0FBSztJQUFHLGlDQUFJLENBQUE7SUFBRSwrQkFBRyxDQUFBO0lBQUUsK0JBQUcsQ0FBQTtBQUFDLENBQUMsRUFBeEIsS0FBSyxLQUFMLEtBQUssUUFBbUI7QUFBQSxDQUFDO0FBRTlCO0lBaUJJLG1CQUFZLEtBQWE7UUFqQjdCLGlCQTZMQztRQTFMVyxjQUFTLEdBQVksS0FBSyxDQUFDO1FBSTNCLGVBQVUsR0FBWSxLQUFLLENBQUM7UUFFNUIsZUFBVSxHQUFZLEtBQUssQ0FBQztRQUc1QixtQkFBYyxHQUFXLENBQUMsQ0FBQztRQUUzQixpQkFBWSxHQUFXLENBQUMsQ0FBQztRQUN6QixnQkFBVyxHQUFXLENBQUMsQ0FBQztRQUc1Qix5Q0FBeUM7UUFDekMsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQU8sTUFBTyxDQUFDLFlBQVksSUFBVSxNQUFPLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDO1FBQzNGLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFckIscUJBQXFCO1FBQ3JCLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQztZQUNmLEVBQUUsQ0FBQyxDQUFDLE9BQWEsS0FBSSxDQUFDLFlBQWEsQ0FBQyxNQUFNLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDeEQsTUFBTSxDQUFDLEtBQUssQ0FBQztZQUNqQixDQUFDO1lBRUQsRUFBRSxDQUFDLENBQUMsT0FBYSxLQUFJLENBQUMsWUFBYSxDQUFDLE9BQU8sS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUN6RCxNQUFNLENBQUMsS0FBSyxDQUFDO1lBQ2pCLENBQUM7WUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQ2hCLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFFTCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUNsQixZQUFZLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQzVCLElBQUksQ0FBQyxZQUFhLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDdkMsQ0FBQztRQUVELGlCQUFpQjtRQUNqQixJQUFJLENBQUMsVUFBVSxHQUFTLE1BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxHQUFHLEtBQUssQ0FBQztRQUV0RCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUNsQixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksTUFBTSxDQUFDLHlCQUF5QixDQUFDLENBQUM7WUFFNUQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLEdBQUcsVUFBQyxLQUFLO2dCQUNsQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUM7b0JBQ3hCLEtBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDckIsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDSixPQUFPLENBQUMsR0FBRyxDQUFDLDRCQUE0QixFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDMUQsQ0FBQztZQUNMLENBQUMsQ0FBQztRQUNOLENBQUM7SUFDTCxDQUFDO0lBRUQsd0JBQUksR0FBSjtRQUNJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDbEIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztnQkFBTyxJQUFJLENBQUMsWUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3ZELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ3RCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNyQixDQUFDO0lBQ0wsQ0FBQztJQUVELHlCQUFLLEdBQUw7UUFBQSxpQkFXQztRQVZHLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUNyQixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztZQUV2QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDbEIsSUFBSSxDQUFDLGNBQWMsR0FBRyxVQUFVLENBQUM7b0JBQ3ZCLEtBQUksQ0FBQyxZQUFhLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3ZDLENBQUMsRUFBRSxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDckMsQ0FBQztRQUNMLENBQUM7SUFDTCxDQUFDO0lBRUQsMEJBQU0sR0FBTjtRQUNJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNqQixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDSixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDaEIsQ0FBQztRQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQzFCLENBQUM7SUFFRCxpQ0FBYSxHQUFiLFVBQWMsS0FBYTtRQUN2QixFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2Ysd0JBQXdCO1lBQ3hCLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLHlCQUF5QixFQUFFLENBQUM7UUFDOUQsQ0FBQztRQUVELEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFdEIsRUFBRSxDQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDbkIsZUFBZTtZQUNmLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixHQUFHLFFBQVEsRUFBRSxDQUFDO1FBQ25FLENBQUM7UUFFRCxFQUFFLENBQUMsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNuQixlQUFlO1lBQ2YsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsZUFBZSxHQUFHLFFBQVEsRUFBRSxDQUFDO1FBQy9ELENBQUM7UUFFRCxNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUN0QyxDQUFDO0lBRUQsNEJBQVEsR0FBUixVQUFTLEtBQWE7UUFFbEIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLCtCQUErQjtZQUMvQixNQUFNLENBQUM7UUFDWCxDQUFDO1FBRUksMkNBQUssQ0FBOEI7UUFFeEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1QsTUFBTSxDQUFDO1FBQ1gsQ0FBQztRQUVELElBQUksQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCwrQkFBVyxHQUFYO1FBQ0ksTUFBTSxDQUFDLFFBQVEsQ0FBQztJQUNwQixDQUFDO0lBRUQsK0JBQVcsR0FBWDtRQUNJLE1BQU0sQ0FBQyxRQUFRLENBQUM7SUFDcEIsQ0FBQztJQUVPLGlDQUFhLEdBQXJCO1FBQ0ksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDbEIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDSixhQUFhLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDN0MsQ0FBQztJQUNMLENBQUM7SUFFTyw2QkFBUyxHQUFqQjtRQUFBLGlCQWFDO1FBWEcsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsR0FBRyxHQUFHLENBQUM7UUFDeEQsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFFckIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDbEIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO1FBQ3RFLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNKLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxXQUFXLENBQUM7Z0JBQ3BDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSSxDQUFDLFNBQVMsQ0FBQztvQkFBQyxNQUFNLENBQUM7Z0JBQzVCLEtBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNyQixDQUFDLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUN6QixDQUFDO0lBQ0wsQ0FBQztJQUVPLDZCQUFTLEdBQWpCO1FBQ0ksT0FBTyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxHQUFHLGlCQUFpQixFQUFFLENBQUM7WUFDM0UsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxXQUFXLEdBQUcsY0FBYyxHQUFHLEtBQUssQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pHLElBQUksY0FBYyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxZQUFZLElBQUksY0FBYyxDQUFDO1lBQ3BDLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxHQUFHLGNBQWMsQ0FBQztRQUMvRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLGdDQUFZLEdBQXBCLFVBQXFCLFNBQWlCLEVBQUUsS0FBWTtRQUVoRCxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDL0MsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRTNDLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztRQUVsQixNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1osS0FBSyxLQUFLLENBQUMsSUFBSTtnQkFDWCxTQUFTLEdBQUcsR0FBRyxDQUFDO2dCQUNoQixLQUFLLENBQUM7WUFDVixLQUFLLEtBQUssQ0FBQyxHQUFHO2dCQUNWLFNBQVMsR0FBRyxHQUFHLENBQUM7Z0JBQ2hCLEtBQUssQ0FBQztZQUNWLEtBQUssS0FBSyxDQUFDLEdBQUc7Z0JBQ1YsU0FBUyxHQUFHLEdBQUcsQ0FBQztnQkFDaEIsS0FBSyxDQUFDO1lBQ1Y7Z0JBQ0ksT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDN0IsU0FBUyxHQUFHLEdBQUcsQ0FBQztnQkFDaEIsS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQztRQUNoQyxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3JCLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFDTCxnQkFBQztBQUFELENBN0xBLEFBNkxDLElBQUE7QUE3TEQ7MkJBNkxDLENBQUE7Ozs7QUMxTUQ7O0dBRUc7QUFDSCwwQkFBc0IsYUFBYSxDQUFDLENBQUE7QUFDcEMsdUJBQW1CLFVBQVUsQ0FBQyxDQUFBO0FBQzlCLGdDQUE0QixtQkFBbUIsQ0FBQyxDQUFBO0FBQ2hELDZCQUF5QixnQkFBZ0IsQ0FBQyxDQUFBO0FBRTFDLElBQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxDQUFDLE1BQU07QUFDaEMsSUFBTSxlQUFlLEdBQUcsa0NBQWtDLENBQUM7QUFFM0QsSUFBSSxlQUFlLEdBQUcsQ0FBQztJQUNuQixJQUFJLElBQUksR0FBRyx1QkFBdUIsQ0FBQztJQUNuQyxJQUFJLENBQUM7UUFDRCxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNqQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDaEIsQ0FBRTtJQUFBLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDVCxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQ2pCLENBQUM7QUFDTCxDQUFDLENBQUMsRUFBRSxDQUFDO0FBRUwsSUFBSyxRQUF1QjtBQUE1QixXQUFLLFFBQVE7SUFBRywwQ0FBVSxDQUFBO0FBQUMsQ0FBQyxFQUF2QixRQUFRLEtBQVIsUUFBUSxRQUFlO0FBQUEsQ0FBQztBQUM3QixJQUFLLFVBQXVCO0FBQTVCLFdBQUssVUFBVTtJQUFHLDJDQUFRLENBQUE7QUFBQyxDQUFDLEVBQXZCLFVBQVUsS0FBVixVQUFVLFFBQWE7QUFBQSxDQUFDO0FBRTdCO0lBa0JJLHFCQUFvQixZQUE4QixFQUN0QyxNQUF3QixFQUNoQyxRQUEwQixFQUMxQixRQUEwQixFQUNsQixRQUEwQixFQUNsQyxZQUE4QixFQUM5QixpQkFBbUM7UUF4QjNDLGlCQXFOQztRQW5NdUIsaUJBQVksR0FBWixZQUFZLENBQWtCO1FBQ3RDLFdBQU0sR0FBTixNQUFNLENBQWtCO1FBR3hCLGFBQVEsR0FBUixRQUFRLENBQWtCO1FBcEI5QixjQUFTLEdBQVksS0FBSyxDQUFDO1FBQzNCLGlCQUFZLEdBQVcsWUFBWSxDQUFDO1FBRXBDLG1CQUFjLEdBQVksS0FBSyxDQUFDO1FBQ2hDLG1CQUFjLEdBQVksS0FBSyxDQUFDO1FBb0JwQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksbUJBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUU3QyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDN0MsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTdDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxnQkFBTSxFQUFFLENBQUM7UUFFM0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLHlCQUFlLENBQUMsUUFBUSxFQUFFLGNBQVEsS0FBSSxDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2RixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUkseUJBQWUsQ0FBQyxRQUFRLEVBQUUsY0FBUSxLQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZGLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxzQkFBWSxDQUFDLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUMvRixVQUFDLEtBQWE7WUFDVixxQkFBcUI7WUFDckIsTUFBTSxDQUFDLEtBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9DLENBQUMsRUFDRCxVQUFDLEtBQWE7WUFDVix5QkFBeUI7WUFDekIsS0FBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7WUFDMUIsS0FBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xDLENBQUMsQ0FDSixDQUFDO1FBRUYsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDO1FBRWpELHFCQUFxQjtRQUNyQixZQUFZLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFO1lBQ25DLEtBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUMzQixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUU7WUFDN0IsS0FBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2YsQ0FBQyxDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFO1lBQy9CLEtBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNqQixDQUFDLENBQUMsQ0FBQztRQUVILFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsVUFBQyxLQUFLO1lBQ3ZDLEtBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUIsQ0FBQyxDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFVBQUMsS0FBSztZQUNyQyxLQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVCLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLHlCQUFHLEdBQVg7UUFDSSxJQUFBLHNCQUF5RCxFQUFwRCw4QkFBWSxFQUFFLHdDQUFpQixDQUFzQjtRQUUxRCxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzFCLE1BQU0sQ0FBQztRQUNYLENBQUM7UUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRU8scUNBQWUsR0FBdkI7UUFDSSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDN0MsQ0FBQztJQUVPLDJDQUFxQixHQUE3QjtRQUVJLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBRXJDLElBQUEsMkNBQTJELEVBQXRELGdCQUFLLEVBQUUsZ0JBQUssQ0FBMkM7UUFFNUQsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1QsRUFBRSxDQUFDLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7Z0JBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDbEUsRUFBRSxDQUFDLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7Z0JBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDbEUsSUFBSSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzdDLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xDLE1BQU0sQ0FBQztRQUNYLENBQUM7UUFFRCxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTywyQ0FBcUIsR0FBN0I7UUFDSSxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQztRQUVyQyxJQUFBLDJDQUEyRCxFQUF0RCxnQkFBSyxFQUFFLGdCQUFLLENBQTJDO1FBRTVELEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNULEVBQUUsQ0FBQyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO2dCQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2xFLEVBQUUsQ0FBQyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO2dCQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2xFLElBQUksQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM3QyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQyxNQUFNLENBQUM7UUFDWCxDQUFDO1FBRUQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRU8sMkJBQUssR0FBYjtRQUNJLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN0QyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3BCLFlBQVksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUN6QixDQUFDO0lBRU8sbUNBQWEsR0FBckIsVUFBc0IsS0FBb0I7UUFDdEMsSUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQztRQUUxQixFQUFFLENBQUMsQ0FBQyxPQUFPLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN4QixLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDakMsQ0FBQztRQUVELEVBQUUsQ0FBQyxDQUFDLE9BQU8sS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQzFCLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUNqQyxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsT0FBTyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDdEIsOEVBQThFO1lBQzlFLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUV2QixFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUN2QixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDO1lBQy9CLENBQUM7UUFDTCxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sS0FBSyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNuQyw4RUFBOEU7WUFDOUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRXZCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDWCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQztZQUMvQixDQUFDO1FBQ0wsQ0FBQztJQUNMLENBQUM7SUFFTyxpQ0FBVyxHQUFuQixVQUFvQixLQUFvQjtRQUNwQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDeEIsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7UUFDaEMsQ0FBQztRQUVELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEtBQUssUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDbkMsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7UUFDaEMsQ0FBQztJQUNMLENBQUM7SUFFTyxxQ0FBZSxHQUF2QixVQUF3QixLQUFhO1FBRWpDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7UUFFdEMsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7UUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFN0IscURBQUssQ0FBd0M7UUFFbEQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNSLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM5QixJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbEMsQ0FBQztJQUNMLENBQUM7SUFFTyx1Q0FBaUIsR0FBekIsVUFBMEIsS0FBYTtRQUNuQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRU8seUNBQW1CLEdBQTNCO1FBRUksRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUM7WUFBQyxNQUFNLENBQUMsWUFBWSxDQUFDO1FBRTFDLElBQUksSUFBSSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFekMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ1IsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDdkQsTUFBTSxDQUFDLFlBQVksQ0FBQztRQUN4QixDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNkLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELE1BQU0sQ0FBQyxZQUFZLENBQUM7UUFDeEIsQ0FBQztRQUVELE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDeEIsQ0FBQztJQUVPLHVDQUFpQixHQUF6QixVQUEwQixLQUFhO1FBQ25DLEVBQUUsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDO1lBQUMsTUFBTSxDQUFDO1FBQzdCLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFDTCxrQkFBQztBQUFELENBck5BLEFBcU5DLElBQUE7QUFyTkQ7NkJBcU5DLENBQUE7Ozs7QUM5T0Q7O0dBRUc7QUFDSCxJQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsQ0FBQyxLQUFLO0FBRTlCO0lBT0k7UUFMUSxnQkFBVyxHQUFXLENBQUMsQ0FBQztRQUN4QixvQkFBZSxHQUFXLENBQUMsQ0FBQztRQUM1QixzQkFBaUIsR0FBVyxDQUFDLENBQUM7UUFDOUIsZ0JBQVcsR0FBVyxDQUFDLENBQUM7SUFFaEIsQ0FBQztJQUVqQixvQkFBRyxHQUFIO1FBQUEsaUJBZ0NDO1FBOUJHLFlBQVksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFL0IsSUFBSSxDQUFDLFdBQVcsR0FBRyxVQUFVLENBQUM7WUFDMUIsS0FBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2pCLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUVmLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDcEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3hDLE1BQU0sQ0FBQztnQkFDSCxZQUFZLEVBQUUsQ0FBQztnQkFDZixpQkFBaUIsRUFBRSxDQUFDO2FBQ3ZCLENBQUM7UUFDTixDQUFDO1FBRUQsSUFBSSxXQUFXLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QyxJQUFJLFFBQVEsR0FBRyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUM5QyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUUvQixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUV6QiwyQ0FBMkM7UUFDM0MsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUUvRyxJQUFJLEdBQUcsR0FBRyxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUM7UUFFN0MsdUNBQXVDO1FBQ3ZDLE1BQU0sQ0FBQztZQUNILFlBQVksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHO1lBQ3pDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7U0FDNUMsQ0FBQztJQUNOLENBQUM7SUFFRCxzQkFBSyxHQUFMO1FBQ0ksSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBQ0wsYUFBQztBQUFELENBaERBLEFBZ0RDLElBQUE7QUFoREQ7d0JBZ0RDLENBQUE7Ozs7QUNyREQ7O0dBRUc7QUFDSCxJQUFLLFVBQXVCO0FBQTVCLFdBQUssVUFBVTtJQUFHLDJDQUFRLENBQUE7QUFBQyxDQUFDLEVBQXZCLFVBQVUsS0FBVixVQUFVLFFBQWE7QUFBQSxDQUFDO0FBRTdCLElBQU0sa0JBQWtCLEdBQUcsR0FBRyxDQUFDLENBQUMsc0JBQXNCO0FBQ3RELElBQU0scUJBQXFCLEdBQUcsRUFBRSxDQUFDLENBQUMsc0JBQXNCO0FBRXhEO0lBU0kseUJBQVksVUFBNEIsRUFBRSxlQUEyQjtRQVR6RSxpQkFvRUM7UUFqRVcsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFFekIsbUJBQWMsR0FBWSxLQUFLLENBQUM7UUFDaEMseUJBQW9CLEdBQVcsQ0FBQyxDQUFDO1FBS3JDLElBQUksQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDO1FBQ3RCLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxlQUFlLENBQUM7UUFFaEQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLEVBQUUsVUFBQyxLQUFLO1lBQ3pDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLEtBQUssVUFBVSxDQUFDLElBQUksQ0FBQztnQkFBQyxNQUFNLENBQUM7WUFDNUMsS0FBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7WUFDM0IsS0FBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDaEMsS0FBSSxDQUFDLG9CQUFvQixHQUFHLFVBQVUsQ0FBQyxjQUFRLEtBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2hHLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsVUFBQyxLQUFLO1lBQzFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN2QixLQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsK0lBQStJO1lBQ2pLLEtBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDO1lBQzNCLEtBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1lBQ2hDLEtBQUksQ0FBQyxvQkFBb0IsR0FBRyxVQUFVLENBQUMsY0FBUSxLQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUNoRyxDQUFDLENBQUMsQ0FBQztRQUVILHdHQUF3RztRQUN4RyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFVBQUMsS0FBSztZQUN2QyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxLQUFLLFVBQVUsQ0FBQyxJQUFJLENBQUM7Z0JBQUMsTUFBTSxDQUFDO1lBQzVDLEtBQUksQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxLQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztRQUVILHNCQUFzQjtRQUN0QixJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxVQUFDLEtBQUs7WUFDeEMsS0FBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7WUFDNUIsWUFBWSxDQUFDLEtBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsVUFBQyxLQUFLO1lBQzNDLEtBQUksQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDO1lBQzVCLFlBQVksQ0FBQyxLQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFRCx1Q0FBYSxHQUFiLFVBQWMsUUFBZ0I7UUFBOUIsaUJBUUM7UUFQRyxZQUFZLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRWhDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUVwQyxJQUFJLENBQUMsWUFBWSxHQUFHLFVBQVUsQ0FBQztZQUMzQixLQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDM0MsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pCLENBQUM7SUFFTyx1Q0FBYSxHQUFyQjtRQUFBLGlCQVNDO1FBUEcsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztZQUN2QixNQUFNLENBQUM7UUFDWCxDQUFDO1FBRUQsSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFFaEMsSUFBSSxDQUFDLG9CQUFvQixHQUFHLFVBQVUsQ0FBQyxjQUFRLEtBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0lBQ25HLENBQUM7SUFDTCxzQkFBQztBQUFELENBcEVBLEFBb0VDLElBQUE7QUFwRUQ7aUNBb0VDLENBQUE7Ozs7QUM1RUQsNEJBQXdCLGVBQWUsQ0FBQyxDQUFBO0FBRXhDLDJDQUEyQztBQUMzQyxJQUFJLEVBQUUsR0FBRyxJQUFJLHFCQUFXLENBQW1CLFFBQVEsQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLEVBQzVELFFBQVEsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLEVBQ2pDLFFBQVEsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQ25DLFFBQVEsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQ25DLFFBQVEsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQ25DLFFBQVEsQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLEVBQ3ZDLFFBQVEsQ0FBQyxjQUFjLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogSW5wdXREaXNwbGF5XG4gKi9cbmNvbnN0IGlucHV0UmVhY3REZWxheSA9IDUwMDsgLy8gbXMuXG5lbnVtIFN0YXRlIHsgT0ssIFdBUk5JTkcsIEVSUk9SIH1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSW5wdXREaXNwbGF5IHtcblxuICAgIHByaXZhdGUgc3RhdGU6IFN0YXRlO1xuICAgIHByaXZhdGUgdmFsdWU6IG51bWJlcjtcbiAgICBwcml2YXRlIGlucHV0VGltZXJJZDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIG1lc3NhZ2VUaW1lcklkOiBudW1iZXIgPSAwO1xuXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSBpbnB1dERpc3BsYXk6IEhUTUxJbnB1dEVsZW1lbnQsIHByaXZhdGUgbGFiZWw6IEhUTUxMYWJlbEVsZW1lbnQsXG4gICAgICAgIGluaXRpYWxWYWx1ZTogbnVtYmVyLFxuICAgICAgICBwcml2YXRlIGRlZmF1bHRIZWxwVGV4dDogc3RyaW5nLFxuICAgICAgICBwcml2YXRlIHZhbGlkYXRvcjogKHZhbHVlOiBudW1iZXIpID0+IHsgdmFsaWQ6IGJvb2xlYW4sIGVycm9yOiBzdHJpbmcgfSxcbiAgICAgICAgcHJpdmF0ZSBvbk5ld1ZhbGlkVmFsdWU6ICh2YWx1ZTogbnVtYmVyKSA9PiB2b2lkKSB7XG5cbiAgICAgICAgdGhpcy52YWx1ZSA9IGluaXRpYWxWYWx1ZTtcbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkudmFsdWUgPSBpbml0aWFsVmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLk9LO1xuXG4gICAgICAgIHRoaXMuaGFuZGxlTmV3VmFsdWUoaW5pdGlhbFZhbHVlLnRvU3RyaW5nKCkpO1xuXG4gICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZUlucHV0RXZlbnQoZXZlbnQpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXRWYWx1ZSh2YWx1ZTogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMudmFsdWUgPSBNYXRoLnJvdW5kKHZhbHVlICogMTAwKSAvIDEwMDtcbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkudmFsdWUgPSB0aGlzLnZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgIHRoaXMuaGFuZGxlTmV3VmFsdWUodmFsdWUudG9TdHJpbmcoKSk7XG4gICAgfVxuXG4gICAgc2V0VGltZWRFcnJvcihtZXNzYWdlOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubWVzc2FnZVRpbWVySWQpO1xuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuRVJST1IpO1xuICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZShtZXNzYWdlKTtcblxuICAgICAgICB0aGlzLm1lc3NhZ2VUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAvLyBHbyBiYWNrIHRvIHN0YXRlIGNvcnJlc3BvbmRpbmcgdG8gY3VycmVudCBkaXNwbGF5IHZhbHVlXG4gICAgICAgICAgICB0aGlzLmhhbmRsZU5ld1ZhbHVlKHRoaXMuaW5wdXREaXNwbGF5LnZhbHVlKTtcbiAgICAgICAgfSwgZHVyYXRpb24pO1xuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlTmV3VmFsdWUodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAodmFsdWUudG9TdHJpbmcoKS5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZSgnVGhlIHZhbHVlIG11c3QgaGF2ZSBhdCBsZWFzdCB0d28gZGlnaXRzLicpO1xuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5XQVJOSU5HKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc05hTihOdW1iZXIodmFsdWUpKSkge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvck1lc3NhZ2UoJ1RoZSBlbnRlcmVkIHZhbHVlIGlzIG5vdCBhIG51bWJlci4gUGxlYXNlIGVudGVyIGEgbnVtYmVyJyk7XG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLldBUk5JTkcpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHZhbHVlQXNOdW1iZXIgPSBOdW1iZXIodmFsdWUpO1xuXG4gICAgICAgIGxldCB7dmFsaWQsIGVycm9yfSA9IHRoaXMudmFsaWRhdG9yKHZhbHVlQXNOdW1iZXIpO1xuXG4gICAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKGVycm9yKTtcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuRVJST1IpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5PSyk7XG4gICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKHRoaXMuZGVmYXVsdEhlbHBUZXh0KTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUlucHV0RXZlbnQoZXZlbnQ6IEV2ZW50KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLmlucHV0VGltZXJJZCk7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1lc3NhZ2VUaW1lcklkKTtcblxuICAgICAgICB0aGlzLmlucHV0VGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgbGV0IHZhbHVlID0gdGhpcy5pbnB1dERpc3BsYXkudmFsdWU7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5oYW5kbGVOZXdWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMub25OZXdWYWxpZFZhbHVlKE51bWJlcih2YWx1ZSkpO1xuXG4gICAgICAgIH0sIGlucHV0UmVhY3REZWxheSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRTdGF0ZShuZXh0U3RhdGU6IFN0YXRlKSB7XG4gICAgICAgIC8vIFNldCBDU1MgY2xhc3NlcyBjb3JyZXNwb25kaW5nIHRvIHRoZSBlbGVtZW50IHN0YXRlXG4gICAgICAgIGxldCBjdXJyZW50U3RhdGVDbGFzcyA9IHRoaXMuZ2V0U3RhdGVDbGFzcyh0aGlzLnN0YXRlKTtcbiAgICAgICAgbGV0IG5leHRTdGF0ZUNsYXNzID0gdGhpcy5nZXRTdGF0ZUNsYXNzKG5leHRTdGF0ZSk7XG5cbiAgICAgICAgaWYgKGN1cnJlbnRTdGF0ZUNsYXNzICE9PSAnJykge1xuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuY2xhc3NMaXN0LnJlbW92ZShjdXJyZW50U3RhdGVDbGFzcyk7XG4gICAgICAgICAgICB0aGlzLmxhYmVsLmNsYXNzTGlzdC5yZW1vdmUoY3VycmVudFN0YXRlQ2xhc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHRTdGF0ZUNsYXNzICE9PSAnJykge1xuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuY2xhc3NMaXN0LmFkZChuZXh0U3RhdGVDbGFzcyk7XG4gICAgICAgICAgICB0aGlzLmxhYmVsLmNsYXNzTGlzdC5hZGQobmV4dFN0YXRlQ2xhc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5leHRTdGF0ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFN0YXRlQ2xhc3Moc3RhdGU6IFN0YXRlKTogc3RyaW5nIHtcbiAgICAgICAgc3dpdGNoIChzdGF0ZSkge1xuICAgICAgICAgICAgY2FzZSBTdGF0ZS5PSzpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ29rJztcbiAgICAgICAgICAgIGNhc2UgU3RhdGUuV0FSTklORzpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ2hhcy13YXJuaW5nJztcbiAgICAgICAgICAgIGNhc2UgU3RhdGUuRVJST1I6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdoYXMtZXJyb3InO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnVHJpZWQgdG8gZ2V0IGNsYXNzIGNvcnJlc3BvbmRpbmcgdG8gbm9uLWV4aXN0aW5nIHN0YXRlOicsIHN0YXRlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldEVycm9yTWVzc2FnZShtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5sYWJlbC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgfVxufSIsIi8qKlxuICogTWV0cm9ub21lXG4gKi9cbmNvbnN0IG1pblRlbXBvID0gNDA7IC8vIEJQTVxuY29uc3QgbWF4VGVtcG8gPSAyNTA7IC8vIEJQTVxuY29uc3QgbnVtQmVhdHNQZXJCYXIgPSA0O1xuXG5jb25zdCBub3RlTGVuZ3RoID0gMC4wNTsgLy8gU2Vjb25kc1xuY29uc3Qgc2NoZWR1bGVJbnRlcnZhbCA9IDI1LjA7IC8vIG1zLiBIb3cgb2Z0ZW4gdGhlIHNjaGVkdWxpbmcgaXMgY2FsbGVkLlxuY29uc3Qgc2NoZWR1bGVBaGVhZFRpbWUgPSAwLjE7IC8vIFNlY29uZHNcblxuZW51bSBQaXRjaCB7IEhJR0gsIE1JRCwgTE9XIH07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1ldHJvbm9tZSB7XG5cbiAgICBwcml2YXRlIHRlbXBvOiBudW1iZXI7IC8vIGJlYXRzIHBlciBtaW51dGUgKEJQTSlcbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgYXVkaW9Db250ZXh0OiBBdWRpb0NvbnRleHQ7XG4gICAgcHJpdmF0ZSBhdWRpb0xvb3BUaW1lckhhbmRsZTogbnVtYmVyO1xuXG4gICAgcHJpdmF0ZSBjYW5TdXNwZW5kOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICBwcml2YXRlIHVzZXNXb3JrZXI6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIGludGVydmFsV29ya2VyOiBXb3JrZXI7XG5cbiAgICBwcml2YXRlIHN1c3BlbmRUaW1lcklkOiBudW1iZXIgPSAwO1xuXG4gICAgcHJpdmF0ZSBuZXh0Tm90ZVRpbWU6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBuZXh0NHRoTm90ZTogbnVtYmVyID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHRlbXBvOiBudW1iZXIpIHtcbiAgICAgICAgLy8gU2FmYXJpIG5lZWRzIHByZWZpeCB3ZWJraXRBdWRpb0NvbnRleHRcbiAgICAgICAgdGhpcy5hdWRpb0NvbnRleHQgPSBuZXcgKCg8YW55PndpbmRvdykuQXVkaW9Db250ZXh0IHx8ICg8YW55PndpbmRvdykud2Via2l0QXVkaW9Db250ZXh0KSgpO1xuICAgICAgICB0aGlzLnNldFRlbXBvKHRlbXBvKTtcblxuICAgICAgICAvLyAtLVN1c3BlbmQvcmVzdW1lLS1cbiAgICAgICAgdGhpcy5jYW5TdXNwZW5kID0gKCgpID0+IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgKDxhbnk+dGhpcy5hdWRpb0NvbnRleHQpLnJlc3VtZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiAoPGFueT50aGlzLmF1ZGlvQ29udGV4dCkuc3VzcGVuZCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KSgpO1xuXG4gICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN1c3BlbmRUaW1lcklkKTtcbiAgICAgICAgICAgICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5zdXNwZW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLVdlYiB3b3JrZXItLVxuICAgICAgICB0aGlzLnVzZXNXb3JrZXIgPSAoPGFueT53aW5kb3cpLldvcmtlciA/IHRydWUgOiBmYWxzZTtcblxuICAgICAgICBpZiAodGhpcy51c2VzV29ya2VyKSB7XG4gICAgICAgICAgICB0aGlzLmludGVydmFsV29ya2VyID0gbmV3IFdvcmtlcignYnVpbGQvSW50ZXJ2YWxXb3JrZXIuanMnKTtcblxuICAgICAgICAgICAgdGhpcy5pbnRlcnZhbFdvcmtlci5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQuZGF0YSA9PT0gJ3RpY2snKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVyKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0RhdGEgZnJvbSBpbnRlcnZhbFdvcmtlcjogJywgZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBsYXkoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5yZXN1bWUoKTtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuYXVkaW9Mb29wKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwYXVzZSgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3BBdWRpb0xvb3AoKTtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN1c3BlbmRUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5zdXNwZW5kKCk7XG4gICAgICAgICAgICAgICAgfSwgc2NoZWR1bGVBaGVhZFRpbWUgKiAxMDAwICogMik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0b2dnbGUoKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh0aGlzLmlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaXNQbGF5aW5nO1xuICAgIH1cblxuICAgIHZhbGlkYXRlVGVtcG8odGVtcG86IG51bWJlcik6IHsgdmFsaWQ6IGJvb2xlYW4sIGVycm9yOiBzdHJpbmcgfSB7XG4gICAgICAgIGlmIChpc05hTih0ZW1wbykpIHtcbiAgICAgICAgICAgIC8vIENoYW5nZSB0byBlcnJvciBzdGF0ZVxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcjogJ1lvdSBtdXN0IGVudGVyIGEgbnVtYmVyJyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGVtcG8gPSBOdW1iZXIodGVtcG8pO1xuXG4gICAgICAgIGlmICh0ZW1wbyA8IG1pblRlbXBvKSB7XG4gICAgICAgICAgICAvLyBTaWduYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3I6ICdNaW5pbXVtIHRlbXBvIGlzICcgKyBtaW5UZW1wbyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRlbXBvID4gbWF4VGVtcG8pIHtcbiAgICAgICAgICAgIC8vIFNpZ25hbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcjogJ01heCB0ZW1wbyBpcyAnICsgbWF4VGVtcG8gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHZhbGlkOiB0cnVlLCBlcnJvcjogJycgfTtcbiAgICB9XG5cbiAgICBzZXRUZW1wbyh0ZW1wbzogbnVtYmVyKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKHRoaXMudGVtcG8gPT09IHRlbXBvKSB7XG4gICAgICAgICAgICAvLyBEbyBub3RoaW5nIGlmIGl0IGlzIHRoZSBzYW1lXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQge3ZhbGlkfSA9IHRoaXMudmFsaWRhdGVUZW1wbyh0ZW1wbyk7XG5cbiAgICAgICAgaWYgKCF2YWxpZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50ZW1wbyA9IE51bWJlcih0ZW1wbyk7XG4gICAgfVxuXG4gICAgZ2V0TWluVGVtcG8oKSB7XG4gICAgICAgIHJldHVybiBtaW5UZW1wbztcbiAgICB9XG5cbiAgICBnZXRNYXhUZW1wbygpIHtcbiAgICAgICAgcmV0dXJuIG1heFRlbXBvO1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RvcEF1ZGlvTG9vcCgpIHtcbiAgICAgICAgaWYgKHRoaXMudXNlc1dvcmtlcikge1xuICAgICAgICAgICAgdGhpcy5pbnRlcnZhbFdvcmtlci5wb3N0TWVzc2FnZSh7ICdpbnRlcnZhbCc6IDAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuYXVkaW9Mb29wVGltZXJIYW5kbGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhdWRpb0xvb3AoKSB7XG5cbiAgICAgICAgdGhpcy5uZXh0Tm90ZVRpbWUgPSB0aGlzLmF1ZGlvQ29udGV4dC5jdXJyZW50VGltZSArIDAuMTtcbiAgICAgICAgdGhpcy5uZXh0NHRoTm90ZSA9IDA7XG5cbiAgICAgICAgaWYgKHRoaXMudXNlc1dvcmtlcikge1xuICAgICAgICAgICAgdGhpcy5pbnRlcnZhbFdvcmtlci5wb3N0TWVzc2FnZSh7ICdpbnRlcnZhbCc6IHNjaGVkdWxlSW50ZXJ2YWwgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmF1ZGlvTG9vcFRpbWVySGFuZGxlID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5pc1BsYXlpbmcpIHJldHVybjtcbiAgICAgICAgICAgICAgICB0aGlzLnNjaGVkdWxlcigpO1xuICAgICAgICAgICAgfSwgc2NoZWR1bGVJbnRlcnZhbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNjaGVkdWxlcigpIHtcbiAgICAgICAgd2hpbGUgKHRoaXMubmV4dE5vdGVUaW1lIDwgdGhpcy5hdWRpb0NvbnRleHQuY3VycmVudFRpbWUgKyBzY2hlZHVsZUFoZWFkVGltZSkge1xuICAgICAgICAgICAgdGhpcy5zY2hlZHVsZVRvbmUodGhpcy5uZXh0Tm90ZVRpbWUsIHRoaXMubmV4dDR0aE5vdGUgJSBudW1CZWF0c1BlckJhciA/IFBpdGNoLk1JRCA6IFBpdGNoLkhJR0gpO1xuICAgICAgICAgICAgbGV0IHNlY29uZHNQZXJCZWF0ID0gNjAuMCAvIHRoaXMudGVtcG87XG4gICAgICAgICAgICB0aGlzLm5leHROb3RlVGltZSArPSBzZWNvbmRzUGVyQmVhdDtcbiAgICAgICAgICAgIHRoaXMubmV4dDR0aE5vdGUgPSAodGhpcy5uZXh0NHRoTm90ZSArIDEpICUgbnVtQmVhdHNQZXJCYXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNjaGVkdWxlVG9uZShzdGFydFRpbWU6IG51bWJlciwgcGl0Y2g6IFBpdGNoKTogdm9pZCB7XG5cbiAgICAgICAgbGV0IG9zYyA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZU9zY2lsbGF0b3IoKTtcbiAgICAgICAgb3NjLmNvbm5lY3QodGhpcy5hdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuXG4gICAgICAgIGxldCBmcmVxdWVuY3kgPSAwO1xuXG4gICAgICAgIHN3aXRjaCAocGl0Y2gpIHtcbiAgICAgICAgICAgIGNhc2UgUGl0Y2guSElHSDpcbiAgICAgICAgICAgICAgICBmcmVxdWVuY3kgPSA4ODA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBpdGNoLk1JRDpcbiAgICAgICAgICAgICAgICBmcmVxdWVuY3kgPSA0NDA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBpdGNoLkxPVzpcbiAgICAgICAgICAgICAgICBmcmVxdWVuY3kgPSAyMjA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIHBpdGNoJyk7XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gMjIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXF1ZW5jeTtcbiAgICAgICAgb3NjLnN0YXJ0KHN0YXJ0VGltZSk7XG4gICAgICAgIG9zYy5zdG9wKHN0YXJ0VGltZSArIG5vdGVMZW5ndGgpO1xuICAgIH1cbn1cblxuIiwiLyoqXG4gKiBNZXRyb25vbWVVaVxuICovXG5pbXBvcnQgTWV0cm9ub21lIGZyb20gJy4vTWV0cm9ub21lJztcbmltcG9ydCBUYXBwZXIgZnJvbSAnLi9UYXBwZXInO1xuaW1wb3J0IFdoaWxlUHJlc3NlZEJ0biBmcm9tICcuL1doaWxlUHJlc3NlZEJ0bic7XG5pbXBvcnQgSW5wdXREaXNwbGF5IGZyb20gJy4vSW5wdXREaXNwbGF5JztcblxuY29uc3QgZGVmYXVsdFRlbXBvID0gMTIwOyAvLyBCUE1cbmNvbnN0IGRlZmF1bHRIZWxwVGV4dCA9ICdUZW1wbyBpbiBiZWF0cyBwZXIgbWludXRlIChCUE0pOic7XG5cbmxldCBoYXNMb2NhbFN0b3JhZ2UgPSAoKCkgPT4ge1xuICAgIGxldCB0ZXN0ID0gJ21ldHJvbm9tZS10ZXN0LXN0cmluZyc7XG4gICAgdHJ5IHtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGVzdCwgdGVzdCk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHRlc3QpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KSgpO1xuXG5lbnVtIEtleUNvZGVzIHsgU1BBQ0UgPSAzMiB9O1xuZW51bSBNb3VzZUNvZGVzIHsgTEVGVCA9IDEgfTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWV0cm9ub21lVWkge1xuXG4gICAgcHJpdmF0ZSBpc1BsYXlpbmc6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIGRpc3BsYXlWYWx1ZTogbnVtYmVyID0gZGVmYXVsdFRlbXBvO1xuXG4gICAgcHJpdmF0ZSBlbnRlcklzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgc3BhY2VJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAgIHByaXZhdGUgbWV0cm9ub21lOiBNZXRyb25vbWU7XG4gICAgcHJpdmF0ZSB0YXBwZXI6IFRhcHBlcjtcblxuICAgIHByaXZhdGUgbWluVGVtcG86IG51bWJlcjtcbiAgICBwcml2YXRlIG1heFRlbXBvOiBudW1iZXI7XG5cbiAgICBwcml2YXRlIHBsdXNzQnRuOiBXaGlsZVByZXNzZWRCdG47XG4gICAgcHJpdmF0ZSBtaW51c0J0bjogV2hpbGVQcmVzc2VkQnRuO1xuICAgIHByaXZhdGUgaW5wdXREaXNwbGF5OiBJbnB1dERpc3BsYXk7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBsYXlQYXVzZUJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSB0YXBCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIHBsdXNzQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBtaW51c0J0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSByZXNldEJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgaW5wdXREaXNwbGF5OiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBpbnB1dERpc3BsYXlMYWJlbDogSFRNTExhYmVsRWxlbWVudCkge1xuXG4gICAgICAgIHRoaXMubWV0cm9ub21lID0gbmV3IE1ldHJvbm9tZShkZWZhdWx0VGVtcG8pO1xuXG4gICAgICAgIHRoaXMubWluVGVtcG8gPSB0aGlzLm1ldHJvbm9tZS5nZXRNaW5UZW1wbygpO1xuICAgICAgICB0aGlzLm1heFRlbXBvID0gdGhpcy5tZXRyb25vbWUuZ2V0TWF4VGVtcG8oKTtcblxuICAgICAgICB0aGlzLnRhcHBlciA9IG5ldyBUYXBwZXIoKTtcblxuICAgICAgICB0aGlzLnBsdXNzQnRuID0gbmV3IFdoaWxlUHJlc3NlZEJ0bihwbHVzc0J0biwgKCkgPT4geyB0aGlzLmluY3JlbWVudERpc3BsYXlWYWx1ZSgpOyB9KTtcbiAgICAgICAgdGhpcy5taW51c0J0biA9IG5ldyBXaGlsZVByZXNzZWRCdG4obWludXNCdG4sICgpID0+IHsgdGhpcy5kZWNyZW1lbnREaXNwbGF5VmFsdWUoKTsgfSk7XG4gICAgICAgIHRoaXMuaW5wdXREaXNwbGF5ID0gbmV3IElucHV0RGlzcGxheShpbnB1dERpc3BsYXksIGlucHV0RGlzcGxheUxhYmVsLCBkZWZhdWx0VGVtcG8sIGRlZmF1bHRIZWxwVGV4dCxcbiAgICAgICAgICAgICh2YWx1ZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gVmFsaWRhdG9yIGZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8odmFsdWUpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICh2YWx1ZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gSGFuZGxlIG5ldyB2YWxpZCB2YWx1ZVxuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheVZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRNZXRyb25vbWVUZW1wbyh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG5cbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUodGhpcy5nZXRUZW1wb0Zyb21TdG9yYWdlKCkpO1xuXG4gICAgICAgIC8vIFNldCBldmVudCBoYW5kbGVyc1xuICAgICAgICBwbGF5UGF1c2VCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnRvZ2dsZVBsYXlQYXVzZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0YXBCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnRhcCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVLZXlEb3duKGV2ZW50KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlS2V5VXAoZXZlbnQpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHRhcCgpOiB2b2lkIHtcbiAgICAgICAgbGV0IHthdmVyYWdlVGVtcG8sIG51bVZhbHVlc0F2ZXJhZ2VkfSA9IHRoaXMudGFwcGVyLnRhcCgpO1xuXG4gICAgICAgIGlmIChudW1WYWx1ZXNBdmVyYWdlZCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ051bSB2YWx1ZXMgYXZlcmFnZWQ6JywgbnVtVmFsdWVzQXZlcmFnZWQpO1xuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShhdmVyYWdlVGVtcG8pO1xuICAgIH1cblxuICAgIHByaXZhdGUgdG9nZ2xlUGxheVBhdXNlKCk6IHZvaWQge1xuICAgICAgICB0aGlzLmlzUGxheWluZyA9IHRoaXMubWV0cm9ub21lLnRvZ2dsZSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaW5jcmVtZW50RGlzcGxheVZhbHVlKCk6IHZvaWQge1xuXG4gICAgICAgIGxldCBuZXdWYWx1ZSA9IHRoaXMuZGlzcGxheVZhbHVlICsgMTtcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKG5ld1ZhbHVlKTtcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgPiB0aGlzLm1heFRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZSh0aGlzLm1heFRlbXBvKTtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA8IHRoaXMubWluVGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMubWluVGVtcG8pO1xuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuc2V0VGltZWRFcnJvcihlcnJvciwgMjAwMCk7XG4gICAgICAgICAgICB0aGlzLnBsdXNzQnRuLnNldFRpbWVkRXJyb3IoMjAwMCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBkZWNyZW1lbnREaXNwbGF5VmFsdWUoKTogdm9pZCB7XG4gICAgICAgIGxldCBuZXdWYWx1ZSA9IHRoaXMuZGlzcGxheVZhbHVlIC0gMTtcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKG5ld1ZhbHVlKTtcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgPCB0aGlzLm1pblRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZSh0aGlzLm1pblRlbXBvKTtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA+IHRoaXMubWF4VGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMubWF4VGVtcG8pO1xuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuc2V0VGltZWRFcnJvcihlcnJvciwgMjAwMCk7XG4gICAgICAgICAgICB0aGlzLm1pbnVzQnRuLnNldFRpbWVkRXJyb3IoMjAwMCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUoZGVmYXVsdFRlbXBvKTtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUucGF1c2UoKTtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUuc2V0VGVtcG8oZGVmYXVsdFRlbXBvKTtcbiAgICAgICAgdGhpcy50YXBwZXIucmVzZXQoKTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVLZXlEb3duKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGtleU5hbWUgPSBldmVudC5rZXk7XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdBcnJvd1VwJykge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHRoaXMuaW5jcmVtZW50RGlzcGxheVZhbHVlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5TmFtZSA9PT0gJ0Fycm93RG93bicpIHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB0aGlzLmRlY3JlbWVudERpc3BsYXlWYWx1ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdFbnRlcicpIHtcbiAgICAgICAgICAgIC8vIE1heSBub3QgYmUgdmVyeSBpbnR1aXRpdmUuIEVnLiBlbnRlciBvbiByZXNldCBidXR0b24gd2lsbCBub3QgXCJwcmVzc1wiIHJlc2V0XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW50ZXJJc1ByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRvZ2dsZVBsYXlQYXVzZSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW50ZXJJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGVzLlNQQUNFKSB7XG4gICAgICAgICAgICAvLyBNYXkgbm90IGJlIHZlcnkgaW50dWl0aXZlLiBFZy4gc3BhY2Ugb24gcmVzZXQgYnV0dG9uIHdpbGwgbm90IFwicHJlc3NcIiByZXNldFxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNwYWNlSXNQcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50YXAoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNwYWNlSXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlS2V5VXAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VudGVyJykge1xuICAgICAgICAgICAgdGhpcy5lbnRlcklzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGVzLlNQQUNFKSB7XG4gICAgICAgICAgICB0aGlzLnNwYWNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldERpc3BsYXlWYWx1ZSh2YWx1ZTogbnVtYmVyKTogdm9pZCB7XG5cbiAgICAgICAgdmFsdWUgPSBNYXRoLnJvdW5kKHZhbHVlICogMTAwKSAvIDEwMDtcblxuICAgICAgICB0aGlzLmRpc3BsYXlWYWx1ZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5zZXRWYWx1ZSh2YWx1ZSk7XG5cbiAgICAgICAgbGV0IHt2YWxpZH0gPSB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKHZhbHVlKTtcblxuICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0TWV0cm9ub21lVGVtcG8odmFsdWUpO1xuICAgICAgICAgICAgdGhpcy5zZXRUZW1wb0luU3RvcmFnZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldE1ldHJvbm9tZVRlbXBvKHRlbXBvOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUuc2V0VGVtcG8odGVtcG8pO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0VGVtcG9Gcm9tU3RvcmFnZSgpOiBudW1iZXIge1xuXG4gICAgICAgIGlmICghaGFzTG9jYWxTdG9yYWdlKSByZXR1cm4gZGVmYXVsdFRlbXBvO1xuXG4gICAgICAgIGxldCBpdGVtID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3RlbXBvJyk7XG5cbiAgICAgICAgaWYgKCFpdGVtKSB7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndGVtcG8nLCBkZWZhdWx0VGVtcG8udG9TdHJpbmcoKSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmYXVsdFRlbXBvO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzTmFOKGl0ZW0pKSB7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndGVtcG8nLCBkZWZhdWx0VGVtcG8udG9TdHJpbmcoKSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmYXVsdFRlbXBvO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIE51bWJlcihpdGVtKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHNldFRlbXBvSW5TdG9yYWdlKHRlbXBvOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKCFoYXNMb2NhbFN0b3JhZ2UpIHJldHVybjtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3RlbXBvJywgdGVtcG8udG9TdHJpbmcoKSk7XG4gICAgfVxufSIsIi8qKlxuICogVGFwcGVyIC0gYSB0ZW1wbyB0YXBwZXIgbW9kdWxlLiBUaGUgdGFwcGVyIGF2ZXJhZ2VzIGNvbnNlY3V0aXZlIHZhbHVlcyBiZWZvcmUgcmVzZXR0aW5nIGFmdGVyIHJlc2V0QWZ0ZXIgbWlsbGlzZWNvbmRzLlxuICovXG5jb25zdCByZXNldEFmdGVyID0gNTAwMDsgLy8gbXNcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGFwcGVyIHtcblxuICAgIHByaXZhdGUgcHJldmlvdXNUYXA6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBhdmVyYWdlSW50ZXJ2YWw6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBudW1WYWx1ZXNBdmVyYWdlZDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIHRpbWVySGFuZGxlOiBudW1iZXIgPSAwO1xuXG4gICAgY29uc3RydWN0b3IoKSB7IH1cblxuICAgIHRhcCgpOiB7IGF2ZXJhZ2VUZW1wbzogbnVtYmVyLCBudW1WYWx1ZXNBdmVyYWdlZDogbnVtYmVyIH0ge1xuXG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVySGFuZGxlKTtcblxuICAgICAgICB0aGlzLnRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIH0sIHJlc2V0QWZ0ZXIpO1xuXG4gICAgICAgIGlmICghdGhpcy5wcmV2aW91c1RhcCkge1xuICAgICAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBhdmVyYWdlVGVtcG86IDAsXG4gICAgICAgICAgICAgICAgbnVtVmFsdWVzQXZlcmFnZWQ6IDBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3VycmVudFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgbGV0IGludGVydmFsID0gY3VycmVudFRpbWUgLSB0aGlzLnByZXZpb3VzVGFwO1xuICAgICAgICB0aGlzLnByZXZpb3VzVGFwID0gY3VycmVudFRpbWU7XG5cbiAgICAgICAgdGhpcy5udW1WYWx1ZXNBdmVyYWdlZCsrO1xuXG4gICAgICAgIC8vIFJlY3Vyc2l2ZSBhbGdvcml0aG0gZm9yIGxpbmVhciBhdmVyYWdpbmdcbiAgICAgICAgdGhpcy5hdmVyYWdlSW50ZXJ2YWwgPSB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCArICgxIC8gdGhpcy5udW1WYWx1ZXNBdmVyYWdlZCkgKiAoaW50ZXJ2YWwgLSB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCk7XG5cbiAgICAgICAgbGV0IGJwbSA9IDEwMDAgKiA2MC4wIC8gdGhpcy5hdmVyYWdlSW50ZXJ2YWw7XG5cbiAgICAgICAgLy8gUmV0dXJuIHZhbHVlIHJvdW5kZWQgdG8gdHdvIGRlY2ltYWxzXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhdmVyYWdlVGVtcG86IE1hdGgucm91bmQoYnBtICogMTAwKSAvIDEwMCxcbiAgICAgICAgICAgIG51bVZhbHVlc0F2ZXJhZ2VkOiB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmVzZXQoKTogdm9pZCB7XG4gICAgICAgIHRoaXMucHJldmlvdXNUYXAgPSAwO1xuICAgICAgICB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkID0gMDtcbiAgICAgICAgdGhpcy5hdmVyYWdlSW50ZXJ2YWwgPSAwO1xuICAgIH1cbn0iLCIvKipcbiAqIFdoaWxlUHJlc3NlZEJ0bi4gQSBidXR0b24gd2hpY2ggcmVwZWF0ZWRseSB0cmlnZ2VycyBhbiBldmVudCB3aGlsZSBwcmVzc2VkLlxuICovXG5lbnVtIE1vdXNlQ29kZXMgeyBMRUZUID0gMSB9O1xuXG5jb25zdCBrZXlEb3duUmVwZWF0RGVsYXkgPSA1MDA7IC8vIG1zLiBTYW1lIGFzIENocm9tZS5cbmNvbnN0IGtleURvd25SZXBlYXRJbnRlcnZhbCA9IDMwOyAvLyBtcy4gU2FtZSBhcyBDaHJvbWUuXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFdoaWxlUHJlc3NlZEJ0biB7XG5cbiAgICBwcml2YXRlIGJ0bjogSFRNTElucHV0RWxlbWVudDtcbiAgICBwcml2YXRlIGVycm9yVGltZXJJZDogbnVtYmVyID0gMDtcblxuICAgIHByaXZhdGUgbW91c2VJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIG1vdXNlRG93blRpbWVySGFuZGxlOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbW91c2VEb3duSGFuZGxlckZ1bmN0aW9uOiAoKSA9PiB2b2lkO1xuXG4gICAgY29uc3RydWN0b3IoYnRuRWxlbWVudDogSFRNTElucHV0RWxlbWVudCwgaGFuZGxlckZ1bmN0aW9uOiAoKSA9PiB2b2lkKSB7XG5cbiAgICAgICAgdGhpcy5idG4gPSBidG5FbGVtZW50O1xuICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbiA9IGhhbmRsZXJGdW5jdGlvbjtcblxuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC53aGljaCAhPT0gTW91c2VDb2Rlcy5MRUZUKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7IHRoaXMubW91c2VEb3duTG9vcCgpOyB9LCBrZXlEb3duUmVwZWF0RGVsYXkpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5idG4uZm9jdXMoKTsgLy8gVE9ETzogQ2hlY2sgcHJvYmxlbSBpbiBjaHJvbWUgaVBob25lIGVtdWxhdG9yIHdoZXJlIGhvdmVyIGlzIG5vdCByZW1vdmVkIGZyb20gcHJldmlvdXNseSBmb2N1c2VkIGVsZW1lbnQuIEtub3duIGFzIHRoZSBzdGlja3kgaG92ZXIgcHJvYmxlbS5cbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCk7IH0sIGtleURvd25SZXBlYXREZWxheSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBtb3VzZXVwIGV2ZW50bGlzdGVuZXIgdG8gZG9jdW1lbnQgaW4gY2FzZSB0aGUgbW91c2UgaXMgbW92ZWQgYXdheSBmcm9tIGJ0biBiZWZvcmUgaXQgaXMgcmVsZWFzZWQuXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC53aGljaCAhPT0gTW91c2VDb2Rlcy5MRUZUKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEVuZCBvZiB0b3VjaCBldmVudHNcbiAgICAgICAgdGhpcy5idG4uYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idG4uYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hjYW5jZWwnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0VGltZWRFcnJvcihkdXJhdGlvbjogbnVtYmVyKTogdm9pZCB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLmVycm9yVGltZXJJZCk7XG5cbiAgICAgICAgdGhpcy5idG4uY2xhc3NMaXN0LmFkZCgnaGFzLWVycm9yJyk7XG5cbiAgICAgICAgdGhpcy5lcnJvclRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuYnRuLmNsYXNzTGlzdC5yZW1vdmUoJ2hhcy1lcnJvcicpO1xuICAgICAgICB9LCBkdXJhdGlvbik7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBtb3VzZURvd25Mb29wKCk6IHZvaWQge1xuXG4gICAgICAgIGlmICghdGhpcy5tb3VzZUlzUHJlc3NlZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24oKTtcblxuICAgICAgICB0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7IHRoaXMubW91c2VEb3duTG9vcCgpOyB9LCBrZXlEb3duUmVwZWF0SW50ZXJ2YWwpO1xuICAgIH1cbn0iLCJpbXBvcnQgTWV0cm9ub21lVWkgZnJvbSAnLi9NZXRyb25vbWVVaSc7XG5cbi8vIENhbiB1c2UgRG9jdW1lbnQucXVlcnlTZWxlY3RvcigpIGluc3RlYWRcbmxldCB1aSA9IG5ldyBNZXRyb25vbWVVaSg8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheVBhdXNlQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RhcEJ0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbHVzc0J0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtaW51c0J0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXNldEJ0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbnB1dERpc3BsYXknKSxcbiAgICA8SFRNTExhYmVsRWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5wdXREaXNwbGF5TGFiZWwnKSk7XG4iXX0=
