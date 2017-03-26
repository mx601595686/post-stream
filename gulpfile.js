const gulp = require("gulp");
const ts = require("gulp-typescript").createProject('tsconfig.json');
const sourcemaps = require('gulp-sourcemaps');
const mocha = require('gulp-spawn-mocha');

//watch file change
gulp.task('watch', function () {
    gulp.watch(['src/**/*.ts'], ['compile']);
});

//compile TS code
gulp.task("compile", function () {
    return gulp.src('src/**/*.ts')
        .pipe(sourcemaps.init())
        .pipe(ts())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('bin'));
});

//mocha test
gulp.task('test', () =>
    gulp.src('test/**/*.test.js')
        .pipe(mocha({}))
        .once('error', () => {
            process.exit(1);
        })
        .once('end', () => {
            process.exit();
        })
);

gulp.task('test-debug', () =>
    gulp.src('test/**/*.test.js')
        .pipe(mocha({
            debugBrk: 'debug'
        }))
        .once('error', () => {
            process.exit(1);
        })
        .once('end', () => {
            process.exit();
        })
);

