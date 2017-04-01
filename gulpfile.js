const gulp = require("gulp");
const babel = require("gulp-babel");
const sourcemaps = require('gulp-sourcemaps');
const mocha = require('gulp-spawn-mocha');

//watch file change
gulp.task('watch', function () {
    gulp.watch(['src/**/*.js'], ['compile']);
});

//compile code
gulp.task("compile", function () {
    return gulp.src('src/**/*.js')
        //.pipe(sourcemaps.init())
        .pipe(babel())
        //.pipe(sourcemaps.write())
        .pipe(gulp.dest('bin'));
});
