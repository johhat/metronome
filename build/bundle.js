(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
        this.audioContext = new AudioContext();
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
            console.log('Not a number!');
            return false;
        }
        tempo = Number(tempo);
        if (tempo < minTempo) {
            //Signal error
            console.log('Below min tempo');
            return false;
        }
        if (tempo > maxTempo) {
            //Signal error
            console.log('Above max tempo');
            return false;
        }
        return true;
    };
    Metronome.prototype.setTempo = function (tempo) {
        if (this.tempo === tempo) {
            //Do nothing if it is the same
            return;
        }
        if (!this.validateTempo(tempo)) {
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

},{}],2:[function(require,module,exports){
"use strict";
/**
 * MetronomeUi
 */
var Metronome_1 = require('./Metronome');
var Tapper_1 = require('./Tapper');
var WhilePressedBtn_1 = require('./WhilePressedBtn');
var defaultTempo = 120; //BPM
var inputReactDelay = 500; //ms.
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
    function MetronomeUi(playPauseBtn, tapBtn, plussBtn, minusBtn, resetBtn, inputDisplay) {
        var _this = this;
        this.playPauseBtn = playPauseBtn;
        this.tapBtn = tapBtn;
        this.resetBtn = resetBtn;
        this.inputDisplay = inputDisplay;
        this.isPlaying = false;
        this.displayValue = defaultTempo;
        this.displayValueIsValid = true;
        this.tapBtnLastPressedTime = 0; //Dummy value for 'not yet pressed'
        this.inputTimerId = 0;
        this.enterIsPressed = false;
        this.spaceIsPressed = false;
        this.metronome = new Metronome_1.default(defaultTempo);
        this.tapper = new Tapper_1.default();
        this.setDisplayValue(defaultTempo);
        this.plussBtn = new WhilePressedBtn_1.default(plussBtn, function () { _this.incrementDisplayValue(); });
        this.minusBtn = new WhilePressedBtn_1.default(minusBtn, function () { _this.decrementDisplayValue(); });
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
        inputDisplay.addEventListener('input', function (event) {
            _this.handleDisplayInputEvent(event);
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
        if (!this.metronome.validateTempo(newValue)) {
            if (newValue > maxTempo)
                this.setDisplayValue(maxTempo);
            if (newValue < minTempo)
                this.setDisplayValue(minTempo);
            return;
        }
        this.setDisplayValue(newValue);
    };
    MetronomeUi.prototype.decrementDisplayValue = function () {
        var newValue = this.displayValue - 1;
        if (!this.metronome.validateTempo(newValue)) {
            if (newValue < minTempo)
                this.setDisplayValue(minTempo);
            if (newValue > maxTempo)
                this.setDisplayValue(maxTempo);
            return;
        }
        this.setDisplayValue(newValue);
    };
    MetronomeUi.prototype.reset = function () {
        this.setDisplayValue(defaultTempo);
        this.metronome.pause();
        this.metronome.setTempo(defaultTempo);
    };
    MetronomeUi.prototype.handleKeyDown = function (event) {
        var keyName = event.key;
        if (keyName === 'ArrowUp' || keyName === 'ArrowRight') {
            this.incrementDisplayValue();
        }
        if (keyName === 'ArrowDown' || keyName === 'ArrowLeft') {
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
    MetronomeUi.prototype.handleDisplayInputEvent = function (event) {
        var _this = this;
        clearTimeout(this.inputTimerId);
        this.inputTimerId = setTimeout(function () {
            var value = _this.inputDisplay.value;
            if (value.toString().length < 1) {
                _this.setErrorMessage('The entered value has too few digits.');
                return;
            }
            if (isNaN(Number(value))) {
                _this.setErrorMessage('The entered value is not a number. Please enter a number');
                return;
            }
            var valueAsNumber = Number(value);
            //TODO: Get limit values from metronome module 
            if (valueAsNumber < 40) {
                _this.setErrorMessage('The value is too low. Please enter a number in the range 40 to 250');
                return;
            }
            if (valueAsNumber > 250) {
                _this.setErrorMessage('The value is too high. Please enter a number in the range 40 to 250');
                return;
            }
            _this.setDisplayValue(valueAsNumber);
        }, inputReactDelay);
    };
    MetronomeUi.prototype.setErrorMessage = function (message) {
        console.log(message);
    };
    MetronomeUi.prototype.setDisplayValue = function (value) {
        this.displayValue = Math.round(value * 100) / 100;
        this.inputDisplay.value = this.displayValue.toString();
        if (this.metronome.validateTempo(value)) {
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

},{"./Metronome":1,"./Tapper":3,"./WhilePressedBtn":4}],3:[function(require,module,exports){
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
            _this.numValuesAveraged = 0;
            _this.averageInterval = 0;
            _this.previousTap = 0;
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
    return Tapper;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Tapper;

},{}],4:[function(require,module,exports){
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
        //Add mouseup eventlistener to document in case the mouse is moved away from btn before it is released.
        document.addEventListener('mouseup', function (event) {
            if (event.which !== MouseCodes.LEFT)
                return;
            _this.mouseIsPressed = false;
            clearTimeout(_this.mouseDownTimerHandle);
        });
    }
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

},{}],5:[function(require,module,exports){
"use strict";
var MetronomeUi_1 = require("./MetronomeUi");
//Can use Document.querySelector() instead
var ui = new MetronomeUi_1.default(document.getElementById('playPauseBtn'), document.getElementById('tapBtn'), document.getElementById('plussBtn'), document.getElementById('minusBtn'), document.getElementById('resetBtn'), document.getElementById('inputDisplay'));

},{"./MetronomeUi":2}]},{},[5])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvTWV0cm9ub21lLnRzIiwic3JjL01ldHJvbm9tZVVpLnRzIiwic3JjL1RhcHBlci50cyIsInNyYy9XaGlsZVByZXNzZWRCdG4udHMiLCJzcmMvbWFpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTs7R0FFRztBQUNILElBQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxDQUFBLEtBQUs7QUFDekIsSUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLENBQUEsS0FBSztBQUMxQixJQUFNLGNBQWMsR0FBRyxDQUFDLENBQUM7QUFFekIsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLENBQUEsU0FBUztBQUNqQyxJQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxDQUFBLHlDQUF5QztBQUN2RSxJQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQyxDQUFBLFNBQVM7QUFFdkMsSUFBSyxLQUF3QjtBQUE3QixXQUFLLEtBQUs7SUFBRyxpQ0FBSSxDQUFBO0lBQUUsK0JBQUcsQ0FBQTtJQUFFLCtCQUFHLENBQUE7QUFBQyxDQUFDLEVBQXhCLEtBQUssS0FBTCxLQUFLLFFBQW1CO0FBQUEsQ0FBQztBQUU5QjtJQVFJLG1CQUFZLEtBQWE7UUFMakIsY0FBUyxHQUFZLEtBQUssQ0FBQztRQUMzQixnQkFBVyxHQUFXLENBQUMsQ0FBQztRQUs1QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksWUFBWSxFQUFFLENBQUM7UUFDdkMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN6QixDQUFDO0lBRUQsd0JBQUksR0FBSjtRQUNJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDbEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7WUFDdEIsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ3JCLENBQUM7SUFDTCxDQUFD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QVEsQ0FBQyxFQUNqQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBNZXRyb25vbWVcbiAqL1xuY29uc3QgbWluVGVtcG8gPSA0MDsvL0JQTVxuY29uc3QgbWF4VGVtcG8gPSAyNTA7Ly9CUE1cbmNvbnN0IG51bUJlYXRzUGVyQmFyID0gNDtcblxuY29uc3Qgbm90ZUxlbmd0aCA9IDAuMDU7Ly9TZWNvbmRzXG5jb25zdCBzY2hlZHVsZUludGVydmFsID0gMjUuMDsvL21zLiBIb3cgb2Z0ZW4gdGhlIHNjaGVkdWxpbmcgaXMgY2FsbGVkLlxuY29uc3Qgc2NoZWR1bGVBaGVhZFRpbWUgPSAwLjE7Ly9TZWNvbmRzXG5cbmVudW0gUGl0Y2ggeyBISUdILCBNSUQsIExPVyB9O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWUge1xuXG4gICAgcHJpdmF0ZSB0ZW1wbzogbnVtYmVyOyAvL2JlYXRzIHBlciBtaW51dGUgKEJQTSlcbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgY3VycmVudEJlYXQ6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBhdWRpb0NvbnRleHQ6IEF1ZGlvQ29udGV4dDtcbiAgICBwcml2YXRlIGF1ZGlvTG9vcFRpbWVySGFuZGxlOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih0ZW1wbzogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuYXVkaW9Db250ZXh0ID0gbmV3IEF1ZGlvQ29udGV4dCgpO1xuICAgICAgICB0aGlzLnNldFRlbXBvKHRlbXBvKTtcbiAgICB9XG5cbiAgICBwbGF5KCk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLmlzUGxheWluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmF1ZGlvTG9vcCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcGF1c2UoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLmlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5zdG9wQXVkaW9Mb29wKCk7XG4gICAgICAgICAgICB0aGlzLmlzUGxheWluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdG9nZ2xlKCk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAodGhpcy5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucGF1c2UoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucGxheSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmlzUGxheWluZztcbiAgICB9XG5cbiAgICB2YWxpZGF0ZVRlbXBvKHRlbXBvOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKGlzTmFOKHRlbXBvKSkge1xuICAgICAgICAgICAgLy9DaGFuZ2UgdG8gZXJyb3Igc3RhdGVcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdOb3QgYSBudW1iZXIhJylcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRlbXBvID0gTnVtYmVyKHRlbXBvKTtcblxuICAgICAgICBpZiAodGVtcG8gPCBtaW5UZW1wbykge1xuICAgICAgICAgICAgLy9TaWduYWwgZXJyb3JcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdCZWxvdyBtaW4gdGVtcG8nKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRlbXBvID4gbWF4VGVtcG8pIHtcbiAgICAgICAgICAgIC8vU2lnbmFsIGVycm9yXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQWJvdmUgbWF4IHRlbXBvJylcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHNldFRlbXBvKHRlbXBvOiBudW1iZXIpOiB2b2lkIHtcblxuICAgICAgICBpZiAodGhpcy50ZW1wbyA9PT0gdGVtcG8pIHtcbiAgICAgICAgICAgIC8vRG8gbm90aGluZyBpZiBpdCBpcyB0aGUgc2FtZVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLnZhbGlkYXRlVGVtcG8odGVtcG8pKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRlbXBvID0gTnVtYmVyKHRlbXBvKTtcblxuICAgICAgICBjb25zb2xlLmxvZygnTmV3IG1ldHJvbm9tZSB0ZW1wbzonLCB0ZW1wbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdG9wQXVkaW9Mb29wKCkge1xuICAgICAgICBjbGVhckludGVydmFsKHRoaXMuYXVkaW9Mb29wVGltZXJIYW5kbGUpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhdWRpb0xvb3AoKSB7XG5cbiAgICAgICAgbGV0IG5leHROb3RlVGltZSA9IHRoaXMuYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICBsZXQgbmV4dDR0aE5vdGUgPSAwO1xuXG4gICAgICAgIC8vVGhlIHNjaGVkdWxlclxuICAgICAgICB0aGlzLmF1ZGlvTG9vcFRpbWVySGFuZGxlID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3aGlsZSAobmV4dE5vdGVUaW1lIDwgdGhpcy5hdWRpb0NvbnRleHQuY3VycmVudFRpbWUgKyBzY2hlZHVsZUFoZWFkVGltZSkge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zY2hlZHVsZVRvbmUobmV4dE5vdGVUaW1lLCBuZXh0NHRoTm90ZSAlIG51bUJlYXRzUGVyQmFyID8gUGl0Y2guTUlEIDogUGl0Y2guSElHSCk7XG5cbiAgICAgICAgICAgICAgICBsZXQgc2Vjb25kc1BlckJlYXQgPSA2MC4wIC8gdGhpcy50ZW1wbztcbiAgICAgICAgICAgICAgICBuZXh0Tm90ZVRpbWUgKz0gc2Vjb25kc1BlckJlYXQ7XG4gICAgICAgICAgICAgICAgbmV4dDR0aE5vdGUgPSAobmV4dDR0aE5vdGUgKyAxKSAlIG51bUJlYXRzUGVyQmFyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0sIHNjaGVkdWxlSW50ZXJ2YWwpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzY2hlZHVsZVRvbmUoc3RhcnRUaW1lOiBudW1iZXIsIHBpdGNoOiBQaXRjaCk6IHZvaWQge1xuXG4gICAgICAgIGxldCBvc2MgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gICAgICAgIG9zYy5jb25uZWN0KHRoaXMuYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcblxuICAgICAgICBsZXQgZnJlcXVlbmN5ID0gMDtcblxuICAgICAgICBzd2l0Y2ggKHBpdGNoKSB7XG4gICAgICAgICAgICBjYXNlIFBpdGNoLkhJR0g6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gODgwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5NSUQ6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gNDQwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5MT1c6XG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gMjIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBwaXRjaCcpXG4gICAgICAgICAgICAgICAgZnJlcXVlbmN5ID0gMjIwO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXF1ZW5jeTtcbiAgICAgICAgb3NjLnN0YXJ0KHN0YXJ0VGltZSk7XG4gICAgICAgIG9zYy5zdG9wKHN0YXJ0VGltZSArIG5vdGVMZW5ndGgpO1xuICAgIH1cbn1cblxuIiwiLyoqXG4gKiBNZXRyb25vbWVVaVxuICovXG5pbXBvcnQgTWV0cm9ub21lIGZyb20gJy4vTWV0cm9ub21lJztcbmltcG9ydCBUYXBwZXIgZnJvbSAnLi9UYXBwZXInO1xuaW1wb3J0IFdoaWxlUHJlc3NlZEJ0biBmcm9tICcuL1doaWxlUHJlc3NlZEJ0bidcblxuY29uc3QgZGVmYXVsdFRlbXBvID0gMTIwOyAvL0JQTVxuY29uc3QgaW5wdXRSZWFjdERlbGF5ID0gNTAwOy8vbXMuXG5cbi8vVGhlc2Ugc2hvdWxkIGJlIGltcG9ydGVkIGZyb20gTWV0cm9ub21lIG1vZHVsZVxuY29uc3QgbWluVGVtcG8gPSA0MDtcbmNvbnN0IG1heFRlbXBvID0gMjUwO1xuXG5lbnVtIEtleUNvZGVzIHsgU1BBQ0UgPSAzMiB9O1xuZW51bSBNb3VzZUNvZGVzIHsgTEVGVCA9IDEgfTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWV0cm9ub21lVWkge1xuXG4gICAgcHJpdmF0ZSBpc1BsYXlpbmc6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIGRpc3BsYXlWYWx1ZTogbnVtYmVyID0gZGVmYXVsdFRlbXBvO1xuICAgIHByaXZhdGUgZGlzcGxheVZhbHVlSXNWYWxpZDogYm9vbGVhbiA9IHRydWU7XG4gICAgcHJpdmF0ZSB0YXBCdG5MYXN0UHJlc3NlZFRpbWU6IG51bWJlciA9IDA7Ly9EdW1teSB2YWx1ZSBmb3IgJ25vdCB5ZXQgcHJlc3NlZCdcblxuICAgIHByaXZhdGUgaW5wdXRUaW1lcklkOiBudW1iZXIgPSAwO1xuXG4gICAgcHJpdmF0ZSBlbnRlcklzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgc3BhY2VJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAgIHByaXZhdGUgbWV0cm9ub21lOiBNZXRyb25vbWU7XG4gICAgcHJpdmF0ZSB0YXBwZXI6IFRhcHBlclxuXG4gICAgcHJpdmF0ZSBwbHVzc0J0bjogV2hpbGVQcmVzc2VkQnRuO1xuICAgIHByaXZhdGUgbWludXNCdG46IFdoaWxlUHJlc3NlZEJ0bjtcblxuICAgIGNvbnN0cnVjdG9yKHByaXZhdGUgcGxheVBhdXNlQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBwcml2YXRlIHRhcEJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcGx1c3NCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIG1pbnVzQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBwcml2YXRlIHJlc2V0QnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBwcml2YXRlIGlucHV0RGlzcGxheTogSFRNTElucHV0RWxlbWVudCkge1xuXG4gICAgICAgIHRoaXMubWV0cm9ub21lID0gbmV3IE1ldHJvbm9tZShkZWZhdWx0VGVtcG8pO1xuICAgICAgICB0aGlzLnRhcHBlciA9IG5ldyBUYXBwZXIoKTtcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUoZGVmYXVsdFRlbXBvKTtcblxuICAgICAgICB0aGlzLnBsdXNzQnRuID0gbmV3IFdoaWxlUHJlc3NlZEJ0bihwbHVzc0J0biwgKCkgPT4geyB0aGlzLmluY3JlbWVudERpc3BsYXlWYWx1ZSgpIH0pO1xuICAgICAgICB0aGlzLm1pbnVzQnRuID0gbmV3IFdoaWxlUHJlc3NlZEJ0bihtaW51c0J0biwgKCkgPT4geyB0aGlzLmRlY3JlbWVudERpc3BsYXlWYWx1ZSgpIH0pO1xuXG4gICAgICAgIC8vU2V0IGV2ZW50IGhhbmRsZXJzXG4gICAgICAgIHBsYXlQYXVzZUJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudG9nZ2xlUGxheVBhdXNlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRhcEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMudGFwKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJlc2V0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZUtleURvd24oZXZlbnQpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVLZXlVcChldmVudCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlucHV0RGlzcGxheS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVEaXNwbGF5SW5wdXRFdmVudChldmVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgdGFwKCk6IHZvaWQge1xuICAgICAgICBsZXQge2F2ZXJhZ2VUZW1wbywgbnVtVmFsdWVzQXZlcmFnZWR9ID0gdGhpcy50YXBwZXIudGFwKCk7XG5cbiAgICAgICAgaWYgKG51bVZhbHVlc0F2ZXJhZ2VkID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnTnVtIHZhbHVlcyBhdmVyYWdlZDonLCBudW1WYWx1ZXNBdmVyYWdlZClcbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUoYXZlcmFnZVRlbXBvKVxuICAgIH1cblxuICAgIHByaXZhdGUgdG9nZ2xlUGxheVBhdXNlKCk6IHZvaWQge1xuICAgICAgICB0aGlzLmlzUGxheWluZyA9IHRoaXMubWV0cm9ub21lLnRvZ2dsZSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaW5jcmVtZW50RGlzcGxheVZhbHVlKCk6IHZvaWQge1xuXG4gICAgICAgIGxldCBuZXdWYWx1ZSA9IHRoaXMuZGlzcGxheVZhbHVlICsgMTtcblxuICAgICAgICBpZiAoIXRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8obmV3VmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWU+bWF4VGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKG1heFRlbXBvKVxuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlPG1pblRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZShtaW5UZW1wbylcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGRlY3JlbWVudERpc3BsYXlWYWx1ZSgpOiB2b2lkIHtcbiAgICAgICAgbGV0IG5ld1ZhbHVlID0gdGhpcy5kaXNwbGF5VmFsdWUgLSAxO1xuXG4gICAgICAgIGlmICghdGhpcy5tZXRyb25vbWUudmFsaWRhdGVUZW1wbyhuZXdWYWx1ZSkpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZTxtaW5UZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUobWluVGVtcG8pXG4gICAgICAgICAgICBpZiAobmV3VmFsdWU+bWF4VGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKG1heFRlbXBvKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXREaXNwbGF5VmFsdWUobmV3VmFsdWUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcmVzZXQoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKGRlZmF1bHRUZW1wbyk7XG4gICAgICAgIHRoaXMubWV0cm9ub21lLnBhdXNlKCk7XG4gICAgICAgIHRoaXMubWV0cm9ub21lLnNldFRlbXBvKGRlZmF1bHRUZW1wbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVLZXlEb3duKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGtleU5hbWUgPSBldmVudC5rZXk7XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdBcnJvd1VwJyB8fCBrZXlOYW1lID09PSAnQXJyb3dSaWdodCcpIHtcbiAgICAgICAgICAgIHRoaXMuaW5jcmVtZW50RGlzcGxheVZhbHVlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5TmFtZSA9PT0gJ0Fycm93RG93bicgfHwga2V5TmFtZSA9PT0gJ0Fycm93TGVmdCcpIHtcbiAgICAgICAgICAgIHRoaXMuZGVjcmVtZW50RGlzcGxheVZhbHVlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5TmFtZSA9PT0gJ0VudGVyJykge1xuICAgICAgICAgICAgLy9NYXkgbm90IGJlIHZlcnkgaW50dWl0aXZlLiBFZy4gZW50ZXIgb24gcmVzZXQgYnV0dG9uIHdpbGwgbm90IFwicHJlc3NcIiByZXNldFxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmVudGVySXNQcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50b2dnbGVQbGF5UGF1c2UoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVudGVySXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudC5rZXlDb2RlID09PSBLZXlDb2Rlcy5TUEFDRSkge1xuICAgICAgICAgICAgLy9NYXkgbm90IGJlIHZlcnkgaW50dWl0aXZlLiBFZy4gc3BhY2Ugb24gcmVzZXQgYnV0dG9uIHdpbGwgbm90IFwicHJlc3NcIiByZXNldFxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNwYWNlSXNQcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50YXAoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNwYWNlSXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlS2V5VXAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VudGVyJykge1xuICAgICAgICAgICAgdGhpcy5lbnRlcklzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGVzLlNQQUNFKSB7XG4gICAgICAgICAgICB0aGlzLnNwYWNlSXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZURpc3BsYXlJbnB1dEV2ZW50KGV2ZW50OiBFdmVudCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5pbnB1dFRpbWVySWQpO1xuXG4gICAgICAgIHRoaXMuaW5wdXRUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBsZXQgdmFsdWUgPSB0aGlzLmlucHV0RGlzcGxheS52YWx1ZTtcblxuICAgICAgICAgICAgaWYgKHZhbHVlLnRvU3RyaW5nKCkubGVuZ3RoIDwgMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKCdUaGUgZW50ZXJlZCB2YWx1ZSBoYXMgdG9vIGZldyBkaWdpdHMuJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaXNOYU4oTnVtYmVyKHZhbHVlKSkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZSgnVGhlIGVudGVyZWQgdmFsdWUgaXMgbm90IGEgbnVtYmVyLiBQbGVhc2UgZW50ZXIgYSBudW1iZXInKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IHZhbHVlQXNOdW1iZXIgPSBOdW1iZXIodmFsdWUpXG5cbiAgICAgICAgICAgIC8vVE9ETzogR2V0IGxpbWl0IHZhbHVlcyBmcm9tIG1ldHJvbm9tZSBtb2R1bGUgXG4gICAgICAgICAgICBpZiAodmFsdWVBc051bWJlciA8IDQwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRFcnJvck1lc3NhZ2UoJ1RoZSB2YWx1ZSBpcyB0b28gbG93LiBQbGVhc2UgZW50ZXIgYSBudW1iZXIgaW4gdGhlIHJhbmdlIDQwIHRvIDI1MCcpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsdWVBc051bWJlciA+IDI1MCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKCdUaGUgdmFsdWUgaXMgdG9vIGhpZ2guIFBsZWFzZSBlbnRlciBhIG51bWJlciBpbiB0aGUgcmFuZ2UgNDAgdG8gMjUwJylcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKHZhbHVlQXNOdW1iZXIpO1xuXG4gICAgICAgIH0sIGlucHV0UmVhY3REZWxheSlcbiAgICB9XG5cbiAgICBwcml2YXRlIHNldEVycm9yTWVzc2FnZShtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgY29uc29sZS5sb2cobWVzc2FnZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXREaXNwbGF5VmFsdWUodmFsdWU6IG51bWJlcik6IHZvaWQge1xuICAgICAgICB0aGlzLmRpc3BsYXlWYWx1ZSA9IE1hdGgucm91bmQodmFsdWUgKiAxMDApIC8gMTAwO1xuICAgICAgICB0aGlzLmlucHV0RGlzcGxheS52YWx1ZSA9IHRoaXMuZGlzcGxheVZhbHVlLnRvU3RyaW5nKCk7XG5cbiAgICAgICAgaWYgKHRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8odmFsdWUpKSB7XG4gICAgICAgICAgICB0aGlzLnNldE1ldHJvbm9tZVRlbXBvKHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2V0TWV0cm9ub21lVGVtcG8odGVtcG86IG51bWJlcik6IHZvaWQge1xuICAgICAgICB0aGlzLm1ldHJvbm9tZS5zZXRUZW1wbyh0ZW1wbyk7XG4gICAgfVxufSIsIi8qKlxuICogVGFwcGVyIC0gYSB0ZW1wbyB0YXBwZXIgbW9kdWxlLiBUaGUgdGFwcGVyIGF2ZXJhZ2VzIGNvbnNlY3V0aXZlIHZhbHVlcyBiZWZvcmUgcmVzZXR0aW5nIGFmdGVyIHJlc2V0QWZ0ZXIgbWlsbGlzZWNvbmRzLlxuICovXG5jb25zdCByZXNldEFmdGVyID0gNTAwMDsgLy9tc1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUYXBwZXIge1xuXG4gICAgcHJpdmF0ZSBwcmV2aW91c1RhcDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIGF2ZXJhZ2VJbnRlcnZhbDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIG51bVZhbHVlc0F2ZXJhZ2VkOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgdGltZXJIYW5kbGU6IG51bWJlciA9IDA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHsgfVxuXG4gICAgdGFwKCk6IHsgYXZlcmFnZVRlbXBvOiBudW1iZXIsIG51bVZhbHVlc0F2ZXJhZ2VkOiBudW1iZXIgfSB7XG5cbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZXJIYW5kbGUpXG5cbiAgICAgICAgdGhpcy50aW1lckhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5udW1WYWx1ZXNBdmVyYWdlZCA9IDA7XG4gICAgICAgICAgICB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCA9IDA7XG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzVGFwID0gMDtcbiAgICAgICAgfSwgcmVzZXRBZnRlcilcblxuICAgICAgICBpZiAoIXRoaXMucHJldmlvdXNUYXApIHtcbiAgICAgICAgICAgIHRoaXMucHJldmlvdXNUYXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgYXZlcmFnZVRlbXBvOiAwLFxuICAgICAgICAgICAgICAgIG51bVZhbHVlc0F2ZXJhZ2VkOiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGN1cnJlbnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIGxldCBpbnRlcnZhbCA9IGN1cnJlbnRUaW1lIC0gdGhpcy5wcmV2aW91c1RhcDtcbiAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IGN1cnJlbnRUaW1lO1xuXG4gICAgICAgIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQrK1xuXG4gICAgICAgIC8vIFJlY3Vyc2l2ZSBhbGdvcml0aG0gZm9yIGxpbmVhciBhdmVyYWdpbmdcbiAgICAgICAgdGhpcy5hdmVyYWdlSW50ZXJ2YWwgPSB0aGlzLmF2ZXJhZ2VJbnRlcnZhbCArICgxIC8gdGhpcy5udW1WYWx1ZXNBdmVyYWdlZCkgKiAoaW50ZXJ2YWwgLSB0aGlzLmF2ZXJhZ2VJbnRlcnZhbClcblxuICAgICAgICBsZXQgYnBtID0gMTAwMCAqIDYwLjAgLyB0aGlzLmF2ZXJhZ2VJbnRlcnZhbDtcblxuICAgICAgICAvL1JldHVybiB2YWx1ZSByb3VuZGVkIHRvIHR3byBkZWNpbWFsc1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXZlcmFnZVRlbXBvOiBNYXRoLnJvdW5kKGJwbSAqIDEwMCkgLyAxMDAsXG4gICAgICAgICAgICBudW1WYWx1ZXNBdmVyYWdlZDogdGhpcy5udW1WYWx1ZXNBdmVyYWdlZFxuICAgICAgICB9O1xuICAgIH1cbn0iLCIvKipcbiAqIFdoaWxlUHJlc3NlZEJ0bi4gQSBidXR0b24gd2hpY2ggcmVwZWF0ZWRseSB0cmlnZ2VycyBhbiBldmVudCB3aGlsZSBwcmVzc2VkLlxuICovXG5lbnVtIE1vdXNlQ29kZXMgeyBMRUZUID0gMSB9O1xuXG5jb25zdCBrZXlEb3duUmVwZWF0RGVsYXkgPSA1MDA7IC8vbXMuIFNhbWUgYXMgQ2hyb21lLlxuY29uc3Qga2V5RG93blJlcGVhdEludGVydmFsID0gMzA7IC8vbXMuIFNhbWUgYXMgQ2hyb21lLlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBXaGlsZVByZXNzZWRCdG4ge1xuXG4gICAgcHJpdmF0ZSBidG46IEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBtb3VzZUlzUHJlc3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgbW91c2VEb3duVGltZXJIYW5kbGU6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBtb3VzZURvd25IYW5kbGVyRnVuY3Rpb246ICgpID0+IHZvaWQ7XG5cbiAgICBjb25zdHJ1Y3RvcihidG5FbGVtZW50OiBIVE1MSW5wdXRFbGVtZW50LCBoYW5kbGVyRnVuY3Rpb246ICgpID0+IHZvaWQpIHtcblxuICAgICAgICB0aGlzLmJ0biA9IGJ0bkVsZW1lbnQ7XG4gICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uID0gaGFuZGxlckZ1bmN0aW9uO1xuXG4gICAgICAgIHRoaXMuYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBNb3VzZUNvZGVzLkxFRlQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCkgfSwga2V5RG93blJlcGVhdERlbGF5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9BZGQgbW91c2V1cCBldmVudGxpc3RlbmVyIHRvIGRvY3VtZW50IGluIGNhc2UgdGhlIG1vdXNlIGlzIG1vdmVkIGF3YXkgZnJvbSBidG4gYmVmb3JlIGl0IGlzIHJlbGVhc2VkLlxuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXZlbnQud2hpY2ggIT09IE1vdXNlQ29kZXMuTEVGVCkgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5tb3VzZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG1vdXNlRG93bkxvb3AoKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKCF0aGlzLm1vdXNlSXNQcmVzc2VkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbigpO1xuXG4gICAgICAgIHRoaXMubW91c2VEb3duVGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5tb3VzZURvd25Mb29wKCkgfSwga2V5RG93blJlcGVhdEludGVydmFsKTtcbiAgICB9XG59IiwiaW1wb3J0IE1ldHJvbm9tZVVpIGZyb20gXCIuL01ldHJvbm9tZVVpXCJcblxuLy9DYW4gdXNlIERvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoKSBpbnN0ZWFkXG5sZXQgdWkgPSBuZXcgTWV0cm9ub21lVWkoPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXlQYXVzZUJ0bicpLFxuICAgIDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0YXBCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGx1c3NCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWludXNCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzZXRCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5wdXREaXNwbGF5JykpO1xuIl19
