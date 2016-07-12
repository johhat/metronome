/**
 * WhilePressedBtn. A button which repeatedly triggers an event while pressed.
 */
enum MouseCodes { LEFT = 1 };

const keyDownRepeatDelay = 500; // ms. Same as Chrome.
const keyDownRepeatInterval = 30; // ms. Same as Chrome.

export default class WhilePressedBtn {

    private btn: HTMLInputElement;
    private errorTimerId: number = 0;

    private mouseIsPressed: boolean = false;
    private mouseDownTimerHandle: number = 0;
    private mouseDownHandlerFunction: () => void;

    constructor(btnElement: HTMLInputElement, handlerFunction: () => void) {

        this.btn = btnElement;
        this.mouseDownHandlerFunction = handlerFunction;

        this.btn.addEventListener('mousedown', (event) => {
            if (event.which !== MouseCodes.LEFT) return;
            this.mouseIsPressed = true;
            this.mouseDownHandlerFunction();
            this.mouseDownTimerHandle = setTimeout(() => { this.mouseDownLoop(); }, keyDownRepeatDelay);
        });

        this.btn.addEventListener('touchstart', (event) => {
            event.preventDefault();
            this.btn.focus(); // TODO: Check problem in chrome iPhone emulator where hover is not removed from previously focused element. Known as the sticky hover problem.
            this.mouseIsPressed = true;
            this.mouseDownHandlerFunction();
            this.mouseDownTimerHandle = setTimeout(() => { this.mouseDownLoop(); }, keyDownRepeatDelay);
        });

        // Add mouseup eventlistener to document in case the mouse is moved away from btn before it is released.
        document.addEventListener('mouseup', (event) => {
            if (event.which !== MouseCodes.LEFT) return;
            this.mouseIsPressed = false;
            clearTimeout(this.mouseDownTimerHandle);
        });

        // End of touch events
        this.btn.addEventListener('touchend', (event) => {
            this.mouseIsPressed = false;
            clearTimeout(this.mouseDownTimerHandle);
        });

        this.btn.addEventListener('touchcancel', (event) => {
            this.mouseIsPressed = false;
            clearTimeout(this.mouseDownTimerHandle);
        });
    }

    setTimedError(duration: number): void {
        clearTimeout(this.errorTimerId);

        this.btn.classList.add('has-error');

        this.errorTimerId = setTimeout(() => {
            this.btn.classList.remove('has-error');
        }, duration);
    }

    private mouseDownLoop(): void {

        if (!this.mouseIsPressed) {
            return;
        }

        this.mouseDownHandlerFunction();

        this.mouseDownTimerHandle = setTimeout(() => { this.mouseDownLoop(); }, keyDownRepeatInterval);
    }
}