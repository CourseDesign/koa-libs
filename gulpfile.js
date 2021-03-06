const fs = require('fs');
const path = require("path");

const { src, dest, series, lastRun } = require('gulp');
const gulpif = require('gulp-if');
const ts = require('gulp-typescript');
const uglify = require('gulp-uglify');
const merge = require('deepmerge')

function getTsconfigName() {
  if (!process.env.NODE_ENV) return 'tsconfig.json';

  const specificConfig = `tsconfig.${process.env.NODE_ENV.toLowerCase()}.json`;
  if (fs.existsSync(specificConfig)) {
    return specificConfig;
  }

  return 'tsconfig.json';
}

function getFinalTsConfig(config, currentPath) {
  const { extends: parentConfigPath, ...rest } = config;

  if (parentConfigPath) {
    const finalParentConfigPath = path.join(currentPath, parentConfigPath);
    const parentProject = ts.createProject(finalParentConfigPath);

    const parentConfig = getFinalTsConfig(parentProject.rawConfig, parentProject.projectDirectory);
    return merge(parentConfig, rest);
  }
  return rest;
}

function getTsconfig(tsProject) {
  return getFinalTsConfig(tsProject.rawConfig, tsProject.projectDirectory)
}

function getTsFilenames(tsProject) {
  const tsconfig = getTsconfig(tsProject);

  const { fileNames, errors } = tsProject.typescript.parseJsonConfigFileContent(
    tsconfig,
    tsProject.typescript.sys,
    path.resolve(tsProject.projectDirectory),
    undefined,
    tsProject.configFileName
  );

  for (const error of errors) {
    console.error(error.messageText);
  }

  return fileNames;
}

const tsProject = ts.createProject(getTsconfigName());
const tsconfig = getTsconfig(tsProject);
const tsFilenames = getTsFilenames(tsProject);

function compile() {
  return src(tsFilenames, { sourcemaps: true, since: lastRun(compile) })
    .pipe(tsProject())
    .pipe(dest(tsconfig.compilerOptions.outDir));
}

function compression() {
  return src(path.join(tsconfig.compilerOptions.outDir, '**/*.js'), { sourcemaps: true, since: lastRun(compression) })
    .pipe(gulpif(process.env.NODE_ENV === 'production', uglify()))
    .pipe(dest(tsconfig.compilerOptions.outDir));
}

const build = series(compile, compression);

exports.default = series(build);