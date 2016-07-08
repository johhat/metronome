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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvTWV0cm9ub21lLnRzIiwic3JjL01ldHJvbm9tZVVpLnRzIiwic3JjL1RhcHBlci50cyIsInNyYy9XaGlsZVByZXNzZWRCdG4udHMiLCJzcmMvbWFpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTs7R0FFRztBQUNILElBQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxDQUFBLEtBQUs7QUFDekIsSUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLENBQUEsS0FBSztBQUMxQixJQUFNLGNBQWMsR0FBRyxDQUFDLENBQUM7QUFFekIsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLENBQUEsU0FBUztBQUNqQyxJQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxDQUFBLHlDQUF5QztBQUN2RSxJQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQyxDQUFBLFNBQVM7QUFFdkMsSUFBSyxLQUF3QjtBQUE3QixXQUFLLEtBQUs7SUFBRyxpQ0FBSSxDQUFBO0lBQUUsK0JBQUcsQ0FBQTtJQUFFLCtCQUFHLENBQUE7QUFBQyxDQUFDLEVBQXhCLEtBQUssS0FBTCxLQUFLLFFBQW1CO0FBQUEsQ0FBQztBQUU5QjtJQVFJLG1CQUFZLEtBQWE7UUFMakIsY0FBUyxHQUFZLEtBQUssQ0FBQztRQUMzQixnQkFBVyxHQUFXLENBQUMsQ0FBQztRQUs1QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUE7UUFDNUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN6QixDQUFDO0lBRUQsd0JBQUksR0FBSjtRQUNJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDbEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7WUFDdEIsSUFB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QUFDLGNBQWMsQ0FBQyxFQUM1RCxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxFQUNqQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUNuQyxRQUFRLENBQUMsY0FBYyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBNZXRyb25vbWVcbiAqL1xuY29uc3QgbWluVGVtcG8gPSA0MDsvL0JQTVxuY29uc3QgbWF4VGVtcG8gPSAyNTA7Ly9CUE1cbmNvbnN0IG51bUJlYXRzUGVyQmFyID0gNDtcblxuY29uc3Qgbm90ZUxlbmd0aCA9IDAuMDU7Ly9TZWNvbmRzXG5jb25zdCBzY2hlZHVsZUludGVydmFsID0gMjUuMDsvL21zLiBIb3cgb2Z0ZW4gdGhlIHNjaGVkdWxpbmcgaXMgY2FsbGVkLlxuY29uc3Qgc2NoZWR1bGVBaGVhZFRpbWUgPSAwLjE7Ly9TZWNvbmRzXG5cbmVudW0gUGl0Y2ggeyBISUdILCBNSUQsIExPVyB9O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRyb25vbWUge1xuXG4gICAgcHJpdmF0ZSB0ZW1wbzogbnVtYmVyOyAvL2JlYXRzIHBlciBtaW51dGUgKEJQTSlcbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgY3VycmVudEJlYXQ6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBhdWRpb0NvbnRleHQ6IEF1ZGlvQ29udGV4dDtcbiAgICBwcml2YXRlIGF1ZGlvTG9vcFRpbWVySGFuZGxlOiBudW1iZXI7XG5cbiAgICBjb25zdHJ1Y3Rvcih0ZW1wbzogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuYXVkaW9Db250ZXh0ID0gbmV3ICh3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQpKClcbiAgICAgICAgdGhpcy5zZXRUZW1wbyh0ZW1wbyk7XG4gICAgfVxuXG4gICAgcGxheSgpOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLmlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5pc1BsYXlpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5hdWRpb0xvb3AoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBhdXNlKCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcEF1ZGlvTG9vcCgpO1xuICAgICAgICAgICAgdGhpcy5pc1BsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRvZ2dsZSgpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5pc1BsYXlpbmc7XG4gICAgfVxuXG4gICAgdmFsaWRhdGVUZW1wbyh0ZW1wbzogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIGlmIChpc05hTih0ZW1wbykpIHtcbiAgICAgICAgICAgIC8vQ2hhbmdlIHRvIGVycm9yIHN0YXRlXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnTm90IGEgbnVtYmVyIScpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wbyA9IE51bWJlcih0ZW1wbyk7XG5cbiAgICAgICAgaWYgKHRlbXBvIDwgbWluVGVtcG8pIHtcbiAgICAgICAgICAgIC8vU2lnbmFsIGVycm9yXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQmVsb3cgbWluIHRlbXBvJylcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0ZW1wbyA+IG1heFRlbXBvKSB7XG4gICAgICAgICAgICAvL1NpZ25hbCBlcnJvclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0Fib3ZlIG1heCB0ZW1wbycpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBzZXRUZW1wbyh0ZW1wbzogbnVtYmVyKTogdm9pZCB7XG5cbiAgICAgICAgaWYgKHRoaXMudGVtcG8gPT09IHRlbXBvKSB7XG4gICAgICAgICAgICAvL0RvIG5vdGhpbmcgaWYgaXQgaXMgdGhlIHNhbWVcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy52YWxpZGF0ZVRlbXBvKHRlbXBvKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50ZW1wbyA9IE51bWJlcih0ZW1wbyk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ05ldyBtZXRyb25vbWUgdGVtcG86JywgdGVtcG8pO1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RvcEF1ZGlvTG9vcCgpIHtcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmF1ZGlvTG9vcFRpbWVySGFuZGxlKVxuICAgIH1cblxuICAgIHByaXZhdGUgYXVkaW9Mb29wKCkge1xuXG4gICAgICAgIGxldCBuZXh0Tm90ZVRpbWUgPSB0aGlzLmF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgbGV0IG5leHQ0dGhOb3RlID0gMDtcblxuICAgICAgICAvL1RoZSBzY2hlZHVsZXJcbiAgICAgICAgdGhpcy5hdWRpb0xvb3BUaW1lckhhbmRsZSA9IHNldEludGVydmFsKCgpID0+IHtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmlzUGxheWluZykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgd2hpbGUgKG5leHROb3RlVGltZSA8IHRoaXMuYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lICsgc2NoZWR1bGVBaGVhZFRpbWUpIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVUb25lKG5leHROb3RlVGltZSwgbmV4dDR0aE5vdGUgJSBudW1CZWF0c1BlckJhciA/IFBpdGNoLk1JRCA6IFBpdGNoLkhJR0gpO1xuXG4gICAgICAgICAgICAgICAgbGV0IHNlY29uZHNQZXJCZWF0ID0gNjAuMCAvIHRoaXMudGVtcG87XG4gICAgICAgICAgICAgICAgbmV4dE5vdGVUaW1lICs9IHNlY29uZHNQZXJCZWF0O1xuICAgICAgICAgICAgICAgIG5leHQ0dGhOb3RlID0gKG5leHQ0dGhOb3RlICsgMSkgJSBudW1CZWF0c1BlckJhcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9LCBzY2hlZHVsZUludGVydmFsKVxuICAgIH1cblxuICAgIHByaXZhdGUgc2NoZWR1bGVUb25lKHN0YXJ0VGltZTogbnVtYmVyLCBwaXRjaDogUGl0Y2gpOiB2b2lkIHtcblxuICAgICAgICBsZXQgb3NjID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpO1xuICAgICAgICBvc2MuY29ubmVjdCh0aGlzLmF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAgICAgbGV0IGZyZXF1ZW5jeSA9IDA7XG5cbiAgICAgICAgc3dpdGNoIChwaXRjaCkge1xuICAgICAgICAgICAgY2FzZSBQaXRjaC5ISUdIOlxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDg4MDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUGl0Y2guTUlEOlxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDQ0MDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUGl0Y2guTE9XOlxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDIyMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0ludmFsaWQgcGl0Y2gnKVxuICAgICAgICAgICAgICAgIGZyZXF1ZW5jeSA9IDIyMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIG9zYy5mcmVxdWVuY3kudmFsdWUgPSBmcmVxdWVuY3k7XG4gICAgICAgIG9zYy5zdGFydChzdGFydFRpbWUpO1xuICAgICAgICBvc2Muc3RvcChzdGFydFRpbWUgKyBub3RlTGVuZ3RoKTtcbiAgICB9XG59XG5cbiIsIi8qKlxuICogTWV0cm9ub21lVWlcbiAqL1xuaW1wb3J0IE1ldHJvbm9tZSBmcm9tICcuL01ldHJvbm9tZSc7XG5pbXBvcnQgVGFwcGVyIGZyb20gJy4vVGFwcGVyJztcbmltcG9ydCBXaGlsZVByZXNzZWRCdG4gZnJvbSAnLi9XaGlsZVByZXNzZWRCdG4nXG5cbmNvbnN0IGRlZmF1bHRUZW1wbyA9IDEyMDsgLy9CUE1cbmNvbnN0IGlucHV0UmVhY3REZWxheSA9IDUwMDsvL21zLlxuXG4vL1RoZXNlIHNob3VsZCBiZSBpbXBvcnRlZCBmcm9tIE1ldHJvbm9tZSBtb2R1bGVcbmNvbnN0IG1pblRlbXBvID0gNDA7XG5jb25zdCBtYXhUZW1wbyA9IDI1MDtcblxuZW51bSBLZXlDb2RlcyB7IFNQQUNFID0gMzIgfTtcbmVudW0gTW91c2VDb2RlcyB7IExFRlQgPSAxIH07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1ldHJvbm9tZVVpIHtcblxuICAgIHByaXZhdGUgaXNQbGF5aW5nOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBkaXNwbGF5VmFsdWU6IG51bWJlciA9IGRlZmF1bHRUZW1wbztcbiAgICBwcml2YXRlIGRpc3BsYXlWYWx1ZUlzVmFsaWQ6IGJvb2xlYW4gPSB0cnVlO1xuICAgIHByaXZhdGUgdGFwQnRuTGFzdFByZXNzZWRUaW1lOiBudW1iZXIgPSAwOy8vRHVtbXkgdmFsdWUgZm9yICdub3QgeWV0IHByZXNzZWQnXG5cbiAgICBwcml2YXRlIGlucHV0VGltZXJJZDogbnVtYmVyID0gMDtcblxuICAgIHByaXZhdGUgZW50ZXJJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIHNwYWNlSXNQcmVzc2VkOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICBwcml2YXRlIG1ldHJvbm9tZTogTWV0cm9ub21lO1xuICAgIHByaXZhdGUgdGFwcGVyOiBUYXBwZXJcblxuICAgIHByaXZhdGUgcGx1c3NCdG46IFdoaWxlUHJlc3NlZEJ0bjtcbiAgICBwcml2YXRlIG1pbnVzQnRuOiBXaGlsZVByZXNzZWRCdG47XG5cbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBsYXlQYXVzZUJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSB0YXBCdG46IEhUTUxJbnB1dEVsZW1lbnQsXG4gICAgICAgIHBsdXNzQnRuOiBIVE1MSW5wdXRFbGVtZW50LFxuICAgICAgICBtaW51c0J0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSByZXNldEJ0bjogSFRNTElucHV0RWxlbWVudCxcbiAgICAgICAgcHJpdmF0ZSBpbnB1dERpc3BsYXk6IEhUTUxJbnB1dEVsZW1lbnQpIHtcblxuICAgICAgICB0aGlzLm1ldHJvbm9tZSA9IG5ldyBNZXRyb25vbWUoZGVmYXVsdFRlbXBvKTtcbiAgICAgICAgdGhpcy50YXBwZXIgPSBuZXcgVGFwcGVyKCk7XG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKGRlZmF1bHRUZW1wbyk7XG5cbiAgICAgICAgdGhpcy5wbHVzc0J0biA9IG5ldyBXaGlsZVByZXNzZWRCdG4ocGx1c3NCdG4sICgpID0+IHsgdGhpcy5pbmNyZW1lbnREaXNwbGF5VmFsdWUoKSB9KTtcbiAgICAgICAgdGhpcy5taW51c0J0biA9IG5ldyBXaGlsZVByZXNzZWRCdG4obWludXNCdG4sICgpID0+IHsgdGhpcy5kZWNyZW1lbnREaXNwbGF5VmFsdWUoKSB9KTtcblxuICAgICAgICAvL1NldCBldmVudCBoYW5kbGVyc1xuICAgICAgICBwbGF5UGF1c2VCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnRvZ2dsZVBsYXlQYXVzZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0YXBCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnRhcCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzZXQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVLZXlEb3duKGV2ZW50KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlS2V5VXAoZXZlbnQpO1xuICAgICAgICB9KTtcblxuICAgICAgICBpbnB1dERpc3BsYXkuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlRGlzcGxheUlucHV0RXZlbnQoZXZlbnQpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHRhcCgpOiB2b2lkIHtcbiAgICAgICAgbGV0IHthdmVyYWdlVGVtcG8sIG51bVZhbHVlc0F2ZXJhZ2VkfSA9IHRoaXMudGFwcGVyLnRhcCgpO1xuXG4gICAgICAgIGlmIChudW1WYWx1ZXNBdmVyYWdlZCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ051bSB2YWx1ZXMgYXZlcmFnZWQ6JywgbnVtVmFsdWVzQXZlcmFnZWQpXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKGF2ZXJhZ2VUZW1wbylcbiAgICB9XG5cbiAgICBwcml2YXRlIHRvZ2dsZVBsYXlQYXVzZSgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5pc1BsYXlpbmcgPSB0aGlzLm1ldHJvbm9tZS50b2dnbGUoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGluY3JlbWVudERpc3BsYXlWYWx1ZSgpOiB2b2lkIHtcblxuICAgICAgICBsZXQgbmV3VmFsdWUgPSB0aGlzLmRpc3BsYXlWYWx1ZSArIDE7XG5cbiAgICAgICAgaWYgKCF0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKG5ld1ZhbHVlKSkge1xuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlPm1heFRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZShtYXhUZW1wbylcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZTxtaW5UZW1wbykgdGhpcy5zZXREaXNwbGF5VmFsdWUobWluVGVtcG8pXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShuZXdWYWx1ZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBkZWNyZW1lbnREaXNwbGF5VmFsdWUoKTogdm9pZCB7XG4gICAgICAgIGxldCBuZXdWYWx1ZSA9IHRoaXMuZGlzcGxheVZhbHVlIC0gMTtcblxuICAgICAgICBpZiAoIXRoaXMubWV0cm9ub21lLnZhbGlkYXRlVGVtcG8obmV3VmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWU8bWluVGVtcG8pIHRoaXMuc2V0RGlzcGxheVZhbHVlKG1pblRlbXBvKVxuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlPm1heFRlbXBvKSB0aGlzLnNldERpc3BsYXlWYWx1ZShtYXhUZW1wbylcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0RGlzcGxheVZhbHVlKG5ld1ZhbHVlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlc2V0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZShkZWZhdWx0VGVtcG8pO1xuICAgICAgICB0aGlzLm1ldHJvbm9tZS5wYXVzZSgpO1xuICAgICAgICB0aGlzLm1ldHJvbm9tZS5zZXRUZW1wbyhkZWZhdWx0VGVtcG8pO1xuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlS2V5RG93bihldmVudDogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgICAgICBjb25zdCBrZXlOYW1lID0gZXZlbnQua2V5O1xuXG4gICAgICAgIGlmIChrZXlOYW1lID09PSAnQXJyb3dVcCcgfHwga2V5TmFtZSA9PT0gJ0Fycm93UmlnaHQnKSB7XG4gICAgICAgICAgICB0aGlzLmluY3JlbWVudERpc3BsYXlWYWx1ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdBcnJvd0Rvd24nIHx8IGtleU5hbWUgPT09ICdBcnJvd0xlZnQnKSB7XG4gICAgICAgICAgICB0aGlzLmRlY3JlbWVudERpc3BsYXlWYWx1ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleU5hbWUgPT09ICdFbnRlcicpIHtcbiAgICAgICAgICAgIC8vTWF5IG5vdCBiZSB2ZXJ5IGludHVpdGl2ZS4gRWcuIGVudGVyIG9uIHJlc2V0IGJ1dHRvbiB3aWxsIG5vdCBcInByZXNzXCIgcmVzZXRcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5lbnRlcklzUHJlc3NlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMudG9nZ2xlUGxheVBhdXNlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRlcklzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZXMuU1BBQ0UpIHtcbiAgICAgICAgICAgIC8vTWF5IG5vdCBiZSB2ZXJ5IGludHVpdGl2ZS4gRWcuIHNwYWNlIG9uIHJlc2V0IGJ1dHRvbiB3aWxsIG5vdCBcInByZXNzXCIgcmVzZXRcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5zcGFjZUlzUHJlc3NlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMudGFwKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zcGFjZUlzUHJlc3NlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGhhbmRsZUtleVVwKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG4gICAgICAgIGlmIChldmVudC5rZXkgPT09ICdFbnRlcicpIHtcbiAgICAgICAgICAgIHRoaXMuZW50ZXJJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudC5rZXlDb2RlID09PSBLZXlDb2Rlcy5TUEFDRSkge1xuICAgICAgICAgICAgdGhpcy5zcGFjZUlzUHJlc3NlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBoYW5kbGVEaXNwbGF5SW5wdXRFdmVudChldmVudDogRXZlbnQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuaW5wdXRUaW1lcklkKTtcblxuICAgICAgICB0aGlzLmlucHV0VGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgbGV0IHZhbHVlID0gdGhpcy5pbnB1dERpc3BsYXkudmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZS50b1N0cmluZygpLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZSgnVGhlIGVudGVyZWQgdmFsdWUgaGFzIHRvbyBmZXcgZGlnaXRzLicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGlzTmFOKE51bWJlcih2YWx1ZSkpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRFcnJvck1lc3NhZ2UoJ1RoZSBlbnRlcmVkIHZhbHVlIGlzIG5vdCBhIG51bWJlci4gUGxlYXNlIGVudGVyIGEgbnVtYmVyJylcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCB2YWx1ZUFzTnVtYmVyID0gTnVtYmVyKHZhbHVlKVxuXG4gICAgICAgICAgICAvL1RPRE86IEdldCBsaW1pdCB2YWx1ZXMgZnJvbSBtZXRyb25vbWUgbW9kdWxlIFxuICAgICAgICAgICAgaWYgKHZhbHVlQXNOdW1iZXIgPCA0MCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0RXJyb3JNZXNzYWdlKCdUaGUgdmFsdWUgaXMgdG9vIGxvdy4gUGxlYXNlIGVudGVyIGEgbnVtYmVyIGluIHRoZSByYW5nZSA0MCB0byAyNTAnKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZhbHVlQXNOdW1iZXIgPiAyNTApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldEVycm9yTWVzc2FnZSgnVGhlIHZhbHVlIGlzIHRvbyBoaWdoLiBQbGVhc2UgZW50ZXIgYSBudW1iZXIgaW4gdGhlIHJhbmdlIDQwIHRvIDI1MCcpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnNldERpc3BsYXlWYWx1ZSh2YWx1ZUFzTnVtYmVyKTtcblxuICAgICAgICB9LCBpbnB1dFJlYWN0RGVsYXkpXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRFcnJvck1lc3NhZ2UobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnNvbGUubG9nKG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2V0RGlzcGxheVZhbHVlKHZhbHVlOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5kaXNwbGF5VmFsdWUgPSBNYXRoLnJvdW5kKHZhbHVlICogMTAwKSAvIDEwMDtcbiAgICAgICAgdGhpcy5pbnB1dERpc3BsYXkudmFsdWUgPSB0aGlzLmRpc3BsYXlWYWx1ZS50b1N0cmluZygpO1xuXG4gICAgICAgIGlmICh0aGlzLm1ldHJvbm9tZS52YWxpZGF0ZVRlbXBvKHZhbHVlKSkge1xuICAgICAgICAgICAgdGhpcy5zZXRNZXRyb25vbWVUZW1wbyh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldE1ldHJvbm9tZVRlbXBvKHRlbXBvOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5tZXRyb25vbWUuc2V0VGVtcG8odGVtcG8pO1xuICAgIH1cbn0iLCIvKipcbiAqIFRhcHBlciAtIGEgdGVtcG8gdGFwcGVyIG1vZHVsZS4gVGhlIHRhcHBlciBhdmVyYWdlcyBjb25zZWN1dGl2ZSB2YWx1ZXMgYmVmb3JlIHJlc2V0dGluZyBhZnRlciByZXNldEFmdGVyIG1pbGxpc2Vjb25kcy5cbiAqL1xuY29uc3QgcmVzZXRBZnRlciA9IDUwMDA7IC8vbXNcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGFwcGVyIHtcblxuICAgIHByaXZhdGUgcHJldmlvdXNUYXA6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBhdmVyYWdlSW50ZXJ2YWw6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBudW1WYWx1ZXNBdmVyYWdlZDogbnVtYmVyID0gMDtcbiAgICBwcml2YXRlIHRpbWVySGFuZGxlOiBudW1iZXIgPSAwO1xuXG4gICAgY29uc3RydWN0b3IoKSB7IH1cblxuICAgIHRhcCgpOiB7IGF2ZXJhZ2VUZW1wbzogbnVtYmVyLCBudW1WYWx1ZXNBdmVyYWdlZDogbnVtYmVyIH0ge1xuXG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVySGFuZGxlKVxuXG4gICAgICAgIHRoaXMudGltZXJIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQgPSAwO1xuICAgICAgICAgICAgdGhpcy5hdmVyYWdlSW50ZXJ2YWwgPSAwO1xuICAgICAgICAgICAgdGhpcy5wcmV2aW91c1RhcCA9IDA7XG4gICAgICAgIH0sIHJlc2V0QWZ0ZXIpXG5cbiAgICAgICAgaWYgKCF0aGlzLnByZXZpb3VzVGFwKSB7XG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzVGFwID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGF2ZXJhZ2VUZW1wbzogMCxcbiAgICAgICAgICAgICAgICBudW1WYWx1ZXNBdmVyYWdlZDogMFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjdXJyZW50VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgICBsZXQgaW50ZXJ2YWwgPSBjdXJyZW50VGltZSAtIHRoaXMucHJldmlvdXNUYXA7XG4gICAgICAgIHRoaXMucHJldmlvdXNUYXAgPSBjdXJyZW50VGltZTtcblxuICAgICAgICB0aGlzLm51bVZhbHVlc0F2ZXJhZ2VkKytcblxuICAgICAgICAvLyBSZWN1cnNpdmUgYWxnb3JpdGhtIGZvciBsaW5lYXIgYXZlcmFnaW5nXG4gICAgICAgIHRoaXMuYXZlcmFnZUludGVydmFsID0gdGhpcy5hdmVyYWdlSW50ZXJ2YWwgKyAoMSAvIHRoaXMubnVtVmFsdWVzQXZlcmFnZWQpICogKGludGVydmFsIC0gdGhpcy5hdmVyYWdlSW50ZXJ2YWwpXG5cbiAgICAgICAgbGV0IGJwbSA9IDEwMDAgKiA2MC4wIC8gdGhpcy5hdmVyYWdlSW50ZXJ2YWw7XG5cbiAgICAgICAgLy9SZXR1cm4gdmFsdWUgcm91bmRlZCB0byB0d28gZGVjaW1hbHNcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGF2ZXJhZ2VUZW1wbzogTWF0aC5yb3VuZChicG0gKiAxMDApIC8gMTAwLFxuICAgICAgICAgICAgbnVtVmFsdWVzQXZlcmFnZWQ6IHRoaXMubnVtVmFsdWVzQXZlcmFnZWRcbiAgICAgICAgfTtcbiAgICB9XG59IiwiLyoqXG4gKiBXaGlsZVByZXNzZWRCdG4uIEEgYnV0dG9uIHdoaWNoIHJlcGVhdGVkbHkgdHJpZ2dlcnMgYW4gZXZlbnQgd2hpbGUgcHJlc3NlZC5cbiAqL1xuZW51bSBNb3VzZUNvZGVzIHsgTEVGVCA9IDEgfTtcblxuY29uc3Qga2V5RG93blJlcGVhdERlbGF5ID0gNTAwOyAvL21zLiBTYW1lIGFzIENocm9tZS5cbmNvbnN0IGtleURvd25SZXBlYXRJbnRlcnZhbCA9IDMwOyAvL21zLiBTYW1lIGFzIENocm9tZS5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV2hpbGVQcmVzc2VkQnRuIHtcblxuICAgIHByaXZhdGUgYnRuOiBIVE1MSW5wdXRFbGVtZW50O1xuICAgIHByaXZhdGUgbW91c2VJc1ByZXNzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIG1vdXNlRG93blRpbWVySGFuZGxlOiBudW1iZXIgPSAwO1xuICAgIHByaXZhdGUgbW91c2VEb3duSGFuZGxlckZ1bmN0aW9uOiAoKSA9PiB2b2lkO1xuXG4gICAgY29uc3RydWN0b3IoYnRuRWxlbWVudDogSFRNTElucHV0RWxlbWVudCwgaGFuZGxlckZ1bmN0aW9uOiAoKSA9PiB2b2lkKSB7XG5cbiAgICAgICAgdGhpcy5idG4gPSBidG5FbGVtZW50O1xuICAgICAgICB0aGlzLm1vdXNlRG93bkhhbmRsZXJGdW5jdGlvbiA9IGhhbmRsZXJGdW5jdGlvbjtcblxuICAgICAgICB0aGlzLmJ0bi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC53aGljaCAhPT0gTW91c2VDb2Rlcy5MRUZUKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLm1vdXNlSXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMubW91c2VEb3duSGFuZGxlckZ1bmN0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7IHRoaXMubW91c2VEb3duTG9vcCgpIH0sIGtleURvd25SZXBlYXREZWxheSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vQWRkIG1vdXNldXAgZXZlbnRsaXN0ZW5lciB0byBkb2N1bWVudCBpbiBjYXNlIHRoZSBtb3VzZSBpcyBtb3ZlZCBhd2F5IGZyb20gYnRuIGJlZm9yZSBpdCBpcyByZWxlYXNlZC5cbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBNb3VzZUNvZGVzLkxFRlQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMubW91c2VJc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBtb3VzZURvd25Mb29wKCk6IHZvaWQge1xuXG4gICAgICAgIGlmICghdGhpcy5tb3VzZUlzUHJlc3NlZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tb3VzZURvd25IYW5kbGVyRnVuY3Rpb24oKTtcblxuICAgICAgICB0aGlzLm1vdXNlRG93blRpbWVySGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7IHRoaXMubW91c2VEb3duTG9vcCgpIH0sIGtleURvd25SZXBlYXRJbnRlcnZhbCk7XG4gICAgfVxufSIsImltcG9ydCBNZXRyb25vbWVVaSBmcm9tIFwiLi9NZXRyb25vbWVVaVwiXG5cbi8vQ2FuIHVzZSBEb2N1bWVudC5xdWVyeVNlbGVjdG9yKCkgaW5zdGVhZFxubGV0IHVpID0gbmV3IE1ldHJvbm9tZVVpKDxIVE1MSW5wdXRFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5UGF1c2VCdG4nKSxcbiAgICA8SFRNTElucHV0RWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGFwQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsdXNzQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21pbnVzQnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc2V0QnRuJyksXG4gICAgPEhUTUxJbnB1dEVsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2lucHV0RGlzcGxheScpKTtcbiJdfQ==
