/**
 * InputDisplay
 */
const inputReactDelay = 500; // ms.
enum State { OK, WARNING, ERROR }

export default class InputDisplay {

    private state: State;
    private value: number;
    private inputTimerId: number = 0;
    private messageTimerId: number = 0;

    constructor(private inputDisplay: HTMLInputElement, private label: HTMLLabelElement,
        initialValue: number,
        private defaultHelpText: string,
        private validator: (value: number) => { valid: boolean, error: string },
        private onNewValidValue: (value: number) => void) {

        this.value = initialValue;
        this.inputDisplay.value = initialValue.toString();
        this.state = State.OK;

        this.handleNewValue(initialValue.toString());

        this.inputDisplay.addEventListener('input', (event) => {
            this.handleInputEvent(event);
        });
    }

    setValue(value: number) {
        this.value = Math.round(value * 100) / 100;
        this.inputDisplay.value = this.value.toString();
        this.handleNewValue(value.toString());
    }

    setTimedError(message: string, duration: number) {
        clearTimeout(this.messageTimerId);

        this.setState(State.ERROR);
        this.setErrorMessage(message);

        this.messageTimerId = setTimeout(() => {
            // Go back to state corresponding to current display value
            this.handleNewValue(this.inputDisplay.value);
        }, duration);
    }

    private handleNewValue(value: string): boolean {
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

        let valueAsNumber = Number(value);

        let {valid, error} = this.validator(valueAsNumber);

        if (!valid) {
            this.setErrorMessage(error);
            this.setState(State.ERROR);
            return false;
        }

        this.setState(State.OK);
        this.setErrorMessage(this.defaultHelpText);

        return true;
    }

    private handleInputEvent(event: Event) {
        clearTimeout(this.inputTimerId);
        clearTimeout(this.messageTimerId);

        this.inputTimerId = setTimeout(() => {
            let value = this.inputDisplay.value;

            if (!this.handleNewValue(value)) {
                return;
            }

            this.onNewValidValue(Number(value));

        }, inputReactDelay);
    }

    private setState(nextState: State) {
        // Set CSS classes corresponding to the element state
        let currentStateClass = this.getStateClass(this.state);
        let nextStateClass = this.getStateClass(nextState);

        if (currentStateClass !== '') {
            this.inputDisplay.classList.remove(currentStateClass);
            this.label.classList.remove(currentStateClass);
        }

        if (nextStateClass !== '') {
            this.inputDisplay.classList.add(nextStateClass);
            this.label.classList.add(nextStateClass);
        }

        this.state = nextState;
    }

    private getStateClass(state: State): string {
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
    }

    private setErrorMessage(message: string): void {
        this.label.textContent = message;
    }
}