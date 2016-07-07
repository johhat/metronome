var fs = require('fs')
var path = require('path')
var browserSync = require('browser-sync').create()
var browserify = require('browserify');
var watchify = require('watchify')
var tsify = require('tsify');

var sourceFile = path.join(__dirname, 'src/main.ts')
var outFile = path.join(__dirname, 'build/bundle.js')

//Browserify setup
var browserifyInstance = browserify({
  entries: [sourceFile],
  cache: {},
  packageCache: {},
  plugin: [watchify, tsify],
  debug: true //Enables sourcemaps
})

//Browser sync setup
browserSync.init({
  server: './'
})

//Browser sync watching of non-ts-files
browserSync.watch('index.html').on('change', browserSync.reload)
browserSync.watch('css/*.css').on('change', browserSync.reload)

//Bundling and reloading on bundling - fn triggered automatically on change in .ts-files due to watchify+tsify plugins
function bundle() {
  browserifyInstance
    .bundle()
    .on('error', function (error) {
      console.log('Err in fn bundle:', error.toString());
    })
    .pipe(fs.createWriteStream(outFile))

  browserSync.reload(outFile)
}

browserifyInstance.on('update', bundle)

//Initial bundling
bundle()