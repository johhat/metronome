/*eslint-env node */
/*eslint no-console: 0*/
var fs = require('fs');
var path = require('path');
var browserSync = require('browser-sync').create();
var browserify = require('browserify');
var watchify = require('watchify');
var tsify = require('tsify');

var sourceFile = path.join(__dirname, 'src/main.ts');
var outFile = path.join(__dirname, 'build/bundle.js');

//Browserify setup
var browserifyInstance = browserify({
    entries: [sourceFile],
    cache: {},
    packageCache: {},
    plugin: [watchify, tsify],
    debug: true //Enables sourcemaps
});

//Browser sync setup
browserSync.init({
    server: './'
});

//Browser sync watching of non-ts-files
browserSync.watch('index.html').on('change', browserSync.reload);
browserSync.watch('css/*.css').on('change', browserSync.reload);
browserSync.watch('src/IntervalWorker.js').on('change', () => {
    copyFile('src/IntervalWorker.js', 'build/IntervalWorker.js', () => {
        browserSync.reload('src/IntervalWorker.js');
    });
});

//Bundling and reloading on bundling - fn triggered automatically on change in .ts-files due to watchify+tsify plugins
function bundle() {
    browserifyInstance
        .bundle()
        .on('error', function (error) {
            console.log('Err in fn bundle:', error.toString());
        })
        .pipe(fs.createWriteStream(outFile));

    setTimeout(() => {
        browserSync.reload(outFile);// To avoid unexpected end of input error in Chrome
    }, 1000);
}

browserifyInstance.on('update', bundle);

//Initial bundling
bundle();

//Copy files from node modules
copyFile('node_modules/normalize.css/normalize.css', 'css/normalize.css', () => { });

//Copy js files
copyFile('src/IntervalWorker.js', 'build/IntervalWorker.js', () => { });

//Utility functions below here
function copyFile(source, target, cb) {
    var cbCalled = false;

    var rd = fs.createReadStream(source);
    rd.on('error', function (err) {
        console.log('Error during copy. Read stream.', err.toString());
        done(err);
    });
    var wr = fs.createWriteStream(target);
    wr.on('error', function (err) {
        console.log('Error during copy. Write stream.', err.toString());
        done(err);
    });
    wr.on('close', function () {
        console.log('Copy of', source, 'completed');
        done();
    });
    rd.pipe(wr);

    function done(err) {
        if (!cbCalled) {
            cb(err);
            cbCalled = true;
        }
    }
}