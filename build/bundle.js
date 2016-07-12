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
        this.setDisplayValue(defaultTempo);
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
        }
    };
    MetronomeUi.prototype.setMetronomeTempo = function (tempo) {
        this.metronome.setTempo(tempo);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvSW5wdXREaXNwbGF5LnRzIiwic3JjL01ldHJvbm9tZS50cyIsInNyYy9NZXRyb25vbWVVaS50cyIsInNyYy9UYXBwZXIudHMiLCJzcmMvV2hpbGVQcmVzc2VkQnRuLnRzIiwic3JjL21haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7O0dBRUc7QUFDSCxJQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsQ0FBQSxLQUFLO0FBQ2pDLElBQUssS0FBNEI7QUFBakMsV0FBSyxLQUFLO0lBQUcsNkJBQUUsQ0FBQTtJQUFFLHVDQUFPLENBQUE7SUFBRSxtQ0FBSyxDQUFBO0FBQUMsQ0FBQyxFQUE1QixLQUFLLEtBQUwsS0FBSyxRQUF1QjtBQUVqQztJQU9JLHNCQUFvQixZQUE4QixFQUFVLEtBQXVCLEVBQy9FLFlBQW9CLEVBQ1osZUFBdUIsRUFDdkIsU0FBK0QsRUFDL0QsZUFBd0M7UUFYeEQsaUJBMEhDO1FBbkh1QixpQkFBWSxHQUFaLFlBQVksQ0FBa0I7UUFBVSxVQUFLLEdBQUwsS0FBSyxDQUFrQjtRQUV2RSxvQkFBZSxHQUFmLGVBQWUsQ0FBUTtRQUN2QixjQUFTLEdBQVQsU0FBUyxDQUFzRDtRQUMvRCxvQkFBZSxHQUFmLGVBQWUsQ0FBeUI7UUFQNUMsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFDekIsbUJBQWMsR0FBVyxDQUFDLENBQUM7UUFRL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUM7UUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2xELElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUV0QixJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENB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QUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxFQUN2QyxRQUFRLENBQUMsY0FBYyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIElucHV0RGlzcGxheVxuICovXG5jb25zdCBpbnB1dFJlYWN0RGVsYXkgPSA1MDA7Ly9tcy5cbmVudW0gU3RhdGUgeyBPSywgV0FSTklORywgRVJST1IgfVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJbnB1dERpc3BsYXkge1xuXG4gICAgcHJpdmF0ZSBzdGF0ZTogU3RhdGU7XG4gICAgcHJpdmF0ZSB2YWx1ZTogbnVtYmVyO1xuICAgIHByaXZhdGUgaW5wdXRUaW1lcklkOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbWVzc2FnZVRpbWVySWQ6IG51bWJlciA9IDA7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIGlucHV0RGlzcGxheTogSFRNTElucHV0RWxlbWVudCwgcHJpdmF0ZSBsYWJlbDogSFRNTExhYmVsRWxlbWVudCxcbiAgICAgICAgaW5pdGlhbFZhbHVlOiBudW1iZXIsXG4gICAgICAgIHByaXZhdGUgZGVmYXVsdEhlbHBUZXh0OiBzdHJpbmcsXG4gICAgICAgIHByaXZhdGUgdmFsaWRhdG9yOiAodmFsdWU6IG51bWJlcikgPT4geyB2YWxpZDogYm9vbGVhbiwgZXJyb3I6IHN0cmluZyB9LFxuICAgICAgICBwcml2YXRlIG9uTmV3VmFsaWRWYWx1ZTogKHZhbHVlOiBudW1iZXIpID0+IHZvaWQpIHtcblxuICAgICAgICB0aGlzLnZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IGluaXRpYWxWYWx1ZS50b1N0cmluZygpO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuT0s7XG5cbiAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZShpbml0aWFsVmFsdWUudG9TdHJpbmcoKSk7XG5cbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlSW5wdXRFdmVudChldmVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldFZhbHVlKHZhbHVlOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy52YWx1ZSA9IE1hdGgucm91bmQodmFsdWUgKiAxMDApIC8gMTAwO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IHRoaXMudmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZSh2YWx1ZS50b1N0cmluZygpKTtcbiAgICB9XG5cbiAgICBzZXRUaW1lZEVycm9yKG1lc3NhZ2U6IHN0cmluZywgZHVyYXRpb246IG51bWJlcikge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tZXNzYWdlVGltZXJJZClcblxuICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLkVSUk9SKVxuICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZShtZXNzYWdlKVxuXG4gICAgICAgIHRoaXMubWVzc2FnZVRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIC8vR28gYmFjayB0byBzdGF0ZSBjb3JyZXNwb25kaW5nIHRvIGN1cnJlbnQgZGlzcGxheSB2YWx1ZVxuICAgICAgICAgICAgdGhpcy5oYW5kbGVOZXdWYWx1ZSh0aGlzLmlucHV0RGlzcGxheS52YWx1ZSlcbiAgICAgICAgfSwgZHVyYXRpb24pXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVOZXdWYWx1ZSh2YWx1ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh2YWx1ZS50b1N0cmluZygpLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKCdUaGUgdmFsdWUgbXVzdCBoYXZlIGF0IGxlYXN0IHR3byBkaWdpdHMuJyk7XG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLldBUk5JTkcpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNOYU4oTnVtYmVyKHZhbHVlKSkpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKCdUaGUgZW50ZXJlZCB2YWx1ZSBpcyBub3QgYSBudW1iZXIuIFBsZWFzZSBlbnRlciBhIG51bWJlcicpXG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLldBUk5JTkcpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdmFsdWVBc051bWJlciA9IE51bWJlcih2YWx1ZSlcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLnZhbGlkYXRvcih2YWx1ZUFzTnVtYmVyKTtcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZShlcnJvcilcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuRVJST1IpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldFN0YXRlKFN0YXRlLk9LKVxuICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZSh0aGlzLmRlZmF1bHRIZWxwVGV4dClcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUlucHV0RXZlbnQoZXZlbnQ6IEV2ZW50KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLmlucHV0VGltZXJJZCk7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1lc3NhZ2VUaW1lcklkKTtcblxuICAgICAgICB0aGlzLmlucHV0VGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgbGV0IHZhbHVlID0gdGhpcy5pbnB1dERpc3BsYXkudmFsdWU7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5oYW5kbGVOZXdWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5vbk5ld1ZhbGlkVmFsdWUoTnVtYmVyKHZhbHVlKSlcblxuICAgICAgICB9LCBpbnB1dFJlYWN0RGVsYXkpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRTdGF0ZShuZXh0U3RhdGU6IFN0YXRlKSB7XG4gICAgICAgIC8vU2V0IENTUyBjbGFzc2VzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGVsZW1lbnQgc3RhdGVcbiAgICAgICAgbGV0IGN1cnJlbnRTdGF0ZUNsYXNzID0gdGhpcy5nZXRTdGF0ZUNsYXNzKHRoaXMuc3RhdGUpXG4gICAgICAgIGxldCBuZXh0U3RhdGVDbGFzcyA9IHRoaXMuZ2V0U3RhdGVDbGFzcyhuZXh0U3RhdGUpO1xuXG4gICAgICAgIGlmIChjdXJyZW50U3RhdGVDbGFzcyAhPT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LmNsYXNzTGlzdC5yZW1vdmUoY3VycmVudFN0YXRlQ2xhc3MpXG4gICAgICAgICAgICB0aGlzLmxhYmVsLmNsYXNzTGlzdC5yZW1vdmUoY3VycmVudFN0YXRlQ2xhc3MpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV4dFN0YXRlQ2xhc3MgIT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5jbGFzc0xpc3QuYWRkKG5leHRTdGF0ZUNsYXNzKVxuICAgICAgICAgICAgdGhpcy5sYWJlbC5jbGFzc0xpc3QuYWRkKG5leHRTdGF0ZUNsYXNzKVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdGF0ZSA9IG5leHRTdGF0ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFN0YXRlQ2xhc3Moc3RhdGU6IFN0YXRlKTogc3RyaW5nIHtcbiAgICAgICAgc3dpdGNoIChzdGF0ZSkge1xuICAgICAgICAgICAgY2FzZSBTdGF0ZS5PSzpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ29rJ1xuICAgICAgICAgICAgY2FzZSBTdGF0ZS5XQVJOSU5HOlxuICAgICAgICAgICAgICAgIHJldHVybiAnaGFzLXdhcm5pbmcnXG4gICAgICAgICAgICBjYXNlIFN0YXRlLkVSUk9SOlxuICAgICAgICAgICAgICAgIHJldHVybiAnaGFzLWVycm9yJ1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnVHJpZWQgdG8gZ2V0IGNsYXNzIGNvcnJlc3BvbmRpbmcgdG8gbm9uLWV4aXN0aW5nIHN0YXRlOicsIHN0YXRlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJydcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0RXJyb3JNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICB0aGlzLmxhYmVsLnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICB9XG59IiwiLyoqXG4gKiBNZXRyb25vbWVcbiAqL1xuY29uc3QgbWluVGVtcG8gPSA0MDsvL0JQTVxuY29uc3QgbWF4VGVtcG8gPSAyNTA7Ly9CUE1cbmNvbnN0IG51bUJlYXRzUGVyQmFyID0gNDtcblxuY29uc3Qgbm90ZUxlbmd0aCA9IDAuMDU7Ly9TZWNvbmRzXG5jb25zdCBzY2hlZHVsZUludGVydmFsID0gMjUuMDsvL21zLiBIb3cgb2Z0ZW4gdGhlIHNjaGVkdWxpbmcgaXMgY2FsbGVkLlxuY29uc3Qgc2NoZWR1bGVBaGVhZFRpbWUgPSAwLjE7Ly9TZWNvbmRzXG5cbmVudW0gUGl0Y2ggeyBISUdILCBNSUQsIExPVyB9O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWUge1xuXG4gICAgcHJpdmF0ZSB0ZW1wbzogbnVtYmVyOyAvL2JlYXRzIHBlciBtaW51dGUgKEJQTSlcbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgY3VycmVudEJlYXQ6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBhdWRpb0NvbnRleHQ6IEF1ZGlvQ29udGV4dDtcbiAgICBwcml2YXRlIGF1ZGlvTG9vcFRpbWVySGFuZGxlOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih0ZW1wbzogbnVtYmVyKSB7XG4gICAgICAgIC8vU2FmYXJpIG5lZWRzIHByZWZpeCB3ZWJraXRBdWRpb0NvbnRleHRcbiAgICAgICAgdGhpcy5hdWRpb0NvbnRleHQgPSBuZXcgKCg8YW55PndpbmRvdykuQXVkaW9Db250ZXh0IHx8ICg8YW55PndpbmRvdykud2Via2l0QXVkaW9Db250ZXh0KSgpXG4gICAgICAgIHRoaXMuc2V0VGVtcG8odGVtcG8pO1xuICAgIH1cblxuICAgIHBsYXkoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuYXVkaW9Mb29wKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwYXVzZSgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3BBdWRpb0xvb3AoKTtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0b2dnbGUoKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICh0aGlzLmlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaXNQbGF5aW5nO1xuICAgIH1cblxuICAgIHZhbGlkYXRlVGVtcG8odGVtcG86IG51bWJlcik6IHsgdmFsaWQ6IGJvb2xlYW4sIGVycm9yOiBzdHJpbmcgfSB7XG4gICAgICAgIGlmIChpc05hTih0ZW1wbykpIHtcbiAgICAgICAgICAgIC8vQ2hhbmdlIHRvIGVycm9yIHN0YXRlXG4gICAgICAgICAgICByZXR1cm4geyB2YWxpZDogZmFsc2UsIGVycm9yOiAnWW91IG11c3QgZW50ZXIgYSBudW1iZXInIH07XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wbyA9IE51bWJlcih0ZW1wbyk7XG5cbiAgICAgICAgaWYgKHRlbXBvIDwgbWluVGVtcG8pIHtcbiAgICAgICAgICAgIC8vU2lnbmFsIGVycm9yXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQmVsb3cgbWluIHRlbXBvJylcbiAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3I6ICdNaW5pbXVtIHRlbXBvIGlzICcgKyBtaW5UZW1wbyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRlbXBvID4gbWF4VGVtcG8pIHtcbiAgICAgICAgICAgIC8vU2lnbmFsIGVycm9yXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQWJvdmUgbWF4IHRlbXBvJylcbiAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3I6ICdNYXggdGVtcG8gaXMgJyArIG1heFRlbXBvIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyB2YWxpZDogdHJ1ZSwgZXJyb3I6ICcnIH07XG4gICAgfVxuXG4gICAgc2V0VGVtcG8odGVtcG86IG51bWJlcik6IHZvaWQge1xuXG4gICAgICAgIGlmICh0aGlzLnRlbXBvID09PSB0ZW1wbykge1xuICAgICAgICAgICAgLy9EbyBub3RoaW5nIGlmIGl0IGlzIHRoZSBzYW1lXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQge3ZhbGlkfSA9IHRoaXMudmFsaWRhdGVUZW1wbyh0ZW1wbylcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRlbXBvID0gTnVtYmVyKHRlbXBvKTtcblxuICAgICAgICBjb25zb2xlLmxvZygnTmV3IG1ldHJvbm9tZSB0ZW1wbzonLCB0ZW1wbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdG9wQXVkaW9Mb29wKCkge1xuICAgICAgICBjbGVhckludGVydmFsKHRoaXMuYXVkaW9Mb29wVGltZXJIYW5kbGUpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhdWRpb0xvb3AoKSB7XG5cbiAgICAgICAgbGV0IG5leHROb3RlVGltZSA9IHRoaXMuYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICBsZXQgbmV4dDR0aE5vdGUgPSAwO1xuXG4gICAgICAgIC8vVGhlIHNjaGVkdWxlclxuICAgICAgICB0aGlzLmF1ZGlvTG9vcFRpbWVySGFuZGxlID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3aGlsZSAobmV4dE5vdGVUaW1lIDwgdGhpcy5hdWRpb0NvbnRleHQuY3VycmVudFRpbWUgKyBzY2hlZHVsZUFoZWFkVGltZSkge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zY2hlZHVsZVRvbmUobmV4dE5vdGVUaW1lLCBuZXh0NHRoTm90ZSAlIG51bUJlYXRzUGVyQmFyID8gUGl0Y2guTUlEIDogUGl0Y2guSElHSCk7XG5cbiAgICAgICAgICAgICAgICBsZXQgc2Vjb25kc1BlckJlYXQgPSA2MC4wIC8gdGhpcy50ZW1wbztcbiAgICAgICAgICAgICAgICBuZXh0Tm90ZVRpbWUgKz0gc2Vjb25kc1BlckJlYXQ7XG4gICAgICAgICAgICAgICAgbmV4dDR0aE5vdGUgPSAobmV4dDR0aE5vdGUgKyAxKSAlIG51bUJlYXRzUGVyQmFyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0sIHNjaGVkdWxlSW50ZXJ2YWwpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzY2hlZHVsZVRvbmUoc3RhcnRUaW1lOiBudW1iZXIsIHBpdGNoOiBQaXRjaCk6IHZvaWQge1xuXG4gICAgICAgIGxldCBvc2MgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gICAgICAgIG9zYy5jb25uZWN0KHRoaXMuYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgICAgICBsZXQgZnJlcXVlbmN5ID0gMDtcblxuICAgICAgICBzd2l0Y2ggKHBpdGNoKSB7XG4gICAgICAgICAgICBjYXNlIFBpdGNoLkhJR0g6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gODgwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5NSUQ6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gNDQwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5MT1c6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gMjIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBwaXRjaCcpXG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gMjIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXF1ZW5jeTtcbiAgICAgICAgb3NjLnN0YXJ0KHN0YXJ0VGltZSk7XG4gICAgICAgIG9zYy5zdG9wKHN0YXJ0VGltZSArIG5vdGVMZW5ndGgpO1xuICAgIH1cbn1cblxuIiwiLyoqXG4gKiBNZXRyb25vbWVVaVxuICovXG5pbXBvcnQgTWV0cm9ub21lIGZyb20gJy4vTWV0cm9ub21lJztcbmltcG9ydCBUYXBwZXIgZnJvbSAnLi9UYXBwZXInO1xuaW1wb3J0IFdoaWxlUHJlc3NlZEJ0biBmcm9tICcuL1doaWxlUHJlc3NlZEJ0bidcbmltcG9ydCBJbnB1dERpc3BsYXkgZnJvbSAnLi9JbnB1dERpc3BsYXknXG5cbmNvbnN0IGRlZmF1bHRUZW1wbyA9IDEyMDsgLy9CUE1cbmNvbnN0IGRlZmF1bHRIZWxwVGV4dCA9ICdUZW1wbyBpbiBiZWF0cyBwZXIgbWludXRlIChCUE0pOidcblxuLy9UaGVzZSBzaG91bGQgYmUgaW1wb3J0ZWQgZnJvbSBNZXRyb25vbWUgbW9kdWxlXG5jb25zdCBtaW5UZW1wbyA9IDQwO1xuY29uc3QgbWF4VGVtcG8gPSAyNTA7XG5cbmVudW0gS2V5Q29kZXMgeyBTUEFDRSA9IDMyIH07XG5lbnVtIE1vdXNlQ29kZXMgeyBMRUZUID0gMSB9O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWVVaSB7XG5cbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgZGlzcGxheVZhbHVlOiBudW1iZXIgPSBkZWZhdWx0VGVtcG87XG5cbiAgICBwcml2YXRlIGVudGVySXNQcmVzc2VkOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBzcGFjZUlzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG4gICAgcHJpdmF0ZSBtZXRyb25vbWU6IE1ldHJvbm9tZTtcbiAgICBwcml2YXRlIHRhcHBlcjogVGFwcGVyXG5cbiAgICBwcml2YXRlIHBsdXNzQnRuOiBXaGlsZVByZXNzZWRCdG47XG4gICAgcHJpdmF0ZSBtaW51c0J0bjogV2hpbGVQcmVzc2VkQnRuO1xuICAgIHByaXZhdGUgaW5wdXREaXNwbGF5OiBJbnB1dERpc3BsYXk7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBsYXlQYXVzZUJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSB0YXBCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIHBsdXNzQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBtaW51c0J0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSByZXNldEJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgaW5wdXREaXNwbGF5OiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBpbnB1dERpc3BsYXlMYWJlbDogSFRNTExhYmVsRWxlbWVudCkge1xuXG4gICAgICAgIHRoaXMubWV0cm9ub21lID0gbmV3IE1ldHJvbm9tZShkZWZhdWx0VGVtcG8pO1xuICAgICAgICB0aGlzLnRhcHBlciA9IG5ldyBUYXBwZXIoKTtcblxuICAgICAgICB0aGlzLnBsdXNzQnRuID0gbmV3IFdoaWxlUHJlc3NlZEJ0bihwbHVzc0J0biwgKCkgPT4geyB0aGlzLmluY3JlbWVudERpc3BsYXlWYWx1ZSgpIH0pO1xuICAgICAgICB0aGlzLm1pbnVzQnRuID0gbmV3IFdoaWxlUHJlc3NlZEJ0bihtaW51c0J0biwgKCkgPT4geyB0aGlzLmRlY3JlbWVudERpc3BsYXlWYWx1ZSgpIH0pO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheSA9IG5ldyBJbnB1dERpc3BsYXkoaW5wdXREaXNwbGF5LCBpbnB1dERpc3BsYXlMYWJlbCwgZGVmYXVsdFRlbXBvLCBkZWZhdWx0SGVscFRleHQsXG4gICAgICAgICAgICAodmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIC8vVmFsaWRhdG9yIGZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8odmFsdWUpXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgKHZhbHVlOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICAvL0hhbmRsZSBuZXcgdmFsaWQgdmFsdWVcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlWYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0TWV0cm9ub21lVGVtcG8odmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKGRlZmF1bHRUZW1wbyk7XG5cbiAgICAgICAgLy9TZXQgZXZlbnQgaGFuZGxlcnNcbiAgICAgICAgcGxheVBhdXNlQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy50b2dnbGVQbGF5UGF1c2UoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGFwQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy50YXAoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmVzZXRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlS2V5RG93bihldmVudCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZUtleVVwKGV2ZW50KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB0YXAoKTogdm9pZCB7XG4gICAgICAgIGxldCB7YXZlcmFnZVRlbXBvLCBudW1WYWx1ZXNBdmVyYWdlZH0gPSB0aGlzLnRhcHBlci50YXAoKTtcblxuICAgICAgICBpZiAobnVtVmFsdWVzQXZlcmFnZWQgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCdOdW0gdmFsdWVzIGF2ZXJhZ2VkOicsIG51bVZhbHVlc0F2ZXJhZ2VkKVxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShhdmVyYWdlVGVtcG8pXG4gICAgfVxuXG4gICAgcHJpdmF0ZSB0b2dnbGVQbGF5UGF1c2UoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdGhpcy5tZXRyb25vbWUudG9nZ2xlKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBpbmNyZW1lbnREaXNwbGF5VmFsdWUoKTogdm9pZCB7XG5cbiAgICAgICAgbGV0IG5ld1ZhbHVlID0gdGhpcy5kaXNwbGF5VmFsdWUgKyAxO1xuXG4gICAgICAgIGxldCB7dmFsaWQsIGVycm9yfSA9IHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8obmV3VmFsdWUpXG5cbiAgICAgICAgaWYgKCF2YWxpZCkge1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlID4gbWF4VGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKG1heFRlbXBvKVxuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlIDwgbWluVGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKG1pblRlbXBvKVxuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuc2V0VGltZWRFcnJvcihlcnJvciwgMjAwMClcbiAgICAgICAgICAgIHRoaXMucGx1c3NCdG4uc2V0VGltZWRFcnJvcigyMDAwKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUobmV3VmFsdWUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgZGVjcmVtZW50RGlzcGxheVZhbHVlKCk6IHZvaWQge1xuICAgICAgICBsZXQgbmV3VmFsdWUgPSB0aGlzLmRpc3BsYXlWYWx1ZSAtIDE7XG5cbiAgICAgICAgbGV0IHt2YWxpZCwgZXJyb3J9ID0gdGhpcy5tZXRyb25vbWUudmFsaWRhdGVUZW1wbyhuZXdWYWx1ZSlcblxuICAgICAgICBpZiAoIXZhbGlkKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgPCBtaW5UZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUobWluVGVtcG8pXG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgPiBtYXhUZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUobWF4VGVtcG8pXG4gICAgICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5zZXRUaW1lZEVycm9yKGVycm9yLCAyMDAwKVxuICAgICAgICAgICAgdGhpcy5taW51c0J0bi5zZXRUaW1lZEVycm9yKDIwMDApXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUoZGVmYXVsdFRlbXBvKTtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUucGF1c2UoKTtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUuc2V0VGVtcG8oZGVmYXVsdFRlbXBvKTtcbiAgICAgICAgdGhpcy50YXBwZXIucmVzZXQoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUtleURvd24oZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qga2V5TmFtZSA9IGV2ZW50LmtleTtcblxuICAgICAgICBpZiAoa2V5TmFtZSA9PT0gJ0Fycm93VXAnIHx8IGtleU5hbWUgPT09ICdBcnJvd1JpZ2h0Jykge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHRoaXMuaW5jcmVtZW50RGlzcGxheVZhbHVlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5TmFtZSA9PT0gJ0Fycm93RG93bicgfHwga2V5TmFtZSA9PT0gJ0Fycm93TGVmdCcpIHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB0aGlzLmRlY3JlbWVudERpc3BsYXlWYWx1ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdFbnRlcicpIHtcbiAgICAgICAgICAgIC8vTWF5IG5vdCBiZSB2ZXJ5IGludHVpdGl2ZS4gRWcuIGVudGVyIG9uIHJlc2V0IGJ1dHRvbiB3aWxsIG5vdCBcInByZXNzXCIgcmVzZXRcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5lbnRlcklzUHJlc3NlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMudG9nZ2xlUGxheVBhdXNlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRlcklzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZXMuU1BBQ0UpIHtcbiAgICAgICAgICAgIC8vTWF5IG5vdCBiZSB2ZXJ5IGludHVpdGl2ZS4gRWcuIHNwYWNlIG9uIHJlc2V0IGJ1dHRvbiB3aWxsIG5vdCBcInByZXNzXCIgcmVzZXRcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5zcGFjZUlzUHJlc3NlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMudGFwKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zcGFjZUlzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUtleVVwKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgICAgIGlmIChldmVudC5rZXkgPT09ICdFbnRlcicpIHtcbiAgICAgICAgICAgIHRoaXMuZW50ZXJJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudC5rZXlDb2RlID09PSBLZXlDb2Rlcy5TUEFDRSkge1xuICAgICAgICAgICAgdGhpcy5zcGFjZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXREaXNwbGF5VmFsdWUodmFsdWU6IG51bWJlcik6IHZvaWQge1xuXG4gICAgICAgIHZhbHVlID0gTWF0aC5yb3VuZCh2YWx1ZSAqIDEwMCkgLyAxMDA7XG5cbiAgICAgICAgdGhpcy5kaXNwbGF5VmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuc2V0VmFsdWUodmFsdWUpXG5cbiAgICAgICAgbGV0IHt2YWxpZH0gPSB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKHZhbHVlKVxuXG4gICAgICAgIGlmICh2YWxpZCkge1xuICAgICAgICAgICAgdGhpcy5zZXRNZXRyb25vbWVUZW1wbyh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldE1ldHJvbm9tZVRlbXBvKHRlbXBvOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUuc2V0VGVtcG8odGVtcG8pO1xuICAgIH1cbn0iLCIvKipcbiAqIFRhcHBlciAtIGEgdGVtcG8gdGFwcGVyIG1vZHVsZS4gVGhlIHRhcHBlciBhdmVyYWdlcyBjb25zZWN1dGl2ZSB2YWx1ZXMgYmVmb3JlIHJlc2V0dGluZyBhZnRlciByZXNldEFmdGVyIG1pbGxpc2Vjb25kcy5cbiAqL1xuY29uc3QgcmVzZXRBZnRlciA9IDUwMDA7IC8vbXNcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGFwcGVyIHtcblxuICAgIHByaXZhdGUgcHJldmlvdXNUYXA6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBhdmVyYWdlSW50ZXJ2YWw6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBudW1WYWx1ZXNBdmVyYWdlZDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIHRpbWVySGFuZGxlOiBudW1iZXIgPSAwO1xuXG4gICAgY29uc3RydWN0b3IoKSB7IH1cblxuICAgIHRhcCgpOiB7IGF2ZXJhZ2VUZW1wbzogbnVtYmVyLCBudW1WYWx1ZXNBdmVyYWdlZDogbnVtYmVyIH0ge1xuXG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVySGFuZGxlKVxuXG4gICAgICAgIHRoaXMudGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKVxuICAgICAgICB9LCByZXNldEFmdGVyKVxuXG4gICAgICAgIGlmICghdGhpcy5wcmV2aW91c1RhcCkge1xuICAgICAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBhdmVyYWdlVGVtcG86IDAsXG4gICAgICAgICAgICAgICAgbnVtVmFsdWVzQXZlcmFnZWQ6IDBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3VycmVudFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgbGV0IGludGVydmFsID0gY3VycmVudFRpbWUgLSB0aGlzLnByZXZpb3VzVGFwO1xuICAgICAgICB0aGlzLnByZXZpb3VzVGFwID0gY3VycmVudFRpbWU7XG5cbiAgICAgICAgdGhpcy5udW1WYWx1ZXNBdmVyYWdlZCsrXG5cbiAgICAgICAgLy8gUmVjdXJzaXZlIGFsZ29yaXRobSBmb3IgbGluZWFyIGF2ZXJhZ2luZ1xuICAgICAgICB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCA9IHRoaXMuYXZlcmFnZUludGVydmFsICsgKDEgLyB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkKSAqIChpbnRlcnZhbCAtIHRoaXMuYXZlcmFnZUludGVydmFsKVxuXG4gICAgICAgIGxldCBicG0gPSAxMDAwICogNjAuMCAvIHRoaXMuYXZlcmFnZUludGVydmFsO1xuXG4gICAgICAgIC8vUmV0dXJuIHZhbHVlIHJvdW5kZWQgdG8gdHdvIGRlY2ltYWxzXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhdmVyYWdlVGVtcG86IE1hdGgucm91bmQoYnBtICogMTAwKSAvIDEwMCxcbiAgICAgICAgICAgIG51bVZhbHVlc0F2ZXJhZ2VkOiB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmVzZXQoKTogdm9pZCB7XG4gICAgICAgIHRoaXMucHJldmlvdXNUYXAgPSAwO1xuICAgICAgICB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkID0gMDtcbiAgICAgICAgdGhpcy5hdmVyYWdlSW50ZXJ2YWwgPSAwO1xuICAgIH1cbn0iLCIvKipcbiAqIFdoaWxlUHJlc3NlZEJ0bi4gQSBidXR0b24gd2hpY2ggcmVwZWF0ZWRseSB0cmlnZ2VycyBhbiBldmVudCB3aGlsZSBwcmVzc2VkLlxuICovXG5lbnVtIE1vdXNlQ29kZXMgeyBMRUZUID0gMSB9O1xuXG5jb25zdCBrZXlEb3duUmVwZWF0RGVsYXkgPSA1MDA7IC8vbXMuIFNhbWUgYXMgQ2hyb21lLlxuY29uc3Qga2V5RG93blJlcGVhdEludGVydmFsID0gMzA7IC8vbXMuIFNhbWUgYXMgQ2hyb21lLlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBXaGlsZVByZXNzZWRCdG4ge1xuXG4gICAgcHJpdmF0ZSBidG46IEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBlcnJvclRpbWVySWQ6IG51bWJlciA9IDA7XG5cbiAgICBwcml2YXRlIG1vdXNlSXNQcmVzc2VkOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBtb3VzZURvd25UaW1lckhhbmRsZTogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIG1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbjogKCkgPT4gdm9pZDtcblxuICAgIGNvbnN0cnVjdG9yKGJ0bkVsZW1lbnQ6IEhUTUxJbnB1dEVsZW1lbnQsIGhhbmRsZXJGdW5jdGlvbjogKCkgPT4gdm9pZCkge1xuXG4gICAgICAgIHRoaXMuYnRuID0gYnRuRWxlbWVudDtcbiAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24gPSBoYW5kbGVyRnVuY3Rpb247XG5cbiAgICAgICAgdGhpcy5idG4uYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXZlbnQud2hpY2ggIT09IE1vdXNlQ29kZXMuTEVGVCkgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4geyB0aGlzLm1vdXNlRG93bkxvb3AoKSB9LCBrZXlEb3duUmVwZWF0RGVsYXkpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgICB0aGlzLmJ0bi5mb2N1cygpIC8vVE9ETzogQ2hlY2sgcHJvYmxlbSBpbiBjaHJvbWUgaVBob25lIGVtdWxhdG9yIHdoZXJlIGhvdmVyIGlzIG5vdCByZW1vdmVkIGZyb20gcHJldmlvdXNseSBmb2N1c2VkIGVsZW1lbnQuIEtub3duIGFzIHRoZSBzdGlja3kgaG92ZXIgcHJvYmxlbS5cbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCkgfSwga2V5RG93blJlcGVhdERlbGF5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9BZGQgbW91c2V1cCBldmVudGxpc3RlbmVyIHRvIGRvY3VtZW50IGluIGNhc2UgdGhlIG1vdXNlIGlzIG1vdmVkIGF3YXkgZnJvbSBidG4gYmVmb3JlIGl0IGlzIHJlbGVhc2VkLlxuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXZlbnQud2hpY2ggIT09IE1vdXNlQ29kZXMuTEVGVCkgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvL0VuZCBvZiB0b3VjaCBldmVudHNcbiAgICAgICAgdGhpcy5idG4uYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlKTtcbiAgICAgICAgfSlcblxuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGNhbmNlbCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUpO1xuICAgICAgICB9KVxuICAgIH1cblxuICAgIHNldFRpbWVkRXJyb3IoZHVyYXRpb246IG51bWJlcik6IHZvaWQge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5lcnJvclRpbWVySWQpXG5cbiAgICAgICAgdGhpcy5idG4uY2xhc3NMaXN0LmFkZCgnaGFzLWVycm9yJylcblxuICAgICAgICB0aGlzLmVycm9yVGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5idG4uY2xhc3NMaXN0LnJlbW92ZSgnaGFzLWVycm9yJylcbiAgICAgICAgfSwgZHVyYXRpb24pXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBtb3VzZURvd25Mb29wKCk6IHZvaWQge1xuXG4gICAgICAgIGlmICghdGhpcy5tb3VzZUlzUHJlc3NlZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24oKTtcblxuICAgICAgICB0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7IHRoaXMubW91c2VEb3duTG9vcCgpIH0sIGtleURvd25SZXBlYXRJbnRlcnZhbCk7XG4gICAgfVxufSIsImltcG9ydCBNZXRyb25vbWVVaSBmcm9tIFwiLi9NZXRyb25vbWVVaVwiXG5cbi8vQ2FuIHVzZSBEb2N1bWVudC5xdWVyeVNlbGVjdG9yKCkgaW5zdGVhZFxubGV0IHVpID0gbmV3IE1ldHJvbm9tZVVpKDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5UGF1c2VCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGFwQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsdXNzQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21pbnVzQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc2V0QnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lucHV0RGlzcGxheScpLFxuICAgIDxIVE1MTGFiZWxFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbnB1dERpc3BsYXlMYWJlbCcpKTtcbiJdfQ==
