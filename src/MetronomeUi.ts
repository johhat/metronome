/**
 * MetronomeUi
 */
import Metronome from './Metronome';
import Tapper from './Tapper';
import WhilePressedBtn from './WhilePressedBtn'
import InputDisplay from './InputDisplay'

const defaultTempo = 120; //BPM
const defaultHelpText = 'Tempo in beats per minute (BPM):'

//These should be imported from Metronome module
const minTempo = 40;
const maxTempo = 250;

enum KeyCodes { SPACE = 32 };
enum MouseCodes { LEFT = 1 };

export default class MetronomeUi {

    private isPlaying: boolean = false;
    private displayValue: number = defaultTempo;

    private enterIsPressed: boolean = false;
    private spaceIsPressed: boolean = false;

    private metronome: Metronome;
    private tapper: Tapper

    private plussBtn: WhilePressedBtn;
    private minusBtn: WhilePressedBtn;
    private inputDisplay: InputDisplay;

    constructor(private playPauseBtn: HTMLInputElement,
        private tapBtn: HTMLInputElement,
        plussBtn: HTMLInputElement,
        minusBtn: HTMLInputElement,
        private resetBtn: HTMLInputElement,
        inputDisplay: HTMLInputElement,
        inputDisplayLabel: HTMLLabelElement) {

        this.metronome = new Metronome(defaultTempo);
        this.tapper = new Tapper();

        this.plussBtn = new WhilePressedBtn(plussBtn, () => { this.incrementDisplayValue() });
        this.minusBtn = new WhilePressedBtn(minusBtn, () => { this.decrementDisplayValue() });
        this.inputDisplay = new InputDisplay(inputDisplay, inputDisplayLabel, defaultTempo, defaultHelpText,
            (value: number) => {
                //Validator function
                return this.metronome.validateTempo(value)
            },
            (value: number) => {
                //Handle new valid value
                this.displayValue = value;
                this.setMetronomeTempo(value);
            }
        );

        this.setDisplayValue(defaultTempo);

        //Set event handlers
        playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });

        tapBtn.addEventListener('click', () => {
            this.tap();
        });

        resetBtn.addEventListener('click', () => {
            this.reset();
        });

        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });

        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }

    private tap(): void {
        let {averageTempo, numValuesAveraged} = this.tapper.tap();

        if (numValuesAveraged === 0) {
            return;
        }

        console.log('Num values averaged:', numValuesAveraged)
        this.setDisplayValue(averageTempo)
    }

    private togglePlayPause(): void {
        this.isPlaying = this.metronome.toggle();
    }

    private incrementDisplayValue(): void {

        let newValue = this.displayValue + 1;

        let {valid, error} = this.metronome.validateTempo(newValue)

        if (!valid) {
            if (newValue > maxTempo) this.setDisplayValue(maxTempo)
            if (newValue < minTempo) this.setDisplayValue(minTempo)
            this.inputDisplay.setTimedError(error, 2000)
            this.plussBtn.setTimedError(2000)
            return;
        }

        this.setDisplayValue(newValue);
    }

    private decrementDisplayValue(): void {
        let newValue = this.displayValue - 1;

        let {valid, error} = this.metronome.validateTempo(newValue)

        if (!valid) {
            if (newValue < minTempo) this.setDisplayValue(minTempo)
            if (newValue > maxTempo) this.setDisplayValue(maxTempo)
            this.inputDisplay.setTimedError(error, 2000)
            this.minusBtn.setTimedError(2000)
            return;
        }

        this.setDisplayValue(newValue);
    }

    private reset(): void {
        this.setDisplayValue(defaultTempo);
        this.metronome.pause();
        this.metronome.setTempo(defaultTempo);
        this.tapper.reset();
    }

    private handleKeyDown(event: KeyboardEvent): void {
        const keyName = event.key;

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
    }

    private handleKeyUp(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            this.enterIsPressed = false;
        }

        if (event.keyCode === KeyCodes.SPACE) {
            this.spaceIsPressed = false;
        }
    }

    private setDisplayValue(value: number): void {

        value = Math.round(value * 100) / 100;

        this.displayValue = value;
        this.inputDisplay.setValue(value)

        let {valid} = this.metronome.validateTempo(value)

        if (valid) {
            this.setMetronomeTempo(value);
        }
    }

    private setMetronomeTempo(tempo: number): void {
        this.metronome.setTempo(tempo);
    }
}