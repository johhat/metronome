/**
 * Tapper - a tempo tapper module. The tapper averages consecutive values before resetting after resetAfter milliseconds.
 */
const resetAfter = 5000; //ms

export default class Tapper {

    private previousTap: number = 0;
    private averageInterval: number = 0;
    private numValuesAveraged: number = 0;
    private timerHandle: number = 0;

    constructor() { }

    tap(): { averageTempo: number, numValuesAveraged: number } {

        clearTimeout(this.timerHandle)

        this.timerHandle = setTimeout(() => {
            this.reset()
        }, resetAfter)

        if (!this.previousTap) {
            this.previousTap = new Date().getTime();
            return {
                averageTempo: 0,
                numValuesAveraged: 0
            };
        }

        let currentTime = new Date().getTime();
        let interval = currentTime - this.previousTap;
        this.previousTap = currentTime;

        this.numValuesAveraged++

        // Recursive algorithm for linear averaging
        this.averageInterval = this.averageInterval + (1 / this.numValuesAveraged) * (interval - this.averageInterval)

        let bpm = 1000 * 60.0 / this.averageInterval;

        //Return value rounded to two decimals
        return {
            averageTempo: Math.round(bpm * 100) / 100,
            numValuesAveraged: this.numValuesAveraged
        };
    }

    reset(): void {
        this.previousTap = 0;
        this.numValuesAveraged = 0;
        this.averageInterval = 0;
    }
}