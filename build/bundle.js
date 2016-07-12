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
        this.suspendTimerId = 0;
        //Safari needs prefix webkitAudioContext
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.setTempo(tempo);
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
    Metronome.prototype.stopAudioLoop = function () {
        clearInterval(this.audioLoopTimerHandle);
    };
    Metronome.prototype.audioLoop = function () {
        var _this = this;
        var nextNoteTime = this.audioContext.currentTime + 0.1;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvSW5wdXREaXNwbGF5LnRzIiwic3JjL01ldHJvbm9tZS50cyIsInNyYy9NZXRyb25vbWVVaS50cyIsInNyYy9UYXBwZXIudHMiLCJzcmMvV2hpbGVQcmVzc2VkQnRuLnRzIiwic3JjL21haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7O0dBRUc7QUFDSCxJQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsQ0FBQSxLQUFLO0FBQ2pDLElBQUssS0FBNEI7QUFBakMsV0FBSyxLQUFLO0lBQUcsNkJBQUUsQ0FBQTtJQUFFLHVDQUFPLENBQUE7SUFBRSxtQ0FBSyxDQUFBO0FBQUMsQ0FBQyxFQUE1QixLQUFLLEtBQUwsS0FBSyxRQUF1QjtBQUVqQztJQU9JLHNCQUFvQixZQUE4QixFQUFVLEtBQXVCLEVBQy9FLFlBQW9CLEVBQ1osZUFBdUIsRUFDdkIsU0FBK0QsRUFDL0QsZUFBd0M7UUFYeEQsaUJBMEhDO1FBbkh1QixpQkFBWSxHQUFaLFlBQVksQ0FBa0I7UUFBVSxVQUFLLEdBQUwsS0FBSyxDQUFrQjtRQUV2RSxvQkFBZSxHQUFmLGVBQWUsQ0FBUTtRQUN2QixjQUFTLEdBQVQsU0FBUyxDQUFzRDtRQUMvRCxvQkFBZSxHQUFmLGVBQWUsQ0FBeUI7UUFQNUMsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFDekIsbUJBQWMsR0FBVyxDQUFDLENBQUM7UUFRL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUM7UUFDMUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2xELElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUV0QixJQUFJLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxZQUFZLENBQUMsZ0JBQWdCLENB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LENBQUMsVUFBVSxDQUFDLEVBQ25DLFFBQVEsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQ25DLFFBQVEsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQ25DLFFBQVEsQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLEVBQ3ZDLFFBQVEsQ0FBQyxjQUFjLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogSW5wdXREaXNwbGF5XG4gKi9cbmNvbnN0IGlucHV0UmVhY3REZWxheSA9IDUwMDsvL21zLlxuZW51bSBTdGF0ZSB7IE9LLCBXQVJOSU5HLCBFUlJPUiB9XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIElucHV0RGlzcGxheSB7XG5cbiAgICBwcml2YXRlIHN0YXRlOiBTdGF0ZTtcbiAgICBwcml2YXRlIHZhbHVlOiBudW1iZXI7XG4gICAgcHJpdmF0ZSBpbnB1dFRpbWVySWQ6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBtZXNzYWdlVGltZXJJZDogbnVtYmVyID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHByaXZhdGUgaW5wdXREaXNwbGF5OiBIVE1MSW5wdXRFbGVtZW50LCBwcml2YXRlIGxhYmVsOiBIVE1MTGFiZWxFbGVtZW50LFxuICAgICAgICBpbml0aWFsVmFsdWU6IG51bWJlcixcbiAgICAgICAgcHJpdmF0ZSBkZWZhdWx0SGVscFRleHQ6IHN0cmluZyxcbiAgICAgICAgcHJpdmF0ZSB2YWxpZGF0b3I6ICh2YWx1ZTogbnVtYmVyKSA9PiB7IHZhbGlkOiBib29sZWFuLCBlcnJvcjogc3RyaW5nIH0sXG4gICAgICAgIHByaXZhdGUgb25OZXdWYWxpZFZhbHVlOiAodmFsdWU6IG51bWJlcikgPT4gdm9pZCkge1xuXG4gICAgICAgIHRoaXMudmFsdWUgPSBpbml0aWFsVmFsdWU7XG4gICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LnZhbHVlID0gaW5pdGlhbFZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5PSztcblxuICAgICAgICB0aGlzLmhhbmRsZU5ld1ZhbHVlKGluaXRpYWxWYWx1ZS50b1N0cmluZygpKTtcblxuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVJbnB1dEV2ZW50KGV2ZW50KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2V0VmFsdWUodmFsdWU6IG51bWJlcikge1xuICAgICAgICB0aGlzLnZhbHVlID0gTWF0aC5yb3VuZCh2YWx1ZSAqIDEwMCkgLyAxMDA7XG4gICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LnZhbHVlID0gdGhpcy52YWx1ZS50b1N0cmluZygpO1xuICAgICAgICB0aGlzLmhhbmRsZU5ld1ZhbHVlKHZhbHVlLnRvU3RyaW5nKCkpO1xuICAgIH1cblxuICAgIHNldFRpbWVkRXJyb3IobWVzc2FnZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1lc3NhZ2VUaW1lcklkKVxuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuRVJST1IpXG4gICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKG1lc3NhZ2UpXG5cbiAgICAgICAgdGhpcy5tZXNzYWdlVGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgLy9HbyBiYWNrIHRvIHN0YXRlIGNvcnJlc3BvbmRpbmcgdG8gY3VycmVudCBkaXNwbGF5IHZhbHVlXG4gICAgICAgICAgICB0aGlzLmhhbmRsZU5ld1ZhbHVlKHRoaXMuaW5wdXREaXNwbGF5LnZhbHVlKVxuICAgICAgICB9LCBkdXJhdGlvbilcbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZU5ld1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHZhbHVlLnRvU3RyaW5nKCkubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvck1lc3NhZ2UoJ1RoZSB2YWx1ZSBtdXN0IGhhdmUgYXQgbGVhc3QgdHdvIGRpZ2l0cy4nKTtcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuV0FSTklORylcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc05hTihOdW1iZXIodmFsdWUpKSkge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvck1lc3NhZ2UoJ1RoZSBlbnRlcmVkIHZhbHVlIGlzIG5vdCBhIG51bWJlci4gUGxlYXNlIGVudGVyIGEgbnVtYmVyJylcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuV0FSTklORylcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB2YWx1ZUFzTnVtYmVyID0gTnVtYmVyKHZhbHVlKVxuXG4gICAgICAgIGxldCB7dmFsaWQsIGVycm9yfSA9IHRoaXMudmFsaWRhdG9yKHZhbHVlQXNOdW1iZXIpO1xuXG4gICAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKGVycm9yKVxuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZShTdGF0ZS5FUlJPUilcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoU3RhdGUuT0spXG4gICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKHRoaXMuZGVmYXVsdEhlbHBUZXh0KVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlSW5wdXRFdmVudChldmVudDogRXZlbnQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuaW5wdXRUaW1lcklkKTtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubWVzc2FnZVRpbWVySWQpO1xuXG4gICAgICAgIHRoaXMuaW5wdXRUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBsZXQgdmFsdWUgPSB0aGlzLmlucHV0RGlzcGxheS52YWx1ZTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmhhbmRsZU5ld1ZhbHVlKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm9uTmV3VmFsaWRWYWx1ZShOdW1iZXIodmFsdWUpKVxuXG4gICAgICAgIH0sIGlucHV0UmVhY3REZWxheSlcbiAgICB9XG5cbiAgICBwcml2YXRlIHNldFN0YXRlKG5leHRTdGF0ZTogU3RhdGUpIHtcbiAgICAgICAgLy9TZXQgQ1NTIGNsYXNzZXMgY29ycmVzcG9uZGluZyB0byB0aGUgZWxlbWVudCBzdGF0ZVxuICAgICAgICBsZXQgY3VycmVudFN0YXRlQ2xhc3MgPSB0aGlzLmdldFN0YXRlQ2xhc3ModGhpcy5zdGF0ZSlcbiAgICAgICAgbGV0IG5leHRTdGF0ZUNsYXNzID0gdGhpcy5nZXRTdGF0ZUNsYXNzKG5leHRTdGF0ZSk7XG5cbiAgICAgICAgaWYgKGN1cnJlbnRTdGF0ZUNsYXNzICE9PSAnJykge1xuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuY2xhc3NMaXN0LnJlbW92ZShjdXJyZW50U3RhdGVDbGFzcylcbiAgICAgICAgICAgIHRoaXMubGFiZWwuY2xhc3NMaXN0LnJlbW92ZShjdXJyZW50U3RhdGVDbGFzcylcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXh0U3RhdGVDbGFzcyAhPT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LmNsYXNzTGlzdC5hZGQobmV4dFN0YXRlQ2xhc3MpXG4gICAgICAgICAgICB0aGlzLmxhYmVsLmNsYXNzTGlzdC5hZGQobmV4dFN0YXRlQ2xhc3MpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN0YXRlID0gbmV4dFN0YXRlO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0U3RhdGVDbGFzcyhzdGF0ZTogU3RhdGUpOiBzdHJpbmcge1xuICAgICAgICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgICAgICAgICBjYXNlIFN0YXRlLk9LOlxuICAgICAgICAgICAgICAgIHJldHVybiAnb2snXG4gICAgICAgICAgICBjYXNlIFN0YXRlLldBUk5JTkc6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdoYXMtd2FybmluZydcbiAgICAgICAgICAgIGNhc2UgU3RhdGUuRVJST1I6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdoYXMtZXJyb3InXG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdUcmllZCB0byBnZXQgY2xhc3MgY29ycmVzcG9uZGluZyB0byBub24tZXhpc3Rpbmcgc3RhdGU6Jywgc3RhdGUpO1xuICAgICAgICAgICAgICAgIHJldHVybiAnJ1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRFcnJvck1lc3NhZ2UobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIHRoaXMubGFiZWwudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIH1cbn0iLCIvKipcbiAqIE1ldHJvbm9tZVxuICovXG5jb25zdCBtaW5UZW1wbyA9IDQwOy8vQlBNXG5jb25zdCBtYXhUZW1wbyA9IDI1MDsvL0JQTVxuY29uc3QgbnVtQmVhdHNQZXJCYXIgPSA0O1xuXG5jb25zdCBub3RlTGVuZ3RoID0gMC4wNTsvL1NlY29uZHNcbmNvbnN0IHNjaGVkdWxlSW50ZXJ2YWwgPSAyNS4wOy8vbXMuIEhvdyBvZnRlbiB0aGUgc2NoZWR1bGluZyBpcyBjYWxsZWQuXG5jb25zdCBzY2hlZHVsZUFoZWFkVGltZSA9IDAuMTsvL1NlY29uZHNcblxuZW51bSBQaXRjaCB7IEhJR0gsIE1JRCwgTE9XIH07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1ldHJvbm9tZSB7XG5cbiAgICBwcml2YXRlIHRlbXBvOiBudW1iZXI7IC8vYmVhdHMgcGVyIG1pbnV0ZSAoQlBNKVxuICAgIHByaXZhdGUgaXNQbGF5aW5nOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBjdXJyZW50QmVhdDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIGF1ZGlvQ29udGV4dDogQXVkaW9Db250ZXh0O1xuICAgIHByaXZhdGUgYXVkaW9Mb29wVGltZXJIYW5kbGU6IG51bWJlcjtcbiAgICBcbiAgICBwcml2YXRlIGNhblN1c3BlbmQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIHN1c3BlbmRUaW1lcklkIDogbnVtYmVyID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHRlbXBvOiBudW1iZXIpIHtcbiAgICAgICAgLy9TYWZhcmkgbmVlZHMgcHJlZml4IHdlYmtpdEF1ZGlvQ29udGV4dFxuICAgICAgICB0aGlzLmF1ZGlvQ29udGV4dCA9IG5ldyAoKDxhbnk+d2luZG93KS5BdWRpb0NvbnRleHQgfHwgKDxhbnk+d2luZG93KS53ZWJraXRBdWRpb0NvbnRleHQpKClcbiAgICAgICAgdGhpcy5zZXRUZW1wbyh0ZW1wbyk7XG5cbiAgICAgICAgdGhpcy5jYW5TdXNwZW5kID0gKCgpID0+IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgKDxhbnk+dGhpcy5hdWRpb0NvbnRleHQpLnJlc3VtZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5zdXNwZW5kICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9KSgpXG5cbiAgICAgICAgaWYgKHRoaXMuY2FuU3VzcGVuZCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3VzcGVuZFRpbWVySWQpO1xuICAgICAgICAgICAgKDxhbnk+dGhpcy5hdWRpb0NvbnRleHQpLnN1c3BlbmQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBsYXkoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5yZXN1bWUoKTtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuYXVkaW9Mb29wKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwYXVzZSgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3BBdWRpb0xvb3AoKTtcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gZmFsc2U7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0aGlzLmNhblN1c3BlbmQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN1c3BlbmRUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICg8YW55PnRoaXMuYXVkaW9Db250ZXh0KS5zdXNwZW5kKCk7XG4gICAgICAgICAgICAgICAgfSwgc2NoZWR1bGVBaGVhZFRpbWUgKiAxMDAwICogMilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRvZ2dsZSgpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5pc1BsYXlpbmc7XG4gICAgfVxuXG4gICAgdmFsaWRhdGVUZW1wbyh0ZW1wbzogbnVtYmVyKTogeyB2YWxpZDogYm9vbGVhbiwgZXJyb3I6IHN0cmluZyB9IHtcbiAgICAgICAgaWYgKGlzTmFOKHRlbXBvKSkge1xuICAgICAgICAgICAgLy9DaGFuZ2UgdG8gZXJyb3Igc3RhdGVcbiAgICAgICAgICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3I6ICdZb3UgbXVzdCBlbnRlciBhIG51bWJlcicgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRlbXBvID0gTnVtYmVyKHRlbXBvKTtcblxuICAgICAgICBpZiAodGVtcG8gPCBtaW5UZW1wbykge1xuICAgICAgICAgICAgLy9TaWduYWwgZXJyb3JcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdCZWxvdyBtaW4gdGVtcG8nKVxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcjogJ01pbmltdW0gdGVtcG8gaXMgJyArIG1pblRlbXBvIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGVtcG8gPiBtYXhUZW1wbykge1xuICAgICAgICAgICAgLy9TaWduYWwgZXJyb3JcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdBYm92ZSBtYXggdGVtcG8nKVxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGZhbHNlLCBlcnJvcjogJ01heCB0ZW1wbyBpcyAnICsgbWF4VGVtcG8gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHZhbGlkOiB0cnVlLCBlcnJvcjogJycgfTtcbiAgICB9XG5cbiAgICBzZXRUZW1wbyh0ZW1wbzogbnVtYmVyKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKHRoaXMudGVtcG8gPT09IHRlbXBvKSB7XG4gICAgICAgICAgICAvL0RvIG5vdGhpbmcgaWYgaXQgaXMgdGhlIHNhbWVcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB7dmFsaWR9ID0gdGhpcy52YWxpZGF0ZVRlbXBvKHRlbXBvKVxuXG4gICAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudGVtcG8gPSBOdW1iZXIodGVtcG8pO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKCdOZXcgbWV0cm9ub21lIHRlbXBvOicsIHRlbXBvKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0b3BBdWRpb0xvb3AoKSB7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5hdWRpb0xvb3BUaW1lckhhbmRsZSlcbiAgICB9XG5cbiAgICBwcml2YXRlIGF1ZGlvTG9vcCgpIHtcblxuICAgICAgICBsZXQgbmV4dE5vdGVUaW1lID0gdGhpcy5hdWRpb0NvbnRleHQuY3VycmVudFRpbWUgKyAwLjE7XG4gICAgICAgIGxldCBuZXh0NHRoTm90ZSA9IDA7XG5cbiAgICAgICAgLy9UaGUgc2NoZWR1bGVyXG4gICAgICAgIHRoaXMuYXVkaW9Mb29wVGltZXJIYW5kbGUgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHdoaWxlIChuZXh0Tm90ZVRpbWUgPCB0aGlzLmF1ZGlvQ29udGV4dC5jdXJyZW50VGltZSArIHNjaGVkdWxlQWhlYWRUaW1lKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNjaGVkdWxlVG9uZShuZXh0Tm90ZVRpbWUsIG5leHQ0dGhOb3RlICUgbnVtQmVhdHNQZXJCYXIgPyBQaXRjaC5NSUQgOiBQaXRjaC5ISUdIKTtcblxuICAgICAgICAgICAgICAgIGxldCBzZWNvbmRzUGVyQmVhdCA9IDYwLjAgLyB0aGlzLnRlbXBvO1xuICAgICAgICAgICAgICAgIG5leHROb3RlVGltZSArPSBzZWNvbmRzUGVyQmVhdDtcbiAgICAgICAgICAgICAgICBuZXh0NHRoTm90ZSA9IChuZXh0NHRoTm90ZSArIDEpICUgbnVtQmVhdHNQZXJCYXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSwgc2NoZWR1bGVJbnRlcnZhbClcbiAgICB9XG5cbiAgICBwcml2YXRlIHNjaGVkdWxlVG9uZShzdGFydFRpbWU6IG51bWJlciwgcGl0Y2g6IFBpdGNoKTogdm9pZCB7XG5cbiAgICAgICAgbGV0IG9zYyA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZU9zY2lsbGF0b3IoKTtcbiAgICAgICAgb3NjLmNvbm5lY3QodGhpcy5hdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuXG4gICAgICAgIGxldCBmcmVxdWVuY3kgPSAwO1xuXG4gICAgICAgIHN3aXRjaCAocGl0Y2gpIHtcbiAgICAgICAgICAgIGNhc2UgUGl0Y2guSElHSDpcbiAgICAgICAgICAgICAgICBmcmVxdWVuY3kgPSA4ODA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBpdGNoLk1JRDpcbiAgICAgICAgICAgICAgICBmcmVxdWVuY3kgPSA0NDA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBpdGNoLkxPVzpcbiAgICAgICAgICAgICAgICBmcmVxdWVuY3kgPSAyMjA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIHBpdGNoJylcbiAgICAgICAgICAgICAgICBmcmVxdWVuY3kgPSAyMjA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBvc2MuZnJlcXVlbmN5LnZhbHVlID0gZnJlcXVlbmN5O1xuICAgICAgICBvc2Muc3RhcnQoc3RhcnRUaW1lKTtcbiAgICAgICAgb3NjLnN0b3Aoc3RhcnRUaW1lICsgbm90ZUxlbmd0aCk7XG4gICAgfVxufVxuXG4iLCIvKipcbiAqIE1ldHJvbm9tZVVpXG4gKi9cbmltcG9ydCBNZXRyb25vbWUgZnJvbSAnLi9NZXRyb25vbWUnO1xuaW1wb3J0IFRhcHBlciBmcm9tICcuL1RhcHBlcic7XG5pbXBvcnQgV2hpbGVQcmVzc2VkQnRuIGZyb20gJy4vV2hpbGVQcmVzc2VkQnRuJ1xuaW1wb3J0IElucHV0RGlzcGxheSBmcm9tICcuL0lucHV0RGlzcGxheSdcblxuY29uc3QgZGVmYXVsdFRlbXBvID0gMTIwOyAvL0JQTVxuY29uc3QgZGVmYXVsdEhlbHBUZXh0ID0gJ1RlbXBvIGluIGJlYXRzIHBlciBtaW51dGUgKEJQTSk6J1xuXG4vL1RoZXNlIHNob3VsZCBiZSBpbXBvcnRlZCBmcm9tIE1ldHJvbm9tZSBtb2R1bGVcbmNvbnN0IG1pblRlbXBvID0gNDA7XG5jb25zdCBtYXhUZW1wbyA9IDI1MDtcblxubGV0IGhhc0xvY2FsU3RvcmFnZSA9ICgoKSA9PiB7XG4gICAgbGV0IHRlc3QgPSAnbWV0cm9ub21lLXRlc3Qtc3RyaW5nJztcbiAgICB0cnkge1xuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0ZXN0LCB0ZXN0KTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0odGVzdCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pKClcblxuZW51bSBLZXlDb2RlcyB7IFNQQUNFID0gMzIgfTtcbmVudW0gTW91c2VDb2RlcyB7IExFRlQgPSAxIH07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1ldHJvbm9tZVVpIHtcblxuICAgIHByaXZhdGUgaXNQbGF5aW5nOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBkaXNwbGF5VmFsdWU6IG51bWJlciA9IGRlZmF1bHRUZW1wbztcblxuICAgIHByaXZhdGUgZW50ZXJJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIHNwYWNlSXNQcmVzc2VkOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICBwcml2YXRlIG1ldHJvbm9tZTogTWV0cm9ub21lO1xuICAgIHByaXZhdGUgdGFwcGVyOiBUYXBwZXJcblxuICAgIHByaXZhdGUgcGx1c3NCdG46IFdoaWxlUHJlc3NlZEJ0bjtcbiAgICBwcml2YXRlIG1pbnVzQnRuOiBXaGlsZVByZXNzZWRCdG47XG4gICAgcHJpdmF0ZSBpbnB1dERpc3BsYXk6IElucHV0RGlzcGxheTtcblxuICAgIGNvbnN0cnVjdG9yKHByaXZhdGUgcGxheVBhdXNlQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBwcml2YXRlIHRhcEJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcGx1c3NCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIG1pbnVzQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBwcml2YXRlIHJlc2V0QnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBpbnB1dERpc3BsYXk6IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIGlucHV0RGlzcGxheUxhYmVsOiBIVE1MTGFiZWxFbGVtZW50KSB7XG5cbiAgICAgICAgdGhpcy5tZXRyb25vbWUgPSBuZXcgTWV0cm9ub21lKGRlZmF1bHRUZW1wbyk7XG4gICAgICAgIHRoaXMudGFwcGVyID0gbmV3IFRhcHBlcigpO1xuXG4gICAgICAgIHRoaXMucGx1c3NCdG4gPSBuZXcgV2hpbGVQcmVzc2VkQnRuKHBsdXNzQnRuLCAoKSA9PiB7IHRoaXMuaW5jcmVtZW50RGlzcGxheVZhbHVlKCkgfSk7XG4gICAgICAgIHRoaXMubWludXNCdG4gPSBuZXcgV2hpbGVQcmVzc2VkQnRuKG1pbnVzQnRuLCAoKSA9PiB7IHRoaXMuZGVjcmVtZW50RGlzcGxheVZhbHVlKCkgfSk7XG4gICAgICAgIHRoaXMuaW5wdXREaXNwbGF5ID0gbmV3IElucHV0RGlzcGxheShpbnB1dERpc3BsYXksIGlucHV0RGlzcGxheUxhYmVsLCBkZWZhdWx0VGVtcG8sIGRlZmF1bHRIZWxwVGV4dCxcbiAgICAgICAgICAgICh2YWx1ZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9WYWxpZGF0b3IgZnVuY3Rpb25cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tZXRyb25vbWUudmFsaWRhdGVUZW1wbyh2YWx1ZSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAodmFsdWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIC8vSGFuZGxlIG5ldyB2YWxpZCB2YWx1ZVxuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheVZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRNZXRyb25vbWVUZW1wbyh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG5cbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUodGhpcy5nZXRUZW1wb0Zyb21TdG9yYWdlKCkpO1xuXG4gICAgICAgIC8vU2V0IGV2ZW50IGhhbmRsZXJzXG4gICAgICAgIHBsYXlQYXVzZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudG9nZ2xlUGxheVBhdXNlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRhcEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudGFwKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJlc2V0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZUtleURvd24oZXZlbnQpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVLZXlVcChldmVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgdGFwKCk6IHZvaWQge1xuICAgICAgICBsZXQge2F2ZXJhZ2VUZW1wbywgbnVtVmFsdWVzQXZlcmFnZWR9ID0gdGhpcy50YXBwZXIudGFwKCk7XG5cbiAgICAgICAgaWYgKG51bVZhbHVlc0F2ZXJhZ2VkID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnTnVtIHZhbHVlcyBhdmVyYWdlZDonLCBudW1WYWx1ZXNBdmVyYWdlZClcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUoYXZlcmFnZVRlbXBvKVxuICAgIH1cblxuICAgIHByaXZhdGUgdG9nZ2xlUGxheVBhdXNlKCk6IHZvaWQge1xuICAgICAgICB0aGlzLmlzUGxheWluZyA9IHRoaXMubWV0cm9ub21lLnRvZ2dsZSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaW5jcmVtZW50RGlzcGxheVZhbHVlKCk6IHZvaWQge1xuXG4gICAgICAgIGxldCBuZXdWYWx1ZSA9IHRoaXMuZGlzcGxheVZhbHVlICsgMTtcblxuICAgICAgICBsZXQge3ZhbGlkLCBlcnJvcn0gPSB0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKG5ld1ZhbHVlKVxuXG4gICAgICAgIGlmICghdmFsaWQpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA+IG1heFRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZShtYXhUZW1wbylcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA8IG1pblRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZShtaW5UZW1wbylcbiAgICAgICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LnNldFRpbWVkRXJyb3IoZXJyb3IsIDIwMDApXG4gICAgICAgICAgICB0aGlzLnBsdXNzQnRuLnNldFRpbWVkRXJyb3IoMjAwMClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGRlY3JlbWVudERpc3BsYXlWYWx1ZSgpOiB2b2lkIHtcbiAgICAgICAgbGV0IG5ld1ZhbHVlID0gdGhpcy5kaXNwbGF5VmFsdWUgLSAxO1xuXG4gICAgICAgIGxldCB7dmFsaWQsIGVycm9yfSA9IHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8obmV3VmFsdWUpXG5cbiAgICAgICAgaWYgKCF2YWxpZCkge1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlIDwgbWluVGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKG1pblRlbXBvKVxuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlID4gbWF4VGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKG1heFRlbXBvKVxuICAgICAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkuc2V0VGltZWRFcnJvcihlcnJvciwgMjAwMClcbiAgICAgICAgICAgIHRoaXMubWludXNCdG4uc2V0VGltZWRFcnJvcigyMDAwKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUobmV3VmFsdWUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcmVzZXQoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKGRlZmF1bHRUZW1wbyk7XG4gICAgICAgIHRoaXMubWV0cm9ub21lLnBhdXNlKCk7XG4gICAgICAgIHRoaXMubWV0cm9ub21lLnNldFRlbXBvKGRlZmF1bHRUZW1wbyk7XG4gICAgICAgIHRoaXMudGFwcGVyLnJlc2V0KCk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5jbGVhcigpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVLZXlEb3duKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGtleU5hbWUgPSBldmVudC5rZXk7XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdBcnJvd1VwJyB8fCBrZXlOYW1lID09PSAnQXJyb3dSaWdodCcpIHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB0aGlzLmluY3JlbWVudERpc3BsYXlWYWx1ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdBcnJvd0Rvd24nIHx8IGtleU5hbWUgPT09ICdBcnJvd0xlZnQnKSB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5kZWNyZW1lbnREaXNwbGF5VmFsdWUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXlOYW1lID09PSAnRW50ZXInKSB7XG4gICAgICAgICAgICAvL01heSBub3QgYmUgdmVyeSBpbnR1aXRpdmUuIEVnLiBlbnRlciBvbiByZXNldCBidXR0b24gd2lsbCBub3QgXCJwcmVzc1wiIHJlc2V0XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW50ZXJJc1ByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRvZ2dsZVBsYXlQYXVzZSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW50ZXJJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGVzLlNQQUNFKSB7XG4gICAgICAgICAgICAvL01heSBub3QgYmUgdmVyeSBpbnR1aXRpdmUuIEVnLiBzcGFjZSBvbiByZXNldCBidXR0b24gd2lsbCBub3QgXCJwcmVzc1wiIHJlc2V0XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuc3BhY2VJc1ByZXNzZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRhcCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3BhY2VJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVLZXlVcChldmVudDogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgICAgICBpZiAoZXZlbnQua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICAgICAgICB0aGlzLmVudGVySXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZXMuU1BBQ0UpIHtcbiAgICAgICAgICAgIHRoaXMuc3BhY2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0RGlzcGxheVZhbHVlKHZhbHVlOiBudW1iZXIpOiB2b2lkIHtcblxuICAgICAgICB2YWx1ZSA9IE1hdGgucm91bmQodmFsdWUgKiAxMDApIC8gMTAwO1xuXG4gICAgICAgIHRoaXMuZGlzcGxheVZhbHVlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuaW5wdXREaXNwbGF5LnNldFZhbHVlKHZhbHVlKVxuXG4gICAgICAgIGxldCB7dmFsaWR9ID0gdGhpcy5tZXRyb25vbWUudmFsaWRhdGVUZW1wbyh2YWx1ZSlcblxuICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0TWV0cm9ub21lVGVtcG8odmFsdWUpO1xuICAgICAgICAgICAgdGhpcy5zZXRUZW1wb0luU3RvcmFnZSh2YWx1ZSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0TWV0cm9ub21lVGVtcG8odGVtcG86IG51bWJlcik6IHZvaWQge1xuICAgICAgICB0aGlzLm1ldHJvbm9tZS5zZXRUZW1wbyh0ZW1wbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRUZW1wb0Zyb21TdG9yYWdlKCk6IG51bWJlciB7XG5cbiAgICAgICAgaWYgKCFoYXNMb2NhbFN0b3JhZ2UpIHJldHVybiBkZWZhdWx0VGVtcG9cblxuICAgICAgICBsZXQgaXRlbSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd0ZW1wbycpXG5cbiAgICAgICAgaWYgKCFpdGVtKSB7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndGVtcG8nLCBkZWZhdWx0VGVtcG8udG9TdHJpbmcoKSlcbiAgICAgICAgICAgIHJldHVybiBkZWZhdWx0VGVtcG9cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc05hTihpdGVtKSkge1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3RlbXBvJywgZGVmYXVsdFRlbXBvLnRvU3RyaW5nKCkpXG4gICAgICAgICAgICByZXR1cm4gZGVmYXVsdFRlbXBvXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gTnVtYmVyKGl0ZW0pXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRUZW1wb0luU3RvcmFnZSh0ZW1wbzogbnVtYmVyKSB7XG4gICAgICAgIGlmICghaGFzTG9jYWxTdG9yYWdlKSByZXR1cm5cbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3RlbXBvJywgdGVtcG8udG9TdHJpbmcoKSlcbiAgICB9XG59IiwiLyoqXG4gKiBUYXBwZXIgLSBhIHRlbXBvIHRhcHBlciBtb2R1bGUuIFRoZSB0YXBwZXIgYXZlcmFnZXMgY29uc2VjdXRpdmUgdmFsdWVzIGJlZm9yZSByZXNldHRpbmcgYWZ0ZXIgcmVzZXRBZnRlciBtaWxsaXNlY29uZHMuXG4gKi9cbmNvbnN0IHJlc2V0QWZ0ZXIgPSA1MDAwOyAvL21zXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRhcHBlciB7XG5cbiAgICBwcml2YXRlIHByZXZpb3VzVGFwOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgYXZlcmFnZUludGVydmFsOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbnVtVmFsdWVzQXZlcmFnZWQ6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSB0aW1lckhhbmRsZTogbnVtYmVyID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKCkgeyB9XG5cbiAgICB0YXAoKTogeyBhdmVyYWdlVGVtcG86IG51bWJlciwgbnVtVmFsdWVzQXZlcmFnZWQ6IG51bWJlciB9IHtcblxuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lckhhbmRsZSlcblxuICAgICAgICB0aGlzLnRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlc2V0KClcbiAgICAgICAgfSwgcmVzZXRBZnRlcilcblxuICAgICAgICBpZiAoIXRoaXMucHJldmlvdXNUYXApIHtcbiAgICAgICAgICAgIHRoaXMucHJldmlvdXNUYXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgYXZlcmFnZVRlbXBvOiAwLFxuICAgICAgICAgICAgICAgIG51bVZhbHVlc0F2ZXJhZ2VkOiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGN1cnJlbnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIGxldCBpbnRlcnZhbCA9IGN1cnJlbnRUaW1lIC0gdGhpcy5wcmV2aW91c1RhcDtcbiAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IGN1cnJlbnRUaW1lO1xuXG4gICAgICAgIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQrK1xuXG4gICAgICAgIC8vIFJlY3Vyc2l2ZSBhbGdvcml0aG0gZm9yIGxpbmVhciBhdmVyYWdpbmdcbiAgICAgICAgdGhpcy5hdmVyYWdlSW50ZXJ2YWwgPSB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCArICgxIC8gdGhpcy5udW1WYWx1ZXNBdmVyYWdlZCkgKiAoaW50ZXJ2YWwgLSB0aGlzLmF2ZXJhZ2VJbnRlcnZhbClcblxuICAgICAgICBsZXQgYnBtID0gMTAwMCAqIDYwLjAgLyB0aGlzLmF2ZXJhZ2VJbnRlcnZhbDtcblxuICAgICAgICAvL1JldHVybiB2YWx1ZSByb3VuZGVkIHRvIHR3byBkZWNpbWFsc1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXZlcmFnZVRlbXBvOiBNYXRoLnJvdW5kKGJwbSAqIDEwMCkgLyAxMDAsXG4gICAgICAgICAgICBudW1WYWx1ZXNBdmVyYWdlZDogdGhpcy5udW1WYWx1ZXNBdmVyYWdlZFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJlc2V0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLnByZXZpb3VzVGFwID0gMDtcbiAgICAgICAgdGhpcy5udW1WYWx1ZXNBdmVyYWdlZCA9IDA7XG4gICAgICAgIHRoaXMuYXZlcmFnZUludGVydmFsID0gMDtcbiAgICB9XG59IiwiLyoqXG4gKiBXaGlsZVByZXNzZWRCdG4uIEEgYnV0dG9uIHdoaWNoIHJlcGVhdGVkbHkgdHJpZ2dlcnMgYW4gZXZlbnQgd2hpbGUgcHJlc3NlZC5cbiAqL1xuZW51bSBNb3VzZUNvZGVzIHsgTEVGVCA9IDEgfTtcblxuY29uc3Qga2V5RG93blJlcGVhdERlbGF5ID0gNTAwOyAvL21zLiBTYW1lIGFzIENocm9tZS5cbmNvbnN0IGtleURvd25SZXBlYXRJbnRlcnZhbCA9IDMwOyAvL21zLiBTYW1lIGFzIENocm9tZS5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV2hpbGVQcmVzc2VkQnRuIHtcblxuICAgIHByaXZhdGUgYnRuOiBIVE1MSW5wdXRFbGVtZW50O1xuICAgIHByaXZhdGUgZXJyb3JUaW1lcklkOiBudW1iZXIgPSAwO1xuXG4gICAgcHJpdmF0ZSBtb3VzZUlzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgbW91c2VEb3duVGltZXJIYW5kbGU6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBtb3VzZURvd25IYW5kbGVyRnVuY3Rpb246ICgpID0+IHZvaWQ7XG5cbiAgICBjb25zdHJ1Y3RvcihidG5FbGVtZW50OiBIVE1MSW5wdXRFbGVtZW50LCBoYW5kbGVyRnVuY3Rpb246ICgpID0+IHZvaWQpIHtcblxuICAgICAgICB0aGlzLmJ0biA9IGJ0bkVsZW1lbnQ7XG4gICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uID0gaGFuZGxlckZ1bmN0aW9uO1xuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBNb3VzZUNvZGVzLkxFRlQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCkgfSwga2V5RG93blJlcGVhdERlbGF5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5idG4uYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgICAgICAgdGhpcy5idG4uZm9jdXMoKSAvL1RPRE86IENoZWNrIHByb2JsZW0gaW4gY2hyb21lIGlQaG9uZSBlbXVsYXRvciB3aGVyZSBob3ZlciBpcyBub3QgcmVtb3ZlZCBmcm9tIHByZXZpb3VzbHkgZm9jdXNlZCBlbGVtZW50LiBLbm93biBhcyB0aGUgc3RpY2t5IGhvdmVyIHByb2JsZW0uXG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7IHRoaXMubW91c2VEb3duTG9vcCgpIH0sIGtleURvd25SZXBlYXREZWxheSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vQWRkIG1vdXNldXAgZXZlbnRsaXN0ZW5lciB0byBkb2N1bWVudCBpbiBjYXNlIHRoZSBtb3VzZSBpcyBtb3ZlZCBhd2F5IGZyb20gYnRuIGJlZm9yZSBpdCBpcyByZWxlYXNlZC5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBNb3VzZUNvZGVzLkxFRlQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9FbmQgb2YgdG91Y2ggZXZlbnRzXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSk7XG4gICAgICAgIH0pXG5cbiAgICAgICAgdGhpcy5idG4uYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hjYW5jZWwnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlKTtcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBzZXRUaW1lZEVycm9yKGR1cmF0aW9uOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuZXJyb3JUaW1lcklkKVxuXG4gICAgICAgIHRoaXMuYnRuLmNsYXNzTGlzdC5hZGQoJ2hhcy1lcnJvcicpXG5cbiAgICAgICAgdGhpcy5lcnJvclRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuYnRuLmNsYXNzTGlzdC5yZW1vdmUoJ2hhcy1lcnJvcicpXG4gICAgICAgIH0sIGR1cmF0aW9uKVxuICAgIH1cblxuICAgIHByaXZhdGUgbW91c2VEb3duTG9vcCgpOiB2b2lkIHtcblxuICAgICAgICBpZiAoIXRoaXMubW91c2VJc1ByZXNzZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uKCk7XG5cbiAgICAgICAgdGhpcy5tb3VzZURvd25UaW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4geyB0aGlzLm1vdXNlRG93bkxvb3AoKSB9LCBrZXlEb3duUmVwZWF0SW50ZXJ2YWwpO1xuICAgIH1cbn0iLCJpbXBvcnQgTWV0cm9ub21lVWkgZnJvbSBcIi4vTWV0cm9ub21lVWlcIlxuXG4vL0NhbiB1c2UgRG9jdW1lbnQucXVlcnlTZWxlY3RvcigpIGluc3RlYWRcbmxldCB1aSA9IG5ldyBNZXRyb25vbWVVaSg8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheVBhdXNlQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RhcEJ0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbHVzc0J0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtaW51c0J0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXNldEJ0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpbnB1dERpc3BsYXknKSxcbiAgICA8SFRNTExhYmVsRWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5wdXREaXNwbGF5TGFiZWwnKSk7XG4iXX0=
