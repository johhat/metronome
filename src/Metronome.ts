/**
 * Metronome
 */
const minTempo = 40;//BPM
const maxTempo = 250;//BPM
const numBeatsPerBar = 4;

const noteLength = 0.05;//Seconds
const scheduleInterval = 25.0;//ms. How often the scheduling is called.
const scheduleAheadTime = 0.1;//Seconds

enum Pitch { HIGH, MID, LOW };

export default class Metronome {

    private tempo: number; //beats per minute (BPM)
    private isPlaying: boolean = false;
    private currentBeat: number = 0;
    private audioContext: AudioContext;
    private audioLoopTimerHandle: number;

    constructor(tempo: number) {
        //Safari needs prefix webkitAudioContext
        this.audioContext = new ((<any>window).AudioContext || (<any>window).webkitAudioContext)()
        this.setTempo(tempo);
    }

    play(): void {
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.audioLoop();
        }
    }

    pause(): void {
        if (this.isPlaying) {
            this.stopAudioLoop();
            this.isPlaying = false;
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
            //Change to error state
            return { valid: false, error: 'You must enter a number' };
        }

        tempo = Number(tempo);

        if (tempo < minTempo) {
            //Signal error
            console.log('Below min tempo')
            return { valid: false, error: 'Minimum tempo is ' + minTempo };
        }

        if (tempo > maxTempo) {
            //Signal error
            console.log('Above max tempo')
            return { valid: false, error: 'Max tempo is ' + maxTempo };
        }

        return { valid: true, error: '' };
    }

    setTempo(tempo: number): void {

        if (this.tempo === tempo) {
            //Do nothing if it is the same
            return;
        }

        let {valid} = this.validateTempo(tempo)

        if (!valid) {
            return;
        }

        this.tempo = Number(tempo);

        console.log('New metronome tempo:', tempo);
    }

    private stopAudioLoop() {
        clearInterval(this.audioLoopTimerHandle)
    }

    private audioLoop() {

        let nextNoteTime = this.audioContext.currentTime;
        let next4thNote = 0;

        //The scheduler
        this.audioLoopTimerHandle = setInterval(() => {

            if (!this.isPlaying) {
                return;
            }

            while (nextNoteTime < this.audioContext.currentTime + scheduleAheadTime) {

                this.scheduleTone(nextNoteTime, next4thNote % numBeatsPerBar ? Pitch.MID : Pitch.HIGH);

                let secondsPerBeat = 60.0 / this.tempo;
                nextNoteTime += secondsPerBeat;
                next4thNote = (next4thNote + 1) % numBeatsPerBar;
            }

        }, scheduleInterval)
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
                console.log('Invalid pitch')
                frequency = 220;
                break;
        }

        osc.frequency.value = frequency;
        osc.start(startTime);
        osc.stop(startTime + noteLength);
    }
}

