/**
 * MetronomeUi
 */
import Metronome from './Metronome';
import Tapper from './Tapper';
import WhilePressedBtn from './WhilePressedBtn'

const defaultTempo = 120; //BPM
const inputReactDelay = 500;//ms.

//These should be imported from Metronome module
const minTempo = 40;
const maxTempo = 250;

enum KeyCodes { SPACE = 32 };
enum MouseCodes { LEFT = 1 };

export default class MetronomeUi {

    private isPlaying: boolean = false;
    private displayValue: number = defaultTempo;
    private displayValueIsValid: boolean = true;
    private tapBtnLastPressedTime: number = 0;//Dummy value for 'not yet pressed'

    private inputTimerId: number = 0;

    private enterIsPressed: boolean = false;
    private spaceIsPressed: boolean = false;

    private metronome: Metronome;
    private tapper: Tapper

    private plussBtn: WhilePressedBtn;
    private minusBtn: WhilePressedBtn;

    constructor(private playPauseBtn: HTMLInputElement,
        private tapBtn: HTMLInputElement,
        plussBtn: HTMLInputElement,
        minusBtn: HTMLInputElement,
        private resetBtn: HTMLInputElement,
        private inputDisplay: HTMLInputElement) {

        this.metronome = new Metronome(defaultTempo);
        this.tapper = new Tapper();
        this.setDisplayValue(defaultTempo);

        this.plussBtn = new WhilePressedBtn(plussBtn, () => { this.incrementDisplayValue() });
        this.minusBtn = new WhilePressedBtn(minusBtn, () => { this.decrementDisplayValue() });

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

        inputDisplay.addEventListener('input', (event) => {
            this.handleDisplayInputEvent(event);
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

        if (!this.metronome.validateTempo(newValue)) {
            if (newValue>maxTempo) this.setDisplayValue(maxTempo)
            if (newValue<minTempo) this.setDisplayValue(minTempo)
            return;
        }

        this.setDisplayValue(newValue);
    }

    private decrementDisplayValue(): void {
        let newValue = this.displayValue - 1;

        if (!this.metronome.validateTempo(newValue)) {
            if (newValue<minTempo) this.setDisplayValue(minTempo)
            if (newValue>maxTempo) this.setDisplayValue(maxTempo)
            return;
        }

        this.setDisplayValue(newValue);
    }

    private reset(): void {
        this.setDisplayValue(defaultTempo);
        this.metronome.pause();
        this.metronome.setTempo(defaultTempo);
    }

    private handleKeyDown(event: KeyboardEvent): void {
        const keyName = event.key;

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
    }

    private handleKeyUp(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            this.enterIsPressed = false;
        }

        if (event.keyCode === KeyCodes.SPACE) {
            this.spaceIsPressed = false;
        }
    }

    private handleDisplayInputEvent(event: Event) {
        clearTimeout(this.inputTimerId);

        this.inputTimerId = setTimeout(() => {
            let value = this.inputDisplay.value;

            if (value.toString().length < 1) {
                this.setErrorMessage('The entered value has too few digits.');
                return;
            }

            if (isNaN(Number(value))) {
                this.setErrorMessage('The entered value is not a number. Please enter a number')
                return;
            }

            let valueAsNumber = Number(value)

            //TODO: Get limit values from metronome module 
            if (valueAsNumber < 40) {
                this.setErrorMessage('The value is too low. Please enter a number in the range 40 to 250')
                return;
            }

            if (valueAsNumber > 250) {
                this.setErrorMessage('The value is too high. Please enter a number in the range 40 to 250')
                return;
            }

            this.setDisplayValue(valueAsNumber);

        }, inputReactDelay)
    }

    private setErrorMessage(message: string): void {
        console.log(message);
    }

    private setDisplayValue(value: number): void {
        this.displayValue = Math.round(value * 100) / 100;
        this.inputDisplay.value = this.displayValue.toString();

        if (this.metronome.validateTempo(value)) {
            this.setMetronomeTempo(value);
        }
    }

    private setMetronomeTempo(tempo: number): void {
        this.metronome.setTempo(tempo);
    }
}