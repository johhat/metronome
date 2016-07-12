(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
/**
 * InputDisplay
 */
var inputReactDelay = 500; //ms.
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
            //Go back to state corresponding to current display value
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
        //Set CSS classes corresponding to the element state
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
var minTempo = 40; //BPM
var maxTempo = 250; //BPM
var numBeatsPerBar = 4;
var noteLength = 0.05; //Seconds
var scheduleInterval = 25.0; //ms. How often the scheduling is called.
var scheduleAheadTime = 0.1; //Seconds
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
        this.currentBeat = 0;
        this.canSuspend = false;
        this.usesWorker = false;
        this.suspendTimerId = 0;
        this.nextNoteTime = 0;
        this.next4thNote = 0;
        //Safari needs prefix webkitAudioContext
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
            //Change to error state
            return { valid: false, error: 'You must enter a number' };
        }
        tempo = Number(tempo);
        if (tempo < minTempo) {
            //Signal error
            return { valid: false, error: 'Minimum tempo is ' + minTempo };
        }
        if (tempo > maxTempo) {
            //Signal error
            return { valid: false, error: 'Max tempo is ' + maxTempo };
        }
        return { valid: true, error: '' };
    };
    Metronome.prototype.setTempo = function (tempo) {
        if (this.tempo === tempo) {
            //Do nothing if it is the same
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
var defaultTempo = 120; //BPM
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
            //Validator function
            return _this.metronome.validateTempo(value);
        }, function (value) {
            //Handle new valid value
            _this.displayValue = value;
            _this.setMetronomeTempo(value);
        });
        this.setDisplayValue(this.getTempoFromStorage());
        //Set event handlers
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
            //May not be very intuitive. Eg. enter on reset button will not "press" reset
            event.preventDefault();
            if (!this.enterIsPressed) {
                this.togglePlayPause();
                this.enterIsPressed = true;
            }
        }
        if (event.keyCode === KeyCodes.SPACE) {
            //May not be very intuitive. Eg. space on reset button will not "press" reset
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
var resetAfter = 5000; //ms
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
        //Return value rounded to two decimals
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
var keyDownRepeatDelay = 500; //ms. Same as Chrome.
var keyDownRepeatInterval = 30; //ms. Same as Chrome.
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
            _this.btn.focus(); //TODO: Check problem in chrome iPhone emulator where hover is not removed from previously focused element. Known as the sticky hover problem.
            _this.mouseIsPressed = true;
            _this.mouseDownHandlerFunction();
            _this.mouseDownTimerHandle = setTimeout(function () { _this.mouseDownLoop(); }, keyDownRepeatDelay);
        });
        //Add mouseup eventlistener to document in case the mouse is moved away from btn before it is released.
        document.addEventListener('mouseup', function (event) {
            if (event.which !== MouseCodes.LEFT)
                return;
            _this.mouseIsPressed = false;
            clearTimeout(_this.mouseDownTimerHandle);
        });
        //End of touch events
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
var MetronomeUi_1 = require("./MetronomeUi");
//Can use Document.querySelector() instead
var ui = new MetronomeUi_1.default(document.getElementById('playPauseBtn'), document.getElementById('tapBtn'), document.getElementById('plussBtn'), document.getElementById('minusBtn'), document.getElementById('resetBtn'), document.getElementById('inputDisplay'), document.getElementById('inputDisplayLabel'));

},{"./MetronomeUi":3}]},{},[6])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvSW5wdXREaXNwbGF5LnRzIiwic3JjL01ldHJvbm9tZS50cyIsInNyYy9NZXRyb25vbWVVaS50cyIsInNyYy9UYXBwZXIudHMiLCJzcmMvV2hpbGVQcmVzc2VkQnRuLnRzIiwic3JjL21haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7O0dBRUc7QUFDSCxJQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsQ0FBQSxLQUFLO0FBQ2pDLElBQUssS0FBNEI7QUFBakMsV0FBSyxLQUFLO0lBQUcsNkJBQUUsQ0FBQTtJQUFFLHVDQUFPLENBQUE7SUFBRSxtQ0FBSyxDQUFBO0FBQUMsQ0FBQyxFQUE1QixLQUFLLEtBQUwsS0FBSyxRQUF1QjtBQUVqQztJQU9JLHNCQUFvQixZQUE4QixFQUFVLEtBQXVCLEVBQy9FLFlBQW9CLEVBQ1osZUFBdUIsRUFDdkIsU0FBK0QsRUFDL0QsZUFBd0M7UUFYeEQsaUJBMEhDO1FBbkh1QixpQkFBWSxHQUFaLFlBQVksQ0FBa0I7UUFBVSxVQUFLLEdBQUwsS0FBSyxDQUFrQjtRQUV2RSxvQkFBZSxHQUFmLGVBQWUsQ0FBUTtRQUN2QixjQUFTLEdBQVQsU0FBUyxDQUFzRDtRQUMvRCxvQkFBZSxHQUFmLGVBQWUsQ0FBeUI7UUFQNUMsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFDekIsbUJBQWMsR0FBVyxDQUFDLENBQUM7UUFRL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUM7UUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2xELElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUV0QixJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENB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QTBDO0FBQzFDLElBQUksRUFBRSxHQUFHLElBQUkscUJBQVcsQ0FBbUIsUUFBUSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsRUFDNUQsUUFBUSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFDakMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDbkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDbkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFDbkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsRUFDdkMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBJbnB1dERpc3BsYXlcbiAqL1xuY29uc3QgaW5wdXRSZWFjdERlbGF5ID0gNTAwOy8vbXMuXG5lbnVtIFN0YXRlIHsgT0ssIFdBUk5JTkcsIEVSUk9SIH1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSW5wdXREaXNwbGF5IHtcblxuICAgIHByaXZhdGUgc3RhdGU6IFN0YXRlO1xuICAgIHByaXZhdGUgdmFsdWU6IG51bWJlcjtcbiAgICBwcml2YXRlIGlucHV0VGltZXJJZDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIG1lc3NhZ2VUaW1lcklkOiBudW1iZXIgPSAwO1xuXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSBpbnB1dERpc3BsYXk6IEhUTUxJbnB1dEVsZW1lbnQsIHByaXZhdGUgbGFiZWw6IEhUTUxMYWJlbEVsZW1lbnQsXG4gICAgICAgIGluaXRpYWxWYWx1ZTogbnVtYmVyLFxuICAgICAgICBwcml2YXRlIGRlZmF1bHRIZWxwVGV4dDogc3RyaW5nLFxuICAgICAgICBwcml2YXRlIHZhbGlkYXRvcjogKHZhbHVlOiBudW1iZXIpID0+IHsgdmFsaWQ6IGJvb2xlYW4sIGVycm9yOiBzdHJpbmcgfSxcbiAgICAgICAgcHJpdmF0ZSBvbk5ld1ZhbGlkVmFsdWU6ICh2YWx1ZTogbnVtYmVyKSA9PiB2b2lkKSB7XG5cbiAgICAgICAgdGhpcy52YWx1ZSA9IGluaXRpYWxWYWx1ZTtcbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkudmFsdWUgPSBpbml0aWFsVmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLk9LO1xuXG4gICAgICAgIHRoaXMuaGFuZGxlTmV3VmFsdWUoaW5pdGlhbFZhbHVlLnRvU3RyaW5nKCkpO1xuXG4gICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZUlucHV0RXZlbnQoZXZlbnQpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBzZXRWYWx1ZSh2YWx1ZTogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMudmFsdWUgPSBNYXRoLnJvdW5kKHZhbHVlICogMTAwKSAvIDEwMDtcbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkudmFsdWUgPSB0aGlzLnZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgIHRoaXMuaGFuZGxlTmV3VmFsdWUodmFsdWUudG9TdHJpbmcoKSk7XG4gICAgfVxuXG4gICAgc2V0VGltZWRFcnJvcihtZXNzYWdlOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubWVzc2FnZVRpbWVySWQpXG5cbiAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5FUlJPUilcbiAgICAgICAgdGhpcy5zZXRFcnJvck1lc3NhZ2UobWVzc2FnZSlcblxuICAgICAgICB0aGlzLm1lc3NhZ2VUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAvL0dvIGJhY2sgdG8gc3RhdGUgY29ycmVzcG9uZGluZyB0byBjdXJyZW50IGRpc3BsYXkgdmFsdWVcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlTmV3VmFsdWUodGhpcy5pbnB1dERpc3BsYXkudmFsdWUpXG4gICAgICAgIH0sIGR1cmF0aW9uKVxuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlTmV3VmFsdWUodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAodmFsdWUudG9TdHJpbmcoKS5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZSgnVGhlIHZhbHVlIG11c3QgaGF2ZSBhdCBsZWFzdCB0d28gZGlnaXRzLicpO1xuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5XQVJOSU5HKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzTmFOKE51bWJlcih2YWx1ZSkpKSB7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZSgnVGhlIGVudGVyZWQgdmFsdWUgaXMgbm90IGEgbnVtYmVyLiBQbGVhc2UgZW50ZXIgYSBudW1iZXInKVxuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5XQVJOSU5HKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHZhbHVlQXNOdW1iZXIgPSBOdW1iZXIodmFsdWUpXG5cbiAgICAgICAgbGV0IHt2YWxpZCwgZXJyb3J9ID0gdGhpcy52YWxpZGF0b3IodmFsdWVBc051bWJlcik7XG5cbiAgICAgICAgaWYgKCF2YWxpZCkge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvck1lc3NhZ2UoZXJyb3IpXG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLkVSUk9SKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5PSylcbiAgICAgICAgdGhpcy5zZXRFcnJvck1lc3NhZ2UodGhpcy5kZWZhdWx0SGVscFRleHQpXG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVJbnB1dEV2ZW50KGV2ZW50OiBFdmVudCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5pbnB1dFRpbWVySWQpO1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tZXNzYWdlVGltZXJJZCk7XG5cbiAgICAgICAgdGhpcy5pbnB1dFRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGxldCB2YWx1ZSA9IHRoaXMuaW5wdXREaXNwbGF5LnZhbHVlO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuaGFuZGxlTmV3VmFsdWUodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMub25OZXdWYWxpZFZhbHVlKE51bWJlcih2YWx1ZSkpXG5cbiAgICAgICAgfSwgaW5wdXRSZWFjdERlbGF5KVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0U3RhdGUobmV4dFN0YXRlOiBTdGF0ZSkge1xuICAgICAgICAvL1NldCBDU1MgY2xhc3NlcyBjb3JyZXNwb25kaW5nIHRvIHRoZSBlbGVtZW50IHN0YXRlXG4gICAgICAgIGxldCBjdXJyZW50U3RhdGVDbGFzcyA9IHRoaXMuZ2V0U3RhdGVDbGFzcyh0aGlzLnN0YXRlKVxuICAgICAgICBsZXQgbmV4dFN0YXRlQ2xhc3MgPSB0aGlzLmdldFN0YXRlQ2xhc3MobmV4dFN0YXRlKTtcblxuICAgICAgICBpZiAoY3VycmVudFN0YXRlQ2xhc3MgIT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5jbGFzc0xpc3QucmVtb3ZlKGN1cnJlbnRTdGF0ZUNsYXNzKVxuICAgICAgICAgICAgdGhpcy5sYWJlbC5jbGFzc0xpc3QucmVtb3ZlKGN1cnJlbnRTdGF0ZUNsYXNzKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHRTdGF0ZUNsYXNzICE9PSAnJykge1xuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuY2xhc3NMaXN0LmFkZChuZXh0U3RhdGVDbGFzcylcbiAgICAgICAgICAgIHRoaXMubGFiZWwuY2xhc3NMaXN0LmFkZChuZXh0U3RhdGVDbGFzcylcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RhdGUgPSBuZXh0U3RhdGU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRTdGF0ZUNsYXNzKHN0YXRlOiBTdGF0ZSk6IHN0cmluZyB7XG4gICAgICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgICAgICAgIGNhc2UgU3RhdGUuT0s6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdvaydcbiAgICAgICAgICAgIGNhc2UgU3RhdGUuV0FSTklORzpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ2hhcy13YXJuaW5nJ1xuICAgICAgICAgICAgY2FzZSBTdGF0ZS5FUlJPUjpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ2hhcy1lcnJvcidcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1RyaWVkIHRvIGdldCBjbGFzcyBjb3JyZXNwb25kaW5nIHRvIG5vbi1leGlzdGluZyBzdGF0ZTonLCBzdGF0ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICcnXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldEVycm9yTWVzc2FnZShtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5sYWJlbC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgfVxufSIsIi8qKlxuICogTWV0cm9ub21lXG4gKi9cbmNvbnN0IG1pblRlbXBvID0gNDA7Ly9CUE1cbmNvbnN0IG1heFRlbXBvID0gMjUwOy8vQlBNXG5jb25zdCBudW1CZWF0c1BlckJhciA9IDQ7XG5cbmNvbnN0IG5vdGVMZW5ndGggPSAwLjA1Oy8vU2Vjb25kc1xuY29uc3Qgc2NoZWR1bGVJbnRlcnZhbCA9IDI1LjA7Ly9tcy4gSG93IG9mdGVuIHRoZSBzY2hlZHVsaW5nIGlzIGNhbGxlZC5cbmNvbnN0IHNjaGVkdWxlQWhlYWRUaW1lID0gMC4xOy8vU2Vjb25kc1xuXG5lbnVtIFBpdGNoIHsgSElHSCwgTUlELCBMT1cgfTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWV0cm9ub21lIHtcblxuICAgIHByaXZhdGUgdGVtcG86IG51bWJlcjsgLy9iZWF0cyBwZXIgbWludXRlIChCUE0pXG4gICAgcHJpdmF0ZSBpc1BsYXlpbmc6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIGN1cnJlbnRCZWF0OiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgYXVkaW9Db250ZXh0OiBBdWRpb0NvbnRleHQ7XG4gICAgcHJpdmF0ZSBhdWRpb0xvb3BUaW1lckhhbmRsZTogbnVtYmVyO1xuXG4gICAgcHJpdmF0ZSBjYW5TdXNwZW5kOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICBwcml2YXRlIHVzZXNXb3JrZXI6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIGludGVydmFsV29ya2VyOiBXb3JrZXI7XG5cbiAgICBwcml2YXRlIHN1c3BlbmRUaW1lcklkOiBudW1iZXIgPSAwO1xuXG4gICAgcHJpdmF0ZSBuZXh0Tm90ZVRpbWU6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBuZXh0NHRoTm90ZTogbnVtYmVyID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHRlbXBvOiBudW1iZXIpIHtcbiAgICAgICAgLy9TYWZhcmkgbmVlZHMgcHJlZml4IHdlYmtpdEF1ZGlvQ29udGV4dFxuICAgICAgICB0aGlzLmF1ZGlvQ29udGV4dCA9IG5ldyAoKDxhbnk+d2luZG93KS5BdWRpb0NvbnRleHQgfHwgKDxhbnk+d2luZG93KS53ZWJraXRBdWRpb0NvbnRleHQpKClcbiAgICAgICAgdGhpcy5zZXRUZW1wbyh0ZW1wbyk7XG5cbiAgICAgICAgLy8gLS1TdXNwZW5kL3Jlc3VtZS0tXG4gICAgICAgIHRoaXMuY2FuU3VzcGVuZCA9ICgoKSA9PiB7XG4gICAgICAgICAgICBpZiAodHlwZW9mICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5yZXN1bWUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiAoPGFueT50aGlzLmF1ZGlvQ29udGV4dCkuc3VzcGVuZCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSkoKVxuXG4gICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN1c3BlbmRUaW1lcklkKTtcbiAgICAgICAgICAgICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5zdXNwZW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLVdlYiB3b3JrZXItLVxuICAgICAgICB0aGlzLnVzZXNXb3JrZXIgPSAoPGFueT53aW5kb3cpLldvcmtlciA/IHRydWUgOiBmYWxzZVxuXG4gICAgICAgIGlmICh0aGlzLnVzZXNXb3JrZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJ2YWxXb3JrZXIgPSBuZXcgV29ya2VyKCdidWlsZC9JbnRlcnZhbFdvcmtlci5qcycpO1xuXG4gICAgICAgICAgICB0aGlzLmludGVydmFsV29ya2VyLm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChldmVudC5kYXRhID09PSAndGljaycpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zY2hlZHVsZXIoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRGF0YSBmcm9tIGludGVydmFsV29ya2VyOiAnLCBldmVudC5kYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwbGF5KCk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5jYW5TdXNwZW5kKSAoPGFueT50aGlzLmF1ZGlvQ29udGV4dCkucmVzdW1lKCk7XG4gICAgICAgICAgICB0aGlzLmlzUGxheWluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmF1ZGlvTG9vcCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcGF1c2UoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLmlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5zdG9wQXVkaW9Mb29wKCk7XG4gICAgICAgICAgICB0aGlzLmlzUGxheWluZyA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5jYW5TdXNwZW5kKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdXNwZW5kVGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAoPGFueT50aGlzLmF1ZGlvQ29udGV4dCkuc3VzcGVuZCgpO1xuICAgICAgICAgICAgICAgIH0sIHNjaGVkdWxlQWhlYWRUaW1lICogMTAwMCAqIDIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0b2dnbGUoKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh0aGlzLmlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaXNQbGF5aW5nO1xuICAgIH1cblxuICAgIHZhbGlkYXRlVGVtcG8odGVtcG86IG51bWJlcik6IHsgdmFsaWQ6IGJvb2xlYW4sIGVycm9yOiBzdHJpbmcgfSB7XG4gICAgICAgIGlmIChpc05hTih0ZW1wbykpIHtcbiAgICAgICAgICAgIC8vQ2hhbmdlIHRvIGVycm9yIHN0YXRlXG4gICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UsIGVycm9yOiAnWW91IG11c3QgZW50ZXIgYSBudW1iZXInIH07XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wbyA9IE51bWJlcih0ZW1wbyk7XG5cbiAgICAgICAgaWYgKHRlbXBvIDwgbWluVGVtcG8pIHtcbiAgICAgICAgICAgIC8vU2lnbmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UsIGVycm9yOiAnTWluaW11bSB0ZW1wbyBpcyAnICsgbWluVGVtcG8gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0ZW1wbyA+IG1heFRlbXBvKSB7XG4gICAgICAgICAgICAvL1NpZ25hbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcjogJ01heCB0ZW1wbyBpcyAnICsgbWF4VGVtcG8gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHZhbGlkOiB0cnVlLCBlcnJvcjogJycgfTtcbiAgICB9XG5cbiAgICBzZXRUZW1wbyh0ZW1wbzogbnVtYmVyKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKHRoaXMudGVtcG8gPT09IHRlbXBvKSB7XG4gICAgICAgICAgICAvL0RvIG5vdGhpbmcgaWYgaXQgaXMgdGhlIHNhbWVcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB7dmFsaWR9ID0gdGhpcy52YWxpZGF0ZVRlbXBvKHRlbXBvKVxuXG4gICAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudGVtcG8gPSBOdW1iZXIodGVtcG8pO1xuICAgIH1cblxuICAgIGdldE1pblRlbXBvKCkge1xuICAgICAgICByZXR1cm4gbWluVGVtcG9cbiAgICB9XG5cbiAgICBnZXRNYXhUZW1wbygpIHtcbiAgICAgICAgcmV0dXJuIG1heFRlbXBvXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdG9wQXVkaW9Mb29wKCkge1xuICAgICAgICBpZiAodGhpcy51c2VzV29ya2VyKSB7XG4gICAgICAgICAgICB0aGlzLmludGVydmFsV29ya2VyLnBvc3RNZXNzYWdlKHsgJ2ludGVydmFsJzogMCB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5hdWRpb0xvb3BUaW1lckhhbmRsZSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXVkaW9Mb29wKCkge1xuXG4gICAgICAgIHRoaXMubmV4dE5vdGVUaW1lID0gdGhpcy5hdWRpb0NvbnRleHQuY3VycmVudFRpbWUgKyAwLjE7XG4gICAgICAgIHRoaXMubmV4dDR0aE5vdGUgPSAwO1xuXG4gICAgICAgIGlmICh0aGlzLnVzZXNXb3JrZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJ2YWxXb3JrZXIucG9zdE1lc3NhZ2UoeyAnaW50ZXJ2YWwnOiBzY2hlZHVsZUludGVydmFsIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5hdWRpb0xvb3BUaW1lckhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNQbGF5aW5nKSByZXR1cm5cbiAgICAgICAgICAgICAgICB0aGlzLnNjaGVkdWxlcigpXG4gICAgICAgICAgICB9LCBzY2hlZHVsZUludGVydmFsKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzY2hlZHVsZXIoKSB7XG4gICAgICAgIHdoaWxlICh0aGlzLm5leHROb3RlVGltZSA8IHRoaXMuYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lICsgc2NoZWR1bGVBaGVhZFRpbWUpIHtcbiAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVUb25lKHRoaXMubmV4dE5vdGVUaW1lLCB0aGlzLm5leHQ0dGhOb3RlICUgbnVtQmVhdHNQZXJCYXIgPyBQaXRjaC5NSUQgOiBQaXRjaC5ISUdIKTtcbiAgICAgICAgICAgIGxldCBzZWNvbmRzUGVyQmVhdCA9IDYwLjAgLyB0aGlzLnRlbXBvO1xuICAgICAgICAgICAgdGhpcy5uZXh0Tm90ZVRpbWUgKz0gc2Vjb25kc1BlckJlYXQ7XG4gICAgICAgICAgICB0aGlzLm5leHQ0dGhOb3RlID0gKHRoaXMubmV4dDR0aE5vdGUgKyAxKSAlIG51bUJlYXRzUGVyQmFyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzY2hlZHVsZVRvbmUoc3RhcnRUaW1lOiBudW1iZXIsIHBpdGNoOiBQaXRjaCk6IHZvaWQge1xuXG4gICAgICAgIGxldCBvc2MgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gICAgICAgIG9zYy5jb25uZWN0KHRoaXMuYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgICAgICBsZXQgZnJlcXVlbmN5ID0gMDtcblxuICAgICAgICBzd2l0Y2ggKHBpdGNoKSB7XG4gICAgICAgICAgICBjYXNlIFBpdGNoLkhJR0g6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gODgwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5NSUQ6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gNDQwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5MT1c6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gMjIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBwaXRjaCcpXG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gMjIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXF1ZW5jeTtcbiAgICAgICAgb3NjLnN0YXJ0KHN0YXJ0VGltZSk7XG4gICAgICAgIG9zYy5zdG9wKHN0YXJ0VGltZSArIG5vdGVMZW5ndGgpO1xuICAgIH1cbn1cblxuIiwiLyoqXG4gKiBNZXRyb25vbWVVaVxuICovXG5pbXBvcnQgTWV0cm9ub21lIGZyb20gJy4vTWV0cm9ub21lJztcbmltcG9ydCBUYXBwZXIgZnJvbSAnLi9UYXBwZXInO1xuaW1wb3J0IFdoaWxlUHJlc3NlZEJ0biBmcm9tICcuL1doaWxlUHJlc3NlZEJ0bidcbmltcG9ydCBJbnB1dERpc3BsYXkgZnJvbSAnLi9JbnB1dERpc3BsYXknXG5cbmNvbnN0IGRlZmF1bHRUZW1wbyA9IDEyMDsgLy9CUE1cbmNvbnN0IGRlZmF1bHRIZWxwVGV4dCA9ICdUZW1wbyBpbiBiZWF0cyBwZXIgbWludXRlIChCUE0pOidcblxubGV0IGhhc0xvY2FsU3RvcmFnZSA9ICgoKSA9PiB7XG4gICAgbGV0IHRlc3QgPSAnbWV0cm9ub21lLXRlc3Qtc3RyaW5nJztcbiAgICB0cnkge1xuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0ZXN0LCB0ZXN0KTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0odGVzdCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pKClcblxuZW51bSBLZXlDb2RlcyB7IFNQQUNFID0gMzIgfTtcbmVudW0gTW91c2VDb2RlcyB7IExFRlQgPSAxIH07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1ldHJvbm9tZVVpIHtcblxuICAgIHByaXZhdGUgaXNQbGF5aW5nOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBkaXNwbGF5VmFsdWU6IG51bWJlciA9IGRlZmF1bHRUZW1wbztcblxuICAgIHByaXZhdGUgZW50ZXJJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIHNwYWNlSXNQcmVzc2VkOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICBwcml2YXRlIG1ldHJvbm9tZTogTWV0cm9ub21lO1xuICAgIHByaXZhdGUgdGFwcGVyOiBUYXBwZXJcblxuICAgIHByaXZhdGUgbWluVGVtcG8gOiBudW1iZXJcbiAgICBwcml2YXRlIG1heFRlbXBvIDogbnVtYmVyXG5cbiAgICBwcml2YXRlIHBsdXNzQnRuOiBXaGlsZVByZXNzZWRCdG47XG4gICAgcHJpdmF0ZSBtaW51c0J0bjogV2hpbGVQcmVzc2VkQnRuO1xuICAgIHByaXZhdGUgaW5wdXREaXNwbGF5OiBJbnB1dERpc3BsYXk7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBsYXlQYXVzZUJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSB0YXBCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIHBsdXNzQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBtaW51c0J0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSByZXNldEJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgaW5wdXREaXNwbGF5OiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBpbnB1dERpc3BsYXlMYWJlbDogSFRNTExhYmVsRWxlbWVudCkge1xuXG4gICAgICAgIHRoaXMubWV0cm9ub21lID0gbmV3IE1ldHJvbm9tZShkZWZhdWx0VGVtcG8pO1xuXG4gICAgICAgIHRoaXMubWluVGVtcG8gPSB0aGlzLm1ldHJvbm9tZS5nZXRNaW5UZW1wbygpO1xuICAgICAgICB0aGlzLm1heFRlbXBvID0gdGhpcy5tZXRyb25vbWUuZ2V0TWF4VGVtcG8oKTtcblxuICAgICAgICB0aGlzLnRhcHBlciA9IG5ldyBUYXBwZXIoKTtcblxuICAgICAgICB0aGlzLnBsdXNzQnRuID0gbmV3IFdoaWxlUHJlc3NlZEJ0bihwbHVzc0J0biwgKCkgPT4geyB0aGlzLmluY3JlbWVudERpc3BsYXlWYWx1ZSgpIH0pO1xuICAgICAgICB0aGlzLm1pbnVzQnRuID0gbmV3IFdoaWxlUHJlc3NlZEJ0bihtaW51c0J0biwgKCkgPT4geyB0aGlzLmRlY3JlbWVudERpc3BsYXlWYWx1ZSgpIH0pO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheSA9IG5ldyBJbnB1dERpc3BsYXkoaW5wdXREaXNwbGF5LCBpbnB1dERpc3BsYXlMYWJlbCwgZGVmYXVsdFRlbXBvLCBkZWZhdWx0SGVscFRleHQsXG4gICAgICAgICAgICAodmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIC8vVmFsaWRhdG9yIGZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8odmFsdWUpXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgKHZhbHVlOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICAvL0hhbmRsZSBuZXcgdmFsaWQgdmFsdWVcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlWYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0TWV0cm9ub21lVGVtcG8odmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMuZ2V0VGVtcG9Gcm9tU3RvcmFnZSgpKTtcblxuICAgICAgICAvL1NldCBldmVudCBoYW5kbGVyc1xuICAgICAgICBwbGF5UGF1c2VCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnRvZ2dsZVBsYXlQYXVzZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0YXBCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnRhcCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVLZXlEb3duKGV2ZW50KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlS2V5VXAoZXZlbnQpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHRhcCgpOiB2b2lkIHtcbiAgICAgICAgbGV0IHthdmVyYWdlVGVtcG8sIG51bVZhbHVlc0F2ZXJhZ2VkfSA9IHRoaXMudGFwcGVyLnRhcCgpO1xuXG4gICAgICAgIGlmIChudW1WYWx1ZXNBdmVyYWdlZCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ051bSB2YWx1ZXMgYXZlcmFnZWQ6JywgbnVtVmFsdWVzQXZlcmFnZWQpXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKGF2ZXJhZ2VUZW1wbylcbiAgICB9XG5cbiAgICBwcml2YXRlIHRvZ2dsZVBsYXlQYXVzZSgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5pc1BsYXlpbmcgPSB0aGlzLm1ldHJvbm9tZS50b2dnbGUoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGluY3JlbWVudERpc3BsYXlWYWx1ZSgpOiB2b2lkIHtcblxuICAgICAgICBsZXQgbmV3VmFsdWUgPSB0aGlzLmRpc3BsYXlWYWx1ZSArIDE7XG5cbiAgICAgICAgbGV0IHt2YWxpZCwgZXJyb3J9ID0gdGhpcy5tZXRyb25vbWUudmFsaWRhdGVUZW1wbyhuZXdWYWx1ZSlcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgPiB0aGlzLm1heFRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZSh0aGlzLm1heFRlbXBvKVxuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlIDwgdGhpcy5taW5UZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUodGhpcy5taW5UZW1wbylcbiAgICAgICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LnNldFRpbWVkRXJyb3IoZXJyb3IsIDIwMDApXG4gICAgICAgICAgICB0aGlzLnBsdXNzQnRuLnNldFRpbWVkRXJyb3IoMjAwMClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGRlY3JlbWVudERpc3BsYXlWYWx1ZSgpOiB2b2lkIHtcbiAgICAgICAgbGV0IG5ld1ZhbHVlID0gdGhpcy5kaXNwbGF5VmFsdWUgLSAxO1xuXG4gICAgICAgIGxldCB7dmFsaWQsIGVycm9yfSA9IHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8obmV3VmFsdWUpXG5cbiAgICAgICAgaWYgKCF2YWxpZCkge1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlIDwgdGhpcy5taW5UZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUodGhpcy5taW5UZW1wbylcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA+IHRoaXMubWF4VGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMubWF4VGVtcG8pXG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5zZXRUaW1lZEVycm9yKGVycm9yLCAyMDAwKVxuICAgICAgICAgICAgdGhpcy5taW51c0J0bi5zZXRUaW1lZEVycm9yKDIwMDApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUoZGVmYXVsdFRlbXBvKTtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUucGF1c2UoKTtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUuc2V0VGVtcG8oZGVmYXVsdFRlbXBvKTtcbiAgICAgICAgdGhpcy50YXBwZXIucmVzZXQoKTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLmNsZWFyKClcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUtleURvd24oZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qga2V5TmFtZSA9IGV2ZW50LmtleTtcblxuICAgICAgICBpZiAoa2V5TmFtZSA9PT0gJ0Fycm93VXAnKSB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5pbmNyZW1lbnREaXNwbGF5VmFsdWUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXlOYW1lID09PSAnQXJyb3dEb3duJykge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHRoaXMuZGVjcmVtZW50RGlzcGxheVZhbHVlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5TmFtZSA9PT0gJ0VudGVyJykge1xuICAgICAgICAgICAgLy9NYXkgbm90IGJlIHZlcnkgaW50dWl0aXZlLiBFZy4gZW50ZXIgb24gcmVzZXQgYnV0dG9uIHdpbGwgbm90IFwicHJlc3NcIiByZXNldFxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmVudGVySXNQcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50b2dnbGVQbGF5UGF1c2UoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVudGVySXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudC5rZXlDb2RlID09PSBLZXlDb2Rlcy5TUEFDRSkge1xuICAgICAgICAgICAgLy9NYXkgbm90IGJlIHZlcnkgaW50dWl0aXZlLiBFZy4gc3BhY2Ugb24gcmVzZXQgYnV0dG9uIHdpbGwgbm90IFwicHJlc3NcIiByZXNldFxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNwYWNlSXNQcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50YXAoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNwYWNlSXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlS2V5VXAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VudGVyJykge1xuICAgICAgICAgICAgdGhpcy5lbnRlcklzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGVzLlNQQUNFKSB7XG4gICAgICAgICAgICB0aGlzLnNwYWNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldERpc3BsYXlWYWx1ZSh2YWx1ZTogbnVtYmVyKTogdm9pZCB7XG5cbiAgICAgICAgdmFsdWUgPSBNYXRoLnJvdW5kKHZhbHVlICogMTAwKSAvIDEwMDtcblxuICAgICAgICB0aGlzLmRpc3BsYXlWYWx1ZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5zZXRWYWx1ZSh2YWx1ZSlcblxuICAgICAgICBsZXQge3ZhbGlkfSA9IHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8odmFsdWUpXG5cbiAgICAgICAgaWYgKHZhbGlkKSB7XG4gICAgICAgICAgICB0aGlzLnNldE1ldHJvbm9tZVRlbXBvKHZhbHVlKTtcbiAgICAgICAgICAgIHRoaXMuc2V0VGVtcG9JblN0b3JhZ2UodmFsdWUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldE1ldHJvbm9tZVRlbXBvKHRlbXBvOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUuc2V0VGVtcG8odGVtcG8pO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0VGVtcG9Gcm9tU3RvcmFnZSgpOiBudW1iZXIge1xuXG4gICAgICAgIGlmICghaGFzTG9jYWxTdG9yYWdlKSByZXR1cm4gZGVmYXVsdFRlbXBvXG5cbiAgICAgICAgbGV0IGl0ZW0gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndGVtcG8nKVxuXG4gICAgICAgIGlmICghaXRlbSkge1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3RlbXBvJywgZGVmYXVsdFRlbXBvLnRvU3RyaW5nKCkpXG4gICAgICAgICAgICByZXR1cm4gZGVmYXVsdFRlbXBvXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOYU4oaXRlbSkpIHtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0ZW1wbycsIGRlZmF1bHRUZW1wby50b1N0cmluZygpKVxuICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRUZW1wb1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIE51bWJlcihpdGVtKVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0VGVtcG9JblN0b3JhZ2UodGVtcG86IG51bWJlcikge1xuICAgICAgICBpZiAoIWhhc0xvY2FsU3RvcmFnZSkgcmV0dXJuXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0ZW1wbycsIHRlbXBvLnRvU3RyaW5nKCkpXG4gICAgfVxufSIsIi8qKlxuICogVGFwcGVyIC0gYSB0ZW1wbyB0YXBwZXIgbW9kdWxlLiBUaGUgdGFwcGVyIGF2ZXJhZ2VzIGNvbnNlY3V0aXZlIHZhbHVlcyBiZWZvcmUgcmVzZXR0aW5nIGFmdGVyIHJlc2V0QWZ0ZXIgbWlsbGlzZWNvbmRzLlxuICovXG5jb25zdCByZXNldEFmdGVyID0gNTAwMDsgLy9tc1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUYXBwZXIge1xuXG4gICAgcHJpdmF0ZSBwcmV2aW91c1RhcDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIGF2ZXJhZ2VJbnRlcnZhbDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIG51bVZhbHVlc0F2ZXJhZ2VkOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgdGltZXJIYW5kbGU6IG51bWJlciA9IDA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHsgfVxuXG4gICAgdGFwKCk6IHsgYXZlcmFnZVRlbXBvOiBudW1iZXIsIG51bVZhbHVlc0F2ZXJhZ2VkOiBudW1iZXIgfSB7XG5cbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZXJIYW5kbGUpXG5cbiAgICAgICAgdGhpcy50aW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZXNldCgpXG4gICAgICAgIH0sIHJlc2V0QWZ0ZXIpXG5cbiAgICAgICAgaWYgKCF0aGlzLnByZXZpb3VzVGFwKSB7XG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzVGFwID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGF2ZXJhZ2VUZW1wbzogMCxcbiAgICAgICAgICAgICAgICBudW1WYWx1ZXNBdmVyYWdlZDogMFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjdXJyZW50VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgICBsZXQgaW50ZXJ2YWwgPSBjdXJyZW50VGltZSAtIHRoaXMucHJldmlvdXNUYXA7XG4gICAgICAgIHRoaXMucHJldmlvdXNUYXAgPSBjdXJyZW50VGltZTtcblxuICAgICAgICB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkKytcblxuICAgICAgICAvLyBSZWN1cnNpdmUgYWxnb3JpdGhtIGZvciBsaW5lYXIgYXZlcmFnaW5nXG4gICAgICAgIHRoaXMuYXZlcmFnZUludGVydmFsID0gdGhpcy5hdmVyYWdlSW50ZXJ2YWwgKyAoMSAvIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQpICogKGludGVydmFsIC0gdGhpcy5hdmVyYWdlSW50ZXJ2YWwpXG5cbiAgICAgICAgbGV0IGJwbSA9IDEwMDAgKiA2MC4wIC8gdGhpcy5hdmVyYWdlSW50ZXJ2YWw7XG5cbiAgICAgICAgLy9SZXR1cm4gdmFsdWUgcm91bmRlZCB0byB0d28gZGVjaW1hbHNcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGF2ZXJhZ2VUZW1wbzogTWF0aC5yb3VuZChicG0gKiAxMDApIC8gMTAwLFxuICAgICAgICAgICAgbnVtVmFsdWVzQXZlcmFnZWQ6IHRoaXMubnVtVmFsdWVzQXZlcmFnZWRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IDA7XG4gICAgICAgIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQgPSAwO1xuICAgICAgICB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCA9IDA7XG4gICAgfVxufSIsIi8qKlxuICogV2hpbGVQcmVzc2VkQnRuLiBBIGJ1dHRvbiB3aGljaCByZXBlYXRlZGx5IHRyaWdnZXJzIGFuIGV2ZW50IHdoaWxlIHByZXNzZWQuXG4gKi9cbmVudW0gTW91c2VDb2RlcyB7IExFRlQgPSAxIH07XG5cbmNvbnN0IGtleURvd25SZXBlYXREZWxheSA9IDUwMDsgLy9tcy4gU2FtZSBhcyBDaHJvbWUuXG5jb25zdCBrZXlEb3duUmVwZWF0SW50ZXJ2YWwgPSAzMDsgLy9tcy4gU2FtZSBhcyBDaHJvbWUuXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFdoaWxlUHJlc3NlZEJ0biB7XG5cbiAgICBwcml2YXRlIGJ0bjogSFRNTElucHV0RWxlbWVudDtcbiAgICBwcml2YXRlIGVycm9yVGltZXJJZDogbnVtYmVyID0gMDtcblxuICAgIHByaXZhdGUgbW91c2VJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIG1vdXNlRG93blRpbWVySGFuZGxlOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbW91c2VEb3duSGFuZGxlckZ1bmN0aW9uOiAoKSA9PiB2b2lkO1xuXG4gICAgY29uc3RydWN0b3IoYnRuRWxlbWVudDogSFRNTElucHV0RWxlbWVudCwgaGFuZGxlckZ1bmN0aW9uOiAoKSA9PiB2b2lkKSB7XG5cbiAgICAgICAgdGhpcy5idG4gPSBidG5FbGVtZW50O1xuICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbiA9IGhhbmRsZXJGdW5jdGlvbjtcblxuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC53aGljaCAhPT0gTW91c2VDb2Rlcy5MRUZUKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7IHRoaXMubW91c2VEb3duTG9vcCgpIH0sIGtleURvd25SZXBlYXREZWxheSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgIHRoaXMuYnRuLmZvY3VzKCkgLy9UT0RPOiBDaGVjayBwcm9ibGVtIGluIGNocm9tZSBpUGhvbmUgZW11bGF0b3Igd2hlcmUgaG92ZXIgaXMgbm90IHJlbW92ZWQgZnJvbSBwcmV2aW91c2x5IGZvY3VzZWQgZWxlbWVudC4gS25vd24gYXMgdGhlIHN0aWNreSBob3ZlciBwcm9ibGVtLlxuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4geyB0aGlzLm1vdXNlRG93bkxvb3AoKSB9LCBrZXlEb3duUmVwZWF0RGVsYXkpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvL0FkZCBtb3VzZXVwIGV2ZW50bGlzdGVuZXIgdG8gZG9jdW1lbnQgaW4gY2FzZSB0aGUgbW91c2UgaXMgbW92ZWQgYXdheSBmcm9tIGJ0biBiZWZvcmUgaXQgaXMgcmVsZWFzZWQuXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC53aGljaCAhPT0gTW91c2VDb2Rlcy5MRUZUKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vRW5kIG9mIHRvdWNoIGV2ZW50c1xuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUpO1xuICAgICAgICB9KVxuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoY2FuY2VsJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSk7XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgc2V0VGltZWRFcnJvcihkdXJhdGlvbjogbnVtYmVyKTogdm9pZCB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLmVycm9yVGltZXJJZClcblxuICAgICAgICB0aGlzLmJ0bi5jbGFzc0xpc3QuYWRkKCdoYXMtZXJyb3InKVxuXG4gICAgICAgIHRoaXMuZXJyb3JUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmJ0bi5jbGFzc0xpc3QucmVtb3ZlKCdoYXMtZXJyb3InKVxuICAgICAgICB9LCBkdXJhdGlvbilcbiAgICB9XG5cbiAgICBwcml2YXRlIG1vdXNlRG93bkxvb3AoKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKCF0aGlzLm1vdXNlSXNQcmVzc2VkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbigpO1xuXG4gICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCkgfSwga2V5RG93blJlcGVhdEludGVydmFsKTtcbiAgICB9XG59IiwiaW1wb3J0IE1ldHJvbm9tZVVpIGZyb20gXCIuL01ldHJvbm9tZVVpXCJcblxuLy9DYW4gdXNlIERvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoKSBpbnN0ZWFkXG5sZXQgdWkgPSBuZXcgTWV0cm9ub21lVWkoPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXlQYXVzZUJ0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0YXBCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGx1c3NCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWludXNCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzZXRCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5wdXREaXNwbGF5JyksXG4gICAgPEhUTUxMYWJlbEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lucHV0RGlzcGxheUxhYmVsJykpO1xuIl19
