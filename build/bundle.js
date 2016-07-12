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
            console.log('Below min tempo');
            return { valid: false, error: 'Minimum tempo is ' + minTempo };
        }
        if (tempo > maxTempo) {
            //Signal error
            console.log('Above max tempo');
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
        console.log('New metronome tempo:', tempo);
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
        if (keyName === 'ArrowUp' || keyName === 'ArrowRight') {
            event.preventDefault();
            this.incrementDisplayValue();
        }
        if (keyName === 'ArrowDown' || keyName === 'ArrowLeft') {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvSW5wdXREaXNwbGF5LnRzIiwic3JjL01ldHJvbm9tZS50cyIsInNyYy9NZXRyb25vbWVVaS50cyIsInNyYy9UYXBwZXIudHMiLCJzcmMvV2hpbGVQcmVzc2VkQnRuLnRzIiwic3JjL21haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7O0dBRUc7QUFDSCxJQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsQ0FBQSxLQUFLO0FBQ2pDLElBQUssS0FBNEI7QUFBakMsV0FBSyxLQUFLO0lBQUcsNkJBQUUsQ0FBQTtJQUFFLHVDQUFPLENBQUE7SUFBRSxtQ0FBSyxDQUFBO0FBQUMsQ0FBQyxFQUE1QixLQUFLLEtBQUwsS0FBSyxRQUF1QjtBQUVqQztJQU9JLHNCQUFvQixZQUE4QixFQUFVLEtBQXVCLEVBQy9FLFlBQW9CLEVBQ1osZUFBdUIsRUFDdkIsU0FBK0QsRUFDL0QsZUFBd0M7UUFYeEQsaUJBMEhDO1FBbkh1QixpQkFBWSxHQUFaLFlBQVksQ0FBa0I7UUFBVSxVQUFLLEdBQUwsS0FBSyxDQUFrQjtRQUV2RSxvQkFBZSxHQUFmLGVBQWUsQ0FBUTtRQUN2QixjQUFTLEdBQVQsU0FBUyxDQUFzRDtRQUMvRCxvQkFBZSxHQUFmLGVBQWUsQ0FBeUI7UUFQNUMsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFDekIsbUJBQWMsR0FBVyxDQUFDLENBQUM7UUFRL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUM7UUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2xELElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUV0QixJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENB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QUcsVUFBVSxDQUFDLGNBQVEsS0FBSSxDQUFDLGFBQWEsRUFBRSxDQUFBLENBQUMsQ0FBQyxFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUNMLHNCQUFDO0FBQUQsQ0FwRUEsQUFvRUMsSUFBQTtBQXBFRDtpQ0FvRUMsQ0FBQTs7OztBQzVFRCw0QkFBd0IsZUFHeEIsQ0FBQyxDQUhzQztBQUV2QywwQ0FBMEM7QUFDMUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxxQkFBVyxDQUFtQixRQUFRLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxFQUM1RCxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxFQUNqQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxFQUN2QyxRQUFRLENBQUMsY0FBYyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIElucHV0RGlzcGxheVxuICovXG5jb25zdCBpbnB1dFJlYWN0RGVsYXkgPSA1MDA7Ly9tcy5cbmVudW0gU3RhdGUgeyBPSywgV0FSTklORywgRVJST1IgfVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJbnB1dERpc3BsYXkge1xuXG4gICAgcHJpdmF0ZSBzdGF0ZTogU3RhdGU7XG4gICAgcHJpdmF0ZSB2YWx1ZTogbnVtYmVyO1xuICAgIHByaXZhdGUgaW5wdXRUaW1lcklkOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbWVzc2FnZVRpbWVySWQ6IG51bWJlciA9IDA7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIGlucHV0RGlzcGxheTogSFRNTElucHV0RWxlbWVudCwgcHJpdmF0ZSBsYWJlbDogSFRNTExhYmVsRWxlbWVudCxcbiAgICAgICAgaW5pdGlhbFZhbHVlOiBudW1iZXIsXG4gICAgICAgIHByaXZhdGUgZGVmYXVsdEhlbHBUZXh0OiBzdHJpbmcsXG4gICAgICAgIHByaXZhdGUgdmFsaWRhdG9yOiAodmFsdWU6IG51bWJlcikgPT4geyB2YWxpZDogYm9vbGVhbiwgZXJyb3I6IHN0cmluZyB9LFxuICAgICAgICBwcml2YXRlIG9uTmV3VmFsaWRWYWx1ZTogKHZhbHVlOiBudW1iZXIpID0+IHZvaWQpIHtcblxuICAgICAgICB0aGlzLnZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IGluaXRpYWxWYWx1ZS50b1N0cmluZygpO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuT0s7XG5cbiAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZShpbml0aWFsVmFsdWUudG9TdHJpbmcoKSk7XG5cbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlSW5wdXRFdmVudChldmVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldFZhbHVlKHZhbHVlOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy52YWx1ZSA9IE1hdGgucm91bmQodmFsdWUgKiAxMDApIC8gMTAwO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IHRoaXMudmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZSh2YWx1ZS50b1N0cmluZygpKTtcbiAgICB9XG5cbiAgICBzZXRUaW1lZEVycm9yKG1lc3NhZ2U6IHN0cmluZywgZHVyYXRpb246IG51bWJlcikge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tZXNzYWdlVGltZXJJZClcblxuICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLkVSUk9SKVxuICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZShtZXNzYWdlKVxuXG4gICAgICAgIHRoaXMubWVzc2FnZVRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIC8vR28gYmFjayB0byBzdGF0ZSBjb3JyZXNwb25kaW5nIHRvIGN1cnJlbnQgZGlzcGxheSB2YWx1ZVxuICAgICAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZSh0aGlzLmlucHV0RGlzcGxheS52YWx1ZSlcbiAgICAgICAgfSwgZHVyYXRpb24pXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVOZXdWYWx1ZSh2YWx1ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh2YWx1ZS50b1N0cmluZygpLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKCdUaGUgdmFsdWUgbXVzdCBoYXZlIGF0IGxlYXN0IHR3byBkaWdpdHMuJyk7XG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLldBUk5JTkcpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOYU4oTnVtYmVyKHZhbHVlKSkpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKCdUaGUgZW50ZXJlZCB2YWx1ZSBpcyBub3QgYSBudW1iZXIuIFBsZWFzZSBlbnRlciBhIG51bWJlcicpXG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLldBUk5JTkcpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdmFsdWVBc051bWJlciA9IE51bWJlcih2YWx1ZSlcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLnZhbGlkYXRvcih2YWx1ZUFzTnVtYmVyKTtcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZShlcnJvcilcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuRVJST1IpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLk9LKVxuICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZSh0aGlzLmRlZmF1bHRIZWxwVGV4dClcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUlucHV0RXZlbnQoZXZlbnQ6IEV2ZW50KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLmlucHV0VGltZXJJZCk7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1lc3NhZ2VUaW1lcklkKTtcblxuICAgICAgICB0aGlzLmlucHV0VGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgbGV0IHZhbHVlID0gdGhpcy5pbnB1dERpc3BsYXkudmFsdWU7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5oYW5kbGVOZXdWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5vbk5ld1ZhbGlkVmFsdWUoTnVtYmVyKHZhbHVlKSlcblxuICAgICAgICB9LCBpbnB1dFJlYWN0RGVsYXkpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRTdGF0ZShuZXh0U3RhdGU6IFN0YXRlKSB7XG4gICAgICAgIC8vU2V0IENTUyBjbGFzc2VzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGVsZW1lbnQgc3RhdGVcbiAgICAgICAgbGV0IGN1cnJlbnRTdGF0ZUNsYXNzID0gdGhpcy5nZXRTdGF0ZUNsYXNzKHRoaXMuc3RhdGUpXG4gICAgICAgIGxldCBuZXh0U3RhdGVDbGFzcyA9IHRoaXMuZ2V0U3RhdGVDbGFzcyhuZXh0U3RhdGUpO1xuXG4gICAgICAgIGlmIChjdXJyZW50U3RhdGVDbGFzcyAhPT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LmNsYXNzTGlzdC5yZW1vdmUoY3VycmVudFN0YXRlQ2xhc3MpXG4gICAgICAgICAgICB0aGlzLmxhYmVsLmNsYXNzTGlzdC5yZW1vdmUoY3VycmVudFN0YXRlQ2xhc3MpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV4dFN0YXRlQ2xhc3MgIT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5jbGFzc0xpc3QuYWRkKG5leHRTdGF0ZUNsYXNzKVxuICAgICAgICAgICAgdGhpcy5sYWJlbC5jbGFzc0xpc3QuYWRkKG5leHRTdGF0ZUNsYXNzKVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5leHRTdGF0ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFN0YXRlQ2xhc3Moc3RhdGU6IFN0YXRlKTogc3RyaW5nIHtcbiAgICAgICAgc3dpdGNoIChzdGF0ZSkge1xuICAgICAgICAgICAgY2FzZSBTdGF0ZS5PSzpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ29rJ1xuICAgICAgICAgICAgY2FzZSBTdGF0ZS5XQVJOSU5HOlxuICAgICAgICAgICAgICAgIHJldHVybiAnaGFzLXdhcm5pbmcnXG4gICAgICAgICAgICBjYXNlIFN0YXRlLkVSUk9SOlxuICAgICAgICAgICAgICAgIHJldHVybiAnaGFzLWVycm9yJ1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnVHJpZWQgdG8gZ2V0IGNsYXNzIGNvcnJlc3BvbmRpbmcgdG8gbm9uLWV4aXN0aW5nIHN0YXRlOicsIHN0YXRlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJydcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0RXJyb3JNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICB0aGlzLmxhYmVsLnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICB9XG59IiwiLyoqXG4gKiBNZXRyb25vbWVcbiAqL1xuY29uc3QgbWluVGVtcG8gPSA0MDsvL0JQTVxuY29uc3QgbWF4VGVtcG8gPSAyNTA7Ly9CUE1cbmNvbnN0IG51bUJlYXRzUGVyQmFyID0gNDtcblxuY29uc3Qgbm90ZUxlbmd0aCA9IDAuMDU7Ly9TZWNvbmRzXG5jb25zdCBzY2hlZHVsZUludGVydmFsID0gMjUuMDsvL21zLiBIb3cgb2Z0ZW4gdGhlIHNjaGVkdWxpbmcgaXMgY2FsbGVkLlxuY29uc3Qgc2NoZWR1bGVBaGVhZFRpbWUgPSAwLjE7Ly9TZWNvbmRzXG5cbmVudW0gUGl0Y2ggeyBISUdILCBNSUQsIExPVyB9O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWUge1xuXG4gICAgcHJpdmF0ZSB0ZW1wbzogbnVtYmVyOyAvL2JlYXRzIHBlciBtaW51dGUgKEJQTSlcbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgY3VycmVudEJlYXQ6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBhdWRpb0NvbnRleHQ6IEF1ZGlvQ29udGV4dDtcbiAgICBwcml2YXRlIGF1ZGlvTG9vcFRpbWVySGFuZGxlOiBudW1iZXI7XG5cbiAgICBwcml2YXRlIGNhblN1c3BlbmQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAgIHByaXZhdGUgdXNlc1dvcmtlcjogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgaW50ZXJ2YWxXb3JrZXI6IFdvcmtlcjtcblxuICAgIHByaXZhdGUgc3VzcGVuZFRpbWVySWQ6IG51bWJlciA9IDA7XG5cbiAgICBwcml2YXRlIG5leHROb3RlVGltZTogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIG5leHQ0dGhOb3RlOiBudW1iZXIgPSAwO1xuXG4gICAgY29uc3RydWN0b3IodGVtcG86IG51bWJlcikge1xuICAgICAgICAvL1NhZmFyaSBuZWVkcyBwcmVmaXggd2Via2l0QXVkaW9Db250ZXh0XG4gICAgICAgIHRoaXMuYXVkaW9Db250ZXh0ID0gbmV3ICgoPGFueT53aW5kb3cpLkF1ZGlvQ29udGV4dCB8fCAoPGFueT53aW5kb3cpLndlYmtpdEF1ZGlvQ29udGV4dCkoKVxuICAgICAgICB0aGlzLnNldFRlbXBvKHRlbXBvKTtcblxuICAgICAgICAvLyAtLVN1c3BlbmQvcmVzdW1lLS1cbiAgICAgICAgdGhpcy5jYW5TdXNwZW5kID0gKCgpID0+IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgKDxhbnk+dGhpcy5hdWRpb0NvbnRleHQpLnJlc3VtZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5zdXNwZW5kICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9KSgpXG5cbiAgICAgICAgaWYgKHRoaXMuY2FuU3VzcGVuZCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3VzcGVuZFRpbWVySWQpO1xuICAgICAgICAgICAgKDxhbnk+dGhpcy5hdWRpb0NvbnRleHQpLnN1c3BlbmQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tV2ViIHdvcmtlci0tXG4gICAgICAgIHRoaXMudXNlc1dvcmtlciA9ICg8YW55PndpbmRvdykuV29ya2VyID8gdHJ1ZSA6IGZhbHNlXG5cbiAgICAgICAgaWYgKHRoaXMudXNlc1dvcmtlcikge1xuICAgICAgICAgICAgdGhpcy5pbnRlcnZhbFdvcmtlciA9IG5ldyBXb3JrZXIoJ2J1aWxkL0ludGVydmFsV29ya2VyLmpzJyk7XG5cbiAgICAgICAgICAgIHRoaXMuaW50ZXJ2YWxXb3JrZXIub25tZXNzYWdlID0gKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50LmRhdGEgPT09ICd0aWNrJykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjaGVkdWxlcigpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdEYXRhIGZyb20gaW50ZXJ2YWxXb3JrZXI6ICcsIGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBsYXkoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5yZXN1bWUoKTtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuYXVkaW9Mb29wKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwYXVzZSgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3BBdWRpb0xvb3AoKTtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN1c3BlbmRUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5zdXNwZW5kKCk7XG4gICAgICAgICAgICAgICAgfSwgc2NoZWR1bGVBaGVhZFRpbWUgKiAxMDAwICogMilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRvZ2dsZSgpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5pc1BsYXlpbmc7XG4gICAgfVxuXG4gICAgdmFsaWRhdGVUZW1wbyh0ZW1wbzogbnVtYmVyKTogeyB2YWxpZDogYm9vbGVhbiwgZXJyb3I6IHN0cmluZyB9IHtcbiAgICAgICAgaWYgKGlzTmFOKHRlbXBvKSkge1xuICAgICAgICAgICAgLy9DaGFuZ2UgdG8gZXJyb3Igc3RhdGVcbiAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3I6ICdZb3UgbXVzdCBlbnRlciBhIG51bWJlcicgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRlbXBvID0gTnVtYmVyKHRlbXBvKTtcblxuICAgICAgICBpZiAodGVtcG8gPCBtaW5UZW1wbykge1xuICAgICAgICAgICAgLy9TaWduYWwgZXJyb3JcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdCZWxvdyBtaW4gdGVtcG8nKVxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcjogJ01pbmltdW0gdGVtcG8gaXMgJyArIG1pblRlbXBvIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGVtcG8gPiBtYXhUZW1wbykge1xuICAgICAgICAgICAgLy9TaWduYWwgZXJyb3JcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdBYm92ZSBtYXggdGVtcG8nKVxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcjogJ01heCB0ZW1wbyBpcyAnICsgbWF4VGVtcG8gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHZhbGlkOiB0cnVlLCBlcnJvcjogJycgfTtcbiAgICB9XG5cbiAgICBzZXRUZW1wbyh0ZW1wbzogbnVtYmVyKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKHRoaXMudGVtcG8gPT09IHRlbXBvKSB7XG4gICAgICAgICAgICAvL0RvIG5vdGhpbmcgaWYgaXQgaXMgdGhlIHNhbWVcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB7dmFsaWR9ID0gdGhpcy52YWxpZGF0ZVRlbXBvKHRlbXBvKVxuXG4gICAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudGVtcG8gPSBOdW1iZXIodGVtcG8pO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKCdOZXcgbWV0cm9ub21lIHRlbXBvOicsIHRlbXBvKTtcbiAgICB9XG5cbiAgICBnZXRNaW5UZW1wbygpIHtcbiAgICAgICAgcmV0dXJuIG1pblRlbXBvXG4gICAgfVxuXG4gICAgZ2V0TWF4VGVtcG8oKSB7XG4gICAgICAgIHJldHVybiBtYXhUZW1wb1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RvcEF1ZGlvTG9vcCgpIHtcbiAgICAgICAgaWYgKHRoaXMudXNlc1dvcmtlcikge1xuICAgICAgICAgICAgdGhpcy5pbnRlcnZhbFdvcmtlci5wb3N0TWVzc2FnZSh7ICdpbnRlcnZhbCc6IDAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuYXVkaW9Mb29wVGltZXJIYW5kbGUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGF1ZGlvTG9vcCgpIHtcblxuICAgICAgICB0aGlzLm5leHROb3RlVGltZSA9IHRoaXMuYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lICsgMC4xO1xuICAgICAgICB0aGlzLm5leHQ0dGhOb3RlID0gMDtcblxuICAgICAgICBpZiAodGhpcy51c2VzV29ya2VyKSB7XG4gICAgICAgICAgICB0aGlzLmludGVydmFsV29ya2VyLnBvc3RNZXNzYWdlKHsgJ2ludGVydmFsJzogc2NoZWR1bGVJbnRlcnZhbCB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYXVkaW9Mb29wVGltZXJIYW5kbGUgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmlzUGxheWluZykgcmV0dXJuXG4gICAgICAgICAgICAgICAgdGhpcy5zY2hlZHVsZXIoKVxuICAgICAgICAgICAgfSwgc2NoZWR1bGVJbnRlcnZhbClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2NoZWR1bGVyKCkge1xuICAgICAgICB3aGlsZSAodGhpcy5uZXh0Tm90ZVRpbWUgPCB0aGlzLmF1ZGlvQ29udGV4dC5jdXJyZW50VGltZSArIHNjaGVkdWxlQWhlYWRUaW1lKSB7XG4gICAgICAgICAgICB0aGlzLnNjaGVkdWxlVG9uZSh0aGlzLm5leHROb3RlVGltZSwgdGhpcy5uZXh0NHRoTm90ZSAlIG51bUJlYXRzUGVyQmFyID8gUGl0Y2guTUlEIDogUGl0Y2guSElHSCk7XG4gICAgICAgICAgICBsZXQgc2Vjb25kc1BlckJlYXQgPSA2MC4wIC8gdGhpcy50ZW1wbztcbiAgICAgICAgICAgIHRoaXMubmV4dE5vdGVUaW1lICs9IHNlY29uZHNQZXJCZWF0O1xuICAgICAgICAgICAgdGhpcy5uZXh0NHRoTm90ZSA9ICh0aGlzLm5leHQ0dGhOb3RlICsgMSkgJSBudW1CZWF0c1BlckJhcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2NoZWR1bGVUb25lKHN0YXJ0VGltZTogbnVtYmVyLCBwaXRjaDogUGl0Y2gpOiB2b2lkIHtcblxuICAgICAgICBsZXQgb3NjID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpO1xuICAgICAgICBvc2MuY29ubmVjdCh0aGlzLmF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAgICAgbGV0IGZyZXF1ZW5jeSA9IDA7XG5cbiAgICAgICAgc3dpdGNoIChwaXRjaCkge1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5ISUdIOlxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDg4MDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUGl0Y2guTUlEOlxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDQ0MDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUGl0Y2guTE9XOlxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDIyMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgcGl0Y2gnKVxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDIyMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIG9zYy5mcmVxdWVuY3kudmFsdWUgPSBmcmVxdWVuY3k7XG4gICAgICAgIG9zYy5zdGFydChzdGFydFRpbWUpO1xuICAgICAgICBvc2Muc3RvcChzdGFydFRpbWUgKyBub3RlTGVuZ3RoKTtcbiAgICB9XG59XG5cbiIsIi8qKlxuICogTWV0cm9ub21lVWlcbiAqL1xuaW1wb3J0IE1ldHJvbm9tZSBmcm9tICcuL01ldHJvbm9tZSc7XG5pbXBvcnQgVGFwcGVyIGZyb20gJy4vVGFwcGVyJztcbmltcG9ydCBXaGlsZVByZXNzZWRCdG4gZnJvbSAnLi9XaGlsZVByZXNzZWRCdG4nXG5pbXBvcnQgSW5wdXREaXNwbGF5IGZyb20gJy4vSW5wdXREaXNwbGF5J1xuXG5jb25zdCBkZWZhdWx0VGVtcG8gPSAxMjA7IC8vQlBNXG5jb25zdCBkZWZhdWx0SGVscFRleHQgPSAnVGVtcG8gaW4gYmVhdHMgcGVyIG1pbnV0ZSAoQlBNKTonXG5cbmxldCBoYXNMb2NhbFN0b3JhZ2UgPSAoKCkgPT4ge1xuICAgIGxldCB0ZXN0ID0gJ21ldHJvbm9tZS10ZXN0LXN0cmluZyc7XG4gICAgdHJ5IHtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGVzdCwgdGVzdCk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHRlc3QpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KSgpXG5cbmVudW0gS2V5Q29kZXMgeyBTUEFDRSA9IDMyIH07XG5lbnVtIE1vdXNlQ29kZXMgeyBMRUZUID0gMSB9O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWVVaSB7XG5cbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgZGlzcGxheVZhbHVlOiBudW1iZXIgPSBkZWZhdWx0VGVtcG87XG5cbiAgICBwcml2YXRlIGVudGVySXNQcmVzc2VkOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBzcGFjZUlzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG4gICAgcHJpdmF0ZSBtZXRyb25vbWU6IE1ldHJvbm9tZTtcbiAgICBwcml2YXRlIHRhcHBlcjogVGFwcGVyXG5cbiAgICBwcml2YXRlIG1pblRlbXBvIDogbnVtYmVyXG4gICAgcHJpdmF0ZSBtYXhUZW1wbyA6IG51bWJlclxuXG4gICAgcHJpdmF0ZSBwbHVzc0J0bjogV2hpbGVQcmVzc2VkQnRuO1xuICAgIHByaXZhdGUgbWludXNCdG46IFdoaWxlUHJlc3NlZEJ0bjtcbiAgICBwcml2YXRlIGlucHV0RGlzcGxheTogSW5wdXREaXNwbGF5O1xuXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSBwbGF5UGF1c2VCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIHByaXZhdGUgdGFwQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBwbHVzc0J0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgbWludXNCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIHByaXZhdGUgcmVzZXRCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIGlucHV0RGlzcGxheTogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgaW5wdXREaXNwbGF5TGFiZWw6IEhUTUxMYWJlbEVsZW1lbnQpIHtcblxuICAgICAgICB0aGlzLm1ldHJvbm9tZSA9IG5ldyBNZXRyb25vbWUoZGVmYXVsdFRlbXBvKTtcblxuICAgICAgICB0aGlzLm1pblRlbXBvID0gdGhpcy5tZXRyb25vbWUuZ2V0TWluVGVtcG8oKTtcbiAgICAgICAgdGhpcy5tYXhUZW1wbyA9IHRoaXMubWV0cm9ub21lLmdldE1heFRlbXBvKCk7XG5cbiAgICAgICAgdGhpcy50YXBwZXIgPSBuZXcgVGFwcGVyKCk7XG5cbiAgICAgICAgdGhpcy5wbHVzc0J0biA9IG5ldyBXaGlsZVByZXNzZWRCdG4ocGx1c3NCdG4sICgpID0+IHsgdGhpcy5pbmNyZW1lbnREaXNwbGF5VmFsdWUoKSB9KTtcbiAgICAgICAgdGhpcy5taW51c0J0biA9IG5ldyBXaGlsZVByZXNzZWRCdG4obWludXNCdG4sICgpID0+IHsgdGhpcy5kZWNyZW1lbnREaXNwbGF5VmFsdWUoKSB9KTtcbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkgPSBuZXcgSW5wdXREaXNwbGF5KGlucHV0RGlzcGxheSwgaW5wdXREaXNwbGF5TGFiZWwsIGRlZmF1bHRUZW1wbywgZGVmYXVsdEhlbHBUZXh0LFxuICAgICAgICAgICAgKHZhbHVlOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICAvL1ZhbGlkYXRvciBmdW5jdGlvblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKHZhbHVlKVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICh2YWx1ZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9IYW5kbGUgbmV3IHZhbGlkIHZhbHVlXG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5VmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldE1ldHJvbm9tZVRlbXBvKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZSh0aGlzLmdldFRlbXBvRnJvbVN0b3JhZ2UoKSk7XG5cbiAgICAgICAgLy9TZXQgZXZlbnQgaGFuZGxlcnNcbiAgICAgICAgcGxheVBhdXNlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy50b2dnbGVQbGF5UGF1c2UoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGFwQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy50YXAoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmVzZXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlS2V5RG93bihldmVudCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZUtleVVwKGV2ZW50KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB0YXAoKTogdm9pZCB7XG4gICAgICAgIGxldCB7YXZlcmFnZVRlbXBvLCBudW1WYWx1ZXNBdmVyYWdlZH0gPSB0aGlzLnRhcHBlci50YXAoKTtcblxuICAgICAgICBpZiAobnVtVmFsdWVzQXZlcmFnZWQgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCdOdW0gdmFsdWVzIGF2ZXJhZ2VkOicsIG51bVZhbHVlc0F2ZXJhZ2VkKVxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShhdmVyYWdlVGVtcG8pXG4gICAgfVxuXG4gICAgcHJpdmF0ZSB0b2dnbGVQbGF5UGF1c2UoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdGhpcy5tZXRyb25vbWUudG9nZ2xlKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBpbmNyZW1lbnREaXNwbGF5VmFsdWUoKTogdm9pZCB7XG5cbiAgICAgICAgbGV0IG5ld1ZhbHVlID0gdGhpcy5kaXNwbGF5VmFsdWUgKyAxO1xuXG4gICAgICAgIGxldCB7dmFsaWQsIGVycm9yfSA9IHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8obmV3VmFsdWUpXG5cbiAgICAgICAgaWYgKCF2YWxpZCkge1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlID4gdGhpcy5tYXhUZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUodGhpcy5tYXhUZW1wbylcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA8IHRoaXMubWluVGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMubWluVGVtcG8pXG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5zZXRUaW1lZEVycm9yKGVycm9yLCAyMDAwKVxuICAgICAgICAgICAgdGhpcy5wbHVzc0J0bi5zZXRUaW1lZEVycm9yKDIwMDApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBkZWNyZW1lbnREaXNwbGF5VmFsdWUoKTogdm9pZCB7XG4gICAgICAgIGxldCBuZXdWYWx1ZSA9IHRoaXMuZGlzcGxheVZhbHVlIC0gMTtcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKG5ld1ZhbHVlKVxuXG4gICAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA8IHRoaXMubWluVGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMubWluVGVtcG8pXG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgPiB0aGlzLm1heFRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZSh0aGlzLm1heFRlbXBvKVxuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuc2V0VGltZWRFcnJvcihlcnJvciwgMjAwMClcbiAgICAgICAgICAgIHRoaXMubWludXNCdG4uc2V0VGltZWRFcnJvcigyMDAwKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUobmV3VmFsdWUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcmVzZXQoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKGRlZmF1bHRUZW1wbyk7XG4gICAgICAgIHRoaXMubWV0cm9ub21lLnBhdXNlKCk7XG4gICAgICAgIHRoaXMubWV0cm9ub21lLnNldFRlbXBvKGRlZmF1bHRUZW1wbyk7XG4gICAgICAgIHRoaXMudGFwcGVyLnJlc2V0KCk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5jbGVhcigpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVLZXlEb3duKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGtleU5hbWUgPSBldmVudC5rZXk7XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdBcnJvd1VwJyB8fCBrZXlOYW1lID09PSAnQXJyb3dSaWdodCcpIHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB0aGlzLmluY3JlbWVudERpc3BsYXlWYWx1ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdBcnJvd0Rvd24nIHx8IGtleU5hbWUgPT09ICdBcnJvd0xlZnQnKSB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5kZWNyZW1lbnREaXNwbGF5VmFsdWUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXlOYW1lID09PSAnRW50ZXInKSB7XG4gICAgICAgICAgICAvL01heSBub3QgYmUgdmVyeSBpbnR1aXRpdmUuIEVnLiBlbnRlciBvbiByZXNldCBidXR0b24gd2lsbCBub3QgXCJwcmVzc1wiIHJlc2V0XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW50ZXJJc1ByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRvZ2dsZVBsYXlQYXVzZSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW50ZXJJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGVzLlNQQUNFKSB7XG4gICAgICAgICAgICAvL01heSBub3QgYmUgdmVyeSBpbnR1aXRpdmUuIEVnLiBzcGFjZSBvbiByZXNldCBidXR0b24gd2lsbCBub3QgXCJwcmVzc1wiIHJlc2V0XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuc3BhY2VJc1ByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRhcCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3BhY2VJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVLZXlVcChldmVudDogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgICAgICBpZiAoZXZlbnQua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICAgICAgICB0aGlzLmVudGVySXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZXMuU1BBQ0UpIHtcbiAgICAgICAgICAgIHRoaXMuc3BhY2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0RGlzcGxheVZhbHVlKHZhbHVlOiBudW1iZXIpOiB2b2lkIHtcblxuICAgICAgICB2YWx1ZSA9IE1hdGgucm91bmQodmFsdWUgKiAxMDApIC8gMTAwO1xuXG4gICAgICAgIHRoaXMuZGlzcGxheVZhbHVlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LnNldFZhbHVlKHZhbHVlKVxuXG4gICAgICAgIGxldCB7dmFsaWR9ID0gdGhpcy5tZXRyb25vbWUudmFsaWRhdGVUZW1wbyh2YWx1ZSlcblxuICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0TWV0cm9ub21lVGVtcG8odmFsdWUpO1xuICAgICAgICAgICAgdGhpcy5zZXRUZW1wb0luU3RvcmFnZSh2YWx1ZSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0TWV0cm9ub21lVGVtcG8odGVtcG86IG51bWJlcik6IHZvaWQge1xuICAgICAgICB0aGlzLm1ldHJvbm9tZS5zZXRUZW1wbyh0ZW1wbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRUZW1wb0Zyb21TdG9yYWdlKCk6IG51bWJlciB7XG5cbiAgICAgICAgaWYgKCFoYXNMb2NhbFN0b3JhZ2UpIHJldHVybiBkZWZhdWx0VGVtcG9cblxuICAgICAgICBsZXQgaXRlbSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd0ZW1wbycpXG5cbiAgICAgICAgaWYgKCFpdGVtKSB7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndGVtcG8nLCBkZWZhdWx0VGVtcG8udG9TdHJpbmcoKSlcbiAgICAgICAgICAgIHJldHVybiBkZWZhdWx0VGVtcG9cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc05hTihpdGVtKSkge1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3RlbXBvJywgZGVmYXVsdFRlbXBvLnRvU3RyaW5nKCkpXG4gICAgICAgICAgICByZXR1cm4gZGVmYXVsdFRlbXBvXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTnVtYmVyKGl0ZW0pXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRUZW1wb0luU3RvcmFnZSh0ZW1wbzogbnVtYmVyKSB7XG4gICAgICAgIGlmICghaGFzTG9jYWxTdG9yYWdlKSByZXR1cm5cbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3RlbXBvJywgdGVtcG8udG9TdHJpbmcoKSlcbiAgICB9XG59IiwiLyoqXG4gKiBUYXBwZXIgLSBhIHRlbXBvIHRhcHBlciBtb2R1bGUuIFRoZSB0YXBwZXIgYXZlcmFnZXMgY29uc2VjdXRpdmUgdmFsdWVzIGJlZm9yZSByZXNldHRpbmcgYWZ0ZXIgcmVzZXRBZnRlciBtaWxsaXNlY29uZHMuXG4gKi9cbmNvbnN0IHJlc2V0QWZ0ZXIgPSA1MDAwOyAvL21zXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRhcHBlciB7XG5cbiAgICBwcml2YXRlIHByZXZpb3VzVGFwOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgYXZlcmFnZUludGVydmFsOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbnVtVmFsdWVzQXZlcmFnZWQ6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSB0aW1lckhhbmRsZTogbnVtYmVyID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKCkgeyB9XG5cbiAgICB0YXAoKTogeyBhdmVyYWdlVGVtcG86IG51bWJlciwgbnVtVmFsdWVzQXZlcmFnZWQ6IG51bWJlciB9IHtcblxuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lckhhbmRsZSlcblxuICAgICAgICB0aGlzLnRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlc2V0KClcbiAgICAgICAgfSwgcmVzZXRBZnRlcilcblxuICAgICAgICBpZiAoIXRoaXMucHJldmlvdXNUYXApIHtcbiAgICAgICAgICAgIHRoaXMucHJldmlvdXNUYXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgYXZlcmFnZVRlbXBvOiAwLFxuICAgICAgICAgICAgICAgIG51bVZhbHVlc0F2ZXJhZ2VkOiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGN1cnJlbnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIGxldCBpbnRlcnZhbCA9IGN1cnJlbnRUaW1lIC0gdGhpcy5wcmV2aW91c1RhcDtcbiAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IGN1cnJlbnRUaW1lO1xuXG4gICAgICAgIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQrK1xuXG4gICAgICAgIC8vIFJlY3Vyc2l2ZSBhbGdvcml0aG0gZm9yIGxpbmVhciBhdmVyYWdpbmdcbiAgICAgICAgdGhpcy5hdmVyYWdlSW50ZXJ2YWwgPSB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCArICgxIC8gdGhpcy5udW1WYWx1ZXNBdmVyYWdlZCkgKiAoaW50ZXJ2YWwgLSB0aGlzLmF2ZXJhZ2VJbnRlcnZhbClcblxuICAgICAgICBsZXQgYnBtID0gMTAwMCAqIDYwLjAgLyB0aGlzLmF2ZXJhZ2VJbnRlcnZhbDtcblxuICAgICAgICAvL1JldHVybiB2YWx1ZSByb3VuZGVkIHRvIHR3byBkZWNpbWFsc1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXZlcmFnZVRlbXBvOiBNYXRoLnJvdW5kKGJwbSAqIDEwMCkgLyAxMDAsXG4gICAgICAgICAgICBudW1WYWx1ZXNBdmVyYWdlZDogdGhpcy5udW1WYWx1ZXNBdmVyYWdlZFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJlc2V0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLnByZXZpb3VzVGFwID0gMDtcbiAgICAgICAgdGhpcy5udW1WYWx1ZXNBdmVyYWdlZCA9IDA7XG4gICAgICAgIHRoaXMuYXZlcmFnZUludGVydmFsID0gMDtcbiAgICB9XG59IiwiLyoqXG4gKiBXaGlsZVByZXNzZWRCdG4uIEEgYnV0dG9uIHdoaWNoIHJlcGVhdGVkbHkgdHJpZ2dlcnMgYW4gZXZlbnQgd2hpbGUgcHJlc3NlZC5cbiAqL1xuZW51bSBNb3VzZUNvZGVzIHsgTEVGVCA9IDEgfTtcblxuY29uc3Qga2V5RG93blJlcGVhdERlbGF5ID0gNTAwOyAvL21zLiBTYW1lIGFzIENocm9tZS5cbmNvbnN0IGtleURvd25SZXBlYXRJbnRlcnZhbCA9IDMwOyAvL21zLiBTYW1lIGFzIENocm9tZS5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV2hpbGVQcmVzc2VkQnRuIHtcblxuICAgIHByaXZhdGUgYnRuOiBIVE1MSW5wdXRFbGVtZW50O1xuICAgIHByaXZhdGUgZXJyb3JUaW1lcklkOiBudW1iZXIgPSAwO1xuXG4gICAgcHJpdmF0ZSBtb3VzZUlzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgbW91c2VEb3duVGltZXJIYW5kbGU6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBtb3VzZURvd25IYW5kbGVyRnVuY3Rpb246ICgpID0+IHZvaWQ7XG5cbiAgICBjb25zdHJ1Y3RvcihidG5FbGVtZW50OiBIVE1MSW5wdXRFbGVtZW50LCBoYW5kbGVyRnVuY3Rpb246ICgpID0+IHZvaWQpIHtcblxuICAgICAgICB0aGlzLmJ0biA9IGJ0bkVsZW1lbnQ7XG4gICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uID0gaGFuZGxlckZ1bmN0aW9uO1xuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBNb3VzZUNvZGVzLkxFRlQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCkgfSwga2V5RG93blJlcGVhdERlbGF5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idG4uYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgICAgICAgdGhpcy5idG4uZm9jdXMoKSAvL1RPRE86IENoZWNrIHByb2JsZW0gaW4gY2hyb21lIGlQaG9uZSBlbXVsYXRvciB3aGVyZSBob3ZlciBpcyBub3QgcmVtb3ZlZCBmcm9tIHByZXZpb3VzbHkgZm9jdXNlZCBlbGVtZW50LiBLbm93biBhcyB0aGUgc3RpY2t5IGhvdmVyIHByb2JsZW0uXG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7IHRoaXMubW91c2VEb3duTG9vcCgpIH0sIGtleURvd25SZXBlYXREZWxheSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vQWRkIG1vdXNldXAgZXZlbnRsaXN0ZW5lciB0byBkb2N1bWVudCBpbiBjYXNlIHRoZSBtb3VzZSBpcyBtb3ZlZCBhd2F5IGZyb20gYnRuIGJlZm9yZSBpdCBpcyByZWxlYXNlZC5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBNb3VzZUNvZGVzLkxFRlQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9FbmQgb2YgdG91Y2ggZXZlbnRzXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSk7XG4gICAgICAgIH0pXG5cbiAgICAgICAgdGhpcy5idG4uYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hjYW5jZWwnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlKTtcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBzZXRUaW1lZEVycm9yKGR1cmF0aW9uOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuZXJyb3JUaW1lcklkKVxuXG4gICAgICAgIHRoaXMuYnRuLmNsYXNzTGlzdC5hZGQoJ2hhcy1lcnJvcicpXG5cbiAgICAgICAgdGhpcy5lcnJvclRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuYnRuLmNsYXNzTGlzdC5yZW1vdmUoJ2hhcy1lcnJvcicpXG4gICAgICAgIH0sIGR1cmF0aW9uKVxuICAgIH1cblxuICAgIHByaXZhdGUgbW91c2VEb3duTG9vcCgpOiB2b2lkIHtcblxuICAgICAgICBpZiAoIXRoaXMubW91c2VJc1ByZXNzZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uKCk7XG5cbiAgICAgICAgdGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4geyB0aGlzLm1vdXNlRG93bkxvb3AoKSB9LCBrZXlEb3duUmVwZWF0SW50ZXJ2YWwpO1xuICAgIH1cbn0iLCJpbXBvcnQgTWV0cm9ub21lVWkgZnJvbSBcIi4vTWV0cm9ub21lVWlcIlxuXG4vL0NhbiB1c2UgRG9jdW1lbnQucXVlcnlTZWxlY3RvcigpIGluc3RlYWRcbmxldCB1aSA9IG5ldyBNZXRyb25vbWVVaSg8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheVBhdXNlQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RhcEJ0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbHVzc0J0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtaW51c0J0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXNldEJ0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbnB1dERpc3BsYXknKSxcbiAgICA8SFRNTExhYmVsRWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5wdXREaXNwbGF5TGFiZWwnKSk7XG4iXX0=
