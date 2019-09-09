#!/usr/bin/env node

import * as fs from 'fs';

import * as tty from 'tty';

import chalk from 'chalk';
import program from 'commander';

import glob from 'glob';

import { createRegistry, runGrammarTestCase, parseGrammarTestCase, GrammarTestCase, TestFailure } from './unit/index';

// var packageJson = require('../package.json');
// .version(process.env.npm_package_version as string)

// * don't forget the '' vscode-tmgrammar-test -s source.dhall -g testcase/dhall.tmLanguage.json -t '**/*.dhall'
program
  .version("0.0.4")
  .description("Run Textmate grammar test cases using vscode-textmate")
  .option('-s, --scope <scope>', 'Language scope, e.g. source.dhall')
  .option('-g, --grammar <grammar>', 'Path to a grammar file, either .json or .xml')
  .option('-t, --testcases <glob>', 'A glob pattern which specifies testcases to run, e.g. \"./tests/**/test*.dhall\". Quotes are important!')
  .option('-c, --compact', 'Display output in the compact format, which is easier to use with VSCode problem matchers')
  .parse(process.argv);


if (program.scope === undefined || program.grammar === undefined || program.testcases === undefined) {
    program.help()
}


let isatty = tty.isatty(1) && tty.isatty(2)

const symbols = {
    ok: '✓',
    err: '✖',
    dot: '․',
    comma: ',',
    bang: '!'
  };
  
if (process.platform === 'win32') {
    symbols.ok = '\u221A';
    symbols.err = '\u00D7';
    symbols.dot = '.';
}

let terminalWidth = 75;
  
if (isatty) {
    terminalWidth = (process.stdout as tty.WriteStream).getWindowSize()[0];
}


const TestFailed = -1
const TestSuccessful = 0
const Padding = "  "

let grammarPaths : { [key: string]: string } = {}

grammarPaths[program.scope] = program.grammar;


const registry = createRegistry(grammarPaths) ; 

function printSourceLine(testCase: GrammarTestCase, failure: TestFailure) {
    const line = testCase.source[failure.srcLine] 
    const pos = (failure.line + 1) + ": "
    const accents = " ".repeat(failure.start) + "^".repeat(failure.end - failure.start)

    const termWidth = terminalWidth - pos.length - Padding.length - 5

    const trimLeft = failure.end > termWidth ? Math.max(0, failure.start - 8) : 0

    const line1 = line.substr(trimLeft)
    const accents1 = accents.substr(trimLeft)

    console.log(Padding + chalk.gray(pos) + line1.substr(0, termWidth)) 
    console.log(Padding +  " ".repeat(pos.length) + accents1.substr(0, termWidth))    
}

function printReason(testCase: GrammarTestCase, failure: TestFailure) {
    if (failure.missing && failure.missing.length > 0) {
        console.log(chalk.red(Padding + "missing required scopes: ") + chalk.gray(failure.missing.join(" ")))
    }
    if (failure.unexpected && failure.unexpected.length > 0) {
        console.log(chalk.red(Padding + "prohibited scopes: ") + chalk.gray(failure.unexpected.join(" ")))
    }
    if (failure.actual !== undefined) {
        console.log(chalk.red(Padding + "actual: ") + chalk.gray(failure.actual.join(" ")))
    }
}

function displayTestResultFull(filename: string, testCase: GrammarTestCase, failures: TestFailure[]): number {
    if (failures.length === 0) {
        console.log(chalk.green(symbols.ok) + " " + chalk.whiteBright(filename) + ` run successfuly.`)
        return TestSuccessful;
    } else {
        console.log(chalk.red(symbols.err + " " + filename + " failed"))
        failures.forEach(failure => {
            const {l,s,e} = getCorrectedOffsets(failure)
            console.log(Padding + "at [" + chalk.whiteBright(`${filename}:${l}:${s}:${e}`) + "]: ")
            printSourceLine(testCase, failure);
            printReason(testCase, failure);
            
            console.log("\n")
        });
        console.log("");
        return TestFailed;
    }
    
}

function renderCompactErrorMsg(testCase: GrammarTestCase, failure: TestFailure): string {
    let res = ""
    if (failure.missing && failure.missing.length > 0) {
        res += `Missing required scopes: [ ${failure.missing.join(" ")} ] `
    }
    if (failure.unexpected && failure.unexpected.length > 0) {
        res += `Prohibited scopes: [ ${failure.unexpected.join(" ")} ] `
    }
    if (failure.actual !== undefined) {
        res += `actual scopes: [${failure.actual.join(" ")}]`
    }
    return res;
}

function displayTestResultCompact(filename: string, testCase: GrammarTestCase, failures: TestFailure[]): number {
    if (failures.length === 0) {
        console.log(chalk.green(symbols.ok) + " " + chalk.whiteBright(filename) + ` run successfuly.`)
        return TestSuccessful;
    } else {
        failures.forEach(failure => {
            console.log(`ERROR ${filename}:${failure.line + 1}:${failure.start + 1}:${failure.end+1} ${renderCompactErrorMsg(testCase, failure)}`)
            
        });
        return TestFailed;
    }
}

function handleGrammarTestError(filename: string, testCase: GrammarTestCase, reason:any): number {
    console.log(chalk.red(symbols.err) + " testcase " + chalk.gray(filename) + " aborted due to an error")
    console.log(reason);
    return TestFailed;
}

const displayTestResult = program.compact ? displayTestResultCompact : displayTestResultFull;

glob(program.testcases, (err,files) => {
    if (err !== null) {
        console.log(chalk.red("ERROR") + " glob pattern is incorrect: '" + chalk.gray(program.testcases) + "'")
        console.log(err)
        process.exit(-1)
    }
    if(files.length === 0) {
        console.log(chalk.red("ERROR") + " no test cases found")
        process.exit(-1)
    }
    const testResults: Promise<number[]> = Promise.all(files.map(filename => {
        let tc: any = undefined;
        try {
            tc = parseGrammarTestCase(fs.readFileSync(filename).toString())
        } catch(error) {
            console.log(chalk.red("ERROR") + " can't parse testcase: " + chalk.whiteBright(filename) + "")
            console.log(error)
            return new Promise((resolve, reject) => { resolve(TestFailed); });
        }
        let testCase = tc as GrammarTestCase;
        return runGrammarTestCase(registry, testCase).then( (failures) => { 
                    return displayTestResult(filename, testCase, failures) 
                }).catch((error: any) => { 
                    return handleGrammarTestError(filename, testCase, error);
                })
          
    }));
    
    testResults.then(xs => {
        const result = xs.reduce( (a,b) => a + b, 0)
        if (result === TestSuccessful) {
            process.exit(0);
        } else {
            process.exit(-1);
        }
    })
   
});


function getCorrectedOffsets(failure: TestFailure): { l:number, s:number, e:number} {
    return {
        l: failure.line + 1,
        s: failure.start + 1,
        e: failure.end + 1
    }
}
