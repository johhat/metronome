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
        this.isPlaying = false;
        this.currentBeat = 0;
        //Safari needs prefix webkitAudioContext
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.setTempo(tempo);
    }
    Metronome.prototype.play = function () {
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.audioLoop();
        }
    };
    Metronome.prototype.pause = function () {
        if (this.isPlaying) {
            this.stopAudioLoop();
            this.isPlaying = false;
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
    Metronome.prototype.stopAudioLoop = function () {
        clearInterval(this.audioLoopTimerHandle);
    };
    Metronome.prototype.audioLoop = function () {
        var _this = this;
        var nextNoteTime = this.audioContext.currentTime;
        var next4thNote = 0;
        //The scheduler
        this.audioLoopTimerHandle = setInterval(function () {
            if (!_this.isPlaying) {
                return;
            }
            while (nextNoteTime < _this.audioContext.currentTime + scheduleAheadTime) {
                _this.scheduleTone(nextNoteTime, next4thNote % numBeatsPerBar ? Pitch.MID : Pitch.HIGH);
                var secondsPerBeat = 60.0 / _this.tempo;
                nextNoteTime += secondsPerBeat;
                next4thNote = (next4thNote + 1) % numBeatsPerBar;
            }
        }, scheduleInterval);
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
//These should be imported from Metronome module
var minTempo = 40;
var maxTempo = 250;
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
            if (newValue > maxTempo)
                this.setDisplayValue(maxTempo);
            if (newValue < minTempo)
                this.setDisplayValue(minTempo);
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
            if (newValue < minTempo)
                this.setDisplayValue(minTempo);
            if (newValue > maxTempo)
                this.setDisplayValue(maxTempo);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvSW5wdXREaXNwbGF5LnRzIiwic3JjL01ldHJvbm9tZS50cyIsInNyYy9NZXRyb25vbWVVaS50cyIsInNyYy9UYXBwZXIudHMiLCJzcmMvV2hpbGVQcmVzc2VkQnRuLnRzIiwic3JjL21haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7O0dBRUc7QUFDSCxJQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsQ0FBQSxLQUFLO0FBQ2pDLElBQUssS0FBNEI7QUFBakMsV0FBSyxLQUFLO0lBQUcsNkJBQUUsQ0FBQTtJQUFFLHVDQUFPLENBQUE7SUFBRSxtQ0FBSyxDQUFBO0FBQUMsQ0FBQyxFQUE1QixLQUFLLEtBQUwsS0FBSyxRQUF1QjtBQUVqQztJQU9JLHNCQUFvQixZQUE4QixFQUFVLEtBQXVCLEVBQy9FLFlBQW9CLEVBQ1osZUFBdUIsRUFDdkIsU0FBK0QsRUFDL0QsZUFBd0M7UUFYeEQsaUJBMEhDO1FBbkh1QixpQkFBWSxHQUFaLFlBQVksQ0FBa0I7UUFBVSxVQUFLLEdBQUwsS0FBSyxDQUFrQjtRQUV2RSxvQkFBZSxHQUFmLGVBQWUsQ0FBUTtRQUN2QixjQUFTLEdBQVQsU0FBUyxDQUFzRDtRQUMvRCxvQkFBZSxHQUFmLGVBQWUsQ0FBeUI7UUFQNUMsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFDekIsbUJBQWMsR0FBVyxDQUFDLENBQUM7UUFRL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUM7UUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2xELElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUV0QixJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFVBQUMsS0FBSztZQUM5QyxLQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDakMsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQsK0JBQVEsR0FBUixVQUFTLEtBQWE7UUFDbEIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7UUFDM0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNoRCxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxvQ0FBYSxHQUFiLFVBQWMsT0FBZSxFQUFFLFFBQWdCO1FBQS9DLGlCQVVDO1FBVEcsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQTtRQUVqQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUMxQixJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBRTdCLElBQUksQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDO1lBQzdCLHlEQUF5RDtZQUN6RCxLQUFJLENBQUMsY0FBYyxDQUFDLEtBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUE7UUFDaEQsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFBO0lBQ2hCLENBQUM7SUFFTyxxQ0FBYyxHQUF0QixVQUF1QixLQUFhO1FBQ2hDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM5QixJQUFJLENBQUMsZUFBZSxDQUFDLDBDQUEwQyxDQUFDLENBQUM7WUFDakUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDNUIsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUNqQixDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QixJQUFJLENBQUMsZUFBZSxDQUFDLDBEQUEwRCxDQUFDLENBQUE7WUFDaEYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDNUIsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUNqQixDQUFDO1FBRUQsSUFBSSxhQUFhLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBRWpDLElBQUEsa0NBQWtELEVBQTdDLGdCQUFLLEVBQUUsZ0JBQUssQ0FBa0M7UUFFbkQsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUMzQixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUMxQixNQUFNLENBQUMsS0FBSyxDQUFDO1FBQ2pCLENBQUM7UUFFRCxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQTtRQUN2QixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQTtRQUUxQyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFTyx1Q0FBZ0IsR0FBeEIsVUFBeUIsS0FBWTtRQUFyQyxpQkFjQztRQWJHLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDaEMsWUFBWSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVsQyxJQUFJLENBQUMsWUFBWSxHQUFHLFVBQVUsQ0FBQztZQUMzQixJQUFJLEtBQUssR0FBRyxLQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQztZQUVwQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM5QixNQUFNLENBQUE7WUFDVixDQUFDO1lBRUQsS0FBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTtRQUV2QyxDQUFDLEVBQUUsZUFBZSxDQUFDLENBQUE7SUFDdkIsQ0FBQztJQUVPLCtCQUFRLEdBQWhCLFVBQWlCLFNBQWdCO1FBQzdCLG9EQUFvRDtRQUNwRCxJQUFJLGlCQUFpQixHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBQ3RELElBQUksY0FBYyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFbkQsRUFBRSxDQUFDLENBQUMsaUJBQWlCLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzQixJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQTtZQUNyRCxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQTtRQUNsRCxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsY0FBYyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDeEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFBO1lBQy9DLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQTtRQUM1QyxDQUFDO1FBRUQsSUFBSSxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUM7SUFDM0IsQ0FBQztJQUVPLG9DQUFhLEdBQXJCLFVBQXNCLEtBQVk7UUFDOUIsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNaLEtBQUssS0FBSyxDQUFDLEVBQUU7Z0JBQ1QsTUFBTSxDQUFDLElBQUksQ0FBQTtZQUNmLEtBQUssS0FBSyxDQUFDLE9BQU87Z0JBQ2QsTUFBTSxDQUFDLGFBQWEsQ0FBQTtZQUN4QixLQUFLLEtBQUssQ0FBQyxLQUFLO2dCQUNaLE1BQU0sQ0FBQyxXQUFXLENBQUE7WUFDdEI7Z0JBQ0ksT0FBTyxDQUFDLEdBQUcsQ0FBQyx5REFBeUQsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDOUUsTUFBTSxDQUFDLEVBQUUsQ0FBQTtRQUNqQixDQUFDO0lBQ0wsQ0FBQztJQUVPLHNDQUFlLEdBQXZCLFVBQXdCLE9BQWU7UUFDbkMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDO0lBQ3JDLENBQUM7SUFDTCxtQkFBQztBQUFELENBMUhBLEFBMEhDLElBQUE7QUExSEQ7OEJBMEhDLENBQUE7Ozs7QUNoSUQ7O0dBRUc7QUFDSCxJQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsQ0FBQSxLQUFLO0FBQ3pCLElBQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxDQUFBLEtBQUs7QUFDMUIsSUFBTSxjQUFjLEdBQUcsQ0FBQyxDQUFDO0FBRXpCLElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxDQUFBLFNBQVM7QUFDakMsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsQ0FBQSx5Q0FBeUM7QUFDdkUsSUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUMsQ0FBQSxTQUFTO0FBRXZDLElBQUssS0FBd0I7QUFBN0IsV0FBSyxLQUFLO0lBQUcsaUNBQUksQ0FBQTtJQUFFLCtCQUFHLENBQUE7SUFBRSwrQkFBRyxDQUFBO0FBQUMsQ0FBQyxFQUF4QixLQUFLLEtBQUwsS0FBSyxRQUFtQjtBQUFBLENBQUM7QUFFOUI7SUFRSSxtQkFBWSxLQUFhO1FBTGpCLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFDM0IsZ0JBQVcsR0FBVyxDQUFDLENBQUM7UUFLNUIsd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFPLE1BQU8sQ0FBQyxZQUFZLElBQVUsTUFBTyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQTtRQUMxRixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3pCLENBQUM7SUFFRCx3QkFBSSxHQUFKO1FBQ0ksRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNsQixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztZQUN0QixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDckIsQ0FBQztJQUNMLENBQUM7SUFFRCx5QkFBSyxHQUFMO1FBQ0ksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDakIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQzNCLENBQUM7SUFDTCxDQUFDO0lBRUQsMEJBQU0sR0FBTjtRQUNJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ2pCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNqQixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDSixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDaEIsQ0FBQztRQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQzFCLENBQUM7SUFFRCxpQ0FBYSxHQUFiLFVBQWMsS0FBYTtRQUN2QixFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2YsdUJBQXVCO1lBQ3ZCLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLHlCQUF5QixFQUFFLENBQUM7UUFDOUQsQ0FBQztRQUVELEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFdEIsRUFBRSxDQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDbkIsY0FBYztZQUNkLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQTtZQUM5QixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxtQkFBbUIsR0FBRyxRQUFRLEVBQUUsQ0FBQztRQUNuRSxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDbkIsY0FBYztZQUNkLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQTtZQUM5QixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxlQUFlLEdBQUcsUUFBUSxFQUFFLENBQUM7UUFDL0QsQ0FBQztRQUVELE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBQ3RDLENBQUM7SUFFRCw0QkFBUSxHQUFSLFVBQVMsS0FBYTtRQUVsQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDdkIsOEJBQThCO1lBQzlCLE1BQU0sQ0FBQztRQUNYLENBQUM7UUFFSSwyQ0FBSyxDQUE2QjtRQUV2QyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDVCxNQUFNLENBQUM7UUFDWCxDQUFDO1FBRUQsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFM0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRU8saUNBQWEsR0FBckI7UUFDSSxhQUFhLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUE7SUFDNUMsQ0FBQztJQUVPLDZCQUFTLEdBQWpCO1FBQUEsaUJBc0JDO1FBcEJHLElBQUksWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDO1FBQ2pELElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQztRQUVwQixlQUFlO1FBQ2YsSUFBSSxDQUFDLG9CQUFvQixHQUFHLFdBQVcsQ0FBQztZQUVwQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUNsQixNQUFNLENBQUM7WUFDWCxDQUFDO1lBRUQsT0FBTyxZQUFZLEdBQUcsS0FBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQztnQkFFdEUsS0FBSSxDQUFDLFlBQVksQ0FBQyxZQUFZLEVBQUUsV0FBVyxHQUFHLGNBQWMsR0FBRyxLQUFLLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFFdkYsSUFBSSxjQUFjLEdBQUcsSUFBSSxHQUFHLEtBQUksQ0FBQyxLQUFLLENBQUM7Z0JBQ3ZDLFlBQVksSUFBSSxjQUFjLENBQUM7Z0JBQy9CLFdBQVcsR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsR0FBRyxjQUFjLENBQUM7WUFDckQsQ0FBQztRQUVMLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFBO0lBQ3hCLENBQUM7SUFFTyxnQ0FBWSxHQUFwQixVQUFxQixTQUFpQixFQUFFLEtBQVk7UUFFaEQsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQy9DLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUUzQyxJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7UUFFbEIsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNaLEtBQUssS0FBSyxDQUFDLElBQUk7Z0JBQ1gsU0FBUyxHQUFHLEdBQUcsQ0FBQztnQkFDaEIsS0FBSyxDQUFDO1lBQ1YsS0FBSyxLQUFLLENBQUMsR0FBRztnQkFDVixTQUFTLEdBQUcsR0FBRyxDQUFDO2dCQUNoQixLQUFLLENBQUM7WUFDVixLQUFLLEtBQUssQ0FBQyxHQUFHO2dCQUNWLFNBQVMsR0FBRyxHQUFHLENBQUM7Z0JBQ2hCLEtBQUssQ0FBQztZQUNWO2dCQUNJLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUE7Z0JBQzVCLFNBQVMsR0FBRyxHQUFHLENBQUM7Z0JBQ2hCLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUM7UUFDaEMsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNyQixHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBQ0wsZ0JBQUM7QUFBRCxDQXJJQSxBQXFJQyxJQUFBO0FBcklEOzJCQXFJQyxDQUFBOzs7O0FDbEpEOztHQUVHO0FBQ0gsMEJBQXNCLGFBQWEsQ0FBQyxDQUFBO0FBQ3BDLHVCQUFtQixVQUFVLENBQUMsQ0FBQTtBQUM5QixnQ0FBNEIsbUJBQzVCLENBQUMsQ0FEOEM7QUFDL0MsNkJBQXlCLGdCQUV6QixDQUFDLENBRndDO0FBRXpDLElBQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEtBQUs7QUFDL0IsSUFBTSxlQUFlLEdBQUcsa0NBQWtDLENBQUE7QUFFMUQsZ0RBQWdEO0FBQ2hELElBQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQztBQUNwQixJQUFNLFFBQVEsR0FBRyxHQUFHLENBQUM7QUFFckIsSUFBSSxlQUFlLEdBQUcsQ0FBQztJQUNuQixJQUFJLElBQUksR0FBRyx1QkFBdUIsQ0FBQztJQUNuQyxJQUFJLENBQUM7UUFDRCxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNqQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDaEIsQ0FBRTtJQUFBLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDVCxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQ2pCLENBQUM7QUFDTCxDQUFDLENBQUMsRUFBRSxDQUFBO0FBRUosSUFBSyxRQUF1QjtBQUE1QixXQUFLLFFBQVE7SUFBRywwQ0FBVSxDQUFBO0FBQUMsQ0FBQyxFQUF2QixRQUFRLEtBQVIsUUFBUSxRQUFlO0FBQUEsQ0FBQztBQUM3QixJQUFLLFVBQXVCO0FBQTVCLFdBQUssVUFBVTtJQUFHLDJDQUFRLENBQUE7QUFBQyxDQUFDLEVBQXZCLFVBQVUsS0FBVixVQUFVLFFBQWE7QUFBQSxDQUFDO0FBRTdCO0lBZUkscUJBQW9CLFlBQThCLEVBQ3RDLE1BQXdCLEVBQ2hDLFFBQTBCLEVBQzFCLFFBQTBCLEVBQ2xCLFFBQTBCLEVBQ2xDLFlBQThCLEVBQzlCLGlCQUFtQztRQXJCM0MsaUJBOE1DO1FBL0x1QixpQkFBWSxHQUFaLFlBQVksQ0FBa0I7UUFDdEMsV0FBTSxHQUFOLE1BQU0sQ0FBa0I7UUFHeEIsYUFBUSxHQUFSLFFBQVEsQ0FBa0I7UUFqQjlCLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFDM0IsaUJBQVksR0FBVyxZQUFZLENBQUM7UUFFcEMsbUJBQWMsR0FBWSxLQUFLLENBQUM7UUFDaEMsbUJBQWMsR0FBWSxLQUFLLENBQUM7UUFpQnBDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxtQkFBUyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxnQkFBTSxFQUFFLENBQUM7UUFFM0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLHlCQUFlLENBQUMsUUFBUSxFQUFFLGNBQVEsS0FBSSxDQUFDLHFCQUFxQixFQUFFLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0RixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUkseUJBQWUsQ0FBQyxRQUFRLEVBQUUsY0FBUSxLQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RGLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxzQkFBWSxDQUFDLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUMvRixVQUFDLEtBQWE7WUFDVixvQkFBb0I7WUFDcEIsTUFBTSxDQUFDLEtBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBQzlDLENBQUMsRUFDRCxVQUFDLEtBQWE7WUFDVix3QkFBd0I7WUFDeEIsS0FBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7WUFDMUIsS0FBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xDLENBQUMsQ0FDSixDQUFDO1FBRUYsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDO1FBRWpELG9CQUFvQjtRQUNwQixZQUFZLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFO1lBQ25DLEtBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUMzQixDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUU7WUFDN0IsS0FBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2YsQ0FBQyxDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFO1lBQy9CLEtBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNqQixDQUFDLENBQUMsQ0FBQztRQUVILFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsVUFBQyxLQUFLO1lBQ3ZDLEtBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUIsQ0FBQyxDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFVBQUMsS0FBSztZQUNyQyxLQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVCLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLHlCQUFHLEdBQVg7UUFDSSxJQUFBLHNCQUF5RCxFQUFwRCw4QkFBWSxFQUFFLHdDQUFpQixDQUFzQjtRQUUxRCxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzFCLE1BQU0sQ0FBQztRQUNYLENBQUM7UUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixFQUFFLGlCQUFpQixDQUFDLENBQUE7UUFDdEQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQTtJQUN0QyxDQUFDO0lBRU8scUNBQWUsR0FBdkI7UUFDSSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDN0MsQ0FBQztJQUVPLDJDQUFxQixHQUE3QjtRQUVJLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBRXJDLElBQUEsMkNBQTJELEVBQXRELGdCQUFLLEVBQUUsZ0JBQUssQ0FBMEM7UUFFM0QsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1QsRUFBRSxDQUFDLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztnQkFBQyxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFBO1lBQ3ZELEVBQUUsQ0FBQyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7Z0JBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQTtZQUN2RCxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUE7WUFDNUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDakMsTUFBTSxDQUFDO1FBQ1gsQ0FBQztRQUVELElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVPLDJDQUFxQixHQUE3QjtRQUNJLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBRXJDLElBQUEsMkNBQTJELEVBQXRELGdCQUFLLEVBQUUsZ0JBQUssQ0FBMEM7UUFFM0QsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1QsRUFBRSxDQUFDLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztnQkFBQyxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFBO1lBQ3ZELEVBQUUsQ0FBQyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7Z0JBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQTtZQUN2RCxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUE7WUFDNUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUE7WUFDakMsTUFBTSxDQUFDO1FBQ1gsQ0FBQztRQUVELElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVPLDJCQUFLLEdBQWI7UUFDSSxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDdEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNwQixZQUFZLENBQUMsS0FBSyxFQUFFLENBQUE7SUFDeEIsQ0FBQztJQUVPLG1DQUFhLEdBQXJCLFVBQXNCLEtBQW9CO1FBQ3RDLElBQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUM7UUFFMUIsRUFBRSxDQUFDLENBQUMsT0FBTyxLQUFLLFNBQVMsSUFBSSxPQUFPLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQztZQUNwRCxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDakMsQ0FBQztRQUVELEVBQUUsQ0FBQyxDQUFDLE9BQU8sS0FBSyxXQUFXLElBQUksT0FBTyxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDckQsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQ2pDLENBQUM7UUFFRCxFQUFFLENBQUMsQ0FBQyxPQUFPLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN0Qiw2RUFBNkU7WUFDN0UsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRXZCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7WUFDL0IsQ0FBQztRQUNMLENBQUM7UUFFRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxLQUFLLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ25DLDZFQUE2RTtZQUM3RSxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7WUFFdkIsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztnQkFDdkIsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNYLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDO1lBQy9CLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVPLGlDQUFXLEdBQW5CLFVBQW9CLEtBQW9CO1FBQ3BDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN4QixJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztRQUNoQyxDQUFDO1FBRUQsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sS0FBSyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNuQyxJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztRQUNoQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLHFDQUFlLEdBQXZCLFVBQXdCLEtBQWE7UUFFakMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztRQUV0QyxJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQztRQUMxQixJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUU1QixxREFBSyxDQUF1QztRQUVqRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1IsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzlCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUNqQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLHVDQUFpQixHQUF6QixVQUEwQixLQUFhO1FBQ25DLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTyx5Q0FBbUIsR0FBM0I7UUFFSSxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQztZQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUE7UUFFekMsSUFBSSxJQUFJLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUV4QyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDUixZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQTtZQUN0RCxNQUFNLENBQUMsWUFBWSxDQUFBO1FBQ3ZCLENBQUM7UUFFRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2QsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUE7WUFDdEQsTUFBTSxDQUFDLFlBQVksQ0FBQTtRQUN2QixDQUFDO1FBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQTtJQUN2QixDQUFDO0lBRU8sdUNBQWlCLEdBQXpCLFVBQTBCLEtBQWE7UUFDbkMsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUM7WUFBQyxNQUFNLENBQUE7UUFDNUIsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUE7SUFDbkQsQ0FBQztJQUNMLGtCQUFDO0FBQUQsQ0E5TUEsQUE4TUMsSUFBQTtBQTlNRDs2QkE4TUMsQ0FBQTs7OztBQzNPRDs7R0FFRztBQUNILElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUk7QUFFN0I7SUFPSTtRQUxRLGdCQUFXLEdBQVcsQ0FBQyxDQUFDO1FBQ3hCLG9CQUFlLEdBQVcsQ0FBQyxDQUFDO1FBQzVCLHNCQUFpQixHQUFXLENBQUMsQ0FBQztRQUM5QixnQkFBVyxHQUFXLENBQUMsQ0FBQztJQUVoQixDQUFDO0lBRWpCLG9CQUFHLEdBQUg7UUFBQSxpQkFnQ0M7UUE5QkcsWUFBWSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQTtRQUU5QixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztZQUMxQixLQUFJLENBQUMsS0FBSyxFQUFFLENBQUE7UUFDaEIsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFBO1FBRWQsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDeEMsTUFBTSxDQUFDO2dCQUNILFlBQVksRUFBRSxDQUFDO2dCQUNmLGlCQUFpQixFQUFFLENBQUM7YUFDdkIsQ0FBQztRQUNOLENBQUM7UUFFRCxJQUFJLFdBQVcsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3ZDLElBQUksUUFBUSxHQUFHLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO1FBQzlDLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBRS9CLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFBO1FBRXhCLDJDQUEyQztRQUMzQyxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFBO1FBRTlHLElBQUksR0FBRyxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztRQUU3QyxzQ0FBc0M7UUFDdEMsTUFBTSxDQUFDO1lBQ0gsWUFBWSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUc7WUFDekMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQjtTQUM1QyxDQUFDO0lBQ04sQ0FBQztJQUVELHNCQUFLLEdBQUw7UUFDSSxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQztRQUNyQixJQUFJLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLElBQUksQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFDTCxhQUFDO0FBQUQsQ0FoREEsQUFnREMsSUFBQTtBQWhERDt3QkFnREMsQ0FBQTs7OztBQ3JERDs7R0FFRztBQUNILElBQUssVUFBdUI7QUFBNUIsV0FBSyxVQUFVO0lBQUcsMkNBQVEsQ0FBQTtBQUFDLENBQUMsRUFBdkIsVUFBVSxLQUFWLFVBQVUsUUFBYTtBQUFBLENBQUM7QUFFN0IsSUFBTSxrQkFBa0IsR0FBRyxHQUFHLENBQUMsQ0FBQyxxQkFBcUI7QUFDckQsSUFBTSxxQkFBcUIsR0FBRyxFQUFFLENBQUMsQ0FBQyxxQkFBcUI7QUFFdkQ7SUFTSSx5QkFBWSxVQUE0QixFQUFFLGVBQTJCO1FBVHpFLGlCQW9FQztRQWpFVyxpQkFBWSxHQUFXLENBQUMsQ0FBQztRQUV6QixtQkFBYyxHQUFZLEtBQUssQ0FBQztRQUNoQyx5QkFBb0IsR0FBVyxDQUFDLENBQUM7UUFLckMsSUFBSSxDQUFDLEdBQUcsR0FBRyxVQUFVLENBQUM7UUFDdEIsSUFBSSxDQUFDLHdCQUF3QixHQUFHLGVBQWUsQ0FBQztRQUVoRCxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxVQUFDLEtBQUs7WUFDekMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssS0FBSyxVQUFVLENBQUMsSUFBSSxDQUFDO2dCQUFDLE1BQU0sQ0FBQztZQUM1QyxLQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQztZQUMzQixLQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztZQUNoQyxLQUFJLENBQUMsb0JBQW9CLEdBQUcsVUFBVSxDQUFDLGNBQVEsS0FBSSxDQUFDLGFBQWEsRUFBRSxDQUFBLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDL0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxVQUFDLEtBQUs7WUFDMUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFBO1lBQ3RCLEtBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUEsQ0FBQyw4SUFBOEk7WUFDL0osS0FBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7WUFDM0IsS0FBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDaEMsS0FBSSxDQUFDLG9CQUFvQixHQUFHLFVBQVUsQ0FBQyxjQUFRLEtBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQSxDQUFDLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQy9GLENBQUMsQ0FBQyxDQUFDO1FBRUgsdUdBQXVHO1FBQ3ZHLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsVUFBQyxLQUFLO1lBQ3ZDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLEtBQUssVUFBVSxDQUFDLElBQUksQ0FBQztnQkFBQyxNQUFNLENBQUM7WUFDNUMsS0FBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7WUFDNUIsWUFBWSxDQUFDLEtBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDO1FBRUgscUJBQXFCO1FBQ3JCLElBQUksQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLFVBQUMsS0FBSztZQUN4QyxLQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztZQUM1QixZQUFZLENBQUMsS0FBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUE7UUFFRixJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxVQUFDLEtBQUs7WUFDM0MsS0FBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7WUFDNUIsWUFBWSxDQUFDLEtBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFBO0lBQ04sQ0FBQztJQUVELHVDQUFhLEdBQWIsVUFBYyxRQUFnQjtRQUE5QixpQkFRQztRQVBHLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUE7UUFFL0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFBO1FBRW5DLElBQUksQ0FBQyxZQUFZLEdBQUcsVUFBVSxDQUFDO1lBQzNCLEtBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQTtRQUMxQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUE7SUFDaEIsQ0FBQztJQUVPLHVDQUFhLEdBQXJCO1FBQUEsaUJBU0M7UUFQRyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLE1BQU0sQ0FBQztRQUNYLENBQUM7UUFFRCxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUVoQyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsVUFBVSxDQUFDLGNBQVEsS0FBSSxDQUFDLGFBQWEsRUFBRSxDQUFBLENBQUMsQ0FBQyxFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUNMLHNCQUFDO0FBQUQsQ0FwRUEsQUFvRUMsSUFBQTtBQXBFRDtpQ0FvRUMsQ0FBQTs7OztBQzVFRCw0QkFBd0IsZUFHeEIsQ0FBQyxDQUhzQztBQUV2QywwQ0FBMEM7QUFDMUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxxQkFBVyxDQUFtQixRQUFRLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxFQUM1RCxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxFQUNqQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxFQUN2QyxRQUFRLENBQUMsY0FBYyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIElucHV0RGlzcGxheVxuICovXG5jb25zdCBpbnB1dFJlYWN0RGVsYXkgPSA1MDA7Ly9tcy5cbmVudW0gU3RhdGUgeyBPSywgV0FSTklORywgRVJST1IgfVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJbnB1dERpc3BsYXkge1xuXG4gICAgcHJpdmF0ZSBzdGF0ZTogU3RhdGU7XG4gICAgcHJpdmF0ZSB2YWx1ZTogbnVtYmVyO1xuICAgIHByaXZhdGUgaW5wdXRUaW1lcklkOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbWVzc2FnZVRpbWVySWQ6IG51bWJlciA9IDA7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIGlucHV0RGlzcGxheTogSFRNTElucHV0RWxlbWVudCwgcHJpdmF0ZSBsYWJlbDogSFRNTExhYmVsRWxlbWVudCxcbiAgICAgICAgaW5pdGlhbFZhbHVlOiBudW1iZXIsXG4gICAgICAgIHByaXZhdGUgZGVmYXVsdEhlbHBUZXh0OiBzdHJpbmcsXG4gICAgICAgIHByaXZhdGUgdmFsaWRhdG9yOiAodmFsdWU6IG51bWJlcikgPT4geyB2YWxpZDogYm9vbGVhbiwgZXJyb3I6IHN0cmluZyB9LFxuICAgICAgICBwcml2YXRlIG9uTmV3VmFsaWRWYWx1ZTogKHZhbHVlOiBudW1iZXIpID0+IHZvaWQpIHtcblxuICAgICAgICB0aGlzLnZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IGluaXRpYWxWYWx1ZS50b1N0cmluZygpO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuT0s7XG5cbiAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZShpbml0aWFsVmFsdWUudG9TdHJpbmcoKSk7XG5cbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlSW5wdXRFdmVudChldmVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldFZhbHVlKHZhbHVlOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy52YWx1ZSA9IE1hdGgucm91bmQodmFsdWUgKiAxMDApIC8gMTAwO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IHRoaXMudmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZSh2YWx1ZS50b1N0cmluZygpKTtcbiAgICB9XG5cbiAgICBzZXRUaW1lZEVycm9yKG1lc3NhZ2U6IHN0cmluZywgZHVyYXRpb246IG51bWJlcikge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tZXNzYWdlVGltZXJJZClcblxuICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLkVSUk9SKVxuICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZShtZXNzYWdlKVxuXG4gICAgICAgIHRoaXMubWVzc2FnZVRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIC8vR28gYmFjayB0byBzdGF0ZSBjb3JyZXNwb25kaW5nIHRvIGN1cnJlbnQgZGlzcGxheSB2YWx1ZVxuICAgICAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZSh0aGlzLmlucHV0RGlzcGxheS52YWx1ZSlcbiAgICAgICAgfSwgZHVyYXRpb24pXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVOZXdWYWx1ZSh2YWx1ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh2YWx1ZS50b1N0cmluZygpLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKCdUaGUgdmFsdWUgbXVzdCBoYXZlIGF0IGxlYXN0IHR3byBkaWdpdHMuJyk7XG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLldBUk5JTkcpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOYU4oTnVtYmVyKHZhbHVlKSkpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKCdUaGUgZW50ZXJlZCB2YWx1ZSBpcyBub3QgYSBudW1iZXIuIFBsZWFzZSBlbnRlciBhIG51bWJlcicpXG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLldBUk5JTkcpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdmFsdWVBc051bWJlciA9IE51bWJlcih2YWx1ZSlcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLnZhbGlkYXRvcih2YWx1ZUFzTnVtYmVyKTtcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZShlcnJvcilcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuRVJST1IpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLk9LKVxuICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZSh0aGlzLmRlZmF1bHRIZWxwVGV4dClcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUlucHV0RXZlbnQoZXZlbnQ6IEV2ZW50KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLmlucHV0VGltZXJJZCk7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1lc3NhZ2VUaW1lcklkKTtcblxuICAgICAgICB0aGlzLmlucHV0VGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgbGV0IHZhbHVlID0gdGhpcy5pbnB1dERpc3BsYXkudmFsdWU7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5oYW5kbGVOZXdWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5vbk5ld1ZhbGlkVmFsdWUoTnVtYmVyKHZhbHVlKSlcblxuICAgICAgICB9LCBpbnB1dFJlYWN0RGVsYXkpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRTdGF0ZShuZXh0U3RhdGU6IFN0YXRlKSB7XG4gICAgICAgIC8vU2V0IENTUyBjbGFzc2VzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGVsZW1lbnQgc3RhdGVcbiAgICAgICAgbGV0IGN1cnJlbnRTdGF0ZUNsYXNzID0gdGhpcy5nZXRTdGF0ZUNsYXNzKHRoaXMuc3RhdGUpXG4gICAgICAgIGxldCBuZXh0U3RhdGVDbGFzcyA9IHRoaXMuZ2V0U3RhdGVDbGFzcyhuZXh0U3RhdGUpO1xuXG4gICAgICAgIGlmIChjdXJyZW50U3RhdGVDbGFzcyAhPT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LmNsYXNzTGlzdC5yZW1vdmUoY3VycmVudFN0YXRlQ2xhc3MpXG4gICAgICAgICAgICB0aGlzLmxhYmVsLmNsYXNzTGlzdC5yZW1vdmUoY3VycmVudFN0YXRlQ2xhc3MpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV4dFN0YXRlQ2xhc3MgIT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5jbGFzc0xpc3QuYWRkKG5leHRTdGF0ZUNsYXNzKVxuICAgICAgICAgICAgdGhpcy5sYWJlbC5jbGFzc0xpc3QuYWRkKG5leHRTdGF0ZUNsYXNzKVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5leHRTdGF0ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFN0YXRlQ2xhc3Moc3RhdGU6IFN0YXRlKTogc3RyaW5nIHtcbiAgICAgICAgc3dpdGNoIChzdGF0ZSkge1xuICAgICAgICAgICAgY2FzZSBTdGF0ZS5PSzpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ29rJ1xuICAgICAgICAgICAgY2FzZSBTdGF0ZS5XQVJOSU5HOlxuICAgICAgICAgICAgICAgIHJldHVybiAnaGFzLXdhcm5pbmcnXG4gICAgICAgICAgICBjYXNlIFN0YXRlLkVSUk9SOlxuICAgICAgICAgICAgICAgIHJldHVybiAnaGFzLWVycm9yJ1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnVHJpZWQgdG8gZ2V0IGNsYXNzIGNvcnJlc3BvbmRpbmcgdG8gbm9uLWV4aXN0aW5nIHN0YXRlOicsIHN0YXRlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJydcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0RXJyb3JNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICB0aGlzLmxhYmVsLnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICB9XG59IiwiLyoqXG4gKiBNZXRyb25vbWVcbiAqL1xuY29uc3QgbWluVGVtcG8gPSA0MDsvL0JQTVxuY29uc3QgbWF4VGVtcG8gPSAyNTA7Ly9CUE1cbmNvbnN0IG51bUJlYXRzUGVyQmFyID0gNDtcblxuY29uc3Qgbm90ZUxlbmd0aCA9IDAuMDU7Ly9TZWNvbmRzXG5jb25zdCBzY2hlZHVsZUludGVydmFsID0gMjUuMDsvL21zLiBIb3cgb2Z0ZW4gdGhlIHNjaGVkdWxpbmcgaXMgY2FsbGVkLlxuY29uc3Qgc2NoZWR1bGVBaGVhZFRpbWUgPSAwLjE7Ly9TZWNvbmRzXG5cbmVudW0gUGl0Y2ggeyBISUdILCBNSUQsIExPVyB9O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWUge1xuXG4gICAgcHJpdmF0ZSB0ZW1wbzogbnVtYmVyOyAvL2JlYXRzIHBlciBtaW51dGUgKEJQTSlcbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgY3VycmVudEJlYXQ6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBhdWRpb0NvbnRleHQ6IEF1ZGlvQ29udGV4dDtcbiAgICBwcml2YXRlIGF1ZGlvTG9vcFRpbWVySGFuZGxlOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih0ZW1wbzogbnVtYmVyKSB7XG4gICAgICAgIC8vU2FmYXJpIG5lZWRzIHByZWZpeCB3ZWJraXRBdWRpb0NvbnRleHRcbiAgICAgICAgdGhpcy5hdWRpb0NvbnRleHQgPSBuZXcgKCg8YW55PndpbmRvdykuQXVkaW9Db250ZXh0IHx8ICg8YW55PndpbmRvdykud2Via2l0QXVkaW9Db250ZXh0KSgpXG4gICAgICAgIHRoaXMuc2V0VGVtcG8odGVtcG8pO1xuICAgIH1cblxuICAgIHBsYXkoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuYXVkaW9Mb29wKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwYXVzZSgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3BBdWRpb0xvb3AoKTtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0b2dnbGUoKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh0aGlzLmlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaXNQbGF5aW5nO1xuICAgIH1cblxuICAgIHZhbGlkYXRlVGVtcG8odGVtcG86IG51bWJlcik6IHsgdmFsaWQ6IGJvb2xlYW4sIGVycm9yOiBzdHJpbmcgfSB7XG4gICAgICAgIGlmIChpc05hTih0ZW1wbykpIHtcbiAgICAgICAgICAgIC8vQ2hhbmdlIHRvIGVycm9yIHN0YXRlXG4gICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UsIGVycm9yOiAnWW91IG11c3QgZW50ZXIgYSBudW1iZXInIH07XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wbyA9IE51bWJlcih0ZW1wbyk7XG5cbiAgICAgICAgaWYgKHRlbXBvIDwgbWluVGVtcG8pIHtcbiAgICAgICAgICAgIC8vU2lnbmFsIGVycm9yXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQmVsb3cgbWluIHRlbXBvJylcbiAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3I6ICdNaW5pbXVtIHRlbXBvIGlzICcgKyBtaW5UZW1wbyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRlbXBvID4gbWF4VGVtcG8pIHtcbiAgICAgICAgICAgIC8vU2lnbmFsIGVycm9yXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQWJvdmUgbWF4IHRlbXBvJylcbiAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3I6ICdNYXggdGVtcG8gaXMgJyArIG1heFRlbXBvIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgZXJyb3I6ICcnIH07XG4gICAgfVxuXG4gICAgc2V0VGVtcG8odGVtcG86IG51bWJlcik6IHZvaWQge1xuXG4gICAgICAgIGlmICh0aGlzLnRlbXBvID09PSB0ZW1wbykge1xuICAgICAgICAgICAgLy9EbyBub3RoaW5nIGlmIGl0IGlzIHRoZSBzYW1lXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQge3ZhbGlkfSA9IHRoaXMudmFsaWRhdGVUZW1wbyh0ZW1wbylcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRlbXBvID0gTnVtYmVyKHRlbXBvKTtcblxuICAgICAgICBjb25zb2xlLmxvZygnTmV3IG1ldHJvbm9tZSB0ZW1wbzonLCB0ZW1wbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdG9wQXVkaW9Mb29wKCkge1xuICAgICAgICBjbGVhckludGVydmFsKHRoaXMuYXVkaW9Mb29wVGltZXJIYW5kbGUpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhdWRpb0xvb3AoKSB7XG5cbiAgICAgICAgbGV0IG5leHROb3RlVGltZSA9IHRoaXMuYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICBsZXQgbmV4dDR0aE5vdGUgPSAwO1xuXG4gICAgICAgIC8vVGhlIHNjaGVkdWxlclxuICAgICAgICB0aGlzLmF1ZGlvTG9vcFRpbWVySGFuZGxlID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3aGlsZSAobmV4dE5vdGVUaW1lIDwgdGhpcy5hdWRpb0NvbnRleHQuY3VycmVudFRpbWUgKyBzY2hlZHVsZUFoZWFkVGltZSkge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zY2hlZHVsZVRvbmUobmV4dE5vdGVUaW1lLCBuZXh0NHRoTm90ZSAlIG51bUJlYXRzUGVyQmFyID8gUGl0Y2guTUlEIDogUGl0Y2guSElHSCk7XG5cbiAgICAgICAgICAgICAgICBsZXQgc2Vjb25kc1BlckJlYXQgPSA2MC4wIC8gdGhpcy50ZW1wbztcbiAgICAgICAgICAgICAgICBuZXh0Tm90ZVRpbWUgKz0gc2Vjb25kc1BlckJlYXQ7XG4gICAgICAgICAgICAgICAgbmV4dDR0aE5vdGUgPSAobmV4dDR0aE5vdGUgKyAxKSAlIG51bUJlYXRzUGVyQmFyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0sIHNjaGVkdWxlSW50ZXJ2YWwpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzY2hlZHVsZVRvbmUoc3RhcnRUaW1lOiBudW1iZXIsIHBpdGNoOiBQaXRjaCk6IHZvaWQge1xuXG4gICAgICAgIGxldCBvc2MgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gICAgICAgIG9zYy5jb25uZWN0KHRoaXMuYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgICAgICBsZXQgZnJlcXVlbmN5ID0gMDtcblxuICAgICAgICBzd2l0Y2ggKHBpdGNoKSB7XG4gICAgICAgICAgICBjYXNlIFBpdGNoLkhJR0g6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gODgwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5NSUQ6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gNDQwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5MT1c6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gMjIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBwaXRjaCcpXG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gMjIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXF1ZW5jeTtcbiAgICAgICAgb3NjLnN0YXJ0KHN0YXJ0VGltZSk7XG4gICAgICAgIG9zYy5zdG9wKHN0YXJ0VGltZSArIG5vdGVMZW5ndGgpO1xuICAgIH1cbn1cblxuIiwiLyoqXG4gKiBNZXRyb25vbWVVaVxuICovXG5pbXBvcnQgTWV0cm9ub21lIGZyb20gJy4vTWV0cm9ub21lJztcbmltcG9ydCBUYXBwZXIgZnJvbSAnLi9UYXBwZXInO1xuaW1wb3J0IFdoaWxlUHJlc3NlZEJ0biBmcm9tICcuL1doaWxlUHJlc3NlZEJ0bidcbmltcG9ydCBJbnB1dERpc3BsYXkgZnJvbSAnLi9JbnB1dERpc3BsYXknXG5cbmNvbnN0IGRlZmF1bHRUZW1wbyA9IDEyMDsgLy9CUE1cbmNvbnN0IGRlZmF1bHRIZWxwVGV4dCA9ICdUZW1wbyBpbiBiZWF0cyBwZXIgbWludXRlIChCUE0pOidcblxuLy9UaGVzZSBzaG91bGQgYmUgaW1wb3J0ZWQgZnJvbSBNZXRyb25vbWUgbW9kdWxlXG5jb25zdCBtaW5UZW1wbyA9IDQwO1xuY29uc3QgbWF4VGVtcG8gPSAyNTA7XG5cbmxldCBoYXNMb2NhbFN0b3JhZ2UgPSAoKCkgPT4ge1xuICAgIGxldCB0ZXN0ID0gJ21ldHJvbm9tZS10ZXN0LXN0cmluZyc7XG4gICAgdHJ5IHtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGVzdCwgdGVzdCk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHRlc3QpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KSgpXG5cbmVudW0gS2V5Q29kZXMgeyBTUEFDRSA9IDMyIH07XG5lbnVtIE1vdXNlQ29kZXMgeyBMRUZUID0gMSB9O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWVVaSB7XG5cbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgZGlzcGxheVZhbHVlOiBudW1iZXIgPSBkZWZhdWx0VGVtcG87XG5cbiAgICBwcml2YXRlIGVudGVySXNQcmVzc2VkOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBzcGFjZUlzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG4gICAgcHJpdmF0ZSBtZXRyb25vbWU6IE1ldHJvbm9tZTtcbiAgICBwcml2YXRlIHRhcHBlcjogVGFwcGVyXG5cbiAgICBwcml2YXRlIHBsdXNzQnRuOiBXaGlsZVByZXNzZWRCdG47XG4gICAgcHJpdmF0ZSBtaW51c0J0bjogV2hpbGVQcmVzc2VkQnRuO1xuICAgIHByaXZhdGUgaW5wdXREaXNwbGF5OiBJbnB1dERpc3BsYXk7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBsYXlQYXVzZUJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSB0YXBCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIHBsdXNzQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBtaW51c0J0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSByZXNldEJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgaW5wdXREaXNwbGF5OiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBpbnB1dERpc3BsYXlMYWJlbDogSFRNTExhYmVsRWxlbWVudCkge1xuXG4gICAgICAgIHRoaXMubWV0cm9ub21lID0gbmV3IE1ldHJvbm9tZShkZWZhdWx0VGVtcG8pO1xuICAgICAgICB0aGlzLnRhcHBlciA9IG5ldyBUYXBwZXIoKTtcblxuICAgICAgICB0aGlzLnBsdXNzQnRuID0gbmV3IFdoaWxlUHJlc3NlZEJ0bihwbHVzc0J0biwgKCkgPT4geyB0aGlzLmluY3JlbWVudERpc3BsYXlWYWx1ZSgpIH0pO1xuICAgICAgICB0aGlzLm1pbnVzQnRuID0gbmV3IFdoaWxlUHJlc3NlZEJ0bihtaW51c0J0biwgKCkgPT4geyB0aGlzLmRlY3JlbWVudERpc3BsYXlWYWx1ZSgpIH0pO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheSA9IG5ldyBJbnB1dERpc3BsYXkoaW5wdXREaXNwbGF5LCBpbnB1dERpc3BsYXlMYWJlbCwgZGVmYXVsdFRlbXBvLCBkZWZhdWx0SGVscFRleHQsXG4gICAgICAgICAgICAodmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIC8vVmFsaWRhdG9yIGZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8odmFsdWUpXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgKHZhbHVlOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICAvL0hhbmRsZSBuZXcgdmFsaWQgdmFsdWVcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlWYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0TWV0cm9ub21lVGVtcG8odmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKHRoaXMuZ2V0VGVtcG9Gcm9tU3RvcmFnZSgpKTtcblxuICAgICAgICAvL1NldCBldmVudCBoYW5kbGVyc1xuICAgICAgICBwbGF5UGF1c2VCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnRvZ2dsZVBsYXlQYXVzZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0YXBCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnRhcCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVLZXlEb3duKGV2ZW50KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlS2V5VXAoZXZlbnQpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHRhcCgpOiB2b2lkIHtcbiAgICAgICAgbGV0IHthdmVyYWdlVGVtcG8sIG51bVZhbHVlc0F2ZXJhZ2VkfSA9IHRoaXMudGFwcGVyLnRhcCgpO1xuXG4gICAgICAgIGlmIChudW1WYWx1ZXNBdmVyYWdlZCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ051bSB2YWx1ZXMgYXZlcmFnZWQ6JywgbnVtVmFsdWVzQXZlcmFnZWQpXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKGF2ZXJhZ2VUZW1wbylcbiAgICB9XG5cbiAgICBwcml2YXRlIHRvZ2dsZVBsYXlQYXVzZSgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5pc1BsYXlpbmcgPSB0aGlzLm1ldHJvbm9tZS50b2dnbGUoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGluY3JlbWVudERpc3BsYXlWYWx1ZSgpOiB2b2lkIHtcblxuICAgICAgICBsZXQgbmV3VmFsdWUgPSB0aGlzLmRpc3BsYXlWYWx1ZSArIDE7XG5cbiAgICAgICAgbGV0IHt2YWxpZCwgZXJyb3J9ID0gdGhpcy5tZXRyb25vbWUudmFsaWRhdGVUZW1wbyhuZXdWYWx1ZSlcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgPiBtYXhUZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUobWF4VGVtcG8pXG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgPCBtaW5UZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUobWluVGVtcG8pXG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5zZXRUaW1lZEVycm9yKGVycm9yLCAyMDAwKVxuICAgICAgICAgICAgdGhpcy5wbHVzc0J0bi5zZXRUaW1lZEVycm9yKDIwMDApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBkZWNyZW1lbnREaXNwbGF5VmFsdWUoKTogdm9pZCB7XG4gICAgICAgIGxldCBuZXdWYWx1ZSA9IHRoaXMuZGlzcGxheVZhbHVlIC0gMTtcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKG5ld1ZhbHVlKVxuXG4gICAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA8IG1pblRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZShtaW5UZW1wbylcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA+IG1heFRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZShtYXhUZW1wbylcbiAgICAgICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LnNldFRpbWVkRXJyb3IoZXJyb3IsIDIwMDApXG4gICAgICAgICAgICB0aGlzLm1pbnVzQnRuLnNldFRpbWVkRXJyb3IoMjAwMClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlc2V0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShkZWZhdWx0VGVtcG8pO1xuICAgICAgICB0aGlzLm1ldHJvbm9tZS5wYXVzZSgpO1xuICAgICAgICB0aGlzLm1ldHJvbm9tZS5zZXRUZW1wbyhkZWZhdWx0VGVtcG8pO1xuICAgICAgICB0aGlzLnRhcHBlci5yZXNldCgpO1xuICAgICAgICBsb2NhbFN0b3JhZ2UuY2xlYXIoKVxuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlS2V5RG93bihldmVudDogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgICAgICBjb25zdCBrZXlOYW1lID0gZXZlbnQua2V5O1xuXG4gICAgICAgIGlmIChrZXlOYW1lID09PSAnQXJyb3dVcCcgfHwga2V5TmFtZSA9PT0gJ0Fycm93UmlnaHQnKSB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5pbmNyZW1lbnREaXNwbGF5VmFsdWUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXlOYW1lID09PSAnQXJyb3dEb3duJyB8fCBrZXlOYW1lID09PSAnQXJyb3dMZWZ0Jykge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHRoaXMuZGVjcmVtZW50RGlzcGxheVZhbHVlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5TmFtZSA9PT0gJ0VudGVyJykge1xuICAgICAgICAgICAgLy9NYXkgbm90IGJlIHZlcnkgaW50dWl0aXZlLiBFZy4gZW50ZXIgb24gcmVzZXQgYnV0dG9uIHdpbGwgbm90IFwicHJlc3NcIiByZXNldFxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmVudGVySXNQcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50b2dnbGVQbGF5UGF1c2UoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVudGVySXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudC5rZXlDb2RlID09PSBLZXlDb2Rlcy5TUEFDRSkge1xuICAgICAgICAgICAgLy9NYXkgbm90IGJlIHZlcnkgaW50dWl0aXZlLiBFZy4gc3BhY2Ugb24gcmVzZXQgYnV0dG9uIHdpbGwgbm90IFwicHJlc3NcIiByZXNldFxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNwYWNlSXNQcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50YXAoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNwYWNlSXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlS2V5VXAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VudGVyJykge1xuICAgICAgICAgICAgdGhpcy5lbnRlcklzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGVzLlNQQUNFKSB7XG4gICAgICAgICAgICB0aGlzLnNwYWNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldERpc3BsYXlWYWx1ZSh2YWx1ZTogbnVtYmVyKTogdm9pZCB7XG5cbiAgICAgICAgdmFsdWUgPSBNYXRoLnJvdW5kKHZhbHVlICogMTAwKSAvIDEwMDtcblxuICAgICAgICB0aGlzLmRpc3BsYXlWYWx1ZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5zZXRWYWx1ZSh2YWx1ZSlcblxuICAgICAgICBsZXQge3ZhbGlkfSA9IHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8odmFsdWUpXG5cbiAgICAgICAgaWYgKHZhbGlkKSB7XG4gICAgICAgICAgICB0aGlzLnNldE1ldHJvbm9tZVRlbXBvKHZhbHVlKTtcbiAgICAgICAgICAgIHRoaXMuc2V0VGVtcG9JblN0b3JhZ2UodmFsdWUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldE1ldHJvbm9tZVRlbXBvKHRlbXBvOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUuc2V0VGVtcG8odGVtcG8pO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0VGVtcG9Gcm9tU3RvcmFnZSgpOiBudW1iZXIge1xuXG4gICAgICAgIGlmICghaGFzTG9jYWxTdG9yYWdlKSByZXR1cm4gZGVmYXVsdFRlbXBvXG5cbiAgICAgICAgbGV0IGl0ZW0gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndGVtcG8nKVxuXG4gICAgICAgIGlmICghaXRlbSkge1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3RlbXBvJywgZGVmYXVsdFRlbXBvLnRvU3RyaW5nKCkpXG4gICAgICAgICAgICByZXR1cm4gZGVmYXVsdFRlbXBvXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOYU4oaXRlbSkpIHtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0ZW1wbycsIGRlZmF1bHRUZW1wby50b1N0cmluZygpKVxuICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRUZW1wb1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIE51bWJlcihpdGVtKVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0VGVtcG9JblN0b3JhZ2UodGVtcG86IG51bWJlcikge1xuICAgICAgICBpZiAoIWhhc0xvY2FsU3RvcmFnZSkgcmV0dXJuXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0ZW1wbycsIHRlbXBvLnRvU3RyaW5nKCkpXG4gICAgfVxufSIsIi8qKlxuICogVGFwcGVyIC0gYSB0ZW1wbyB0YXBwZXIgbW9kdWxlLiBUaGUgdGFwcGVyIGF2ZXJhZ2VzIGNvbnNlY3V0aXZlIHZhbHVlcyBiZWZvcmUgcmVzZXR0aW5nIGFmdGVyIHJlc2V0QWZ0ZXIgbWlsbGlzZWNvbmRzLlxuICovXG5jb25zdCByZXNldEFmdGVyID0gNTAwMDsgLy9tc1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUYXBwZXIge1xuXG4gICAgcHJpdmF0ZSBwcmV2aW91c1RhcDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIGF2ZXJhZ2VJbnRlcnZhbDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIG51bVZhbHVlc0F2ZXJhZ2VkOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgdGltZXJIYW5kbGU6IG51bWJlciA9IDA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHsgfVxuXG4gICAgdGFwKCk6IHsgYXZlcmFnZVRlbXBvOiBudW1iZXIsIG51bVZhbHVlc0F2ZXJhZ2VkOiBudW1iZXIgfSB7XG5cbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZXJIYW5kbGUpXG5cbiAgICAgICAgdGhpcy50aW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZXNldCgpXG4gICAgICAgIH0sIHJlc2V0QWZ0ZXIpXG5cbiAgICAgICAgaWYgKCF0aGlzLnByZXZpb3VzVGFwKSB7XG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzVGFwID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGF2ZXJhZ2VUZW1wbzogMCxcbiAgICAgICAgICAgICAgICBudW1WYWx1ZXNBdmVyYWdlZDogMFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjdXJyZW50VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgICBsZXQgaW50ZXJ2YWwgPSBjdXJyZW50VGltZSAtIHRoaXMucHJldmlvdXNUYXA7XG4gICAgICAgIHRoaXMucHJldmlvdXNUYXAgPSBjdXJyZW50VGltZTtcblxuICAgICAgICB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkKytcblxuICAgICAgICAvLyBSZWN1cnNpdmUgYWxnb3JpdGhtIGZvciBsaW5lYXIgYXZlcmFnaW5nXG4gICAgICAgIHRoaXMuYXZlcmFnZUludGVydmFsID0gdGhpcy5hdmVyYWdlSW50ZXJ2YWwgKyAoMSAvIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQpICogKGludGVydmFsIC0gdGhpcy5hdmVyYWdlSW50ZXJ2YWwpXG5cbiAgICAgICAgbGV0IGJwbSA9IDEwMDAgKiA2MC4wIC8gdGhpcy5hdmVyYWdlSW50ZXJ2YWw7XG5cbiAgICAgICAgLy9SZXR1cm4gdmFsdWUgcm91bmRlZCB0byB0d28gZGVjaW1hbHNcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGF2ZXJhZ2VUZW1wbzogTWF0aC5yb3VuZChicG0gKiAxMDApIC8gMTAwLFxuICAgICAgICAgICAgbnVtVmFsdWVzQXZlcmFnZWQ6IHRoaXMubnVtVmFsdWVzQXZlcmFnZWRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IDA7XG4gICAgICAgIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQgPSAwO1xuICAgICAgICB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCA9IDA7XG4gICAgfVxufSIsIi8qKlxuICogV2hpbGVQcmVzc2VkQnRuLiBBIGJ1dHRvbiB3aGljaCByZXBlYXRlZGx5IHRyaWdnZXJzIGFuIGV2ZW50IHdoaWxlIHByZXNzZWQuXG4gKi9cbmVudW0gTW91c2VDb2RlcyB7IExFRlQgPSAxIH07XG5cbmNvbnN0IGtleURvd25SZXBlYXREZWxheSA9IDUwMDsgLy9tcy4gU2FtZSBhcyBDaHJvbWUuXG5jb25zdCBrZXlEb3duUmVwZWF0SW50ZXJ2YWwgPSAzMDsgLy9tcy4gU2FtZSBhcyBDaHJvbWUuXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFdoaWxlUHJlc3NlZEJ0biB7XG5cbiAgICBwcml2YXRlIGJ0bjogSFRNTElucHV0RWxlbWVudDtcbiAgICBwcml2YXRlIGVycm9yVGltZXJJZDogbnVtYmVyID0gMDtcblxuICAgIHByaXZhdGUgbW91c2VJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIG1vdXNlRG93blRpbWVySGFuZGxlOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbW91c2VEb3duSGFuZGxlckZ1bmN0aW9uOiAoKSA9PiB2b2lkO1xuXG4gICAgY29uc3RydWN0b3IoYnRuRWxlbWVudDogSFRNTElucHV0RWxlbWVudCwgaGFuZGxlckZ1bmN0aW9uOiAoKSA9PiB2b2lkKSB7XG5cbiAgICAgICAgdGhpcy5idG4gPSBidG5FbGVtZW50O1xuICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbiA9IGhhbmRsZXJGdW5jdGlvbjtcblxuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC53aGljaCAhPT0gTW91c2VDb2Rlcy5MRUZUKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7IHRoaXMubW91c2VEb3duTG9vcCgpIH0sIGtleURvd25SZXBlYXREZWxheSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgIHRoaXMuYnRuLmZvY3VzKCkgLy9UT0RPOiBDaGVjayBwcm9ibGVtIGluIGNocm9tZSBpUGhvbmUgZW11bGF0b3Igd2hlcmUgaG92ZXIgaXMgbm90IHJlbW92ZWQgZnJvbSBwcmV2aW91c2x5IGZvY3VzZWQgZWxlbWVudC4gS25vd24gYXMgdGhlIHN0aWNreSBob3ZlciBwcm9ibGVtLlxuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4geyB0aGlzLm1vdXNlRG93bkxvb3AoKSB9LCBrZXlEb3duUmVwZWF0RGVsYXkpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvL0FkZCBtb3VzZXVwIGV2ZW50bGlzdGVuZXIgdG8gZG9jdW1lbnQgaW4gY2FzZSB0aGUgbW91c2UgaXMgbW92ZWQgYXdheSBmcm9tIGJ0biBiZWZvcmUgaXQgaXMgcmVsZWFzZWQuXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC53aGljaCAhPT0gTW91c2VDb2Rlcy5MRUZUKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vRW5kIG9mIHRvdWNoIGV2ZW50c1xuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUpO1xuICAgICAgICB9KVxuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoY2FuY2VsJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSk7XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgc2V0VGltZWRFcnJvcihkdXJhdGlvbjogbnVtYmVyKTogdm9pZCB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLmVycm9yVGltZXJJZClcblxuICAgICAgICB0aGlzLmJ0bi5jbGFzc0xpc3QuYWRkKCdoYXMtZXJyb3InKVxuXG4gICAgICAgIHRoaXMuZXJyb3JUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmJ0bi5jbGFzc0xpc3QucmVtb3ZlKCdoYXMtZXJyb3InKVxuICAgICAgICB9LCBkdXJhdGlvbilcbiAgICB9XG5cbiAgICBwcml2YXRlIG1vdXNlRG93bkxvb3AoKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKCF0aGlzLm1vdXNlSXNQcmVzc2VkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbigpO1xuXG4gICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCkgfSwga2V5RG93blJlcGVhdEludGVydmFsKTtcbiAgICB9XG59IiwiaW1wb3J0IE1ldHJvbm9tZVVpIGZyb20gXCIuL01ldHJvbm9tZVVpXCJcblxuLy9DYW4gdXNlIERvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoKSBpbnN0ZWFkXG5sZXQgdWkgPSBuZXcgTWV0cm9ub21lVWkoPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXlQYXVzZUJ0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0YXBCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGx1c3NCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWludXNCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzZXRCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5wdXREaXNwbGF5JyksXG4gICAgPEhUTUxMYWJlbEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lucHV0RGlzcGxheUxhYmVsJykpO1xuIl19
