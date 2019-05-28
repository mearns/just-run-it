# just-run-it

A simple and straightforward javascript library for running system commands.

**Warning**: This is a package I wrote to serve my needs on a few different projects: it's manually tested, but there's
not much (or anything) in the way of automated testing, so best of luck to you. Please file issues if you find any,
I'll do my best to address them.

## Overview

This is a slightly opinionated
and not terribly flexible wrapper around Node's `child_process.spawn` function, which makes it simple to
run commands, capture output, stream output, and handle errors, as long as you don't need a lot of flexibility.
If you need more flexibility, definitely just use `spawn`.

## Installation

```console
npm install --save just-run-it
```

## Basic usage

```javascript
const runIt = require("just-run-it");

const { stdout, stderr, code } = await runIt(["node", "--version"]);
```

## Quick Features

If you like these features, awesome. If not, a few of them can be disabled, otherwise use `child_process.spawn` directly.

-   Streams command's STDOUT and STDERR to your own process's (disable with `quiet` option).
-   Captures STDOUT and STDERR to strings for your use (disable with `capture` option).
-   Fails (rejects) if command fails to execute, or terminates with non-zero exit code.
-   Fails (rejects) if command is terminated with unhandled signal.
-   Optionally connect a readable Stream object to command's STDIN.
-   Forwards SIGTERM and SIGINT from child process to calling process (disable with `trapSignals` option).
-   Not processed through the shell (no escaping required).

## API and Options

The package exports a single function which returns a Promise and has with the following signature:

```javascript
runIt(args, [options]);
```

The `args` parameter is an array of strings giving all of the arguments for the child process, starting with
the command itself (this is different from `spawn`, which takes the command separate from it's parameters).

The `options` is parameter is an optional Object you can use to configure a few things.

### Options

<table>
    <tbody>
        <tr>
            <th>Option</th>
            <th>Default</th>
            <th>Description</th>
        <tr>
            <th><code>env</code></th>
            <td><code>{}</code></td>
            <td>An Object of environment variables to _merge_ with the current process's environment (i.e., `process.env`)</td>
        </tr>
        <tr>
            <th><code>capture</code></th>
            <td><code>true</code></td>
            <td>
Whether or not to capture the child process's STDOUT and STDERR into
in-memory Strings. This is done by default so they can be returned in the fulfillment
value, and also used in Errors. However, if the command produces a huge amount of output
that you don't actually need, you can set this to false to save the memory.
            </td>
        </tr>
        <tr>
            <th><code>quiet</code></th>
            <td><code>false</code></td>
            <td>
The default behavior is to write the command being executed, plus STDOUT and STDERR from
the child process to this process's output streams. Set this to `true` to supress this output.
            </td>
        </tr>
        <tr>
            <th><code>stdin</code></th>
            <td><code>process.stdin</code></td>
            <td>
Optionally, provide a readable stream that will be used as the child process's STDIN.
Otherwise, this process's STDIN is used.
            </td>
        </tr>
        <tr>
            <th><code>encoding</code></th>
            <td><code>"utf8"</code></td>
            <td>
Optionally, provide the encoding for the STDOUT and STDERR streams from the child process.
            </td>
        </tr>
        <tr>
            <th><code>propagateSignals</code></th>
            <td><code>true</code></td>
            <td>
By default, SIGINT and SIGTERM signals
that terminate the child process are caught and forwarded to the parent process as well.
If you set this to <code>false</code> instead, those signals will not be forwarded to the parent
process.
            </td>
        </tr>
        <tr>
            <th><code>color</code></th>
            <td><code>true</code></td>
            <td>
            Whether (and how) to colorize output. This is irrelevant if `quiet` is true as no output
            is generated. If set to <code>false</code>, the output is not colorized, it is written
            as is. If <code>true</code> (the default), the output is colorized using a default colorizer
            if available (see below). To provide a custom colorizer, provide an object with appropriate
            methods to transform a string into a "colorized" string, as described in the "Colorization"
            section, below.
            </td>
        </tr>
    </tbody>
</table>

### Return Value

The function returns a Promise which fulfills with an Object. By default (when capture is enabled), the
Object has the following properties:

| Property Name | Description                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `code`        | The exit code of the command, which will always be 0 because otherwise the Promise will reject. |
| `stdout`      | The captured output from the command process's STDOUT stream, as a string.                      |
| `stderr`      | The captured output from the command process's STDERR stream, as a string.                      |

If the `capture` option is false, then the `stdout` and `stderr` properties will not be defined.

### Errors

The Promise returned by the function will reject under _any of_ the following conditions:

1.  The command child process fails to start, i.e., the `ChildProcess` fires an ["error" event](https://nodejs.org/api/child_process.html#child_process_event_error).
2.  The command process exits with a non-zero exit code.
3.  The command process is killed by a signal.

In all cases, the Error that the promise rejects with has the following properties:

| Error property | Description                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command`      | The first element from the given `args`, representing the command that was executed, in isolation from it's parameters.                                                            |
| `args`         | The remaining elements of `args`, representing the parameters passed to the command.                                                                                               |
| `shellCommand` | A "pretty" string representing the command as it might be invoked in the shell. This is only meant for human consumption, no guarantees are made as to the accuracy of the syntax. |
| `stdout`       | The captured STDOUT from the command, or `null` if capture is disabled                                                                                                             |
| `stderr`       | The captured STDERR from the command, or `null` if capture is disabled                                                                                                             |

In the event that the process fails to start (condition 1, above) the Error will also have a `cause` property which is the original `Error` fired by
the `ChildProcess`. In this case the `stack` property of the Error issued by this function has been augmented with the stack of the causing error.

In the event that the command exits with a non-zero exit code (condition 2, above), the Error will have a `code` property containing the exit code of the process.

Lastly, if the command is killed by a signal before it exits (condition 3, above), the Error will have a `signal` property set to the name of the signal that killed the process.

## Colorization

By default, the `color` option (see above) is set to `true`, which will attempt to load a terminal color
library from this packages optional dependencies. Any of the following packages will be loaded if available
(in order of priority, for no particular reason):

1. [ansi-colors](https://www.npmjs.com/package/ansi-colors)
2. [colorette](https://www.npmjs.com/package/colorette)
3. [chalk](https://www.npmjs.com/package/chalk)
4. [kleur](https://www.npmjs.com/package/kleur)

If none of these packages are available, the default colorizer will simply pass through strings untransformed.

You can also provide your own colorization object to the `color` option, which provides a set of prescribed
methods. Each method should be a string transformation, meaning a function that takes a string and returns
a string. Note that the function will be applied to arbitrarily small chunks of the stream data from the command
child process, not necessarily seeing the entire string at one time.

A colorization object (referred to as `c`, below) should provide the following string transformation methods:

| Method Name | Used for                                                                 | Fallbacks                       |
| ----------- | ------------------------------------------------------------------------ | ------------------------------- |
| `prompt`    | The leading "> " before the "shell command" at the start of the command. | `c.command`, `c.gray`, `c.grey` |
| `command`   | The "shell command" that is printed when the command is initialized      | `c.gray`, `c.grey`              |
| `stdout`    | Used to colorize everything from the command process's STDOUT stream     | `c.green`                       |
| `stderr`    | Used to colorize everything from the command process's STDERR stream     | `c.red`                         |

Any methods that are missing will attempt to use the fallback methods as listed, in order. If none of fallbacks are available either,
the method from the default colorizer is used.
