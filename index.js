const childProcess = require("child_process");

const passThruColorizer = s => s;
const defaultColor = findColorPackage(
    "ansi-colors",
    "colorette",
    "chalk",
    "kleur"
) || {
    prompt: passThruColorizer,
    command: passThruColorizer,
    stdout: passThruColorizer,
    stderr: passThruColorizer
};

function findColorPackage(...packages) {
    while (packages.length) {
        const package = packages.shift();
        try {
            return require(package);
        } catch (error) {
            // ignore optional dependencies.
            continue;
        }
    }
    return null;
}

const SUCCESSFUL_EXIT_CODE = 0;

function getStreamDataReducer(capture, quiet, encoding) {
    if (capture) {
        if (quiet) {
            return (acc, chunk) => acc + chunk.toString(encoding);
        }
        return (acc, chunk, stream, colorize) => {
            const s = chunk.toString(encoding);
            stream.write(colorize(s));
            return acc + s;
        };
    } else {
        if (quiet) {
            return null;
        }
        return (acc, chunk, stream, colorize) => {
            const s = chunk.toString(encoding);
            stream.write(colorize(s));
            return null;
        };
    }
}

function escapeSingleQuotes(s) {
    return s.replace(/['\\]/g, m => `\\${m}`);
}

function makeSingleQuoted(s) {
    return `'${escapeSingleQuotes(s)}'`;
}
function safeMakeDoubleQuoted(s) {
    return `"${s}"`;
}

const hasSpacesRe = /\s/;
const hasSingleQuotesRe = /'/;
const hasShellCharsRe = /[&|;!$"\\]/;

function prettyCommand(args) {
    return args
        .map(arg => {
            const hasSpaces = hasSpacesRe.test(arg);
            const hasSingleQuotes = hasSingleQuotesRe.test(arg);
            const hasShellChars = hasShellCharsRe.test(arg);
            if (hasShellChars) {
                return makeSingleQuoted(arg);
            } else if (hasSingleQuotes || hasSpaces) {
                return safeMakeDoubleQuoted(arg);
            }
            return arg;
        })
        .join(" ");
}

function getColorizer(_color) {
    const color = !_color ? {} : _color === true ? defaultColor : _color;
    const colorizer = {
        prompt: color.prompt || color.command || color.gray || color.grey,
        command: color.command || color.gray || color.grey,
        stdout: color.stdout || color.green,
        stderr: color.stderr || color.red
    };
    Object.keys(colorizer).forEach(propName => {
        const method = colorizer[propName] || defaultColor[propName];
        const bindTarget = method ? color : defaultColor;
        if (method) {
            colorizer[propName] =
                (method.bind && method.bind(bindTarget)) ||
                (method.apply && (s => method.apply(bindTarget, [s]))) ||
                method;
        }
    });
    return colorizer;
}

/**
 *
 * @param {Array<String>} command The command to excute, as an array of arguments (starting with
 * the command itself).
 * @param {Object} [config]
 * @param {Object} [config.env={}] An object of environment variables. If not given, the
 * current process's environment is used. If this is given, it **merged**
 * with the current process's environment (overwriting any existing env vars for the child).
 * @param {boolean} [config.capture=true] Whether or not to capture STDOUT and STDERR into
 * in-memory buffers. This is done by default so they can be returned in the fulfillment
 * value, and also used in Errors. However, if the command produces a huge amount of output
 * that you don't actually need, you can set this to false to save the memory.
 * @param {boolean} [config.quiet=false] Default behavior is to write the command being
 * executed, plus STDOUT and STDERR from the child process to this process's output
 * streams. Set this to ``true`` to supress this.
 * @param {Stream} [config.stdin] Optionally, provide a readable stream that will be
 * used as the sub process's STDIN. Otherwise, this process's STDIN is used.
 * @param {String} [config.encoding="utf8"] Optionally, provide the encoding for
 * the STDOUT and STDERR streams from the child process.
 * @param {boolean} [config.propagateSignals=true] By default, SIGINT and SIGTERM signals
 * that terminate the child process are caught and forwarded to the parent process as well.
 * If you set this to `false` instead, those signals will not be forwarded to the parent
 * process.
 * @param {Object|boolean} [config.color=true] An object providing methods that are used to colorize
 * output. This is ignored if `quiet` is true. If `chalk` or `ansi-color` are available,
 * they are used as the defaut colors. If not available, the default will not transform the output
 * at all. If you don't want any colors, pass `false`. Otherwise,
 * use the default or pass in an object which has methods named `prompt`, `command`, `stdout`, and
 * `stderr` to return the colorized versionsof the different parts of the output. If those methods
 * are not available, a series of defaults will be applied, generally reaching to `gray`, `gray`,
 * `green`, and `red` respectively. If these defaults still aren't found, the string will be passed
 * through unmodified.
 *
 * @async
 * @returns A promise to fulfill when the child process completes successfully.
 * Successful completion is considered to be that the process exits with an
 * exit code of 0. When this happens, the promise fulfills with an object that
 * has a `code` property equal to the child process's exit code (therefore, 0).
 * If `capture` is enabled (the default), then the fulfillment value also has
 * `stdout` and `stderr` properties which are the captured output Strings from
 * the process.
 *
 * If the child process fails to launch, if it exits with a non-zero exit code,
 * or if it terminates with an unhandled signal, then the returned promise will
 * reject. If `capture` is enabled, the rejection error will include `stdout`
 * and `stderr` properties containing the captured output Strings from the
 * child process. The error will also have `command`, `args`, and `shellCommand`
 * properties attached to it, giving, respectively, the first command line argument,
 * the remaining command line arguments, and a String meant to represent the command
 * as it might be invoked in the shell (ymmv). If the process exited with a non-zero
 * exit code, this is attached to the error in a `code` property, or if the process
 * exits due to an unhandled signal, the name of the signal is attached to the error
 * in a `signal` property.
 */
module.exports = function justRunThis(
    _args,
    {
        env = {},
        capture = true,
        quiet = false,
        stdin = process.stdin,
        encoding = "utf8",
        propagateSignals = true,
        color: _color = true
    } = {}
) {
    const errorSource = new Error();
    const shellCommand = prettyCommand(_args);
    const [command, ...args] = _args;
    let stdout = null;
    let stderr = null;
    if (capture) {
        stdout = "";
        stderr = "";
    }
    const createError = (error, props = {}) => {
        const errorMessage = error instanceof Error ? error.message : error;
        const e = new Error(errorMessage);
        e.stack = errorSource.stack;
        if (error instanceof Error) {
            e.cause = error;
            e.stack += `\n  caused by: ${error.stack}`;
        }
        e.command = command;
        e.args = args;
        e.shellCommand = shellCommand;
        e.stdout = stdout;
        e.stderr = stderr;
        Object.assign(e, props);
        return e;
    };
    return new Promise((resolve, reject) => {
        const color = getColorizer(_color);
        if (!quiet) {
            console.log(color.prompt("> ") + color.command(shellCommand));
        }
        const outputOpt = capture || !quiet ? "pipe" : "ignore";
        const proc = childProcess.spawn(command, args, {
            stdio: [stdin, outputOpt, outputOpt],
            env: {
                ...process.env,
                ...env
            }
        });
        const streamReducer = getStreamDataReducer(
            capture,
            quiet,
            encoding,
            color
        );
        if (streamReducer) {
            proc.stdout.on("data", chunk => {
                stdout = streamReducer(
                    stdout,
                    chunk,
                    process.stdout,
                    color.stdout
                );
            });
            proc.stderr.on("data", chunk => {
                stderr = streamReducer(
                    stderr,
                    chunk,
                    process.stderr,
                    color.stderr
                );
            });
        }
        proc.on("error", error => reject(createError(error)));
        proc.on("exit", (code, signal) => {
            if (code === SUCCESSFUL_EXIT_CODE) {
                if (capture) {
                    resolve({ code, stdout, stderr });
                } else {
                    resolve({ code });
                }
            } else if (code !== null) {
                reject(
                    createError(
                        `Command process exited with error code ${code}`,
                        { code }
                    )
                );
            } else {
                if (
                    propagateSignals &&
                    (signal === "SIGINT" || signal === "SIGTERM")
                ) {
                    process.kill(process.pid, signal);
                }
                reject(
                    createError(
                        `Command process exited due to signal ${signal}`,
                        { signal }
                    )
                );
            }
        });
    });
};
