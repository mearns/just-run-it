declare module "just-run-it" {
    export interface JustRunItError extends Error {
        cause?: Error;

        /**
         * The first part of the command line.
         */
        command: string;

        /**
         * The remaining command line arguments, after the first.
         */
        args: string[];

        /**
         * A pretty-printed approximation of the command being executed, including
         * all arguments and custom environment variables. This is, to the best of
         * our abilities, in the form of a bash commmand.
         */
        shellCommand: string;

        stdout: string | null;
        stderr: string | null;
    }

    /**
     *
     * @async
     * @returns A promise that fulfills with an object containing the exit code of the process.
     * If `capture` was enabled, the object will also contain the `stdout` and `stderr` output as
     * strings. See {@link CaptureResult} for more. If `dryRun` is enabled, then the promise will resolve with `undefined`.
     * If it fails, the promise will reject with a {@link JustRunItError}.
     */
    export default function justRunIt(
        args: string[],
        options: {
            /**
             * An object of environment variables to **merge** with those of the current process.
             */
            env?: { [envVarName: string]: string };

            /**
             * Whether or not to capture the child process's STDOUT and STDERR into in-memory Strings.
             * This is done by default so they can be returned in the fulfillment value, and also used
             * in Errors. However, if the command produces a huge amount of output that you don't
             * actually need, you can set this to false to save the memory.
             */
            capture?: boolean;
            quiet?: boolean;
            stdin?: ReadableStream;
            encoding?: string;
            propagateSignals?: boolean;
            color?: boolean | Colorizer;
        }
    ): Promise<undefined | Result | CaptureResult>;

    export interface Result {
        code: number;
    }

    export interface CaptureResult extends Result {
        stdout: string;
        stderr: string;
    }

    export interface Colorizer {
        prompt?: (text: string) => string;
        command?: (text: string) => string;
        stdout?: (text: string) => string;
        stderr?: (text: string) => string;
        gray?: (text: string) => string;
        grey?: (text: string) => string;
        green?: (text: string) => string;
        red?: (text: string) => string;
    }
}
