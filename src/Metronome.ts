/**
 * Metronome
 */
const minTempo = 40; // BPM
const maxTempo = 250; // BPM
const numBeatsPerBar = 4;

const noteLength = 0.05; // Seconds
const scheduleInterval = 25.0; // ms. How often the scheduling is called.
const scheduleAheadTime = 0.1; // Seconds

enum Pitch { HIGH, MID, LOW };

export default class Metronome {

    private tempo: number; // beats per minute (BPM)
    private isPlaying: boolean = false;
    private audioContext: AudioContext;
    private audioLoopTimerHandle: number;

    private canSuspend: boolean = false;

    private usesWorker: boolean = false;
    private intervalWorker: Worker;

    private suspendTimerId: number = 0;

    private nextNoteTime: number = 0;
    private next4thNote: number = 0;

    constructor(tempo: number) {
        // Safari needs prefix webkitAudioContext
        this.audioContext = new ((<any>window).AudioContext || (<any>window).webkitAudioContext)();
        this.setTempo(tempo);

        // --Suspend/resume--
        this.canSuspend = (() => {
            if (typeof (<any>this.audioContext).resume !== 'function') {
                return false;
            }

            if (typeof (<any>this.audioContext).suspend !== 'function') {
                return false;
            }
            return true;
        })();

        if (this.canSuspend) {
            clearTimeout(this.suspendTimerId);
            (<any>this.audioContext).suspend();
        }

        // --Web worker--
        this.usesWorker = (<any>window).Worker ? true : false;

        if (this.usesWorker) {
            this.intervalWorker = new Worker('build/IntervalWorker.js');

            this.intervalWorker.onmessage = (event) => {
                if (event.data === 'tick') {
                    this.scheduler();
                } else {
                    console.log('Data from intervalWorker: ', event.data);
                }
            };
        }
    }

    play(): void {
        if (!this.isPlaying) {
            if (this.canSuspend) (<any>this.audioContext).resume();
            this.isPlaying = true;
            this.audioLoop();
        }
    }

    pause(): void {
        if (this.isPlaying) {
            this.stopAudioLoop();
            this.isPlaying = false;

            if (this.canSuspend) {
                this.suspendTimerId = setTimeout(() => {
                    (<any>this.audioContext).suspend();
                }, scheduleAheadTime * 1000 * 2);
            }
        }
    }

    toggle(): boolean {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
        return this.isPlaying;
    }

    validateTempo(tempo: number): { valid: boolean, error: string } {
        if (isNaN(tempo)) {
            // Change to error state
            return { valid: false, error: 'You must enter a number' };
        }

        tempo = Number(tempo);

        if (tempo < minTempo) {
            // Signal error
            return { valid: false, error: 'Minimum tempo is ' + minTempo };
        }

        if (tempo > maxTempo) {
            // Signal error
            return { valid: false, error: 'Max tempo is ' + maxTempo };
        }

        return { valid: true, error: '' };
    }

    setTempo(tempo: number): void {

        if (this.tempo === tempo) {
            // Do nothing if it is the same
            return;
        }

        let {valid} = this.validateTempo(tempo);

        if (!valid) {
            return;
        }

        this.tempo = Number(tempo);
    }

    getMinTempo() {
        return minTempo;
    }

    getMaxTempo() {
        return maxTempo;
    }

    private stopAudioLoop() {
        if (this.usesWorker) {
            this.intervalWorker.postMessage({ 'interval': 0 });
        } else {
            clearInterval(this.audioLoopTimerHandle);
        }
    }

    private audioLoop() {

        this.nextNoteTime = this.audioContext.currentTime + 0.1;
        this.next4thNote = 0;

        if (this.usesWorker) {
            this.intervalWorker.postMessage({ 'interval': scheduleInterval });
        } else {
            this.audioLoopTimerHandle = setInterval(() => {
                if (!this.isPlaying) return;
                this.scheduler();
            }, scheduleInterval);
        }
    }

    private scheduler() {
        while (this.nextNoteTime < this.audioContext.currentTime + scheduleAheadTime) {
            this.scheduleTone(this.nextNoteTime, this.next4thNote % numBeatsPerBar ? Pitch.MID : Pitch.HIGH);
            let secondsPerBeat = 60.0 / this.tempo;
            this.nextNoteTime += secondsPerBeat;
            this.next4thNote = (this.next4thNote + 1) % numBeatsPerBar;
        }
    }

    private scheduleTone(startTime: number, pitch: Pitch): void {

        let osc = this.audioContext.createOscillator();
        osc.connect(this.audioContext.destination);

        let frequency = 0;

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
    }
}

