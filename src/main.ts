import MetronomeUi from './MetronomeUi';

// Can use Document.querySelector() instead
let ui = new MetronomeUi(<HTMLInputElement>document.getElementById('playPauseBtn'),
    <HTMLInputElement>document.getElementById('tapBtn'),
    <HTMLInputElement>document.getElementById('plussBtn'),
    <HTMLInputElement>document.getElementById('minusBtn'),
    <HTMLInputElement>document.getElementById('resetBtn'),
    <HTMLInputElement>document.getElementById('inputDisplay'),
    <HTMLLabelElement>document.getElementById('inputDisplayLabel'));
